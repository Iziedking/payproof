// P4: the split-v1 fee circuit on X Layer, proved on the bytes the chain holds (as for every
// other circuit; the same fact was proved on the file before tape-out by fee-prepare.mts).
// Usage: node scripts/p4/fee-onchain.mts <rpc> <timeout-seconds> <out-dir>
// Needs OSS_CAD_SUITE. Runs on the test host through the resource hook, after the owner's tape-out
// and `tapeout-plan.mts landed` have written the id to chain/netlists/fee/ids.json.
//
// 1. Pin a block. Read the fee circuit at that block and check its keccak against the file.
// 2. eval on chain at fixed pots and compare with floor(pot / 10) and with the simulator.
// 3. Ask `fee-is-fixed`: for every 32-bit pot, fee x 10000 <= pot x 1000 < (fee + 1) x 10000
//    (fee = floor(pot x 1000 / 10000), owner decision D17) of ABC iprove, Yosys sat and Bitwuzla.
//    A "holds" needs a second tool. Any counterexample is replayed with eval on chain.
// 4. Mutant: fee one higher at a pot of 5,000,000 base units must come back "fails".
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pack, unpack, type Field } from '../../compiler/src/layout.ts';
import { evaluate } from '../../compiler/src/netlist.ts';
import { toVerilog } from '../../prover/src/export.ts';
import { toolsFromEnv } from '../../prover/src/run.ts';
import { ask, verdict, type Question } from '../../prover/src/fact.ts';
import { CIRCUITS, latestBlock, readCircuit, rpcAt } from '../../prover/src/chain.ts';

const [rpcUrl, timeoutArg, outDir] = process.argv.slice(2);
if (!rpcUrl || !timeoutArg || !outDir) throw new Error('usage: fee-onchain.mts <rpc> <timeout-seconds> <out-dir>');
const TIMEOUT = Number(timeoutArg);
mkdirSync(outDir, { recursive: true });
const tools = toolsFromEnv();
const rpc = rpcAt(rpcUrl);
const ranOn = process.env.PAYPROOF_HOST || execFileSync('hostname', { encoding: 'utf8' }).trim();
const toolVersion = execFileSync(tools.yosys, ['-V'], { encoding: 'utf8' }).trim();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const manifest = JSON.parse(readFileSync('chain/netlists/fee/manifest.json', 'utf8'));
const ids = JSON.parse(readFileSync('chain/netlists/fee/ids.json', 'utf8'));
const P: { keccak256: string; inputs: Field[]; outputs: Field[] } = manifest.pieces.find((p: { name: string }) => p.name === 'split_fee');
if (!ids.split_fee) throw new Error('no split_fee id in chain/netlists/fee/ids.json');

const block = await latestBlock(rpc);
console.log(`pinned block ${block}; ${toolVersion}; ran on ${ranOn}`);
const c = await readCircuit(rpc, BigInt(ids.split_fee), block, P.keccak256);
console.log(`fee circuit ${c.ref.id}: keccak ${c.ref.netlistKeccak}, ${c.ref.gateCount} gates`);

const sim = (pot: bigint) => unpack(P.outputs, evaluate(c.bytes, c.ref.nIn, c.ref.nOut, pack(P.inputs, { pot }, c.ref.nIn), c.refs)).fee;
async function evalOnChain(pot: bigint) {
  const input = pack(P.inputs, { pot }, c.ref.nIn);
  const hex = Array.from(input, (b) => b.toString(16).padStart(2, '0')).join('');
  const data = '0x934d06ea' + BigInt(c.ref.id).toString(16).padStart(64, '0') + (64n).toString(16).padStart(64, '0') +
    input.length.toString(16).padStart(64, '0') + hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
  const ret = (await rpc('eth_call', [{ to: CIRCUITS, data }, '0x' + block.toString(16)])).replace(/^0x/, '');
  const off = Number(BigInt('0x' + ret.slice(0, 64))) * 2;
  const len = Number(BigInt('0x' + ret.slice(off, off + 64)));
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = parseInt(ret.slice(off + 64 + 2 * i, off + 66 + 2 * i), 16);
  return unpack(P.outputs, out).fee;
}

