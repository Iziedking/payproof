// P2 dry run, SIMULATION: tape out the three rules' decision circuits on an anvil fork of
// X Layer as the impersonated deployer, then compare on-chain `eval` (eth_call on the fork)
// with the local simulator. Nothing is sent to the live chain and no key is used.
//
//   node scripts/p2/fork-tapeout.mts <fork rpc> <json dir> <out.json>
//
// split-v1: split_check_modc_32.ref.json. Every module except the top is taped out on its own
// (dependency order), then the top, whose instances become REF records to them. cn-bonus and
// ng-paye: their flat netlists. Calls and encodings as in scripts/p1/fork-gas.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromYosys, type RefTarget, type YosysJson } from '../../compiler/src/yosys.ts';
import { evaluate, load, refKey, type Circuit } from '../../compiler/src/netlist.ts';
import { pack, unpack } from '../../compiler/src/layout.ts';
// @ts-ignore: plain JS module, vendored unchanged
import { keccakHex } from '../../vendor/tapekit/keccak.js';

const [FORK, JSON_DIR, OUT] = process.argv.slice(2);
const DEPLOYER = '0x5c807eA36fC11a72192d83ecff2b3D4746767612';
const CIRCUITS = '0x1900801e311184063b9d9c119c9d98aa4950e12c';
const CPU = Uint8Array.from(Buffer.from(CIRCUITS.slice(2), 'hex'));
const LIVE_GAS_PRICE = '0x' + (20000001).toString(16); // read on the live chain, P1 fork run

