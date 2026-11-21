// The P0 netlists (spikes/p0/tap/*.tap.json) against the rule vectors (rules/*/vectors.json),
// through pack, evaluate and unpack. Also packing round trips on each layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate } from '../src/netlist.ts';
import { pack, unpack, type Field } from '../src/layout.ts';

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const hexToBytes = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h.replace(/^0x/, ''), 'hex'));

const CASES = [
  { rule: 'ng-paye-nta2025', tap: 'spikes/p0/tap/ng_paye.tap.json' },
  { rule: 'cn-bonus-2023-30', tap: 'spikes/p0/tap/cn_bonus.tap.json' },
  { rule: 'split-v1', tap: 'spikes/p0/tap/split_check_modc_32.tap.json' },
];

for (const { rule, tap } of CASES) {
  const layout = read(`rules/${rule}/layout.json`);
  const vectors = read(`rules/${rule}/vectors.json`);
  const t = read(tap);

  test(`${rule}: layout matches the netlist`, () => {
    assert.equal(layout.nIn, t.nIn);
    assert.equal(layout.nOut, t.nOut);
    assert.deepEqual(layout.inputs, t.inputs);
    assert.deepEqual(layout.outputs, t.outputs);
  });

  test(`${rule}: ${vectors.count} vectors through ${t.module} (${t.gates} gates)`, () => {
    assert.equal(vectors.vectors.length, vectors.count);
    const bytes = hexToBytes(t.netlistHex);
    for (const v of vectors.vectors) {
      assert.ok(typeof v.source === 'string' && v.source.length > 0, 'every vector names its source');
      const ins = Object.fromEntries(Object.entries(v.inputs).map(([k, x]) => [k, BigInt(x as string)]));
      const out = unpack(layout.outputs as Field[], evaluate(bytes, t.nIn, t.nOut, pack(layout.inputs, ins, t.nIn)));
      const want = Object.fromEntries(Object.entries(v.outputs).map(([k, x]) => [k, BigInt(x as string)]));
      assert.deepEqual(out, want, `${v.why}: inputs ${JSON.stringify(v.inputs)}`);
    }
  });

  test(`${rule}: pack then unpack returns the values`, () => {
    let seed = 20261121n;
    const rnd = (w: number) => { seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return (seed >> 11n) & ((1n << BigInt(w)) - 1n); };
    for (let i = 0; i < 200; i++) {
      const vals = Object.fromEntries((layout.inputs as Field[]).map((f) => [f.name, rnd(f.width)]));
      assert.deepEqual(unpack(layout.inputs, pack(layout.inputs, vals, t.nIn)), vals);
    }
  });
}

test('pack refuses a value wider than its field', () => {
  assert.throws(() => pack([{ name: 'x', offset: 0, width: 4 }], { x: 16n }, 8), /does not fit/);
  assert.throws(() => pack([{ name: 'x', offset: 0, width: 4 }, { name: 'y', offset: 3, width: 2 }], { x: 1n, y: 1n }, 8), /overlaps/);
});
