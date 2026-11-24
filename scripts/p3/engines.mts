// P3: engine equality on X Layer (PLAN section 13, P3; prover rules 1 to 5 of section 11.2).
// Usage: node scripts/p3/engines.mts <rpc> <timeout-seconds> <out-dir>
// Needs OSS_CAD_SUITE. Runs on the test host through the resource hook, after the owner has taped
// out the SIMULATED engines in chain/netlists/engines and `tapeout-plan.mts landed` has written
// their ids to chain/netlists/engines/ids.json.
//
// 1. Pin a block. Read circuit 9 (the reference) and each engine at that block, and check every
//    keccak against the files that were taped out.
// 2. Export each to Verilog from those bytes and ask "is there a bonus where the engine's tax or
//    net differs from the reference?" of ABC, Yosys sat and Bitwuzla (rule 4: a "holds" needs a
//    second tool).
// 3. Any input found is replayed in the simulator and with eval on chain for both circuits
//    (rule 3). A disproof says only that the two circuits differ for a valid input (PLAN L7).
// 4. Mutant (rule 5): the same question with the engine's tax raised by one fen at a bonus of
//    50,000.00 yuan must come back "differs".
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pack, unpack, type Field } from '../../compiler/src/layout.ts';
import { evaluate } from '../../compiler/src/netlist.ts';
import { toVerilog } from '../../prover/src/export.ts';
import { toolsFromEnv } from '../../prover/src/run.ts';
import { ask, verdict, type Question } from '../../prover/src/fact.ts';
import { CIRCUITS, latestBlock, readCircuit, rpcAt, type ChainCircuit } from '../../prover/src/chain.ts';

const [rpcUrl, timeoutArg, outDir] = process.argv.slice(2);
if (!rpcUrl || !timeoutArg || !outDir) throw new Error('usage: engines.mts <rpc> <timeout-seconds> <out-dir>');
const TIMEOUT = Number(timeoutArg);
mkdirSync(outDir, { recursive: true });
const tools = toolsFromEnv();
const rpc = rpcAt(rpcUrl);
const ranOn = process.env.PAYPROOF_HOST || execFileSync('hostname', { encoding: 'utf8' }).trim();
const toolVersion = execFileSync(tools.yosys, ['-V'], { encoding: 'utf8' }).trim();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
type Piece = { name: string; label?: string; keccak256: string; nIn: number; nOut: number; inputs: Field[]; outputs: Field[] };

const refManifest = JSON.parse(readFileSync('chain/netlists/manifest.json', 'utf8'));
const refIds = JSON.parse(readFileSync('chain/netlists/ids.json', 'utf8'));
const engManifest = JSON.parse(readFileSync('chain/netlists/engines/manifest.json', 'utf8'));
const engIds = JSON.parse(readFileSync('chain/netlists/engines/ids.json', 'utf8'));
const REF: Piece = refManifest.pieces.find((p: Piece) => p.name === 'cn_bonus');

const block = await latestBlock(rpc);
console.log(`pinned block ${block}; ${toolVersion}; ran on ${ranOn}`);
const ref = await readCircuit(rpc, BigInt(refIds.cn_bonus), block, REF.keccak256);
const refV = toVerilog(ref.bytes, ref.ref.nIn, ref.ref.nOut, 'cn_ref', ref.refs);
writeFileSync(join(outDir, 'cn_ref.v'), refV);
console.log(`reference circuit ${ref.ref.id}: keccak ${ref.ref.netlistKeccak}, ${ref.ref.gateCount} gates`);

const simOf = (c: ChainCircuit) => (bonus: bigint) =>
  unpack(REF.outputs, evaluate(c.bytes, c.ref.nIn, c.ref.nOut, pack(REF.inputs, { bonus }, c.ref.nIn), c.refs));
async function evalOnChain(c: ChainCircuit, bonus: bigint) {
  const input = pack(REF.inputs, { bonus }, c.ref.nIn);
  const hex = Array.from(input, (b) => b.toString(16).padStart(2, '0')).join('');
  const data = '0x934d06ea' + BigInt(c.ref.id).toString(16).padStart(64, '0') + (64n).toString(16).padStart(64, '0') +
    input.length.toString(16).padStart(64, '0') + hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
  const ret = (await rpc('eth_call', [{ to: CIRCUITS, data }, '0x' + block.toString(16)])).replace(/^0x/, '');
  const off = Number(BigInt('0x' + ret.slice(0, 64))) * 2;
  const len = Number(BigInt('0x' + ret.slice(off, off + 64)));
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = parseInt(ret.slice(off + 64 + 2 * i, off + 66 + 2 * i), 16);
  return unpack(REF.outputs, out);
}
const answersOut = (q: Question) => q.answers.map((a) => ({ tool: a.tool, status: a.status, seconds: +a.seconds.toFixed(2),
  x: a.x === null ? null : a.x.toString(), command: a.command, tail: a.tail }));

