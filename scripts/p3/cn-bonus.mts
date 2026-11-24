// P3: facts and traps of the China bonus rule, on the circuits read from X Layer.
// Usage: node scripts/p3/cn-bonus.mts <rpc> <timeout-seconds-per-query> <out-dir>
// Needs OSS_CAD_SUITE (Yosys and yosys-abc). Runs on the test host through the resource hook.
//
// 1. Pin a block. Read circuit 9 (decision) and 12 (explanation) at that block and check their
//    keccak-256 against the hashes recorded at tape-out (chain/netlists/*/manifest.json).
// 2. Export each to Verilog from those bytes (prover/src/export.ts).
// 3. Facts, each asked of ABC and of Yosys sat:
//      tax-within-bonus        bad = tax > bonus
//      breakdown-adds-up       bad = tax != tax_before_deduction - quick_deduction  (circuits 9 and 12)
//    and for each a mutant of the rule that must come back "fails".
// 4. raise-never-lowers-take-home: the trap finder over `bonus` on `net` (prover/src/traps.ts),
//    which needs no table. Every edge is replayed in the simulator (inside findTraps) and with
//    eval on chain at the pinned block.
// 5. Only then the published table (Announcement 2023 No. 30, rules/cn-bonus-2023-30/README.md)
//    gives the expected ranges, and the two lists are compared. Any difference fails the run.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { evaluate } from '../../compiler/src/netlist.ts';
import { pack, unpack, type Field } from '../../compiler/src/layout.ts';
import { toVerilog } from '../../prover/src/export.ts';
import { toolsFromEnv } from '../../prover/src/run.ts';
import { findTraps } from '../../prover/src/traps.ts';
import { ask, verdict, type Question } from '../../prover/src/fact.ts';
import { CIRCUITS, latestBlock, readCircuit, rpcAt, type ChainCircuit, type Rpc } from '../../prover/src/chain.ts';
import { CHOSEN, ONLY, toolList } from './common.mts';

const [rpcUrl, timeoutArg, outDir] = process.argv.slice(2);
if (!rpcUrl || !timeoutArg || !outDir) throw new Error('usage: cn-bonus.mts <rpc> <timeout-seconds> <out-dir>');
const TIMEOUT = Number(timeoutArg);
mkdirSync(outDir, { recursive: true });
const tools = toolsFromEnv();
const rpc = rpcAt(rpcUrl);
const started = new Date().toISOString();
// The container's own hostname is a random id; the launcher passes the host alias.
const ranOn = process.env.PAYPROOF_HOST || execFileSync('hostname', { encoding: 'utf8' }).trim();
const toolVersion = execFileSync(tools.yosys, ['-V'], { encoding: 'utf8' }).trim();

const manifest = JSON.parse(readFileSync('chain/netlists/manifest.json', 'utf8'));
const explainManifest = JSON.parse(readFileSync('chain/netlists/explain/manifest.json', 'utf8'));
const ids = JSON.parse(readFileSync('chain/netlists/ids.json', 'utf8'));
const explainIds = JSON.parse(readFileSync('chain/netlists/explain/ids.json', 'utf8'));
const piece = (m: { pieces: { name: string }[] }, n: string) => m.pieces.find((p) => p.name === n) as
  { name: string; keccak256: string; nIn: number; nOut: number; inputs: Field[]; outputs: Field[] };
const DEC = piece(manifest, 'cn_bonus');
const EXP = piece(explainManifest, 'cn_bonus_explain');

const block = await latestBlock(rpc);
console.log(`pinned block ${block}; ${toolVersion}; ran on ${ranOn}`);
const dec = await readCircuit(rpc, BigInt(ids.cn_bonus), block, DEC.keccak256);
const exp = await readCircuit(rpc, BigInt(explainIds.cn_bonus_explain), block, EXP.keccak256);
for (const c of [dec, exp]) console.log(`circuit ${c.ref.id}: keccak ${c.ref.netlistKeccak}, ${c.ref.gateCount} gates, nIn ${c.ref.nIn}, nOut ${c.ref.nOut}`);

