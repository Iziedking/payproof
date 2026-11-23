// P2 SIMULATION: open a circuit's container, publish the built app to DeWEB and activate its
// name, on an anvil fork of X Layer, as the impersonated deployer. Nothing reaches the live chain.
//
//   node scripts/p2/deweb-fork.mts <fork rpc> <dist dir> <circuit id> <out.json>
//
// Calls, from the sources:
// - opener.open(address circuits, uint256 id), payable FEE(): the opener's bytecode on X Layer
//   (selectors resolved through the openchain signature database, 2026-11-23); FEE() read on chain.
// - SiteRegistry putFile / appendChunk / fileInfo / read, DomainBinding bind / monthlyFee /
//   isLive / isContainerLive, opener accountOf / isOpened: TAPs@527477ecb7cf TAP-10 Appendix A.
// The fork's deployer balance is raised with anvil_setBalance, because the live account cannot
// pay the opening fee today; the report states the real cost so the owner can fund it.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
// @ts-ignore: plain JS module, vendored unchanged
import { keccakHex } from '../../vendor/tapekit/keccak.js';

const [FORK, DIST, ID_S, OUT] = process.argv.slice(2);
const ID = BigInt(ID_S);
const DEPLOYER = '0x5c807eA36fC11a72192d83ecff2b3D4746767612';
const CIRCUITS = '0x1900801e311184063b9d9c119c9d98aa4950e12c';
const OPENER = '0x536adD8F30f03b69f6fbF29d425A816A0dC50106';
const SITES = '0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6';
const DOMAIN = '0x68809Fd2fb343aA57D0aeB7f33Defe477c9666f9';
const PROCESSOR = 425; // scripts/p2/deweb-read.mts
const GAS_PRICE = 20_000_001n;
const CHUNK = 24_000;
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

const sel = (s: string) => keccakHex(new TextEncoder().encode(s)).slice(2, 10);
if (sel('open(address,uint256)') !== '0a0e5c9d' || sel('FEE()') !== 'c57981b5') throw new Error('selector check failed');
// ABI encoding for the few shapes used here: address, uint, bytes32 (static); string, bytes (dynamic).
type V = { t: 'address' | 'uint' | 'bytes32'; v: string | bigint } | { t: 'string' | 'bytes'; v: string | Uint8Array };
const word = (x: bigint) => x.toString(16).padStart(64, '0');
function enc(args: V[]): string {
  const heads: string[] = []; const tails: string[] = []; let off = 32 * args.length;
  for (const a of args) {
    if (a.t === 'address') heads.push((a.v as string).replace(/^0x/, '').toLowerCase().padStart(64, '0'));
    else if (a.t === 'uint') heads.push(word(a.v as bigint));
    else if (a.t === 'bytes32') heads.push((a.v as string).replace(/^0x/, ''));
    else {
      const b = typeof a.v === 'string' ? new TextEncoder().encode(a.v) : a.v;
      const hex = Buffer.from(b).toString('hex');
      const tail = word(BigInt(b.length)) + hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
      heads.push(word(BigInt(off))); tails.push(tail); off += tail.length / 2;
    }
  }
  return heads.join('') + tails.join('');
}
const callData = (sig: string, args: V[]) => '0x' + sel(sig) + enc(args);

let rid = 1;
async function rpc(method: string, params: unknown[]): Promise<any> {
  const j: any = await (await fetch(FORK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method, params }) })).json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}
const call = (to: string, data: string, from = DEPLOYER) => rpc('eth_call', [{ from, to, data }, 'latest']);
const num = (h: string) => BigInt(h);
async function receipt(h: string) { for (let i = 0; i < 120; i++) { const r = await rpc('eth_getTransactionReceipt', [h]); if (r) return r; await new Promise((z) => setTimeout(z, 500)); } throw new Error('no receipt'); }
const txs: any[] = [];
async function send(label: string, to: string, data: string, value = 0n) {
  const tx = { from: DEPLOYER, to, data, value: '0x' + value.toString(16) };
  const est = num(await rpc('eth_estimateGas', [tx, 'latest']));
  const h = await rpc('eth_sendTransaction', [{ ...tx, gas: '0x' + ((est * 11n) / 10n).toString(16), gasPrice: '0x' + GAS_PRICE.toString(16) }]);
  const r = await receipt(h);
  if (num(r.status) !== 1n) throw new Error(`${label} reverted`);
  const row = { label, gasEstimate: Number(est), gasUsed: Number(num(r.gasUsed)), value: value.toString(), calldataBytes: (data.length - 2) / 2 };
  txs.push(row); console.log(JSON.stringify(row));
}

const files = (function walk(d: string): string[] { return readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; }); })(DIST)
  .map((p) => { const path = relative(DIST, p).split('\\').join('/'); const ext = path.slice(path.lastIndexOf('.')); const data = new Uint8Array(readFileSync(p)); return { path, type: TYPES[ext] ?? 'application/octet-stream', data, sha: '0x' + createHash('sha256').update(data).digest('hex') }; })
  .sort((a, b) => (a.path === 'index.html' ? 1 : b.path === 'index.html' ? -1 : a.path.localeCompare(b.path))); // index.html last: the site appears only once its assets exist

