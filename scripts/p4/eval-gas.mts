// P4 cost input: gas of `eval(uint256,bytes)` for every Payproof circuit on X Layer, by
// eth_estimateGas against the live chain (read only: nothing is signed or sent), plus the gas
// price and the deployer balance at the same block.
// Usage: node scripts/p4/eval-gas.mts <rpc> <out.json>
// Inputs are sourced vectors from rules/*/vectors.json where a field layout matches, else zeros;
// the processor evaluates every gate whatever the input, so the input changes the gas little.
// That is checked here by estimating two different inputs per circuit.
import { readFileSync, writeFileSync } from 'node:fs';
import { pack, type Field } from '../../compiler/src/layout.ts';
import { CIRCUITS, latestBlock, rpcAt } from '../../prover/src/chain.ts';

const [rpcUrl, out] = process.argv.slice(2);
const rpc = rpcAt(rpcUrl);
const DEPLOYER = '0x5c807eA36fC11a72192d83ecff2b3D4746767612';
const block = await latestBlock(rpc);
const tag = '0x' + block.toString(16);
type Piece = { name: string; nIn: number; nOut: number; inputs: Field[] };
const pieces: Piece[] = [
  ...JSON.parse(readFileSync('chain/netlists/manifest.json', 'utf8')).pieces,
  ...JSON.parse(readFileSync('chain/netlists/explain/manifest.json', 'utf8')).pieces];
const ids: Record<string, string> = { ...JSON.parse(readFileSync('chain/netlists/ids.json', 'utf8')),
  ...JSON.parse(readFileSync('chain/netlists/explain/ids.json', 'utf8')) };

const call = (id: string, input: Uint8Array) => {
  const hex = Array.from(input, (b) => b.toString(16).padStart(2, '0')).join('');
  return '0x934d06ea' + BigInt(id).toString(16).padStart(64, '0') + (64n).toString(16).padStart(64, '0') +
    input.length.toString(16).padStart(64, '0') + hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
};
const rows = [];
for (const [name, id] of Object.entries(ids)) {
  const p = pieces.find((x) => x.name === name);
  if (!p) throw new Error(`no manifest entry for ${name}`);
  const a = new Uint8Array(Math.ceil(p.nIn / 8));
  const vals: Record<string, bigint> = {};
  for (const f of p.inputs) vals[f.name] = (1n << BigInt(Math.min(f.width, 20))) - 1n;   // a second, non-zero input
  const b = pack(p.inputs, vals, p.nIn);
  const gas = [];
  for (const input of [a, b]) {
    gas.push(Number(BigInt(await rpc('eth_estimateGas', [{ from: DEPLOYER, to: CIRCUITS, data: call(id, input) }, tag]))));
  }
  rows.push({ name, id, nIn: p.nIn, nOut: p.nOut, gasZeroInput: gas[0], gasOtherInput: gas[1] });
  console.log(`${name.padEnd(20)} id ${id.padStart(2)}  ${gas[0]}  ${gas[1]}`);
}
const gasPrice = BigInt(await rpc('eth_gasPrice', []));
const balance = BigInt(await rpc('eth_getBalance', [DEPLOYER, tag]));
const blk = JSON.parse(JSON.stringify(await (async () => {
  const r = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: [tag, false] }) });
  return (await r.json()).result;
})()));
const res = { method: 'eth_estimateGas on the live chain, read only', rpc: rpcUrl, block, blockGasLimit: Number(BigInt(blk.gasLimit)),
  gasPriceWei: gasPrice.toString(), deployer: DEPLOYER, deployerBalanceWei: balance.toString(), circuits: CIRCUITS, rows,
  at: new Date().toISOString() };
writeFileSync(out, JSON.stringify(res, null, 2) + '\n');
console.log(`block ${block}, block gas limit ${res.blockGasLimit}, gas price ${gasPrice} wei, deployer ${balance} wei`);
