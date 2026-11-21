// Round trip and known pairs, with the real tools (OSS_CAD_SUITE, PAYPROOF_JSON_DIR).
//
// 1. bytes -> toVerilog -> Yosys synth + abc -g NAND -> fromYosys -> bytes2. bytes and bytes2
//    give identical outputs on random inputs, and ABC proves the two exports equal.
// 2. Known-equal pair: a netlist against itself re-exported gives "holds".
// 3. Known-different pairs (mutants: one NAND's input rewired): "fails", and the counterexample
//    reproduces in the simulator (prover rule 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fromYosys } from '../../compiler/src/yosys.ts';
import { decode, encode, evaluate } from '../../compiler/src/netlist.ts';
import { toVerilog } from '../src/export.ts';
import { equivalent, literalToBigInt, toolsFromEnv, yosys } from '../src/run.ts';

const DIR = process.env.PAYPROOF_JSON_DIR ?? '';
const skip = !DIR || !existsSync(DIR) || !process.env.OSS_CAD_SUITE;
const yj = (name: string) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const T = 600;

function resynth(verilog: string, top: string) {
  const tools = toolsFromEnv();
  const d = mkdtempSync(join(tmpdir(), 'payproof-rt-'));
  try {
    writeFileSync(join(d, 'in.v'), verilog);
    yosys(tools, `read_verilog in.v; synth -flatten -top ${top} -noabc; abc -g NAND; opt_clean -purge; write_json out.json`, d);
    return fromYosys(JSON.parse(readFileSync(join(d, 'out.json'), 'utf8')), top);
  } finally { rmSync(d, { recursive: true, force: true }); }
}

function rng(seed: bigint) {
  let s = seed;
  return (bytes: number) => {
    const out = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) { s = (s * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); out[i] = Number(s >> 56n); }
    return out;
  };
}

/** Rewire the k-th NAND's second input to constant 1, which makes it a NOT of its first input. */
function mutate(bytes: Uint8Array, nIn: number, k: number): Uint8Array {
  const els = decode(bytes, nIn);
  const e = els[k];
  const copy = els.map((x) => ({ ...x, ins: x.ins.slice() }));
  copy[k].ins[1] = e.ins[1] === 1 ? 0 : 1;
  return encode(copy);
}

for (const name of ['adder8', 'cn_bonus', 'split_check_8']) {
  test(`${name}: export, re-synthesise, import: same outputs, and proved equal`, { skip, timeout: 3_600_000 }, () => {
    const c = fromYosys(yj(name), name);
    const v1 = toVerilog(c.bytes, c.nIn, c.nOut, 'gold');
    const c2 = resynth(toVerilog(c.bytes, c.nIn, c.nOut, 'rt'), 'rt');
    assert.equal(c2.nIn, c.nIn); assert.equal(c2.nOut, c.nOut);
    const r = rng(20261121n);
    for (let i = 0; i < 500; i++) {
      const x = r((c.nIn + 7) >> 3);
      assert.equal(hex(evaluate(c2.bytes, c2.nIn, c2.nOut, x)), hex(evaluate(c.bytes, c.nIn, c.nOut, x)), `input ${hex(x)}`);
    }
    const v2 = toVerilog(c2.bytes, c2.nIn, c2.nOut, 'gate');
    const res = equivalent(toolsFromEnv(), { 'gold.v': v1, 'gate.v': v2 }, 'gold', 'gate', T);
    console.log(`  ${name}: gates ${c.gates} -> ${c2.gates}; ${res.verdictLine}; ${res.seconds.toFixed(2)} s; miter ${res.miterSha256}`);
    assert.equal(res.status, 'holds', res.log.slice(-2000));
  });

  test(`${name}: known-different pair (one NAND rewired) fails, and the counterexample replays`, { skip, timeout: 3_600_000 }, () => {
    const c = fromYosys(yj(name), name);
    // A rewired gate can be redundant (the first run found two such gates, proved equal).
    // So the mutant is chosen by simulation: the first gate from a third of the way in whose
    // rewiring changes the outputs on one of 300 random inputs. The pair is then known different.
    const n = decode(c.bytes, c.nIn).length;
    let k = Math.floor(n / 3); let bad = c.bytes; let witness = '';
    for (; k < n && !witness; k++) {
      bad = mutate(c.bytes, c.nIn, k);
      const r = rng(BigInt(k));
      for (let i = 0; i < 300 && !witness; i++) {
        const x = r((c.nIn + 7) >> 3);
        if (hex(evaluate(bad, c.nIn, c.nOut, x)) !== hex(evaluate(c.bytes, c.nIn, c.nOut, x))) witness = hex(x);
      }
    }
    k--;
    assert.ok(witness, 'no gate found whose rewiring shows in simulation');
    const res = equivalent(toolsFromEnv(), { 'gold.v': toVerilog(c.bytes, c.nIn, c.nOut, 'gold'),
      'gate.v': toVerilog(bad, c.nIn, c.nOut, 'gate') }, 'gold', 'gate', T);
    console.log(`  ${name} mutant (NAND ${k} of ${n}, simulation witness ${witness}): ${res.verdictLine}; ${res.seconds.toFixed(2)} s; cex ${JSON.stringify(res.counterexample)}`);
    assert.equal(res.status, 'fails', 'a pair the simulator shows different must not be proved equal');
    assert.ok(res.counterexample, 'a failure must come with an input');
    const lit = Object.values(res.counterexample!)[0];
    const v = literalToBigInt(lit);
    const x = new Uint8Array((c.nIn + 7) >> 3);
    for (let i = 0; i < c.nIn; i++) if ((v >> BigInt(i)) & 1n) x[i >> 3] |= 1 << (i & 7);
    assert.notEqual(hex(evaluate(bad, c.nIn, c.nOut, x)), hex(evaluate(c.bytes, c.nIn, c.nOut, x)),
      `counterexample ${lit} must give different outputs in the simulator`);
  });
}

test('known-equal pair: a netlist against its own export', { skip, timeout: 600_000 }, () => {
  const c = fromYosys(yj('cn_bonus'), 'cn_bonus');
  const res = equivalent(toolsFromEnv(), { 'gold.v': toVerilog(c.bytes, c.nIn, c.nOut, 'gold'),
    'gate.v': toVerilog(c.bytes, c.nIn, c.nOut, 'gate') }, 'gold', 'gate', T);
  assert.equal(res.status, 'holds');
});