const decV = toVerilog(dec.bytes, dec.ref.nIn, dec.ref.nOut, 'cn_dec', dec.refs);
const expV = toVerilog(exp.bytes, exp.ref.nIn, exp.ref.nOut, 'cn_exp', exp.refs);
writeFileSync(join(outDir, 'cn_dec.v'), decV);
writeFileSync(join(outDir, 'cn_exp.v'), expV);

const sim = (c: ChainCircuit, fields: { inputs: Field[]; outputs: Field[] }) => (v: Record<string, bigint>) =>
  unpack(fields.outputs, evaluate(c.bytes, c.ref.nIn, c.ref.nOut, pack(fields.inputs, v, c.ref.nIn), c.refs));
const decSim = sim(dec, DEC);
const expSim = sim(exp, { inputs: DEC.inputs, outputs: EXP.outputs });

// eval(uint256 id, bytes inputs) 0x934d06ea, at the pinned block.
async function onChain(r: Rpc, c: ChainCircuit, fields: { inputs: Field[]; outputs: Field[] }, v: Record<string, bigint>) {
  const input = pack(fields.inputs, v, c.ref.nIn);
  const hex = Array.from(input, (b) => b.toString(16).padStart(2, '0')).join('');
  const data = '0x934d06ea' + BigInt(c.ref.id).toString(16).padStart(64, '0') + (64n).toString(16).padStart(64, '0') +
    input.length.toString(16).padStart(64, '0') + hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
  const ret = (await r('eth_call', [{ to: CIRCUITS, data }, '0x' + block.toString(16)])).replace(/^0x/, '');
  const off = Number(BigInt('0x' + ret.slice(0, 64))) * 2;
  const len = Number(BigInt('0x' + ret.slice(off, off + 64)));
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = parseInt(ret.slice(off + 64 + 2 * i, off + 66 + 2 * i), 16);
  return unpack(fields.outputs, out);
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const records: unknown[] = [];
const circuitsOf = (...cs: ChainCircuit[]) => cs.flatMap((c) => c.read);
const record = (kind: string, factId: string, statement: { en: string; zh: string }, cs: ChainCircuit[],
  domain: string, status: string, extra: Record<string, unknown>) => {
  const r = { kind, ruleId: 'cn-bonus-2023-30', factId, statement, circuits: circuitsOf(...cs), blockNumber: block,
    domain, status, ...extra, tools: toolList(tools.yosys, toolVersion, tools.bitwuzla, tools.z3), ...(ONLY ? { selectedFacts: ONLY } : {}),
    timeoutSeconds: TIMEOUT, ranOn, ranAt: new Date().toISOString() };
  records.push(r);
  writeFileSync(join(outDir, `${factId}.json`), JSON.stringify(r, null, 2) + '\n');
  return r;
};

const answersOut = (q: Question) => q.answers.map((a) => ({ tool: a.tool, status: a.status, seconds: +a.seconds.toFixed(2),
  x: a.x === null ? null : a.x.toString(), command: a.command, tail: a.tail }));

// A fact on the decision circuit, its mutant, and the replay of any counterexample.
async function fact(id: string, statement: { en: string; zh: string }, circuitV: string, q: (inst: string) => string,
  mutantNote: string, mutant: (inst: string) => string, check: (x: bigint) => Promise<boolean>, cs: ChainCircuit[]) {
  if (ONLY && !ONLY.includes(id)) { console.log(`${id}: skipped (PAYPROOF_FACTS)`); return null; }
  const question = q('c');
  writeFileSync(join(outDir, `${id}.q.v`), question);
  const r = ask(tools, circuitV, question, 32, TIMEOUT, CHOSEN ?? true);
  const v = verdict(r);
  let replay: unknown = null;
  if (v === 'fails') {
    const x = r.answers.find((a) => a.x !== null)!.x!;
    replay = { x: x.toString(), brokenInSimulatorAndOnChain: await check(x) };
    if (!(replay as { brokenInSimulatorAndOnChain: boolean }).brokenInSimulatorAndOnChain) throw new Error(`${id}: counterexample ${x} does not replay`);
  }
  const mq = mutant('c');
  writeFileSync(join(outDir, `${id}.mutant.q.v`), mq);
  const m = ask(tools, circuitV, mq, 32, TIMEOUT, CHOSEN ?? false);
  const mv = verdict(m);
  console.log(`${id}: ${v} (${r.answers.map((a) => `${a.tool} ${a.status} ${a.seconds.toFixed(1)}s`).join(', ')}); mutant ${mv}`);
  if (mv !== 'fails') throw new Error(`${id}: the mutant did not fail (${mv}), so the question cannot tell a broken rule`);
  return record('fact', id, statement, cs, 'every 32-bit bonus (no validity circuit, owner decision 2026-11-22)', v, {
    questionSha256: sha(question), aigSha256: r.aigSha256, smt2Sha256: r.smt2Sha256, answers: answersOut(r), counterexample: replay,
    mutant: { note: mutantNote, questionSha256: sha(mq), aigSha256: m.aigSha256, smt2Sha256: m.smt2Sha256, status: mv, answers: answersOut(m) } });
}

// Decision outputs: tax = out[31:0], net = out[63:32].
const decInst = (n: string, x = 'x', tax = 'tax', net = 'net') =>
  `  wire [63:0] o_${n};\n  cn_dec ${n} (.in(${x}), .out(o_${n}));\n  wire [31:0] ${tax} = o_${n}[31:0];\n  wire [31:0] ${net} = o_${n}[63:32];\n`;

await fact('tax-within-bonus', { en: 'The tax on a bonus is never more than the bonus', zh: '年终奖的税额不会超过年终奖本身' }, decV,
  (n) => `module q (input [31:0] x, output bad);\n${decInst(n)}  assign bad = tax > x;\nendmodule\n`,
  'tax is replaced by bonus + 1 when the bonus is 100 fen',
  (n) => `module q (input [31:0] x, output bad);\n${decInst(n, 'x', 'tax0')}  wire [31:0] tax = (x == 32'd100) ? 32'd101 : tax0;\n  assign bad = tax > x;\nendmodule\n`,
  async (x) => decSim({ bonus: x }).tax > x && (await onChain(rpc, dec, DEC, { bonus: x })).tax > x, [dec]);

// Explanation outputs: bracket [2:0], rate [9:3], quick_deduction [30:10], tax_before_deduction [62:31].
const both = `${decV}\n${expV}`;
const breakdown = (n: string, mutate: boolean) => `module q (input [31:0] x, output bad);\n${decInst(n, 'x', mutate ? 'tax0' : 'tax')}` +
  (mutate ? `  wire [31:0] tax = (x == 32'd5000000) ? tax0 + 32'd1 : tax0;\n` : '') +
  `  wire [62:0] e;\n  cn_exp ce (.in(x), .out(e));\n  wire [20:0] qd = e[30:10];\n  wire [31:0] tbd = e[62:31];\n` +
  `  assign bad = ({1'b0, tax} != ({1'b0, tbd} - {12'd0, qd}));\nendmodule\n`;
await fact('breakdown-adds-up', { en: 'The tax equals the tax before the quick deduction minus the quick deduction', zh: '税额等于扣除速算扣除数之前的税额减去速算扣除数' }, both,
  (n) => breakdown(n, false), 'tax is raised by one fen when the bonus is 50,000.00 yuan', (n) => breakdown(n, true),
  async (x) => { const t = decSim({ bonus: x }).tax; const e = expSim({ bonus: x }); return t !== e.tax_before_deduction - e.quick_deduction; },
  [dec, exp]);

// With PAYPROOF_FACTS set, only the selected facts run: no trap search.
if (ONLY) {
  writeFileSync(join(outDir, 'records.json'), JSON.stringify({ started, finished: new Date().toISOString(), block, records }, null, 2) + '\n');
  console.log(`ALL CHECKS PASSED (selected facts only: ${ONLY.join(', ')})`);
  process.exit(0);
}

// raise-never-lowers-take-home, by the trap finder, from the circuit alone.
const t0 = Date.now();
const traps = findTraps(tools, decV, 'cn_dec', dec.ref.nIn, dec.ref.nOut, DEC.inputs, DEC.outputs, 'bonus', 'net', {}, decSim, TIMEOUT);
const trapSeconds = (Date.now() - t0) / 1000;
for (const t of traps.ranges) {
  const a = await onChain(rpc, dec, DEC, { bonus: BigInt(t.edge) });
  const b = await onChain(rpc, dec, DEC, { bonus: BigInt(t.from) });
  const c = await onChain(rpc, dec, DEC, { bonus: BigInt(t.to) });
  if (!(b.net < a.net && c.net < a.net)) throw new Error(`trap ${t.from}..${t.to} does not replay with eval on chain`);
  (t as Record<string, unknown>).onChain = { netAtEdge: a.net.toString(), netAtFrom: b.net.toString(), netAtTo: c.net.toString() };
}
console.log(`traps: ${traps.ranges.map((t) => `${t.from}..${t.to}`).join(', ')}; complete ${traps.complete}; ${traps.queries.length} queries, ${trapSeconds.toFixed(1)} s`);

// Expected ranges from the published table, written only now.
const TABLE: [bigint, bigint, bigint][] = [ // 12 x monthly limit (fen), rate %, quick deduction (fen)
  [3600000n, 3n, 0n], [14400000n, 10n, 21000n], [30000000n, 20n, 141000n], [42000000n, 25n, 266000n],
  [66000000n, 30n, 441000n], [96000000n, 35n, 716000n], [(1n << 32n) - 1n, 45n, 1516000n]];
const netPublished = (b: bigint) => { const [, r, qd] = TABLE.find(([lim]) => b <= lim)!; return b - (b * r / 100n - qd); };
const expected = TABLE.slice(0, 6).map(([lim], i) => {
  const at = netPublished(lim);
  let lo = lim + 1n, hi = TABLE[i + 1][0];             // net rises inside the next row, so search it
  if (netPublished(lo) >= at) throw new Error(`published table has no drop after ${lim}`);
  while (lo < hi) { const m = (lo + hi + 1n) / 2n; if (netPublished(m) < at) lo = m; else hi = m - 1n; }
  return { from: (lim + 1n).toString(), to: lo.toString() };
});
const found = traps.ranges.map((t) => ({ from: t.from, to: t.to }));
const match = JSON.stringify(found) === JSON.stringify(expected);
console.log(`published table: ${expected.map((t) => `${t.from}..${t.to}`).join(', ')}; match ${match}`);
record('fact', 'raise-never-lowers-take-home', { en: 'A bigger bonus never leaves you with less after tax', zh: '年终奖越高，税后到手不会更少' }, [dec],
  'every 32-bit bonus', traps.ranges.length ? 'fails' : (traps.complete ? 'holds' : 'undecided'), {
    method: 'trap finder (prover/src/traps.ts): edge query, then binary-search widening, each by ABC iprove',
    traps: { over: 'bonus', result: 'net', ranges: traps.ranges, complete: traps.complete, seconds: trapSeconds,
      queries: traps.queries.map((q) => ({ ...q, seconds: +q.seconds.toFixed(2) })) },
    publishedTable: { source: 'Announcement 2023 No. 30, attachment (rules/cn-bonus-2023-30/README.md)', expected, match } });

writeFileSync(join(outDir, 'records.json'), JSON.stringify({ started, finished: new Date().toISOString(), block, records }, null, 2) + '\n');
if (!match) { console.error('FAIL: the traps found in the circuit differ from the published table'); process.exit(1); }
console.log('ALL CHECKS PASSED');
