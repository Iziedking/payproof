// Yosys JSON (after `abc -g NAND; opt_clean -purge`) to TAP-02 netlist bytes and a field layout.
//
// Cells may be $_NAND_, $_NOT_, or an instance of another module of the same JSON that is
// already on chain; such an instance becomes one REF record to that circuit (pass `refs`).
// With no instances this is a port of scripts/p0/yosys2tap.py, which produced every P0 tape-out
// file; the tests check that both give the same bytes. Rules:
// - Input ports in port order take signals 2, 3, ...; output ports in port order are the last
//   nOut signals.
// - A NOT becomes NAND(x, x).
// - A REF record's inputs are the instance's input-port bits and its outputs the output-port
//   bits, both in the target module's port order (the order fromYosys gives that module).
// - A NAND or NOT cell that drives exactly one output bit and nothing else is emitted last, at
//   its output position. Any other output bit gets a fresh NOT copy (when its driver is a NOT),
//   a constant from NAND(1,1) or NAND(0,0), or a two-gate buffer.
import { NAND, REF, encode, type Element } from './netlist.ts';
import type { Field } from './layout.ts';

type Bit = number | string;
type YosysCell = { type: string; connections: Record<string, Bit[]> };
type YosysPort = { direction: string; bits: Bit[] };
type YosysModule = { ports: Record<string, YosysPort>; cells: Record<string, YosysCell> };
export type YosysJson = { modules: Record<string, YosysModule> };

/** Where an instantiated module lives on chain. */
export type RefTarget = { cpu: Uint8Array; id: bigint };

export type Compiled = {
  module: string; nIn: number; nOut: number;
  gates: number;                 // NAND records in this netlist (REF records not counted)
  refRecords: number;
  bytes: Uint8Array;
  inputs: Field[]; outputs: Field[];
};

type C = { kind: 'nand' | 'not' | 'ref'; ins: Bit[]; outs: Bit[]; type: string };

function portsOf(mod: YosysModule) {
  const inPorts: [string, Bit[]][] = [];
  const outPorts: [string, Bit[]][] = [];
  for (const [name, p] of Object.entries(mod.ports)) {
    if (p.direction === 'input') inPorts.push([name, p.bits]);
    else if (p.direction === 'output') outPorts.push([name, p.bits]);
    else throw new Error(`unsupported port direction ${p.direction}`);
  }
  return { inPorts, outPorts };
}

