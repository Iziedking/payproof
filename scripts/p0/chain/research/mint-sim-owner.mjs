// Read-only: gas for one mint call from the owner's address, simulated on processor #423
// (same transistor beacon as ours, price 0), with a BEM balance and allowance written by
// state override. Our own processor does not exist yet, so this is the closest real code.
// node scripts/p0/chain/research/mint-sim-owner.mjs <owner>
import { keccakHex, keccak256 } from '../../../../vendor/tapekit/keccak.js';
const RPC = 'https://xlayerrpc.okx.com'; let i = 1;
const owner = process.argv[2];
const sel = (s) => keccakHex(new TextEncoder().encode(s)).slice(0, 10);
const rpc = async (m, p) => { const j = await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: i++, method: m, params: p }) })).json(); return j.error ? { error: j.error.message } : j.result; };
const w = (n) => BigInt(n).toString(16).padStart(64, '0');
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const h2b = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const map = (k, s) => hex(keccak256(h2b(k.padStart(64, '0') + s.padStart(64, '0'))));
const BEM = '0x60e62efa9405d6873c5deabd4e6cc91c25363952';
const tr = '0xe3d05dea04d5058eac631be7dec59173d583d2b9';
const call = async (s) => BigInt(await rpc('eth_call', [{ to: tr, data: sel(s) }, 'latest']));
const cap = await call('supplyCap()'), minted = await call('minted()'), price = await call('mintPrice()'), fee = await call('protocolFee()');
const left = cap - minted;
const o = owner.slice(2).toLowerCase(), t = tr.slice(2);
const units = price * left + fee;
const ov = { [BEM]: { stateDiff: { ['0x' + map(o, w(5))]: '0x' + w(units), ['0x' + map(t, map(o, w(6)))]: '0x' + w(units) } } };
for (const [id, amt] of [[0n, 1n], [0n, left], [1n, 1n]]) {
  const data = sel('mint(uint256,uint256)') + w(id) + w(amt);
  const g = await rpc('eth_estimateGas', [{ from: owner, to: tr, data }, 'latest', ov]);
  console.log(JSON.stringify({ id: String(id), amount: String(amt), gas: typeof g === 'string' ? String(BigInt(g)) : g }));
}
console.log(JSON.stringify({ processor423: { supplyCap: String(cap), minted: String(minted), mintPrice: String(price), protocolFee: String(fee) },
  bemGivenByOverride: String(units), note: 'balance and allowance set to exactly price*left + protocolFee: the full-supply mint needs nothing more' }));
// Shared supply: LATCH (id 1) one above the remaining NAND supply must hit the same cap.
for (const [id, amt] of [[1n, left], [1n, left + 1n], [0n, left + 1n]]) {
  const data = sel('mint(uint256,uint256)') + w(id) + w(amt);
  const g = await rpc('eth_estimateGas', [{ from: owner, to: tr, data }, 'latest', ov]);
  console.log(JSON.stringify({ id: String(id), amount: String(amt), result: typeof g === 'string' ? 'ok, gas ' + BigInt(g) : g }));
}
