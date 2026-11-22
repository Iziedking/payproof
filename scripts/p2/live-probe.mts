// P2 live, read-only: find out why `eval` by eth_call reverts on the public X Layer RPC.
// For each circuit id, sends one eth_call of eval(id, zero input) without a gas field and with
// explicit gas values, plus eth_estimateGas. Sends no transaction.
// Usage: node scripts/p2/live-probe.mts <rpc> <id:inputBits>...
import { keccakHex } from '../../vendor/tapekit/keccak.js';
const CIRCUITS = '0x1900801e311184063b9d9c119c9d98aa4950e12c';
const DEPLOYER = '0x5c807eA36fC11a72192d83ecff2b3D4746767612';
const [rpcUrl, ...specs] = process.argv.slice(2);
let rid = 1;
async function rpc(method: string, params: unknown[]) {
  const r = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method, params }) });
  return r.json();
}
const w = (v: bigint | number) => BigInt(v).toString(16).padStart(64, '0');
// eval(uint256,bytes) selector, the same keccak as tapeout-plan.mts.
const sel = keccakHex(new TextEncoder().encode('eval(uint256,bytes)')).slice(0, 10);
console.log(JSON.stringify({ selector: sel }));
for (const s of specs) {
  const [id, bits] = s.split(':').map(Number);
  const n = Math.ceil(bits / 8);
  const data = sel + w(id) + w(64) + w(n) + '00'.repeat(Math.ceil(n / 32) * 32);
  const gasList = (process.env.GAS_LIST ?? ',30000000,100000000,150000000,200000000').split(',').map((g) => (g ? Number(g) : undefined));
  for (const gas of gasList) {
    const call: any = { from: DEPLOYER, to: CIRCUITS, data };
    if (gas) call.gas = '0x' + gas.toString(16);
    const j: any = await rpc('eth_call', [call, 'latest']);
    console.log(JSON.stringify({ id, gas: gas ?? 'none', ok: !j.error, error: j.error ?? null, resultBytes: j.result ? (j.result.length - 2) / 2 : null }));
  }
  const e: any = await rpc('eth_estimateGas', [{ from: DEPLOYER, to: CIRCUITS, data }]);
  console.log(JSON.stringify({ id, estimateGas: e.result ? Number(BigInt(e.result)) : null, error: e.error ?? null }));
}
