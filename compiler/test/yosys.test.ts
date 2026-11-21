// fromYosys on the Yosys JSON written by the P1 re-synthesis (host-service, Yosys 0.70,
// scripts/p0/synth-all.sh groups wage and check-narrow). PAYPROOF_JSON_DIR points at the copy.
// Checks: the bytes equal the P0 tape-out files made by scripts/p0/yosys2tap.py; the rule
// vectors pass through the fresh netlists; the mutant differs; split_check_8 matches the rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromYosys } from '../src/yosys.ts';
import { evaluate } from '../src/netlist.ts';
import { pack, unpack } from '../src/layout.ts';

const DIR = process.env.PAYPROOF_JSON_DIR ?? '';
const root = (p: string) => new URL(`../../${p}`, import.meta.url);
const yj = (name: string) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const hex = (b: Uint8Array) => '0x' + Buffer.from(b).toString('hex');
const skip = !DIR || !existsSync(DIR);

for (const name of ['adder8', 'cn_bonus', 'ng_paye']) {
  test(`${name}: same bytes as the P0 tape-out file`, { skip }, () => {
    const c = fromYosys(yj(name), name);
    const p0 = JSON.parse(readFileSync(root(`spikes/p0/tap/${name}.tap.json`), 'utf8'));
    assert.equal(c.gates, p0.gates);
    assert.equal(c.nIn, p0.nIn);
    assert.equal(c.nOut, p0.nOut);
    assert.deepEqual(c.inputs, p0.inputs);
    assert.deepEqual(c.outputs, p0.outputs);
    assert.equal(hex(c.bytes), p0.netlistHex);
  });
}

for (const [name, rule] of [['cn_bonus', 'cn-bonus-2023-30'], ['ng_paye', 'ng-paye-nta2025']]) {
  test(`${name}: rule vectors through the freshly imported netlist`, { skip }, () => {
    const c = fromYosys(yj(name), name);
    const v = JSON.parse(readFileSync(root(`rules/${rule}/vectors.json`), 'utf8'));
    for (const x of v.vectors) {
      const ins = Object.fromEntries(Object.entries(x.inputs).map(([k, s]) => [k, BigInt(s as string)]));
      const out = unpack(c.outputs, evaluate(c.bytes, c.nIn, c.nOut, pack(c.inputs, ins, c.nIn)));
      assert.deepEqual(out, Object.fromEntries(Object.entries(x.outputs).map(([k, s]) => [k, BigInt(s as string)])), x.why);
    }
  });
}

test('ng_paye_mutant19 (third band 19%) differs from ng_paye on a rule vector', { skip }, () => {
  const good = fromYosys(yj('ng_paye'), 'ng_paye');
  const bad = fromYosys(yj('ng_paye_mutant19'), 'ng_paye_mutant19');
  const v = JSON.parse(readFileSync(root('rules/ng-paye-nta2025/vectors.json'), 'utf8'));
  let differ = 0;
  for (const x of v.vectors) {
    const ins = Object.fromEntries(Object.entries(x.inputs).map(([k, s]) => [k, BigInt(s as string)]));
    const a = hex(evaluate(good.bytes, good.nIn, good.nOut, pack(good.inputs, ins, good.nIn)));
    const b = hex(evaluate(bad.bytes, bad.nIn, bad.nOut, pack(bad.inputs, ins, bad.nIn)));
    if (a !== b) differ++;
  }
  assert.ok(differ > 0, 'the vectors must catch the mutant');
});

test('split_check_8: every one of 3,000 inputs matches the rule', { skip }, () => {
  const c = fromYosys(yj('split_check_8'), 'split_check_8');
  let seed = 7n;
  const rnd = () => { seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return (seed >> 33n) & 0xffn; };
  for (let i = 0; i < 3000; i++) {
    const [pot, shares, total] = [rnd(), rnd(), rnd()];
    const exact = total ? (pot * shares * 8500n) / (10000n * total) : 0n;
    const payout = i % 3 === 0 ? rnd() : (exact + BigInt((i % 3) - 1)) & 0xffn;
    const valid = total !== 0n && shares <= total;
    const lhs = payout * total * 10000n; const rhs = pot * shares * 8500n;
    const want = valid && lhs <= rhs && rhs < lhs + total * 10000n ? 1n : 0n;
    const got = unpack(c.outputs, evaluate(c.bytes, c.nIn, c.nOut, pack(c.inputs, { pot, shares, total, payout }, c.nIn)));
    assert.equal(got.ok, want, `pot ${pot} shares ${shares} total ${total} payout ${payout}`);
  }
});
