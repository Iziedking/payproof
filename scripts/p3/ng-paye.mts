// P3: facts of the Nigeria pay tax rule (PLAN 11.1), on circuits 10 and 11 read from X Layer.
// Usage: node scripts/p3/ng-paye.mts <rpc> <timeout-seconds-per-query> <out-dir>
//
// Facts (every input is valid: no validity circuit, owner decision 2026-11-22):
//   tax-within-income             annual_tax <= gross
//   more-pay-more-tax             same deductions, more gross: annual_tax never smaller
//   raise-never-lowers-take-home  same deductions, more gross: gross - annual_tax never smaller
//                                 (expected to FAIL just above the minimum wage, README "Open points");
//                                 then the trap finder over gross with every deduction 0
//   relief-never-raises-tax       same gross, every deduction at least as big: annual_tax never bigger
//   breakdown-adds-up             chargeable == band1 + ... + band6 and
//                                 annual_tax == exempt ? 0 : floor((15 b2 + 18 b3 + 21 b4 + 23 b5 + 25 b6) / 100)
// Each fact that holds has a mutant of the rule that must come back "fails".
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { toVerilog } from '../../prover/src/export.ts';
import { findTraps } from '../../prover/src/traps.ts';
import { ONLY, setup, type Piece } from './common.mts';

const run = await setup('ng-paye-nta2025', ...(process.argv.slice(2) as [string, string, string]));
const dec = await run.circuit('ng_paye');
const exp = await run.circuit('ng_paye_explain');
const decV = toVerilog(dec.c.bytes, dec.c.ref.nIn, dec.c.ref.nOut, 'ng_dec', dec.c.refs);
const expV = toVerilog(exp.c.bytes, exp.c.ref.nIn, exp.c.ref.nOut, 'ng_exp', exp.c.refs);
writeFileSync(join(run.outDir, 'ng_dec.v'), decV);
writeFileSync(join(run.outDir, 'ng_exp.v'), expV);
const DOMAIN = 'every input (no validity circuit, owner decision 2026-11-22)';
const F = dec.piece.inputs;   // gross, pension, nhf, nhis, life, mortgage, rent; 195 bits

/** Field values of a 195-bit input vector. */
const fields = (v: bigint, p: Piece = dec.piece) =>
  Object.fromEntries(p.inputs.map((f) => [f.name, (v >> BigInt(f.offset)) & ((1n << BigInt(f.width)) - 1n)]));
const mask = (w: number) => (1n << BigInt(w)) - 1n;
const tax = async (v: Record<string, bigint>) => {
  const s = dec.sim(v).annual_tax; const o = (await run.onChain(dec.c, dec.piece, v)).annual_tax;
  if (s !== o) throw new Error(`simulator ${s} and eval on chain ${o} differ at ${JSON.stringify(v, (_, x) => String(x))}`);
  return s;
};
const show = (v: Record<string, bigint>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.toString()]));

// Verilog pieces. Decision out: annual_tax [29:0], monthly_tax [56:30].
const D = (n: string, inp: string) => `  wire [56:0] o_${n}; ng_dec ${n} (.in(${inp}), .out(o_${n}));\n  wire [29:0] t_${n} = o_${n}[29:0];\n`;
const Q = (w: number, body: string) => `module q (input [${w - 1}:0] x, output bad);\n${body}endmodule\n`;

await run.fact({ id: 'tax-within-income', statement: { en: 'The yearly tax is never more than the yearly gross pay', zh: '年度税额不会超过年度总收入' },
  domain: DOMAIN, circuitV: decV, width: 195, cs: [dec.c],
  question: Q(195, `${D('c', 'x')}  assign bad = t_c > x[29:0];\n`),
  mutant: { note: 'tax is replaced by gross + 1 when gross is N1,000',
    question: Q(195, `${D('c', 'x')}  wire [29:0] t = (x[29:0] == 30'd1000) ? 30'd1001 : t_c;\n  assign bad = t > x[29:0];\n`) },
  replay: async (x) => { const v = fields(x); return (await tax(v)) > v.gross ? { input: show(v) } : null; } });

// Two incomes with the same deductions: x[194:0] is the first input, x[224:195] the second gross.
const twoGross = (pre: string) => `  wire [29:0] g2 = x[224:195];\n${D('c1', 'x[194:0]')}${D('c2', '{x[194:30], g2}')}${pre}`;
const replayTwo = (broken: (g1: bigint, t1: bigint, g2: bigint, t2: bigint) => boolean) => async (x: bigint) => {
  const v1 = fields(x & mask(195)); const v2 = { ...v1, gross: (x >> 195n) & mask(30) };
  const t1 = await tax(v1); const t2 = await tax(v2);
  return v1.gross < v2.gross && broken(v1.gross, t1, v2.gross, t2) ? { first: show(v1), second: show(v2), taxFirst: String(t1), taxSecond: String(t2) } : null;
};

