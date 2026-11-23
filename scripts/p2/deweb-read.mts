// P2, read-only: what a DeWEB test publish of the app needs to know, read from X Layer.
// Sends no transaction. Selectors and addresses from TapeOutProtocol/TapeKit@37c617e7e332
// (kernel/src/selectors.js, README.md "Deployments") and TAPs@527477ecb7cf (TAP-10 Appendix A);
// each selector is recomputed here with keccak and checked.
//
//   node scripts/p2/deweb-read.mts <rpc>
//
// Prints: our processor's number in the factory (for the site name <#ID>.2.<number>.tape),
// DomainBinding.monthlyFee() in wei, and for circuits 3 to 14 the container address and
// whether it is opened and live.
// @ts-ignore: plain JS module, vendored unchanged
import { keccakHex } from '../../vendor/tapekit/keccak.js';

const RPC = process.argv[2] ?? 'https://xlayerrpc.okx.com';
const FACTORY = '0x1f09DAeFA827f02CBb40967cc91b259763760761';
const OPENER = '0x536adD8F30f03b69f6fbF29d425A816A0dC50106';
const DOMAIN = '0x68809Fd2fb343aA57D0aeB7f33Defe477c9666f9';
const SITES = '0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6';
const CIRCUITS = '0x1900801e311184063b9d9c119c9d98aa4950e12c';
const EXPECT: Record<string, string> = {
  'cpuCount()': '0xa94da8a7', 'cpuAt(uint256)': '0x4bc7cbbd', 'accountOf(address,uint256)': '0x0c1905e5',
  'isOpened(address,uint256)': '0x8b508494', 'monthlyFee()': '0x8cfd3e40', 'isContainerLive(address)': '0xdcca979e',
  'pathCount(address)': '0xb554782b', 'ownerOf(uint256)': '0x6352211e',
};
const sel = (s: string) => { const h = keccakHex(new TextEncoder().encode(s)).slice(0, 10); if (EXPECT[s] && EXPECT[s] !== h) throw new Error(`selector ${s}: ${h} != ${EXPECT[s]}`); return h; };
const w = (v: bigint | number | string) => (typeof v === 'string' ? v.replace(/^0x/, '').toLowerCase().padStart(64, '0') : BigInt(v).toString(16).padStart(64, '0'));
let rid = 1;
async function call(to: string, data: string, tries = 5): Promise<string> {
  for (let t = 1; ; t++) {
    try {
      const j: any = await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method: 'eth_call', params: [{ to, data }, 'latest'] }) })).json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j.result;
    } catch (e) { if (t >= tries) throw e; await new Promise((r) => setTimeout(r, 800 * t)); }
  }
}
const word = (r: string, i = 0) => BigInt('0x' + r.slice(2 + 64 * i, 2 + 64 * (i + 1)));
const addr = (r: string) => '0x' + r.slice(26, 66);

const count = Number(word(await call(FACTORY, sel('cpuCount()'))));
let number = -1;
for (let i = count - 1; i >= 0 && number < 0; i--) if (addr(await call(FACTORY, sel('cpuAt(uint256)') + w(i))).toLowerCase() === CIRCUITS) number = i;
const fee = word(await call(DOMAIN, sel('monthlyFee()')));
const block = Number(BigInt((await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method: 'eth_blockNumber', params: [] }) })).json()).result));
console.log(JSON.stringify({ block, factoryCpuCount: count, ourProcessorNumber: number, circuits: CIRCUITS, monthlyFeeWei: fee.toString(), monthlyFeeOkb: Number(fee) / 1e18 }));
for (let id = 3; id <= 14; id++) {
  const container = addr(await call(OPENER, sel('accountOf(address,uint256)') + w(CIRCUITS) + w(id)));
  const opened = word(await call(OPENER, sel('isOpened(address,uint256)') + w(CIRCUITS) + w(id))) === 1n;
  const owner = addr(await call(CIRCUITS, sel('ownerOf(uint256)') + w(id)));
  const files = Number(word(await call(SITES, sel('pathCount(address)') + w(container))));
  let live: boolean | string;
  try { live = word(await call(DOMAIN, sel('isContainerLive(address)') + w(container))) === 1n; } catch (e) { live = 'reverted'; }
  console.log(JSON.stringify({ id, name: number >= 0 ? `${id}.2.${number}.tape` : null, container, opened, owner, files, live }));
}
