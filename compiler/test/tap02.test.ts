// The simulator against the TAP-02 reference vectors (vendor/taps/tap-02/vectors.json,
// SHA-256 1a02f5cf991c130a22dc6cc6ee93d0f8fe0720afed081665fa8b8018aefd203b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { beat, decode, encode, evaluate, load, packBits, unpackBits, refKey, type Circuit } from '../src/netlist.ts';

const path = new URL('../../vendor/taps/tap-02/vectors.json', import.meta.url);
const raw = readFileSync(path);
const V = JSON.parse(raw.toString('utf8'));
const hexToBytes = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h.replace(/^0x/, ''), 'hex'));
const toHex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

type RefSpec = { cpu: string; id: number; nIn: number; nOut: number; netlist: string };
function resolverFor(refs: RefSpec[]) {
  const map = new Map<string, Circuit>();
  const resolve = (cpu: Uint8Array, id: bigint): Circuit | null => map.get(refKey(cpu, id)) ?? null;
  for (const r of refs) map.set(refKey(hexToBytes(r.cpu), BigInt(r.id)), load(hexToBytes(r.netlist), r.nIn, r.nOut, resolve));
  return resolve;
}

test('vectors file is the one TAP-02 names', () => {
  assert.equal(createHash('sha256').update(raw).digest('hex'), '1a02f5cf991c130a22dc6cc6ee93d0f8fe0720afed081665fa8b8018aefd203b');
  assert.equal(V.format, 'tap-netlist-vectors/1');
});

for (const c of V.valid) {
  test(`valid: ${c.name}`, () => {
    const bytes = hexToBytes(c.netlist);
    assert.equal(toHex(encode(decode(bytes, c.nIn))), toHex(bytes), 'decode then encode gives the same bytes');
    const circ = load(bytes, c.nIn, c.nOut, resolverFor(c.refs));
    assert.equal(circ.nState, c.nState);
    for (const row of c.truthTable ?? []) {
      assert.equal(toHex(evaluate(bytes, c.nIn, c.nOut, hexToBytes(row.inputs), resolverFor(c.refs))), row.outputs, `inputs ${row.inputs}`);
    }
    for (const b of c.beats ?? []) {
      const r = beat(circ, unpackBits(hexToBytes(b.state), circ.nState), unpackBits(hexToBytes(b.inputs), c.nIn));
      assert.equal(toHex(packBits(r.outputs)), b.outputs, `beat outputs, state ${b.state} inputs ${b.inputs}`);
      assert.equal(toHex(packBits(r.newState)), b.newState, `beat new state, state ${b.state} inputs ${b.inputs}`);
    }
  });
}

for (const c of V.illFormed) {
  test(`ill-formed: ${c.name}`, () => {
    assert.throws(() => load(hexToBytes(c.netlist), c.nIn, c.nOut, resolverFor(c.refs)), (e: Error) => e.message === c.reason);
  });
}

test('packing edge cases', () => {
  const pe = V.packingEdgeCases;
  const circ = V.valid.find((x: { name: string }) => x.name === pe.circuit);
  for (const k of pe.cases) {
    assert.equal(toHex(evaluate(hexToBytes(circ.netlist), circ.nIn, circ.nOut, hexToBytes(k.inputs))), k.outputs, k.case);
  }
});

test('NAND truth table', () => {
  const nand = hexToBytes('0x00000002000003');
  const got = [0, 1, 2, 3].map((x) => toHex(evaluate(nand, 2, 1, Uint8Array.of(x))));
  assert.deepEqual(got, ['01', '01', '01', '00']);
});
