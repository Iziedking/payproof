// P3, split-v1: read circuit 8 (the check a claim runs) and every circuit it references from
// X Layer at one pinned block, check each hash against the tape-out record, and write the
// Verilog that scripts/p3/split-chain.sh proves. Nothing here is a proof; it only prepares files.
// Usage: node scripts/p3/split-export.mts <rpc> <out-dir>
//
// Files written to <out-dir>:
//   c8.v           circuit 8 exported from its bytes, with each REF target as its own module
//   cK.v           each REF target K exported on its own (module cK, ports in/out)
//   gK.v, gK-mut.v the RTL module for K (spikes/p0/rtl/split_check_mod.v) behind the same ports,
//                  and a control that changes one constant; used by link 2
//   c8-rtlrefs.v   circuit 8's own gates with every REF target replaced by its RTL wrapper; used
//                  by link 3 (circuit 8 equals split_check_mod)
//   chain.json     block, circuits read (id, keccak, gates) and which RTL module each REF is
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { toVerilog } from '../../prover/src/export.ts';
import { latestBlock, readCircuit, rpcAt } from '../../prover/src/chain.ts';
import { pieceOf } from './common.mts';

const [rpcUrl, outDir] = process.argv.slice(2);
if (!rpcUrl || !outDir) throw new Error('usage: split-export.mts <rpc> <out-dir>');
mkdirSync(outDir, { recursive: true });
const rpc = rpcAt(rpcUrl);
const block = await latestBlock(rpc);
const top = pieceOf('split_v1_top');
const c8 = await readCircuit(rpc, BigInt(top.id), block, top.piece.keccak256);
console.log(`pinned block ${block}; circuit 8 keccak ${c8.ref.netlistKeccak}; ${c8.read.length - 1} REF targets`);

// The RTL module behind each referenced piece, with its port slices from the tape-out layout.
const RTL: Record<string, { inst: (u: string) => string; mut: string }> = {
  m_mul_tmc_32: { inst: (u) => `m_mul #(.W(32)) ${u} (.a(in[31:0]), .b(in[63:32]), .y(out));`, mut: '' },
  m_x8500: { inst: (u) => `m_x8500 #(.W(32), .HOLDER_BPS(8500)) ${u} (.a(in[63:0]), .y(out));`, mut: 'assign out = in[63:0] * 8499;' },
  m_add: { inst: (u) => `m_add #(.W(32)) ${u} (.a(in[77:0]), .b(in[123:78]), .y(out));`, mut: 'assign out = in[77:0] + in[123:78] + 1;' },
  m_x10000_narrow: { inst: (u) => `m_x10000_narrow #(.W(32)) ${u} (.a(in[31:0]), .y(out));`, mut: 'assign out = in[31:0] * 10001;' },
  m_x10000_wide: { inst: (u) => `m_x10000_wide #(.W(32)) ${u} (.a(in[63:0]), .y(out));`, mut: 'assign out = in[63:0] * 10001;' },
};
const refIds = (top.piece as unknown as { refs: Record<string, string> }).refs ?? {};
const byId = new Map(Object.entries(refIds).map(([n, id]) => [id, n]));

const mods: { id: string; piece: string; keccak: string; gates: number; nIn: number; nOut: number }[] = [];
for (const r of c8.read.slice(1)) {
  const name = byId.get(r.id);
  if (!name || !RTL[name]) throw new Error(`REF target ${r.id} is not one of the recorded split modules`);
  const p = pieceOf(name);
  if (r.netlistKeccak !== p.piece.keccak256.toLowerCase()) throw new Error(`REF target ${r.id}: keccak ${r.netlistKeccak}, recorded ${p.piece.keccak256}`);
  if (r.nIn !== p.piece.nIn || r.nOut !== p.piece.nOut) throw new Error(`REF target ${r.id}: ports differ from the record`);
  const sub = await readCircuit(rpc, BigInt(r.id), block, p.piece.keccak256);
  writeFileSync(join(outDir, `c${r.id}.v`), toVerilog(sub.bytes, r.nIn, r.nOut, `c${r.id}`, sub.refs));
  const ports = `(input [${r.nIn - 1}:0] in, output [${r.nOut - 1}:0] out)`;
  writeFileSync(join(outDir, `g${r.id}.v`), `module g${r.id} ${ports};\n  ${RTL[name].inst('u')}\nendmodule\n`);
  if (RTL[name].mut) writeFileSync(join(outDir, `g${r.id}-mut.v`), `module g${r.id} ${ports};\n  ${RTL[name].mut}\nendmodule\n`);
  mods.push({ id: r.id, piece: name, keccak: r.netlistKeccak, gates: r.gateCount, nIn: r.nIn, nOut: r.nOut });
  console.log(`REF target ${r.id} = ${name}: keccak ${r.netlistKeccak}, ${r.gateCount} gates`);
}

// Circuit 8 with its REF modules, and the same top with RTL wrappers in their place.
const full = toVerilog(c8.bytes, c8.ref.nIn, c8.ref.nOut, 'c8', c8.refs);
writeFileSync(join(outDir, 'c8.v'), full);
const parts = full.split(/\n\n/);
const topText = parts[parts.length - 1];
const wrappers: string[] = [];
for (const part of parts.slice(0, -1)) {
  const key = part.match(/^\/\/ REF target [0-9a-f]+:(\d+)/m);
  const mod = part.match(/^module (\S+) \((input \[\d+:0\] in, output \[\d+:0\] out)\);/m);
  if (!key || !mod) throw new Error('unexpected part in the export of circuit 8');
  const name = byId.get(key[1])!;
  wrappers.push(`// RTL in place of circuit ${key[1]} (${name})\nmodule ${mod[1]} (${mod[2]});\n  ${RTL[name].inst('u')}\nendmodule`);
}
if (wrappers.length !== mods.length) throw new Error(`${wrappers.length} REF modules in the export, ${mods.length} read`);
writeFileSync(join(outDir, 'c8-rtlrefs.v'), `${wrappers.join('\n\n')}\n\n${topText}`);
// The RTL top behind circuit 8's port layout (pot, shares, total, payout; ok).
writeFileSync(join(outDir, 'g8.v'), 'module g8 (input [127:0] in, output [0:0] out);\n' +
  '  split_check_mod #(.W(32), .HOLDER_BPS(8500)) u (.pot(in[31:0]), .shares(in[63:32]), .total(in[95:64]), .payout(in[127:96]), .ok(out[0]));\nendmodule\n');
writeFileSync(join(outDir, 'chain.json'), JSON.stringify({ block, circuit8: c8.ref, refs: mods, at: new Date().toISOString() }, null, 2) + '\n');
console.log('export done');