await run.fact({ id: 'more-pay-more-tax', statement: { en: 'With the same deductions, more pay never means less tax', zh: '扣除项相同时，收入越高，税额不会更少' },
  domain: DOMAIN, circuitV: decV, width: 225, cs: [dec.c],
  question: Q(225, `${twoGross('')}  assign bad = (x[29:0] < g2) && (t_c2 < t_c1);\n`),
  mutant: { note: 'tax is set to 0 when gross is N2,000,000',
    question: Q(225, `${twoGross("  wire [29:0] u2 = (g2 == 30'd2000000) ? 30'd0 : t_c2;\n")}  assign bad = (x[29:0] < g2) && (u2 < t_c1);\n`) },
  replay: replayTwo((_g1, t1, _g2, t2) => t2 < t1) });

await run.fact({ id: 'raise-never-lowers-take-home', statement: { en: 'With the same deductions, a raise never leaves you with less after tax', zh: '扣除项相同时，加薪后税后收入不会更少' },
  domain: DOMAIN, circuitV: decV, width: 225, cs: [dec.c], mutant: null,
  question: Q(225, `${twoGross('')}  assign bad = (x[29:0] < g2) && (({1'b0, g2} - {1'b0, t_c2}) < ({1'b0, x[29:0]} - {1'b0, t_c1}));\n`),
  replay: replayTwo((g1, t1, g2, t2) => g2 - t2 < g1 - t1) });

// Same gross, every deduction at least as big. x[194:0] is the first input; x[359:195] the
// second input's deductions (pension, nhf, nhis, life, mortgage: 27 bits each; rent: 30 bits).
const ge = `  wire [164:0] d2 = x[359:195];\n  wire ge = (d2[26:0] >= x[56:30]) && (d2[53:27] >= x[83:57]) && (d2[80:54] >= x[110:84]) &&\n` +
  `            (d2[107:81] >= x[137:111]) && (d2[134:108] >= x[164:138]) && (d2[164:135] >= x[194:165]);\n` +
  D('c1', 'x[194:0]') + D('c2', '{d2, x[29:0]}');
await run.fact({ id: 'relief-never-raises-tax', statement: { en: 'Claiming more of any relief or deduction never raises the tax', zh: '多申报任何一项减免或扣除，税额不会因此增加' },
  domain: DOMAIN, circuitV: decV, width: 360, cs: [dec.c],
  question: Q(360, `${ge}  assign bad = ge && (t_c2 > t_c1);\n`),
  mutant: { note: 'tax is raised by N1,000 when the rent is N1,000,000',
    question: Q(360, `${ge}  wire [29:0] u2 = (d2[164:135] == 30'd1000000) ? t_c2 + 30'd1000 : t_c2;\n  assign bad = ge && (u2 > t_c1);\n`) },
  replay: async (x) => {
    const v1 = fields(x & mask(195)); const v2 = fields(((x >> 195n) << 30n) | (x & mask(30)));
    const ok = F.slice(1).every((f) => v2[f.name] >= v1[f.name]) && v2.gross === v1.gross;
    const t1 = await tax(v1); const t2 = await tax(v2);
    return ok && t2 > t1 ? { first: show(v1), second: show(v2), taxFirst: String(t1), taxSecond: String(t2) } : null;
  } });

// Explanation out: chargeable [80:51], exempt [81], band1 [101:82], band2 [123:102], band3 [147:124],
// band4 [171:148], band5 [196:172], band6 [226:197].
const bd = (mut: string) => `${D('c', 'x')}${mut}  wire [226:0] e; ng_exp ce (.in(x), .out(e));\n` +
  `  wire [39:0] b1 = e[101:82], b2 = e[123:102], b3 = e[147:124], b4 = e[171:148], b5 = e[196:172], b6 = e[226:197];\n` +
  `  wire [39:0] ch = e[80:51];\n  wire [39:0] bandTax = (40'd15 * b2 + 40'd18 * b3 + 40'd21 * b4 + 40'd23 * b5 + 40'd25 * b6) / 40'd100;\n` +
  `  wire [39:0] want = e[81] ? 40'd0 : bandTax;\n  assign bad = (b1 + b2 + b3 + b4 + b5 + b6 != ch) || ({10'd0, t} != want);\n`;
await run.fact({ id: 'breakdown-adds-up', statement: { en: 'The bands add up to the chargeable income, and the tax is the sum of each band times its rate', zh: '各税级收入之和等于应纳税所得额，税额等于各税级收入乘以税率之和' },
  domain: DOMAIN, circuitV: `${decV}\n${expV}`, width: 195, cs: [dec.c, exp.c],
  question: Q(195, bd('  wire [29:0] t = t_c;\n')),
  mutant: { note: 'tax is raised by N1 when gross is N5,000,000', question: Q(195, bd("  wire [29:0] t = (x[29:0] == 30'd5000000) ? t_c + 30'd1 : t_c;\n")) },
  replay: async (x) => {
    const v = fields(x); const t = await tax(v); const e = exp.sim(v);
    const sum = e.band1 + e.band2 + e.band3 + e.band4 + e.band5 + e.band6;
    const want = e.exempt ? 0n : (15n * e.band2 + 18n * e.band3 + 21n * e.band4 + 23n * e.band5 + 25n * e.band6) / 100n;
    return sum !== e.chargeable || t !== want ? { input: show(v), tax: String(t), want: String(want) } : null;
  } });

