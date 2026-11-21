// TAP-02 netlist: decode, encode, well-formedness check and one-beat evaluation.
//
// Written from the TAP-02 reference implementation, vendor/taps/tap-02/reference.py
// (TapeOutProtocol/TAPs 075dd834a72c, MIT), and checked against its vectors.json. Each function
// follows the reference function of the same name; error messages are the reference's own, so
// the ill-formed vectors can be compared by reason.
//
// Signals: 0 is constant 0, 1 is constant 1, 2 .. 1 + nIn are the inputs, then each element's
// outputs in order. The circuit's outputs are the last nOut signals.
// Records (big-endian): NAND 0x00 a(3) b(3); LATCH 0x01 d(3);
// REF 0x02 cpu(20) id(8) nIn(1) nOut(1) then nIn inputs of 3 bytes.

export const NAND = 0x00;
export const LATCH = 0x01;
export const REF = 0x02;
export const MAX_SIGNALS = 1 << 24;
export const MAX_PINS = 1 << 16;
export const MAX_GATES = 2 ** 32 - 1;

export class IllFormed extends Error {}

export type Element = {
  op: number;
  ins: number[];
  cpu: Uint8Array;      // REF only, 20 bytes
  cid: bigint;          // REF only
  nOut: number;
  firstOut: number;
};

export type Circuit = {
  nIn: number;
  nOut: number;
  elements: Element[];
  nSignals: number;
  subs: Map<string, Circuit>;
  nState: number;
  nGates: number;
  stateBase: number[];
};

/** Resolves a REF target to a loaded circuit, or null when it is not a registered circuit. */
export type RefResolver = (cpu: Uint8Array, id: bigint) => Circuit | null;

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const refKey = (cpu: Uint8Array, id: bigint): string => `${hex(cpu)}:${id}`;

export function decode(data: Uint8Array, nIn: number): Element[] {
  let p = 0;
  let next = 2 + nIn;
  const els: Element[] = [];
  const take = (k: number): Uint8Array => {
    if (p + k > data.length) throw new IllFormed(`truncated record at byte ${p}`);
    const b = data.subarray(p, p + k);
    p += k;
    return b;
  };
  const u24 = (): number => { const b = take(3); return (b[0] << 16) | (b[1] << 8) | b[2]; };
  while (p < data.length) {
    const op = take(1)[0];
    let e: Element;
    if (op === NAND) {
      const a = u24();
      e = { op, ins: [a, u24()], cpu: new Uint8Array(0), cid: 0n, nOut: 1, firstOut: 0 };
    } else if (op === LATCH) {
      e = { op, ins: [u24()], cpu: new Uint8Array(0), cid: 0n, nOut: 1, firstOut: 0 };
    } else if (op === REF) {
      const cpu = take(20).slice();
      let cid = 0n;
      for (const x of take(8)) cid = (cid << 8n) | BigInt(x);
      const ni = take(1)[0];
      const no = take(1)[0];
      const ins: number[] = [];
      for (let i = 0; i < ni; i++) ins.push(u24());
      e = { op, ins, cpu, cid, nOut: no, firstOut: 0 };
    } else {
      throw new IllFormed(`unknown opcode 0x${op.toString(16).padStart(2, '0')} at byte ${p - 1}`);
    }
    e.firstOut = next;
    next += e.nOut;
    els.push(e);
  }
  return els;
}

export function encode(els: Element[]): Uint8Array {
  const out: number[] = [];
  const u24 = (s: number) => { out.push((s >> 16) & 0xff, (s >> 8) & 0xff, s & 0xff); };
  for (const e of els) {
    out.push(e.op);
    if (e.op === REF) {
      out.push(...e.cpu);
      for (let i = 7; i >= 0; i--) out.push(Number((e.cid >> BigInt(8 * i)) & 0xffn));
      out.push(e.ins.length, e.nOut);
    }
    for (const s of e.ins) u24(s);
  }
  return Uint8Array.from(out);
}