export function fromYosys(json: YosysJson, top: string, refs: Map<string, RefTarget> = new Map()): Compiled {
  const mod = json.modules[top];
  if (!mod) throw new Error(`module ${top} not in the Yosys JSON`);
  const { inPorts, outPorts } = portsOf(mod);

  const sig = new Map<number, number>();
  let nIn = 0;
  const inputs: Field[] = [];
  for (const [name, bits] of inPorts) {
    inputs.push({ name, offset: nIn, width: bits.length });
    for (const b of bits) {
      if (typeof b !== 'number') throw new Error(`constant bit on input port ${name}`);
      sig.set(b, 2 + nIn);
      nIn++;
    }
  }

  const cells = new Map<string, C>();
  const driver = new Map<number, string>();
  for (const [cname, c] of Object.entries(mod.cells)) {
    let cell: C;
    if (c.type === '$_NAND_') cell = { kind: 'nand', ins: [c.connections.A[0], c.connections.B[0]], outs: [c.connections.Y[0]], type: c.type };
    else if (c.type === '$_NOT_') cell = { kind: 'not', ins: [c.connections.A[0]], outs: [c.connections.Y[0]], type: c.type };
    else if (refs.has(c.type)) {
      const sub = json.modules[c.type];
      if (!sub) throw new Error(`instance ${cname} of ${c.type}: module not in the JSON`);
      const sp = portsOf(sub);
      const ins = sp.inPorts.flatMap(([p, bits]) => { const x = c.connections[p]; if (!x || x.length !== bits.length) throw new Error(`instance ${cname}: port ${p} width`); return x; });
      const outs = sp.outPorts.flatMap(([p, bits]) => { const x = c.connections[p]; if (!x || x.length !== bits.length) throw new Error(`instance ${cname}: port ${p} width`); return x; });
      if (ins.length > 255 || outs.length > 255) throw new Error(`instance ${cname} of ${c.type}: ${ins.length} inputs, ${outs.length} outputs; a REF allows at most 255 each`);
      cell = { kind: 'ref', ins, outs, type: c.type };
    } else throw new Error(`unexpected cell type ${c.type}: run abc -g NAND and opt_clean first, or pass it in refs`);
    for (const y of cell.outs) {
      if (typeof y !== 'number') { if (cell.kind === 'ref') continue; throw new Error(`cell ${cname} drives a constant`); }
      driver.set(y, cname);
    }
    cells.set(cname, cell);
  }
  const constOf = (b: Bit): number | null => (b === '0' ? 0 : b === '1' ? 1 : null);
  for (const [cname, c] of cells) {
    for (const b of c.ins) if (typeof b === 'string' && constOf(b) === null) throw new Error(`undefined bit ${JSON.stringify(b)} feeding ${cname}`);
  }

  const users = new Map<string, number>();
  for (const c of cells.values()) for (const b of c.ins) {
    if (typeof b === 'number' && driver.has(b)) { const d = driver.get(b)!; users.set(d, (users.get(d) ?? 0) + 1); }
  }
  const outBits: Bit[] = outPorts.flatMap(([, bits]) => bits);
  const outUses = new Map<string, number>();
  for (const b of outBits) if (typeof b === 'number' && driver.has(b)) { const d = driver.get(b)!; outUses.set(d, (outUses.get(d) ?? 0) + 1); }
  const deferred = new Set<string>();
  for (const b of outBits) {
    const cn = typeof b === 'number' ? driver.get(b) : undefined;
    if (cn !== undefined && cells.get(cn)!.kind !== 'ref' && (users.get(cn) ?? 0) === 0 && outUses.get(cn) === 1) deferred.add(cn);
  }

  // Topological order by iterative depth-first search, in the same visiting order as the P0 tool.
  const order: string[] = [];
  const state = new Map<string, number>();
  const visit = (start: string) => {
    const stack: [string, boolean][] = [[start, false]];
    while (stack.length) {
      const [n, done] = stack.pop()!;
      if (done) { if (state.get(n) !== 2) { state.set(n, 2); order.push(n); } continue; }
      if (state.get(n) === 2) continue;
      if (state.get(n) === 1) throw new Error('combinational loop');
      state.set(n, 1);
      stack.push([n, true]);
      for (const b of cells.get(n)!.ins) {
        const d = typeof b === 'number' ? driver.get(b) : undefined;
        if (d !== undefined && state.get(d) !== 2) stack.push([d, false]);
      }
    }
  };
  for (const cn of cells.keys()) if (!deferred.has(cn)) visit(cn);
  for (const cn of deferred) for (const b of cells.get(cn)!.ins) {
    if (typeof b === 'number' && deferred.has(driver.get(b) ?? '')) throw new Error('deferred cell feeds deferred cell');
  }

  const els: Element[] = [];
  let nextSig = 2 + nIn;
  let gates = 0;
  const ref = (b: Bit): number => {
    if (typeof b === 'string') return constOf(b)!;
    const s = sig.get(b);
    if (s === undefined) throw new Error(`bit ${b} used before it is driven`);
    return s;
  };
  const emit = (a: number, b: number): number => {
    els.push({ op: NAND, ins: [a, b], cpu: new Uint8Array(0), cid: 0n, nOut: 1, firstOut: nextSig });
    gates++;
    return nextSig++;
  };

  for (const cn of order) {
    const c = cells.get(cn)!;
    if (c.kind === 'ref') {
      const t = refs.get(c.type)!;
      if (t.cpu.length !== 20) throw new Error(`REF target ${c.type}: cpu must be 20 bytes`);
      els.push({ op: REF, ins: c.ins.map(ref), cpu: t.cpu, cid: t.id, nOut: c.outs.length, firstOut: nextSig });
      c.outs.forEach((y, i) => { if (typeof y === 'number') sig.set(y, nextSig + i); });
      nextSig += c.outs.length;
    } else {
      const a = ref(c.ins[0]);
      sig.set(c.outs[0] as number, emit(a, c.kind === 'not' ? a : ref(c.ins[1])));
    }
  }

  const outputs: Field[] = [];
  let off = 0;
  for (const [name, bits] of outPorts) { outputs.push({ name, offset: off, width: bits.length }); off += bits.length; }
  const tail: [number, number][] = [];
  for (const b of outBits) {
    const cn = typeof b === 'number' ? driver.get(b) : undefined;
    const c = cn !== undefined ? cells.get(cn)! : undefined;
    if (cn !== undefined && deferred.has(cn)) {
      const a = ref(c!.ins[0]);
      tail.push([a, c!.kind === 'not' ? a : ref(c!.ins[1])]);
    } else if (c !== undefined && c.kind === 'not') {
      const a = ref(c.ins[0]);
      tail.push([a, a]);
    } else {
      const k = constOf(b);
      if (k !== null) tail.push(k === 0 ? [1, 1] : [0, 0]);
      else { const s = ref(b); const inv = emit(s, s); tail.push([inv, inv]); }
    }
  }
  for (const [a, b] of tail) emit(a, b);

  for (const e of els) for (const s of e.ins) if (s >= 1 << 24) throw new Error('signal index above u24');
  return { module: top, nIn, nOut: outBits.length, gates, refRecords: els.length - gates, bytes: encode(els), inputs, outputs };
}