// With PAYPROOF_FACTS set, only the selected facts run: no trap search.
if (ONLY) { run.finish(); console.log(`ALL CHECKS PASSED (selected facts only: ${ONLY.join(', ')})`); process.exit(0); }

// Traps of raise-never-lowers-take-home over gross, every deduction 0, from the circuit alone.
// The decision circuit gives tax, not take-home, so it is wrapped: out = gross - annual_tax
// (tax-within-income above shows this never goes below zero).
const netV = `${decV}\nmodule ng_net (input [194:0] in, output [30:0] out);\n  wire [56:0] o; ng_dec d (.in(in), .out(o));\n` +
  `  assign out = {1'b0, in[29:0]} - {1'b0, o[29:0]};\nendmodule\n`;
const ZERO = { pension: 0n, nhf: 0n, nhis: 0n, life: 0n, mortgage: 0n, rent: 0n };
const net = (v: Record<string, bigint>) => ({ net: v.gross - dec.sim({ ...ZERO, ...v }).annual_tax });
const t0 = Date.now();
const traps = findTraps(run.tools, netV, 'ng_net', 195, 31, F, [{ name: 'net', offset: 0, width: 31 }], 'gross', 'net', ZERO, net, run.timeout);
const trapSeconds = (Date.now() - t0) / 1000;
for (const t of traps.ranges) {
  const at = async (g: bigint) => g - (await tax({ gross: g, ...ZERO }));
  const [a, b, c] = [await at(BigInt(t.edge)), await at(BigInt(t.from)), await at(BigInt(t.to))];
  if (!(b < a && c < a)) throw new Error(`trap ${t.from}..${t.to} does not replay with eval on chain`);
  (t as Record<string, unknown>).onChain = { takeHomeAtEdge: String(a), takeHomeAtFrom: String(b), takeHomeAtTo: String(c) };
}
console.log(`traps: ${traps.ranges.map((t) => `${t.from}..${t.to}`).join(', ')}; complete ${traps.complete}; ${traps.queries.length} queries, ${trapSeconds.toFixed(1)} s`);

// Expected, written only now, from the rule as the README states it (our reading, D3 and D4).
const ref = (g: bigint) => {
  if (g <= 840000n) return g;
  const bands: [bigint, bigint, bigint][] = [[800000n, 3000000n, 15n], [3000000n, 12000000n, 18n], [12000000n, 25000000n, 21n],
    [25000000n, 50000000n, 23n], [50000000n, 1n << 40n, 25n]];
  let h = 0n;
  for (const [lo, hi, r] of bands) if (g > lo) h += ((g < hi ? g : hi) - lo) * r;
  return g - h / 100n;
};
// Take-home rises by at least 1 - 0.25 a naira above the cliff and the tax is floored once, so the
// only drop is at the minimum wage; its end is where take-home is back to its value at N840,000.
let lo = 840001n, hi = 3000000n;
if (ref(lo) >= ref(840000n)) throw new Error('the README formula has no drop at the minimum wage');
while (lo < hi) { const m = (lo + hi + 1n) / 2n; if (ref(m) < ref(840000n)) lo = m; else hi = m - 1n; }
const expected = [{ from: '840001', to: lo.toString() }];
const found = traps.ranges.map((t) => ({ from: t.from, to: t.to }));
const match = JSON.stringify(found) === JSON.stringify(expected);
console.log(`README formula: ${expected.map((t) => `${t.from}..${t.to}`).join(', ')}; match ${match}`);
const rec = run.records.find((r) => (r as { factId: string }).factId === 'raise-never-lowers-take-home') as Record<string, unknown>;
Object.assign(rec, { traps: { over: 'gross', result: 'gross - annual_tax', fixed: 'every deduction 0', ranges: traps.ranges,
  complete: traps.complete, seconds: trapSeconds, queries: traps.queries.map((q) => ({ ...q, seconds: +q.seconds.toFixed(2) })) },
  expectedFromReadme: { note: 'rules/ng-paye-nta2025/README.md, our reading of section 162 (1) (t) and the Fourth Schedule (D3, D4)', expected, match } });
writeFileSync(join(run.outDir, 'raise-never-lowers-take-home.json'), JSON.stringify(rec, null, 2) + '\n');
run.finish();
if (!match) { console.error('FAIL: the traps found in the circuit differ from the README formula'); process.exit(1); }
console.log('ALL CHECKS PASSED');
