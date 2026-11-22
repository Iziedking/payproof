// P2: one real `eval` transaction of the split-v1 circuit (#8) on X Layer, signed by the owner.
// This file holds no key and sends nothing on the live chain.
//
//   node scripts/p2/eval-tx.mts plan <netlist dir> [vector index]
//       Prints the input bytes for a split-v1 rule vector, the output the local simulator and the
//       rule expect, the calldata, and the owner's `cast estimate` and `cast send` lines.
//   node scripts/p2/eval-tx.mts field <netlist dir> <name>
//       Prints one field of the plan for vector 0 (used by eval-dryrun.sh).
//   node scripts/p2/eval-tx.mts landed <rpc> <netlist dir> <tx hash> [vector index]
//       Checks a landed eval transaction: status, sender, target, the exact calldata of the plan,
//       gas used, and the block's gas limit. Prints one JSON line. Read-only.
//
// The output of a transaction is not in its receipt (eval emits no event). It is read back by
// replaying the transaction on a fork (scripts/p2/eval-dryrun.sh), not here.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate, load, refKey, type Circuit } from '../../compiler/src/netlist.ts';
import { pack } from '../../compiler/src/layout.ts';
import { keccakHex } from '../../vendor/tapekit/keccak.js';

const CIRCUITS = '0x1900801e311184063b9d9C119C9D98AA4950E12c';
const DEPLOYER = '0x5c807eA36fC11a72192d83ecff2b3D4746767612';
const GAS_PRICE = 20_000_001n;
const GAS_LIMIT = 107_000_000n; // fork estimate for this input 97,191,212, used 95,673,102 (p2.md section 2), times 1.1
const CPU = Uint8Array.from(Buffer.from(CIRCUITS.slice(2), 'hex'));
const hex = (b: Uint8Array) => '0x' + Buffer.from(b).toString('hex');
const w = (n: bigint | number) => BigInt(n).toString(16).padStart(64, '0');
const bytesArg = (h: string) => { const x = h.replace(/^0x/, ''); return w(x.length / 2) + x.padEnd(Math.ceil(x.length / 64) * 64, '0'); };
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

function plan(dir: string, index: number) {
  const ids: Record<string, string> = readJson(join(dir, 'ids.json'));
  const m = readJson(join(dir, 'manifest.json'));
  const top = m.pieces.find((p: any) => p.name === 'split_v1_top');
  const id = BigInt(ids.split_v1_top);
  const local = new Map<string, Circuit>();
  for (const p of m.pieces) if (p.refRecords === 0 && ids[p.name] !== undefined)
    local.set(refKey(CPU, BigInt(ids[p.name])), load(readFileSync(join(dir, `${p.name}.bin`)), p.nIn, p.nOut));
  const v = JSON.parse(readFileSync(new URL('../../rules/split-v1/vectors.json', import.meta.url), 'utf8')).vectors[index];
  const x = pack(top.inputs, Object.fromEntries(Object.entries(v.inputs).map(([k, s]) => [k, BigInt(s as string)])), top.nIn);
  const want = pack(top.outputs, Object.fromEntries(Object.entries(v.outputs).map(([k, s]) => [k, BigInt(s as string)])), top.nOut);
  const got = evaluate(readFileSync(join(dir, 'split_v1_top.bin')), top.nIn, top.nOut, x, (c, i) => local.get(refKey(c, i)) ?? null);
  if (hex(got) !== hex(want)) throw new Error(`local ${hex(got)} differs from the rule ${hex(want)}`);
  const data = keccakHex(new TextEncoder().encode('eval(uint256,bytes)')).slice(0, 10) + w(id) + w(64) + bytesArg(hex(x));
  const common = `--rpc-url https://xlayerrpc.okx.com --chain 196`;
  return { id: id.toString(), vector: index, inputs: v.inputs, why: v.why, inputBytes: hex(x), expected: v.outputs, expectedBytes: hex(want),
    data, gasLimit: GAS_LIMIT.toString(), gasPrice: GAS_PRICE.toString(),
    maxFeeOkb: Number(GAS_LIMIT * GAS_PRICE) / 1e18,
    estimate: `cast estimate ${CIRCUITS} "eval(uint256,bytes)" ${id} ${hex(x)} --from ${DEPLOYER} --rpc-url https://xlayerrpc.okx.com`,
    send: `cast send ${CIRCUITS} "eval(uint256,bytes)" ${id} ${hex(x)} --from ${DEPLOYER} --account payproof-deployer ${common} --legacy --gas-price ${GAS_PRICE} --gas-limit ${GAS_LIMIT}` };
}

async function landed(rpcUrl: string, dir: string, hash: string, index: number) {
  let rid = 1;
  const rpc = async (method: string, params: unknown[]) => {
    const j: any = await (await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method, params }) })).json();
    if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
    return j.result;
  };
  const p = plan(dir, index);
  const tx = await rpc('eth_getTransactionByHash', [hash]);
  const r = await rpc('eth_getTransactionReceipt', [hash]);
  if (!tx || !r) throw new Error('transaction or receipt not found');
  const fail: string[] = [];
  if (Number(BigInt(r.status)) !== 1) fail.push(`status ${r.status}`);
  if (tx.from.toLowerCase() !== DEPLOYER.toLowerCase()) fail.push(`from ${tx.from}`);
  if (String(tx.to).toLowerCase() !== CIRCUITS.toLowerCase()) fail.push(`to ${tx.to}`);
  if (tx.input.toLowerCase() !== p.data.toLowerCase()) fail.push('calldata differs from the plan');
  const block = await rpc('eth_getBlockByNumber', [r.blockNumber, false]);
  const out = { tx: hash, block: Number(BigInt(r.blockNumber)), status: Number(BigInt(r.status)), gasUsed: Number(BigInt(r.gasUsed)),
    gasLimit: Number(BigInt(tx.gas)), gasPrice: BigInt(tx.gasPrice).toString(), feeOkb: Number(BigInt(r.gasUsed) * BigInt(tx.gasPrice)) / 1e18,
    blockGasUsed: Number(BigInt(block.gasUsed)), blockGasLimit: Number(BigInt(block.gasLimit)), logs: r.logs.length,
    circuit: p.id, inputBytes: p.inputBytes, expectedBytes: p.expectedBytes, fail };
  console.log(JSON.stringify(out));
  if (fail.length) process.exit(1);
}

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'plan') console.log(JSON.stringify(plan(a[0], Number(a[1] ?? 0)), null, 2));
else if (cmd === 'field') console.log((plan(a[0], 0) as any)[a[1]]);
else if (cmd === 'landed') await landed(a[0], a[1], a[2], Number(a[3] ?? 0));
else { console.error('commands: plan, landed (see the header)'); process.exit(2); }
