// P0 read-only probes of X Layer mainnet. Uses eth_call, eth_estimateGas,
// eth_getStorageAt and block reads only. Sends nothing and holds no key.
//
// node scripts/p0/chain/xlayer-probe.mjs state      [rpc]
// node scripts/p0/chain/xlayer-probe.mjs create-sim [rpc]
// node scripts/p0/chain/xlayer-probe.mjs txcap      [rpc] [blocks]
//
// Sources: selectors and addresses from TAP-02 section 6 and TapeKit
// kernel/src/config.js at 37c617e7e332; function names (createCPU, deployFee,
// bem, TAPEOUT_FEE, mintPrice, protocolFee, supplyCap, minted) from the
// human-readable ABI in the tapeout.net app bundle index-DizVcbig.js
// (SHA-256 0c532120c91d15367da384da0dad3692f03acaee321c874aad3963c8c5aebf0c), read 2026-11-17.
import { keccakHex, keccak256 } from '../../../vendor/tapekit/keccak.js';

const [cmd = 'state', RPC = 'https://xlayerrpc.okx.com', arg3] = process.argv.slice(2);
const FACTORY = '0x1f09DAeFA827f02CBb40967cc91b259763760761';
const BEACON = '0xf70d1ed4f62CF3780157B0b421b7E2F45bD0991C';
const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

let id = 1;
async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }) });
  const j = await r.json();
  return j.error ? { error: j.error.message, data: j.error.data } : j.result;
}
const sel = (sig) => keccakHex(new TextEncoder().encode(sig)).slice(0, 10);
const w = (n) => BigInt(n).toString(16).padStart(64, '0');
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const h2b = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const num = (h) => (typeof h === 'string' && h.length > 2 ? BigInt(h.slice(0, 66)) : h);
const adr = (h) => (typeof h === 'string' ? '0x' + h.slice(26, 66) : h);
const call = (to, sig, args = '') => rpc('eth_call', [{ to, data: sel(sig) + args }, 'latest']);
const show = (o) => console.log(JSON.stringify(o, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));

async function state() {
  const blk = await rpc('eth_getBlockByNumber', ['latest', false]);
  const o = { rpc: RPC, client: await rpc('web3_clientVersion', []), chainId: num(await rpc('eth_chainId', [])),
    block: num(blk.number), time: new Date(Number(num(blk.timestamp)) * 1000).toISOString(),
    blockGasLimit: num(blk.gasLimit), baseFeeWei: num(blk.baseFeePerGas) };
  o.factory = { cpuCount: num(await call(FACTORY, 'cpuCount()')), deployFee: num(await call(FACTORY, 'deployFee()')),
    bem: adr(await call(FACTORY, 'bem()')), isSealed: num(await call(FACTORY, 'isSealed()')),
    owner: adr(await call(FACTORY, 'owner()')),
    implementation: adr(await rpc('eth_getStorageAt', [FACTORY, IMPL_SLOT, 'latest'])) };
  o.beacon = { implementation: adr(await call(BEACON, 'implementation()')), owner: adr(await call(BEACON, 'owner()')) };
  const bem = o.factory.bem;
  o.bemToken = { decimals: num(await call(bem, 'decimals()')), totalSupply: num(await call(bem, 'totalSupply()')) };
  const last = adr(await call(FACTORY, 'cpuAt(uint256)', w(o.factory.cpuCount - 1n)));
  const tr = adr(await call(last, 'transistors()'));
  o.sampleProcessor = { address: last, TAPEOUT_FEE: num(await call(last, 'TAPEOUT_FEE()')),
    nextId: num(await call(last, 'nextId()')), transistors: tr,
    mintPrice: num(await call(tr, 'mintPrice()')), protocolFee: num(await call(tr, 'protocolFee()')),
    supplyCap: num(await call(tr, 'supplyCap()')), minted: num(await call(tr, 'minted()')) };
  show(o);
}