let rid = 1;
async function rpc(method: string, params: unknown[]): Promise<any> {
  const r = await fetch(FORK, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}
const sel = (s: string) => keccakHex(new TextEncoder().encode(s)).slice(0, 10);
const w = (n: bigint | number) => BigInt(n).toString(16).padStart(64, '0');
const bytesArg = (hex: string) => { const h = hex.replace(/^0x/, ''); return w(h.length / 2) + h.padEnd(Math.ceil(h.length / 64) * 64, '0'); };
function encodeDynamic(heads: (string | { tail: string })[]) {
  let off = heads.length * 32; const h: string[] = []; const t: string[] = [];
  for (const x of heads) { if (typeof x === 'string') h.push(x); else { h.push(w(off)); t.push(x.tail); off += x.tail.length / 2; } }
  return h.join('') + t.join('');
}
const hex = (b: Uint8Array) => '0x' + Buffer.from(b).toString('hex');
const num = (h: string) => Number(BigInt(h));
const decodeBytes = (ret: string) => { const h = ret.slice(2); const off = Number(BigInt('0x' + h.slice(0, 64))) * 2;
  const len = Number(BigInt('0x' + h.slice(off, off + 64))); return '0x' + h.slice(off + 64, off + 64 + len * 2); };
const TRANSFER = keccakHex(new TextEncoder().encode('Transfer(address,address,uint256)'));

async function receipt(hash: string) {
  for (let i = 0; i < 60; i++) { const r = await rpc('eth_getTransactionReceipt', [hash]); if (r) return r; await new Promise((z) => setTimeout(z, 1000)); }
  throw new Error(`no receipt for ${hash}`);
}

const fee = BigInt(await rpc('eth_call', [{ to: CIRCUITS, data: sel('TAPEOUT_FEE()') }, 'latest']));
await rpc('anvil_impersonateAccount', [DEPLOYER]);
const out: any = { simulation: true, startedUtc: new Date().toISOString(), forkBlock: num(await rpc('eth_blockNumber', [])),
  tapeoutFeeWei: fee.toString(), tapeouts: [], checks: [] };
const blockGasLimit = num((await rpc('eth_getBlockByNumber', ['latest', false])).gasLimit);

async function tapeout(label: string, bytes: Uint8Array, nIn: number, nOut: number, gates: number, refRecords: number) {
  const data = sel('tapeout(bytes,uint32,uint32)') + encodeDynamic([{ tail: bytesArg(hex(bytes)) }, w(nIn), w(nOut)]);
  const tx = { from: DEPLOYER, to: CIRCUITS, data, value: '0x' + fee.toString(16) };
  const est = num(await rpc('eth_estimateGas', [tx, 'latest']));
  const gas = Math.min(Math.ceil(est * 1.1), blockGasLimit);
  const hash = await rpc('eth_sendTransaction', [{ ...tx, gas: '0x' + gas.toString(16), gasPrice: LIVE_GAS_PRICE }]);
  const r = await receipt(hash);
  const log = r.logs.find((l: any) => l.address.toLowerCase() === CIRCUITS && l.topics[0] === TRANSFER);
  const id = BigInt(log.topics[3]);
  const info = await rpc('eth_call', [{ to: CIRCUITS, data: sel('circuitInfo(uint256)') + w(id) }, 'latest']);
  const infoGates = Number(BigInt('0x' + info.slice(2 + 3 * 64, 2 + 4 * 64)));
  const row = { label, id: id.toString(), bytes: bytes.length, nIn, nOut, nandRecords: gates, refRecords,
    calldataChars: data.length, status: num(r.status), gasEstimate: est, gasUsed: num(r.gasUsed), circuitInfoGates: infoGates };
  out.tapeouts.push(row);
  console.log(JSON.stringify(row));
  return id;
}

async function compare(label: string, id: bigint, nIn: number, nOut: number, bytes: Uint8Array,
  resolve: ((cpu: Uint8Array, id: bigint) => Circuit | null) | null, inputs: Uint8Array[], oracle: (x: Uint8Array) => string | null) {
  let mismatch = 0; let oracleMismatch = 0; let gasMin = Infinity; let gasMax = 0; const examples: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const x = inputs[i];
    const tx = { from: DEPLOYER, to: CIRCUITS, data: sel('eval(uint256,bytes)') + encodeDynamic([w(id), { tail: bytesArg(hex(x)) }]) };
    const chain = decodeBytes(await rpc('eth_call', [tx, 'latest']));
    const local = hex(evaluate(bytes, nIn, nOut, x, resolve));
    if (chain !== local) { mismatch++; if (examples.length < 3) examples.push(`in ${hex(x)} chain ${chain} local ${local}`); }
    const o = oracle(x);
    if (o !== null && o !== local) { oracleMismatch++; if (examples.length < 3) examples.push(`in ${hex(x)} rule ${o} local ${local}`); }
    if (i < 3) { const g = num(await rpc('eth_estimateGas', [tx, 'latest'])); gasMin = Math.min(gasMin, g); gasMax = Math.max(gasMax, g); }
  }
  const row = { label, id: id.toString(), cases: inputs.length, chainVsLocalMismatches: mismatch, ruleVsLocalMismatches: oracleMismatch,
    evalGasEstimateFirst3: [gasMin, gasMax], examples };
  out.checks.push(row);
  console.log(JSON.stringify(row));
}

let seed = 20261121n;
const rnd = (bits: number) => { let v = 0n; for (let k = 0; k < bits; k += 32) { seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); v = (v << 32n) | (seed >> 32n); } return v & ((1n << BigInt(bits)) - 1n); };
const rules = (r: string) => JSON.parse(readFileSync(new URL(`../../rules/${r}/vectors.json`, import.meta.url), 'utf8'));

