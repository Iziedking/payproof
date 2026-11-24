// P3: turn the two SIMULATED engines into TAP-02 netlist files for the owner's tape-out, and
// pre-check each against circuit 9's netlist file before any OKB is spent.
// Usage: node scripts/p3/engines-prepare.mts <yosys json dir> <out netlist dir> <timeout-seconds>
//
// Writes <out>/<engine>.bin and <out>/manifest.json in the shape of chain/netlists/manifest.json,
// so the owner tapes out with the same script: chain/script/TapeOut.s.sol (path, nIn, nOut, keccak).
//
// The pre-check is on our own files (chain/netlists/cn_bonus.bin is the file that was taped out
// as circuit 9; its keccak is checked against the manifest). It is not the proof: the proof runs
// after the tape-out on the bytes read from X Layer (scripts/p3/engines.mts, PLAN L14). It asks
// "is there a bonus where the engine's outputs differ from the reference?" of ABC and Yosys sat,
// and any input found is replayed in the simulator.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fromYosys, type YosysJson } from '../../compiler/src/yosys.ts';
import { evaluate } from '../../compiler/src/netlist.ts';
import { pack, unpack } from '../../compiler/src/layout.ts';
import { toVerilog } from '../../prover/src/export.ts';
import { equivalent, toolsFromEnv } from '../../prover/src/run.ts';
import { ask, toolsFromList, verdict, type Answer } from '../../prover/src/fact.ts';
// @ts-ignore: plain JS module, vendored unchanged
import { keccakHex } from '../../vendor/tapekit/keccak.js';

const [jsonDir, outDir, timeoutArg] = process.argv.slice(2);
if (!jsonDir || !outDir || !timeoutArg) throw new Error('usage: engines-prepare.mts <json dir> <out dir> <timeout-seconds>');
const ENGINES = [
  { name: 'cn_vendor_a', label: 'Simulated engine A (China bonus)', expect: 'equal' },
  { name: 'cn_vendor_b', label: 'Simulated engine B (China bonus)', expect: 'different' },
] as const;

const manifest = JSON.parse(readFileSync('chain/netlists/manifest.json', 'utf8'));
const ref = manifest.pieces.find((p: { name: string }) => p.name === 'cn_bonus');
const refBytes = new Uint8Array(readFileSync('chain/netlists/cn_bonus.bin'));
if (keccakHex(refBytes) !== ref.keccak256) throw new Error('chain/netlists/cn_bonus.bin does not match its manifest keccak');
const refV = toVerilog(refBytes, ref.nIn, ref.nOut, 'cn_ref');
const tools = toolsFromEnv();
// Launcher options. PAYPROOF_TOOLS picks the fact tools (default ABC iprove and Yosys sat).
// PAYPROOF_CEC=1 also asks ABC &cec whether the two netlists are equal. PAYPROOF_ENGINES limits
// the pre-check to the engines named; every engine is still compiled and written to the manifest.
const CHOSEN = toolsFromList(process.env.PAYPROOF_TOOLS);
const CEC = process.env.PAYPROOF_CEC === '1';
const ONLY = process.env.PAYPROOF_ENGINES ? process.env.PAYPROOF_ENGINES.split(',').map((e) => e.trim()) : null;
const sim = (b: Uint8Array, nIn: number, nOut: number, bonus: bigint) =>
  unpack(ref.outputs, evaluate(b, nIn, nOut, pack(ref.inputs, { bonus }, nIn), () => null));

mkdirSync(outDir, { recursive: true });
const pieces = [];
let ok = true;
for (const e of ENGINES) {
  const c = fromYosys(JSON.parse(readFileSync(join(jsonDir, `${e.name}.json`), 'utf8')) as YosysJson, e.name);
  if (c.nIn !== ref.nIn || c.nOut !== ref.nOut) throw new Error(`${e.name}: pins ${c.nIn}/${c.nOut}, reference ${ref.nIn}/${ref.nOut}`);
  if (JSON.stringify(c.inputs) !== JSON.stringify(ref.inputs) || JSON.stringify(c.outputs) !== JSON.stringify(ref.outputs)) {
    throw new Error(`${e.name}: layout differs from circuit 9`);
  }
  if (c.refRecords !== 0) throw new Error(`${e.name}: REF records not expected`);
  writeFileSync(join(outDir, `${e.name}.bin`), c.bytes);
  pieces.push({ name: e.name, label: e.label, simulated: true, yosysModule: e.name, file: `netlists/engines/${e.name}.bin`,
    nIn: c.nIn, nOut: c.nOut, nandRecords: c.gates, refRecords: 0, bytes: c.bytes.length, keccak256: keccakHex(c.bytes),
    sha256: createHash('sha256').update(c.bytes).digest('hex'), inputs: c.inputs, outputs: c.outputs, reference: 'cn_bonus' });

  if (ONLY && !ONLY.includes(e.name)) {
    console.log(`${e.name}: ${c.gates} gates, keccak ${keccakHex(c.bytes)}; pre-check skipped (PAYPROOF_ENGINES)`);
    continue;
  }
  const engV = toVerilog(c.bytes, c.nIn, c.nOut, 'cn_eng');
  const q = `module q (input [31:0] x, output bad);\n  wire [63:0] a, b;\n  cn_ref r (.in(x), .out(a));\n  cn_eng e (.in(x), .out(b));\n  assign bad = a != b;\nendmodule\n`;
  const r = ask(tools, `${refV}\n${engV}`, q, 32, Number(timeoutArg), CHOSEN ?? true);
  if (CEC) {
    const k = equivalent(tools, { 'r.v': refV, 'e.v': engV }, 'cn_ref', 'cn_eng', Number(timeoutArg));
    r.answers.push({ tool: 'abc-cec', status: k.status, seconds: k.seconds, x: null, command: '&cec -m', tail: k.verdictLine } as unknown as Answer);
  }
  const v = verdict(r);
  let note = '';
  if (v === 'fails') {
    const x = r.answers.find((a) => a.x !== null)!.x!;
    const ra = sim(refBytes, ref.nIn, ref.nOut, x), rb = sim(c.bytes, c.nIn, c.nOut, x);
    if (ra.tax === rb.tax && ra.net === rb.net) throw new Error(`${e.name}: input ${x} does not replay in the simulator`);
    note = `; bonus ${x} fen: reference tax ${ra.tax}, engine tax ${rb.tax} (simulator)`;
  }
  const got = v === 'holds' ? 'equal' : v === 'fails' ? 'different' : 'undecided';
  if (got !== e.expect) ok = false;
  console.log(`${e.name}: ${c.gates} gates, ${c.bytes.length} bytes, keccak ${keccakHex(c.bytes)}; pre-check ${got} ` +
    `(${r.answers.map((a) => `${a.tool} ${a.status} ${a.seconds.toFixed(1)}s`).join(', ')}), expected ${e.expect}${note}`);
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ circuits: manifest.circuits,
  note: 'SIMULATED engines for engine equality (PLAN L13). TAP-02 netlists for tapeout(bytes,uint32,uint32); made by scripts/p3/engines-prepare.mts',
  pieces }, null, 2) + '\n');
if (!ok) { console.error('FAIL: a pre-check differs from what the engine was written to show'); process.exit(1); }
console.log('ALL CHECKS PASSED');