const fee = num(await call(OPENER, '0x' + sel('FEE()')));
const monthly = num(await call(DOMAIN, '0x' + sel('monthlyFee()')));
const container = '0x' + (await call(OPENER, callData('accountOf(address,uint256)', [{ t: 'address', v: CIRCUITS }, { t: 'uint', v: ID }]))).slice(26);
const owner = '0x' + (await call(CIRCUITS, callData('ownerOf(uint256)', [{ t: 'uint', v: ID }]))).slice(26);
const realBalance = num(await rpc('eth_getBalance', [DEPLOYER, 'latest']));
const forkBlock = Number(num(await rpc('eth_blockNumber', [])));
console.log(JSON.stringify({ forkBlock, id: ID.toString(), container, owner, openFeeWei: fee.toString(), monthlyFeeWei: monthly.toString(), deployerBalanceWei: realBalance.toString(), files: files.map((f) => [f.path, f.data.length, f.type]) }));

// Who may open: try from an unrelated account first (eth_call only).
let strangerOpen: string;
try { await call(OPENER, callData('open(address,uint256)', [{ t: 'address', v: CIRCUITS }, { t: 'uint', v: ID }]), '0x000000000000000000000000000000000000dEaD'); strangerOpen = 'would succeed'; }
catch (e) { strangerOpen = 'reverts: ' + String(e).slice(0, 160); }
console.log(JSON.stringify({ strangerOpen }));

await rpc('anvil_impersonateAccount', [DEPLOYER]);
await rpc('anvil_setBalance', [DEPLOYER, '0x' + (10n ** 18n).toString(16)]); // SIMULATION ONLY
await send('open', OPENER, callData('open(address,uint256)', [{ t: 'address', v: CIRCUITS }, { t: 'uint', v: ID }]), fee);
const opened = num(await call(OPENER, callData('isOpened(address,uint256)', [{ t: 'address', v: CIRCUITS }, { t: 'uint', v: ID }]))) === 1n;

for (const f of files) {
  const n = Math.ceil(f.data.length / CHUNK) || 1;
  await send(`putFile ${f.path} 1/${n}`, SITES, callData('putFile(address,string,string,bytes32,bytes)', [{ t: 'address', v: container }, { t: 'string', v: f.path }, { t: 'string', v: f.type }, { t: 'bytes32', v: f.sha }, { t: 'bytes', v: f.data.subarray(0, CHUNK) }]));
  for (let k = 1; k < n; k++) await send(`appendChunk ${f.path} ${k + 1}/${n}`, SITES, callData('appendChunk(address,string,uint256,bytes)', [{ t: 'address', v: container }, { t: 'string', v: f.path }, { t: 'uint', v: BigInt(k) }, { t: 'bytes', v: f.data.subarray(k * CHUNK, (k + 1) * CHUNK) }]));
}
const name = `${ID}.2.${PROCESSOR}.tape`;
await send(`bind ${name} 12 months`, DOMAIN, callData('bind(string,address,uint256)', [{ t: 'string', v: name }, { t: 'address', v: container }, { t: 'uint', v: 12n }]), monthly * 12n);

// Read everything back the way the gateway does and compare.
const checks: any[] = [];
for (const f of files) {
  const ret = await call(SITES, callData('read(address,string)', [{ t: 'address', v: container }, { t: 'string', v: f.path }]));
  const h = ret.slice(2); const off = Number(BigInt('0x' + h.slice(0, 64))) * 2; const len = Number(BigInt('0x' + h.slice(off, off + 64)));
  const back = Buffer.from(h.slice(off + 64, off + 64 + len * 2), 'hex');
  const info = (await call(SITES, callData('fileInfo(address,string)', [{ t: 'address', v: container }, { t: 'string', v: f.path }]))).slice(2);
  const declared = '0x' + info.slice(128, 192);
  checks.push({ path: f.path, bytes: f.data.length, sameBytes: Buffer.compare(back, Buffer.from(f.data)) === 0, declaredSha: declared === f.sha });
}
const live = num(await call(DOMAIN, callData('isLive(string,address)', [{ t: 'string', v: name }, { t: 'address', v: container }]))) === 1n;
const containerLive = num(await call(DOMAIN, callData('isContainerLive(address)', [{ t: 'address', v: container }]))) === 1n;
const gas = txs.reduce((s, t) => s + t.gasUsed, 0);
const cost = { transactions: txs.length, gasUsed: gas, networkOkb: Number(BigInt(gas) * GAS_PRICE) / 1e18, openFeeOkb: Number(fee) / 1e18, bindOkb: Number(monthly * 12n) / 1e18, totalOkb: Number(BigInt(gas) * GAS_PRICE + fee + monthly * 12n) / 1e18, deployerHasOkb: Number(realBalance) / 1e18 };
const out = { simulation: 'anvil fork of X Layer, impersonated deployer, balance raised with anvil_setBalance', forkBlock, circuitId: ID.toString(), name, gatewayUrl: `https://${ID}-2-${PROCESSOR}.tapekit.org/`, container, openFeeWei: fee.toString(), monthlyFeeWei: monthly.toString(), strangerOpen, opened, live, containerLive, checks, txs, cost };
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ opened, live, containerLive, allFilesMatch: checks.every((c) => c.sameBytes && c.declaredSha), cost }));
process.exit(opened && live && checks.every((c) => c.sameBytes && c.declaredSha) ? 0 : 1);
