// Read circuits from X Layer at one pinned block (PLAN 11.2 prover rule 1, L14: proofs run on
// the bytes on chain, never on our Verilog).
//
// Calls, from the processor interface (PLAN section 6, docs/evidence/p0/selectors.txt):
//   circuitInfo(uint256) 0x084d60f1 -> (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount)
//   netlist(uint256)     0x3fc4be56 -> bytes
// Every read names the block, so all circuits in one record come from the same chain state.
// A REF target is read the same way and checked to be stateless; the resolver given to the
// compiler only ever returns circuits read here.
import { keccakHex } from '../../vendor/tapekit/keccak.js';
import { REF, decode, load, refKey, type Circuit, type RefResolver } from '../../compiler/src/netlist.ts';

export const CHAIN_ID = 196;
export const CIRCUITS = '0x1900801e311184063b9d9c119c9d98aa4950e12c';
const CIRCUIT_INFO = '0x084d60f1';
const NETLIST = '0x3fc4be56';

export type OnChainCircuit = {
  chainId: 196; cpu: `0x${string}`; id: string; netlistKeccak: `0x${string}`; gateCount: number;
  nIn: number; nOut: number;
};

export type ChainCircuit = {
  ref: OnChainCircuit;
  bytes: Uint8Array;
  refs: RefResolver;               // resolves every REF target to a circuit read at the same block
  read: OnChainCircuit[];          // this circuit first, then each REF target once
  blockNumber: number;
};

const hexToBytes = (h: string): Uint8Array => {
  const s = h.replace(/^0x/, '');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(2 * i, 2 * i + 2), 16);
  return out;
};
const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const word = (n: bigint): string => n.toString(16).padStart(64, '0');

export function rpcAt(url: string) {
  let id = 0;
  return async (method: string, params: unknown[]): Promise<string> => {
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
        const j = await r.json() as { result?: string; error?: { message?: string } };
        if (j.error) throw new Error(`${method}: ${j.error.message ?? JSON.stringify(j.error)}`);
        if (typeof j.result !== 'string') throw new Error(`${method}: no result`);
        return j.result;
      } catch (e) {
        if (attempt >= 5) throw e;
        await new Promise((res) => setTimeout(res, 1000 * attempt));
      }
    }
  };
}
export type Rpc = ReturnType<typeof rpcAt>;

export async function latestBlock(rpc: Rpc): Promise<number> {
  return Number(BigInt(await rpc('eth_blockNumber', [])));
}

function decodeBytes(ret: string): Uint8Array {
  const h = ret.replace(/^0x/, '');
  const off = Number(BigInt('0x' + h.slice(0, 64))) * 2;
  const len = Number(BigInt('0x' + h.slice(off, off + 64)));
  return hexToBytes(h.slice(off + 64, off + 64 + len * 2));
}

async function readOne(rpc: Rpc, cpu: string, id: bigint, block: number) {
  const tag = '0x' + block.toString(16);
  const info = (await rpc('eth_call', [{ to: cpu, data: CIRCUIT_INFO + word(id) }, tag])).replace(/^0x/, '');
  if (info.length < 256) throw new Error(`circuitInfo(${id}) on ${cpu}: short reply`);
  const [nIn, nOut, nState, gateCount] = [0, 1, 2, 3].map((k) => Number(BigInt('0x' + info.slice(64 * k, 64 * k + 64))));
  const bytes = decodeBytes(await rpc('eth_call', [{ to: cpu, data: NETLIST + word(id) }, tag]));
  if (bytes.length === 0) throw new Error(`netlist(${id}) on ${cpu}: empty at block ${block}`);
  if (nState !== 0) throw new Error(`circuit ${id} on ${cpu} has state (${nState}); Payproof rules are stateless (L9)`);
  const ref: OnChainCircuit = { chainId: CHAIN_ID, cpu: cpu.toLowerCase() as `0x${string}`, id: id.toString(),
    netlistKeccak: keccakHex(bytes) as `0x${string}`, gateCount, nIn, nOut };
  return { ref, bytes };
}

/**
 * Read circuit `id` and, recursively, every circuit it references, all at `block`.
 * `expectKeccak` is the hash recorded when the circuit was taped out; a different reply stops the run.
 */
export async function readCircuit(rpc: Rpc, id: bigint, block: number, expectKeccak?: string,
  cpu: string = CIRCUITS): Promise<ChainCircuit> {
  const top = await readOne(rpc, cpu, id, block);
  if (expectKeccak && top.ref.netlistKeccak !== expectKeccak.toLowerCase()) {
    throw new Error(`circuit ${id}: keccak ${top.ref.netlistKeccak} at block ${block}, expected ${expectKeccak}`);
  }
  const read: OnChainCircuit[] = [top.ref];
  const loaded = new Map<string, Circuit>();
  const raw = new Map<string, { nIn: number; nOut: number; bytes: Uint8Array }>();
  // First pass: fetch every REF target (a REF record names a processor and an id).
  const pending: { nIn: number; bytes: Uint8Array }[] = [{ nIn: top.ref.nIn, bytes: top.bytes }];
  while (pending.length) {
    const c = pending.pop()!;
    for (const e of decode(c.bytes, c.nIn)) {
      if (e.op !== REF) continue;
      const key = refKey(e.cpu, e.cid);
      if (raw.has(key)) continue;
      const sub = await readOne(rpc, '0x' + hex(e.cpu), e.cid, block);
      raw.set(key, { nIn: sub.ref.nIn, nOut: sub.ref.nOut, bytes: sub.bytes });
      read.push(sub.ref);
      pending.push({ nIn: sub.ref.nIn, bytes: sub.bytes });
    }
  }
  const refs: RefResolver = (c, i) => {
    const key = refKey(c, i);
    if (loaded.has(key)) return loaded.get(key)!;
    const r = raw.get(key);
    if (!r) return null;
    const circuit = load(r.bytes, r.nIn, r.nOut, refs);
    loaded.set(key, circuit);
    return circuit;
  };
  return { ref: top.ref, bytes: top.bytes, refs, read, blockNumber: block };
}
