// P4: turn the split-v1 fee circuit (rules/split-v1/fee.v) into the TAP-02 netlist the owner
// tapes out, and prove on that netlist, before any OKB is spent, that it is the rule:
//   for every 32-bit pot, fee x 10000 <= pot x 1000 < (fee + 1) x 10000
// which is the definition of fee = floor(pot x feeBps / 10000) with feeBps = 1000 (D17). The
// question does not use a division, so it does not restate the circuit. A mutant (fee one higher
// at a pot of 50,000.00) must be caught. The proof is repeated on the bytes read from X Layer
// after the tape-out (scripts/p4/fee-onchain.mts), as for every other circuit.
// Usage: node scripts/p4/fee-prepare.mts <yosys json> <out dir> <timeout-seconds>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fromYosys, type YosysJson } from '../../compiler/src/yosys.ts';
import { evaluate } from '../../compiler/src/netlist.ts';
import { pack, unpack, type Field } from '../../compiler/src/layout.ts';
import { toVerilog } from '../../prover/src/export.ts';
import { toolsFromEnv } from '../../prover/src/run.ts';
import { ask, toolsFromList, verdict } from '../../prover/src/fact.ts';
// @ts-ignore: plain JS module, vendored unchanged
import { keccakHex } from '../../vendor/tapekit/keccak.js';

const [jsonPath, outDir, timeoutArg] = process.argv.slice(2);
if (!jsonPath || !outDir || !timeoutArg) throw new Error('usage: fee-prepare.mts <yosys json> <out dir> <timeout-seconds>');
const TIMEOUT = Number(timeoutArg);
const tools = toolsFromEnv();
const CHOSEN = toolsFromList(process.env.PAYPROOF_TOOLS) ?? ['abc-iprove', 'yosys-sat', 'smt-bitwuzla'];
const INPUTS: Field[] = [{ name: 'pot', offset: 0, width: 32 }];
const OUTPUTS: Field[] = [{ name: 'fee', offset: 0, width: 32 }];

const c = fromYosys(JSON.parse(readFileSync(jsonPath, 'utf8')) as YosysJson, 'split_fee');
if (c.nIn !== 32 || c.nOut !== 32 || c.refRecords !== 0) throw new Error(`split_fee: pins ${c.nIn}/${c.nOut}, REF ${c.refRecords}`);
if (JSON.stringify(c.inputs) !== JSON.stringify(INPUTS) || JSON.stringify(c.outputs) !== JSON.stringify(OUTPUTS)) {
  throw new Error(`split_fee: layout ${JSON.stringify(c.inputs)} ${JSON.stringify(c.outputs)}`);
}

// Spot checks in the simulator first.
const sim = (pot: bigint) => unpack(OUTPUTS, evaluate(c.bytes, c.nIn, c.nOut, pack(INPUTS, { pot }, c.nIn), () => null)).fee;
for (const pot of [0n, 1n, 9n, 10n, 11n, 100n, 5_000_000n, 4_294_967_295n]) {
  if (sim(pot) !== pot / 10n) throw new Error(`simulator: fee(${pot}) = ${sim(pot)}, want ${pot / 10n}`);
}

mkdirSync(outDir, { recursive: true });
const v = toVerilog(c.bytes, c.nIn, c.nOut, 'fee_c');
writeFileSync(join(outDir, 'split_fee.v'), v);
const question = (mutate: boolean) => `module q (input [31:0] x, output bad);\n  wire [31:0] f0;\n  fee_c c (.in(x), .out(f0));\n` +
  (mutate ? `  wire [31:0] f = (x == 32'd5000000) ? f0 + 32'd1 : f0;\n` : `  wire [31:0] f = f0;\n`) +
  `  wire [63:0] lo = {32'd0, f} * 64'd10000;\n  wire [63:0] mid = {32'd0, x} * 64'd1000;\n` +
  `  wire [63:0] hi = ({32'd0, f} + 64'd1) * 64'd10000;\n  assign bad = !(lo <= mid && mid < hi);\nendmodule\n`;
const q = question(false), mq = question(true);
writeFileSync(join(outDir, 'fee-is-fixed.q.v'), q);
writeFileSync(join(outDir, 'fee-is-fixed.mutant.q.v'), mq);
const r = ask(tools, v, q, 32, TIMEOUT, CHOSEN);
const m = ask(tools, v, mq, 32, TIMEOUT, CHOSEN);
const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const line = (x: typeof r) => x.answers.map((a) => `${a.tool} ${a.status} ${a.seconds.toFixed(1)}s`).join(', ');
console.log(`split_fee: ${c.gates} gates, ${c.bytes.length} bytes, keccak ${keccakHex(c.bytes)}`);
console.log(`fee-is-fixed (file): ${verdict(r)} (${line(r)}); mutant ${verdict(m)} (${line(m)})`);

writeFileSync(join(outDir, 'split_fee.bin'), c.bytes);
const piece = { name: 'split_fee', label: 'split-v1 fee circuit, feeBps 1000', yosysModule: 'split_fee', file: 'netlists/fee/split_fee.bin',
  nIn: c.nIn, nOut: c.nOut, nandRecords: c.gates, refRecords: 0, bytes: c.bytes.length, keccak256: keccakHex(c.bytes),
  sha256: sha(c.bytes), inputs: INPUTS, outputs: OUTPUTS };
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ circuits: '0x1900801e311184063b9d9c119c9d98aa4950e12c',
  note: 'split-v1 fee circuit (rules/split-v1/fee.v). TAP-02 netlist for tapeout(bytes,uint32,uint32); made by scripts/p4/fee-prepare.mts',
  pieces: [piece] }, null, 2) + '\n');
writeFileSync(join(outDir, 'fee-is-fixed.precheck.json'), JSON.stringify({ factId: 'fee-is-fixed', on: 'netlist file, before tape-out',
  keccak256: piece.keccak256, status: verdict(r), questionSha256: sha(q), answers: r.answers.map((a) => ({ tool: a.tool, status: a.status,
  seconds: +a.seconds.toFixed(2), x: a.x === null ? null : a.x.toString() })), mutant: { status: verdict(m), questionSha256: sha(mq),
  answers: m.answers.map((a) => ({ tool: a.tool, status: a.status, seconds: +a.seconds.toFixed(2) })) }, timeoutSeconds: TIMEOUT,
  ranAt: new Date().toISOString() }, null, 2) + '\n');
const holds = r.answers.filter((a) => a.status === 'holds').length;
if (verdict(r) !== 'holds' || holds < 2 || verdict(m) !== 'fails') { console.error('FAIL: fee-is-fixed needs two tools and a caught mutant'); process.exit(1); }
console.log('ALL CHECKS PASSED');
