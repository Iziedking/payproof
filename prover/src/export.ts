// TAP-02 netlist bytes to structural Verilog, one NAND per record (PLAN section 11.2, L14:
// the proof input comes from the chain bytes). REF records are flattened: each REF target is
// written once as its own module and instantiated, then the reader can `flatten`.
// Stateless circuits only: a LATCH is refused, since no Payproof rule has state.
//
// Signal names: n0 = 1'b0, n1 = 1'b1, inputs are bits of `in`, every other signal is wire sK.
// Outputs: `out[i]` is the (nSignals - nOut + i)-th signal.
import { LATCH, NAND, REF, load, refKey, type Circuit, type RefResolver } from '../../compiler/src/netlist.ts';

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function moduleText(c: Circuit, name: string, subName: (key: string) => string): string {
  const L: string[] = [];
  L.push(`module ${name} (input [${Math.max(c.nIn, 1) - 1}:0] in, output [${c.nOut - 1}:0] out);`);
  const s = (k: number): string => (k === 0 ? "1'b0" : k === 1 ? "1'b1" : k < 2 + c.nIn ? `in[${k - 2}]` : `s${k}`);
  const first = 2 + c.nIn;
  if (c.nSignals > first) L.push(`  wire ${Array.from({ length: c.nSignals - first }, (_, i) => `s${first + i}`).join(', ')};`);
  let inst = 0;
  for (const e of c.elements) {
    if (e.op === NAND) {
      L.push(`  assign s${e.firstOut} = ~(${s(e.ins[0])} & ${s(e.ins[1])});`);
    } else if (e.op === LATCH) {
      throw new Error('LATCH: stateful circuits are not exported');
    } else if (e.op === REF) {
      const outs = Array.from({ length: e.nOut }, (_, i) => `s${e.firstOut + e.nOut - 1 - i}`).join(', ');
      const ins = e.ins.length ? `{${e.ins.slice().reverse().map(s).join(', ')}}` : "1'b0";
      L.push(`  ${subName(refKey(e.cpu, e.cid))} u${inst++} (.in(${ins}), .out({${outs}}));`);
    }
  }
  for (let i = 0; i < c.nOut; i++) L.push(`  assign out[${i}] = ${s(c.nSignals - c.nOut + i)};`);
  L.push('endmodule');
  return L.join('\n');
}

/** Structural Verilog for a stateless TAP-02 netlist. `name` is the top module. */
export function toVerilog(netlist: Uint8Array, nIn: number, nOut: number, name: string,
  refs: RefResolver | null = null): string {
  const top = load(netlist, nIn, nOut, refs);
  if (top.nState !== 0) throw new Error('stateful circuits are not exported');
  const subs = new Map<string, string>();
  const parts: string[] = [];
  const subName = (key: string) => subs.get(key)!;
  const walk = (c: Circuit) => {
    for (const [key, sub] of c.subs) {
      if (subs.has(key)) continue;
      subs.set(key, `${name}_ref${subs.size}`);
      walk(sub);
      parts.push(`// REF target ${key}\n` + moduleText(sub, subs.get(key)!, subName));
    }
  };
  walk(top);
  parts.push(moduleText(top, name, subName));
  return `// Generated from TAP-02 bytes: ${netlist.length} bytes, nIn ${nIn}, nOut ${nOut}.\n` +
    `// First 16 bytes ${hex(netlist.subarray(0, 16))}\n` + parts.join('\n\n') + '\n';
}