const spot: { pot: string; want: string; simulator: string; chain: string }[] = [];
for (const pot of [0n, 1n, 9n, 10n, 11n, 100n, 5_000_000n, 4_294_967_295n]) {
  const [s, ch] = [sim(pot), await evalOnChain(pot)];
  spot.push({ pot: pot.toString(), want: (pot / 10n).toString(), simulator: s.toString(), chain: ch.toString() });
  if (s !== pot / 10n || ch !== pot / 10n) throw new Error(`fee(${pot}): simulator ${s}, chain ${ch}, want ${pot / 10n}`);
}
console.log(`eval on chain matches floor(pot / 10) at ${spot.length} pots`);

const v = toVerilog(c.bytes, c.ref.nIn, c.ref.nOut, 'fee_c', c.refs);
writeFileSync(join(outDir, 'split_fee.v'), v);
const question = (mutate: boolean) => `module q (input [31:0] x, output bad);\n  wire [31:0] f0;\n  fee_c c (.in(x), .out(f0));\n` +
  (mutate ? `  wire [31:0] f = (x == 32'd5000000) ? f0 + 32'd1 : f0;\n` : `  wire [31:0] f = f0;\n`) +
  `  wire [63:0] lo = {32'd0, f} * 64'd10000;\n  wire [63:0] mid = {32'd0, x} * 64'd1000;\n` +
  `  wire [63:0] hi = ({32'd0, f} + 64'd1) * 64'd10000;\n  assign bad = !(lo <= mid && mid < hi);\nendmodule\n`;
const q = question(false), mq = question(true);
writeFileSync(join(outDir, 'fee-is-fixed.q.v'), q);
writeFileSync(join(outDir, 'fee-is-fixed.mutant.q.v'), mq);
const CHOSEN = ['abc-iprove', 'yosys-sat', 'smt-bitwuzla'];
const r = ask(tools, v, q, 32, TIMEOUT, CHOSEN);
let counterexample: { pot: string; chainFee: string } | null = null;
if (verdict(r) === 'fails') {
  const x = r.answers.find((a) => a.x !== null)!.x!;
  counterexample = { pot: x.toString(), chainFee: (await evalOnChain(x)).toString() };
}
const m = ask(tools, v, mq, 32, TIMEOUT, CHOSEN);
const line = (x: Question) => x.answers.map((a) => `${a.tool} ${a.status} ${a.seconds.toFixed(1)}s`).join(', ');
console.log(`fee-is-fixed (chain): ${verdict(r)} (${line(r)}); mutant ${verdict(m)} (${line(m)})` +
  (counterexample ? `; counterexample pot ${counterexample.pot}, chain fee ${counterexample.chainFee}` : ''));

const answersOut = (x: Question) => x.answers.map((a) => ({ tool: a.tool, status: a.status, seconds: +a.seconds.toFixed(2),
  x: a.x === null ? null : a.x.toString(), command: a.command, tail: a.tail }));
const rec = { kind: 'fact', factId: 'fee-is-fixed', ruleId: 'split-v1',
  statement: { en: 'The operator fee is exactly 10% of the deposit, rounded down, for every 32-bit deposit',
    zh: '对每一笔 32 位存入金额，运营方费用恰好是存入金额的 10%，向下取整' },
  definition: 'fee x 10000 <= pot x 1000 < (fee + 1) x 10000 (feeBps 1000, owner decision D17)',
  circuits: c.read, blockNumber: block, spotChecks: spot, status: verdict(r), questionSha256: sha(q), aigSha256: r.aigSha256,
  smt2Sha256: r.smt2Sha256, answers: answersOut(r), counterexample,
  mutant: { note: 'fee one higher at a pot of 5,000,000 base units', questionSha256: sha(mq), status: verdict(m), answers: answersOut(m) },
  tools: [{ name: 'yosys', version: toolVersion }, { name: 'yosys-abc', version: 'bundled with the same OSS CAD Suite 2026-10-29' },
    { name: 'bitwuzla', version: execFileSync(tools.bitwuzla!, ['--version'], { encoding: 'utf8' }).trim() + ' (OSS CAD Suite 2026-10-29)' }],
  timeoutSeconds: TIMEOUT, ranOn, ranAt: new Date().toISOString() };
writeFileSync(join(outDir, 'fee-is-fixed.json'), JSON.stringify(rec, null, 2) + '\n');
const holds = r.answers.filter((a) => a.status === 'holds').length;
if (verdict(r) !== 'holds' || holds < 2 || verdict(m) !== 'fails') { console.error('FAIL: fee-is-fixed needs two tools and a caught mutant'); process.exit(1); }
console.log('ALL CHECKS PASSED');