const question = (mutate: boolean) => `module q (input [31:0] x, output bad);\n  wire [63:0] a, b0;\n` +
  `  cn_ref r (.in(x), .out(a));\n  cn_eng e (.in(x), .out(b0));\n` +
  (mutate ? `  wire [63:0] b = (x == 32'd5000000) ? {b0[63:32], b0[31:0] + 32'd1} : b0;\n` : `  wire [63:0] b = b0;\n`) +
  `  assign bad = a != b;\nendmodule\n`;

const records: unknown[] = [];
let allOk = true;
for (const p of engManifest.pieces as (Piece & { label: string })[]) {
  if (!engIds[p.name]) throw new Error(`${p.name}: no circuit id in chain/netlists/engines/ids.json`);
  const eng = await readCircuit(rpc, BigInt(engIds[p.name]), block, p.keccak256);
  const engV = toVerilog(eng.bytes, eng.ref.nIn, eng.ref.nOut, 'cn_eng', eng.refs);
  writeFileSync(join(outDir, `${p.name}.v`), engV);
  const circuitV = `${refV}\n${engV}`;
  const q = question(false);
  writeFileSync(join(outDir, `${p.name}.q.v`), q);
  const r = ask(tools, circuitV, q, 32, TIMEOUT, ['abc-iprove', 'yosys-sat', 'smt-bitwuzla']);
  const v = verdict(r);   // holds = equal for every bonus; fails = an input where they differ
  let counterexample: Record<string, string> | null = null;
  if (v === 'fails') {
    const x = r.answers.find((a) => a.x !== null)!.x!;
    const [sr, se, cr, ce] = [simOf(ref)(x), simOf(eng)(x), await evalOnChain(ref, x), await evalOnChain(eng, x)];
    if (sr.tax !== cr.tax || se.tax !== ce.tax) throw new Error(`${p.name}: simulator and eval on chain differ at ${x}`);
    if (cr.tax === ce.tax && cr.net === ce.net) throw new Error(`${p.name}: input ${x} does not replay as a difference on chain`);
    counterexample = { bonusFen: x.toString(), referenceTax: cr.tax.toString(), engineTax: ce.tax.toString(),
      referenceNet: cr.net.toString(), engineNet: ce.net.toString() };
  }
  const mq = question(true);
  writeFileSync(join(outDir, `${p.name}.mutant.q.v`), mq);
  const m = ask(tools, circuitV, mq, 32, TIMEOUT, false);
  if (verdict(m) !== 'fails') { allOk = false; console.error(`${p.name}: the mutant was not caught (${verdict(m)})`); }
  const status = v === 'holds' ? 'equal' : v === 'fails' ? 'differs' : 'undecided';
  console.log(`${p.name} (${p.label}): ${status} (${r.answers.map((a) => `${a.tool} ${a.status} ${a.seconds.toFixed(1)}s`).join(', ')})` +
    (counterexample ? `; bonus ${counterexample.bonusFen} fen: reference tax ${counterexample.referenceTax}, engine tax ${counterexample.engineTax} (eval on chain)` : '') +
    `; mutant ${verdict(m)}`);
  const rec = { kind: 'equality', ruleId: 'cn-bonus-2023-30', engine: p.name, label: p.label, simulated: true,
    statement: { en: `${p.label} gives the same tax and take-home as the rule for every bonus`,
      zh: `${p.label}（模拟引擎）对每一笔奖金给出的税额和到手金额都与规则相同` },
    circuits: [...ref.read, ...eng.read], blockNumber: block, domain: 'every 32-bit bonus (no validity circuit, owner decision 2026-11-22)',
    status: v, result: status, questionSha256: sha(q), aigSha256: r.aigSha256, smt2Sha256: r.smt2Sha256, answers: answersOut(r), counterexample,
    mutant: { note: "engine's tax raised by one fen at a bonus of 50,000.00 yuan", questionSha256: sha(mq), status: verdict(m), answers: answersOut(m) },
    tools: [{ name: 'yosys', version: toolVersion }, { name: 'yosys-abc', version: 'bundled with the same OSS CAD Suite 2026-10-29' },
      { name: 'bitwuzla', version: execFileSync(tools.bitwuzla!, ['--version'], { encoding: 'utf8' }).trim() + ' (OSS CAD Suite 2026-10-29)' }],
    timeoutSeconds: TIMEOUT, ranOn, ranAt: new Date().toISOString() };
  records.push(rec);
  writeFileSync(join(outDir, `${p.name}.json`), JSON.stringify(rec, null, 2) + '\n');
}
writeFileSync(join(outDir, 'records.json'), JSON.stringify({ block, records }, null, 2) + '\n');
if (!allOk) process.exit(1);
console.log('ALL CHECKS PASSED');