// createCPU(name, symbol, story, supply, price) simulated from a dummy address with
// a BEM balance and allowance written by state override. Slots were found by probing
// balanceOf / allowance with overrides: balances at mapping slot 0, allowances at 6.
async function createSim() {
  const from = '0x000000000000000000000000000000000000dEaD';
  const bem = adr(await call(FACTORY, 'bem()'));
  const map = (k, s) => hex(keccak256(h2b(k.padStart(64, '0') + s.padStart(64, '0'))));
  const o = from.slice(2).toLowerCase(), f = FACTORY.slice(2).toLowerCase();
  const big = '0x' + w(10n ** 18n);
  const str = (s) => { const b = Buffer.from(s); return w(b.length) + b.toString('hex').padEnd(Math.ceil(b.length / 32) * 64, '0'); };
  const enc = (n, sy, st, sup, pr) => { const parts = [str(n), str(sy), str(st)]; let off = 5 * 32; const heads = [];
    for (const p of parts) { heads.push(w(off)); off += p.length / 2; } return heads.join('') + w(sup) + w(pr) + parts.join(''); };
  const sig = 'createCPU(string,string,string,uint256,uint256)';
  const noFunds = await rpc('eth_call', [{ from, to: FACTORY, data: sel(sig) + enc('Payproof', 'PAYP', 'test', 1000000n, 0n) }, 'latest']);
  const ov = { [bem]: { stateDiff: { ['0x' + map(o, w(0))]: big, ['0x' + map(f, map(o, w(6)))]: big } }, [from]: { balance: big } };
  const rows = [];
  for (const [sup, price] of [[1000000n, 0n], [10000000n, 0n], [100000000n, 1000n]]) {
    const data = sel(sig) + enc('Payproof', 'PAYP', 'test', sup, price);
    const r = await rpc('eth_call', [{ from, to: FACTORY, data }, 'latest', ov]);
    const g = await rpc('eth_estimateGas', [{ from, to: FACTORY, data }, 'latest', ov]);
    rows.push({ supply: sup, mintPrice: price, ok: typeof r === 'string', gas: num(g) });
  }
  show({ withoutBem: noFunds, withBemOverride: rows,
    note: '0xfb8f41b2 is ERC20InsufficientAllowance(spender, allowance, needed)' });
}

// Largest transaction gas limits in recent blocks, with receipts for those above 2^24.
async function txcap() {
  const span = Number(arg3 || 3000);
  const head = Number(await rpc('eth_blockNumber', []));
  let maxGas = 0n; let txs = 0; let blocks = 0; const over = [];
  for (let b = head; b > head - span; b -= 6) {
    const blk = await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), true]); blocks++;
    for (const t of blk.transactions) {
      txs++; const g = BigInt(t.gas); if (g > maxGas) maxGas = g;
      if (g > 16777216n && over.length < 5) {
        const r = await rpc('eth_getTransactionReceipt', [t.hash]);
        over.push({ block: b, hash: t.hash, gasLimit: g, gasUsed: BigInt(r.gasUsed), status: r.status });
      }
    }
    await new Promise((r) => setTimeout(r, 30));
  }
  show({ head, blocksSampled: blocks, every: 6, txs, maxGasLimit: maxGas, above2pow24: over });
}

if (cmd !== 'evalgas') await ({ state, 'create-sim': createSim, txcap }[cmd] ?? (() => { throw new Error('unknown command'); }))();

// eval gas on circuits already taped out by anyone: scan processors, collect
// stateless circuits with gateCount and nIn, then eth_estimateGas on eval(id, zeros).
// node scripts/p0/chain/xlayer-probe.mjs evalgas [rpc]
async function evalgas() {
  const n = Number(num(await call(FACTORY, 'cpuCount()')));
  const found = [];
  for (let i = 0; i < n; i++) {
    const cpu = adr(await call(FACTORY, 'cpuAt(uint256)', w(i)));
    const next = Number(num(await call(cpu, 'nextId()')));
    for (let c = Math.max(1, next - 3); c < next; c++) {
      const info = await call(cpu, 'circuitInfo(uint256)', w(c));
      if (typeof info !== 'string' || info.length < 2 + 64 * 4) continue;
      const f = [0, 1, 2, 3].map((k) => Number(BigInt('0x' + info.slice(2 + 64 * k, 66 + 64 * k))));
      if (f[2] === 0) found.push({ cpu, id: c, nIn: f[0], nOut: f[1], gates: f[3] });
    }
    if (i % 50 === 0) await new Promise((r) => setTimeout(r, 200));
  }
  found.sort((a, b) => b.gates - a.gates);
  const pick = [...found.slice(0, 8), ...found.filter((x) => x.gates > 50 && x.gates < 2000).slice(0, 4)];
  const rows = [];
  for (const x of pick) {
    const bytes = Math.ceil(x.nIn / 8);
    const enc = w(x.id) + w(64) + w(bytes) + '00'.repeat(Math.ceil(bytes / 32) * 32);
    const g = await rpc('eth_estimateGas', [{ to: x.cpu, data: sel('eval(uint256,bytes)') + enc, gas: '0x' + (200000000).toString(16) }, 'latest']);
    const gas = typeof g === 'string' ? Number(BigInt(g)) : g;
    rows.push({ ...x, evalGas: gas, gasPerGate: typeof gas === 'number' ? +(gas / x.gates).toFixed(1) : null });
  }
  show({ statelessCircuitsSeen: found.length, largestGates: found[0]?.gates, rows });
}
if (cmd === 'evalgas') await evalgas();
