// Field layouts: named unsigned fields at bit offsets of a TAP-02 input or output vector.
// A field's value is little-endian from its offset (bit k of the value is vector bit
// offset + k), the convention of every rules/<rule>/layout.json and scripts/p0/check_tap.py.

export type Field = { name: string; offset: number; width: number };
export type Layout = { nIn: number; nOut: number; inputs: Field[]; outputs: Field[] };

export function checkFields(fields: Field[], nBits: number): void {
  const used = new Uint8Array(nBits);
  for (const f of fields) {
    if (!Number.isInteger(f.offset) || !Number.isInteger(f.width) || f.width < 1 || f.offset < 0 || f.offset + f.width > nBits) {
      throw new Error(`field ${f.name} does not fit in ${nBits} bits`);
    }
    for (let i = f.offset; i < f.offset + f.width; i++) {
      if (used[i]) throw new Error(`field ${f.name} overlaps another field at bit ${i}`);
      used[i] = 1;
    }
  }
}

/** Pack named values into a vector of nBits bits, returned as bytes (bit i in byte i >> 3). */
export function pack(fields: Field[], values: Record<string, bigint>, nBits: number): Uint8Array {
  checkFields(fields, nBits);
  const out = new Uint8Array((nBits + 7) >> 3);
  for (const f of fields) {
    const v = values[f.name];
    if (typeof v !== 'bigint') throw new Error(`missing value for ${f.name}`);
    if (v < 0n || v >> BigInt(f.width) !== 0n) throw new Error(`${f.name} = ${v} does not fit in ${f.width} bits`);
    for (let k = 0; k < f.width; k++) {
      if ((v >> BigInt(k)) & 1n) { const b = f.offset + k; out[b >> 3] |= 1 << (b & 7); }
    }
  }
  return out;
}

/** Read named values back from bytes; missing bytes read as 0. */
export function unpack(fields: Field[], bytes: Uint8Array): Record<string, bigint> {
  const out: Record<string, bigint> = {};
  for (const f of fields) {
    let v = 0n;
    for (let k = f.width - 1; k >= 0; k--) {
      const b = f.offset + k;
      const bit = (b >> 3) < bytes.length ? (bytes[b >> 3] >> (b & 7)) & 1 : 0;
      v = (v << 1n) | BigInt(bit);
    }
    out[f.name] = v;
  }
  return out;
}