// ---- split-v1, REF-joined ----
{
  const j = JSON.parse(readFileSync(join(JSON_DIR, 'split_check_modc_32.ref.json'), 'utf8')) as YosysJson;
  const topName = 'split_check_mod';
  const order = ['m_mul_tmc_32', ...Object.keys(j.modules).filter((m) => m !== topName && m !== 'm_mul_tmc_32')];
  const refs = new Map<string, RefTarget>();
  const local = new Map<string, Circuit>();
  const resolve = (cpu: Uint8Array, id: bigint) => local.get(refKey(cpu, id)) ?? null;
  for (const m of order) {
    const c = fromYosys(j, m);
    if (c.refRecords !== 0) throw new Error(`${m} has REF records; order modules by dependency`);
    const id = await tapeout(`split-v1 module ${m}`, c.bytes, c.nIn, c.nOut, c.gates, 0);
    refs.set(m, { cpu: CPU, id });
    local.set(refKey(CPU, id), load(c.bytes, c.nIn, c.nOut));
  }
  const top = fromYosys(j, topName, refs);
  const topId = await tapeout('split-v1 top (REF-joined)', top.bytes, top.nIn, top.nOut, top.gates, top.refRecords);
  const ok = (x: Uint8Array) => {
    const v = unpack(top.inputs, x);
    const valid = v.total !== 0n && v.shares <= v.total;
    const lhs = v.payout * v.total * 10000n; const rhs = v.pot * v.shares * 8500n;
    return hex(pack(top.outputs, { ok: valid && lhs <= rhs && rhs < lhs + v.total * 10000n ? 1n : 0n }, top.nOut));
  };
  const xs: Uint8Array[] = rules('split-v1').vectors.map((v: any) => pack(top.inputs, Object.fromEntries(Object.entries(v.inputs).map(([k, s]) => [k, BigInt(s as string)])), top.nIn));
  for (let i = 0; i < 200; i++) {
    const total = rnd(32) | 1n; const shares = rnd(32) % (total + 1n); const pot = rnd(32);
    const exact = (pot * shares * 8500n) / (10000n * total);
    const payout = i % 4 === 0 ? rnd(32) : (exact + BigInt((i % 3) - 1)) & 0xffffffffn;
    xs.push(pack(top.inputs, { pot, shares, total, payout }, top.nIn));
  }
  await compare('split-v1 top', topId, top.nIn, top.nOut, top.bytes, resolve, xs, ok);
  const tx = { from: DEPLOYER, to: CIRCUITS, data: sel('eval(uint256,bytes)') + encodeDynamic([w(topId), { tail: bytesArg(hex(xs[0])) }]) };
  const est = num(await rpc('eth_estimateGas', [tx, 'latest']));
  const h = await rpc('eth_sendTransaction', [{ ...tx, gas: '0x' + Math.min(Math.ceil(est * 1.1), blockGasLimit).toString(16), gasPrice: LIVE_GAS_PRICE }]);
  const r = await receipt(h);
  out.splitEvalTx = { status: num(r.status), gasUsed: num(r.gasUsed), estimate: est };
  console.log(JSON.stringify(out.splitEvalTx));
}

// ---- cn-bonus and ng-paye, flat ----
for (const [name, rule] of [['cn_bonus', 'cn-bonus-2023-30'], ['ng_paye', 'ng-paye-nta2025']]) {
  const c = fromYosys(JSON.parse(readFileSync(join(JSON_DIR, `${name}.json`), 'utf8')), name);
  const id = await tapeout(`${rule} decision (flat)`, c.bytes, c.nIn, c.nOut, c.gates, 0);
  const vec = rules(rule).vectors;
  const xs: Uint8Array[] = []; const want = new Map<string, string>();
  for (const v of vec) {
    const x = pack(c.inputs, Object.fromEntries(Object.entries(v.inputs).map(([k, s]) => [k, BigInt(s as string)])), c.nIn);
    xs.push(x); want.set(hex(x), hex(pack(c.outputs, Object.fromEntries(Object.entries(v.outputs).map(([k, s]) => [k, BigInt(s as string)])), c.nOut)));
  }
  for (let i = 0; i < 1000; i++) xs.push(pack(c.inputs, Object.fromEntries(c.inputs.map((f) => [f.name, rnd(f.width)])), c.nIn));
  await compare(`${rule} decision`, id, c.nIn, c.nOut, c.bytes, null, xs, (x) => want.get(hex(x)) ?? null);
}

out.finishedUtc = new Date().toISOString();
writeFileSync(OUT, JSON.stringify(out, null, 2));
const bad = out.checks.reduce((s: number, r: any) => s + r.chainVsLocalMismatches + r.ruleVsLocalMismatches, 0);
console.log(`total mismatches ${bad}`);
process.exit(bad ? 1 : 0);