/** Decode and check well-formedness (TAP-02 section 3). */
export function load(data: Uint8Array, nIn: number, nOut: number, resolve: RefResolver | null = null): Circuit {
  const els = decode(data, nIn);
  const nSig = 2 + nIn + els.reduce((s, e) => s + e.nOut, 0);
  if (nSig > MAX_SIGNALS) throw new IllFormed('more than 2^24 signals');
  if (!(nIn >= 0 && nIn <= MAX_PINS && nOut >= 1 && nOut <= MAX_PINS)) throw new IllFormed('nIn/nOut out of range');
  if (nSig - 2 - nIn < nOut) throw new IllFormed('too few signals for outputs');
  const c: Circuit = { nIn, nOut, elements: els, nSignals: nSig, subs: new Map(), nState: 0, nGates: 0, stateBase: [] };
  for (const e of els) {
    for (const s of e.ins) {
      const limit = e.op === LATCH ? nSig : e.firstOut;
      if (s >= limit) throw new IllFormed(`signal ${s} referenced by element at ${e.firstOut} is not available`);
    }
    c.stateBase.push(c.nState);
    if (e.op === LATCH) {
      c.nState += 1;
    } else if (e.op === REF) {
      if (resolve === null) throw new IllFormed('REF without a resolver');
      const sub = resolve(e.cpu, e.cid);
      if (sub === null) throw new IllFormed('REF target is not a circuit of a registered processor');
      if (sub.nIn !== e.ins.length || sub.nOut !== e.nOut) throw new IllFormed('REF arity does not match the target circuit');
      if (sub.nState > MAX_SIGNALS) throw new IllFormed('REF size');
      c.subs.set(refKey(e.cpu, e.cid), sub);
      c.nState += sub.nState;
      c.nGates += sub.nGates;
    }
  }
  c.nGates += els.filter((e) => e.op !== REF).length;
  if (c.nState > MAX_SIGNALS || c.nGates > MAX_GATES) throw new IllFormed('size overflow');
  return c;
}

/** One beat (TAP-02 section 4). state and inputs are bit arrays (0 or 1). */
export function beat(c: Circuit, state: Uint8Array, inputs: Uint8Array): { newState: Uint8Array; outputs: Uint8Array } {
  if (state.length !== c.nState || inputs.length !== c.nIn) throw new Error('beat: wrong state or input length');
  const a = new Uint8Array(c.nSignals);
  a[1] = 1;
  a.set(inputs, 2);
  const newState = state.slice();
  let n = 2 + c.nIn;
  for (let i = 0; i < c.elements.length; i++) {
    const e = c.elements[i];
    const base = c.stateBase[i];
    if (e.op === NAND) {
      a[n++] = 1 - (a[e.ins[0]] & a[e.ins[1]]);
    } else if (e.op === LATCH) {
      a[n++] = state[base];
    } else {
      const sub = c.subs.get(refKey(e.cpu, e.cid))!;
      const r = beat(sub, state.subarray(base, base + sub.nState), Uint8Array.from(e.ins, (s) => a[s]));
      newState.set(r.newState, base);
      a.set(r.outputs, n);
      n += r.outputs.length;
    }
  }
  for (let i = 0; i < c.elements.length; i++) {
    const e = c.elements[i];
    if (e.op === LATCH) newState[c.stateBase[i]] = a[e.ins[0]];
  }
  return { newState, outputs: a.slice(n - c.nOut, n) };
}

/** Bit i of a vector is bit (i mod 8) of byte floor(i / 8), least significant first. */
export function packBits(bits: Uint8Array): Uint8Array {
  const out = new Uint8Array((bits.length + 7) >> 3);
  for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3] |= 1 << (i & 7);
  return out;
}

/** As the deployed evaluator reads inputs and state: missing bytes read as 0; extra bytes and bits are ignored. */
export function unpackBits(data: Uint8Array, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (i >> 3) < data.length ? (data[i >> 3] >> (i & 7)) & 1 : 0;
  return out;
}

/** Stateless evaluation as `eval(id, inputs)` returns it: packed inputs in, packed outputs out. */
export function evaluate(bytes: Uint8Array, nIn: number, nOut: number, inputs: Uint8Array,
  refs: RefResolver | null = null): Uint8Array {
  const c = load(bytes, nIn, nOut, refs);
  const r = beat(c, new Uint8Array(c.nState), unpackBits(inputs, nIn));
  return packBits(r.outputs);
}
