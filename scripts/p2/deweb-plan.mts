// P2: prepare the app files for the owner's DeWEB publish (chain/script/DeWebPublish.s.sol),
// print the owner's command, and check what landed. Holds no key and sends no transaction: every
// command here is a file write or a read-only RPC call.
//
//   node scripts/p2/deweb-plan.mts prepare <dist dir> <site dir>
//       Copies every file of the built app into <site dir> and writes <site dir>/manifest.json:
//       paths, content types, SHA-256 and sizes, index.html last.
//   node scripts/p2/deweb-plan.mts command <rpc> <site dir> <#ID> <months>
//       Prints the cost and the owner's forge command, with the live gas price and balance.
//   node scripts/p2/deweb-plan.mts landed <rpc> <site dir> <#ID> <out.json>
//       Reads every file back from SiteRegistry, compares bytes and the declared SHA-256, and
//       checks the container is opened and the name live. Exit 1 on any difference.
//   node scripts/p2/deweb-plan.mts mirror <rpc> <site dir> <#ID> <mirror base url> <out.json>
//       Fetches every manifest file from the mirror and compares it byte for byte with the file
//       read from SiteRegistry, so the mirror is shown to serve the build that is on chain.
//       Exit 1 on any difference.
//
// Interfaces as in chain/script/DeWebPublish.s.sol (TAP-10 Appendix A; opener bytecode).
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname } from 'node:path';
// @ts-ignore: plain JS module, vendored unchanged
import { keccakHex } from '../../vendor/tapekit/keccak.js';

const DEPLOYER = '0x5c807eA36fC11a72192d83ecff2b3D4746767612';
const ACCOUNT = 'payproof-deployer';
const CIRCUITS = '0x1900801e311184063b9d9c119c9d98aa4950e12c';
const OPENER = '0x536adD8F30f03b69f6fbF29d425A816A0dC50106';
const SITES = '0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6';
const DOMAIN = '0x68809Fd2fb343aA57D0aeB7f33Defe477c9666f9';
const PROCESSOR = 425;
const CHUNK = 24_000;
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.jpg': 'image/jpeg' };
// Gas per step, measured on the fork (docs/evidence/p2/deweb.md): used for the cost estimate only.
const GAS_PER_BYTE = 226; // 71,892,818 gas less open and bind, over 316,863 bytes
const GAS_OPEN = 167_244, GAS_BIND = 185_482, GAS_PER_TX = 60_000;

type Manifest = { note: string; paths: string[]; types: string[]; sha256: string[]; sizes: number[] };
const sha = (b: Uint8Array) => '0x' + createHash('sha256').update(b).digest('hex');
const sel = (s: string) => keccakHex(new TextEncoder().encode(s)).slice(2, 10);
const word = (x: bigint) => x.toString(16).padStart(64, '0');
const addrW = (a: string) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const strTail = (s: string) => { const h = Buffer.from(s, 'utf8').toString('hex'); return word(BigInt(h.length / 2)) + h.padEnd(Math.ceil(h.length / 64) * 64, '0'); };
const callAddrStr = (sig: string, a: string, s: string) => '0x' + sel(sig) + addrW(a) + word(64n) + strTail(s);
const callStrAddr = (sig: string, s: string, a: string) => '0x' + sel(sig) + word(64n) + addrW(a) + strTail(s);
const callAddrUint = (sig: string, a: string, n: bigint) => '0x' + sel(sig) + addrW(a) + word(n);

function rpcAt(url: string) {
  let id = 1;
  return async (method: string, params: unknown[]): Promise<any> => {
    for (let t = 1; ; t++) {
      try {
        const j: any = await (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }) })).json();
        if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
        return j.result;
      } catch (e) { if (t >= 5) throw e; await new Promise((r) => setTimeout(r, 800 * t)); }
    }
  };
}
const readManifest = (dir: string): Manifest => JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

function prepare(dist: string, site: string) {
  rmSync(site, { recursive: true, force: true });
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = walk(dist).map((p) => relative(dist, p).split('\\').join('/'))
    .sort((a, b) => (a === 'index.html' ? 1 : b === 'index.html' ? -1 : a.localeCompare(b)));
  if (files[files.length - 1] !== 'index.html') throw new Error('no index.html in the build');
  const m: Manifest = { note: 'Files of the Payproof app as published to DeWEB, in publish order (index.html last). Written by scripts/p2/deweb-plan.mts prepare; read by chain/script/DeWebPublish.s.sol.', paths: [], types: [], sha256: [], sizes: [] };
  for (const f of files) {
    const ext = f.slice(f.lastIndexOf('.'));
    const type = TYPES[ext];
    if (!type) throw new Error(`no content type for ${f}`);
    const data = new Uint8Array(readFileSync(join(dist, f)));
    mkdirSync(dirname(join(site, f)), { recursive: true });
    copyFileSync(join(dist, f), join(site, f));
    m.paths.push(f); m.types.push(type); m.sha256.push(sha(data)); m.sizes.push(data.length);
  }
  writeFileSync(join(site, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
  console.log(JSON.stringify({ site, files: m.paths.map((p, i) => [p, m.sizes[i], m.types[i], m.sha256[i]]) }));
}

async function command(url: string, site: string, idS: string, monthsS: string) {
  const rpc = rpcAt(url);
  const m = readManifest(site);
  const id = BigInt(idS), months = BigInt(monthsS);
  const gasPrice = BigInt(await rpc('eth_gasPrice', []));
  const balance = BigInt(await rpc('eth_getBalance', [DEPLOYER, 'latest']));
  const fee = BigInt(await rpc('eth_call', [{ to: OPENER, data: '0x' + sel('FEE()') }, 'latest']));
  const monthly = BigInt(await rpc('eth_call', [{ to: DOMAIN, data: '0x' + sel('monthlyFee()') }, 'latest']));
  const opened = BigInt(await rpc('eth_call', [{ to: OPENER, data: callAddrUint('isOpened(address,uint256)', CIRCUITS, id) }, 'latest'])) === 1n;
  const container = await containerOf(rpc, id);
  const name = `${idS}.2.${PROCESSOR}.tape`;
  const live = opened && BigInt(await rpc('eth_call', [{ to: DOMAIN, data: callStrAddr('isLive(string,address)', name, container) }, 'latest'])) === 1n;
  // What the script will still send, by the same rule as DeWebPublish.s.sol chunksOnChain():
  // a file with the same declared SHA-256 keeps its chunks; anything else is written from chunk 0.
  let bytes = 0, txs = (opened ? 0 : 1) + (live ? 0 : 1);
  const todo: string[] = [];
  for (let i = 0; i < m.paths.length; i++) {
    const total = Math.ceil(m.sizes[i] / CHUNK);
    let have = 0;
    if (opened) {
      const info = (await rpc('eth_call', [{ to: SITES, data: callAddrStr('fileInfo(address,string)', container, m.paths[i]) }, 'latest'])).slice(2);
      const w = (k: number) => BigInt('0x' + info.slice(64 * k, 64 * (k + 1)));
      const same = '0x' + info.slice(128, 192) === m.sha256[i];
      have = same && Number(w(4)) <= total && Number(w(0)) <= m.sizes[i] ? Number(w(4)) : 0;
      if (have === total && Number(w(0)) !== m.sizes[i]) have = 0;
    }
    if (have === total) continue;
    todo.push(have ? `${m.paths[i]} (from chunk ${have})` : m.paths[i]);
    txs += total - have;
    bytes += m.sizes[i] - Math.min(m.sizes[i], have * CHUNK);
  }
  const gas = BigInt(bytes * GAS_PER_BYTE + txs * GAS_PER_TX + (opened ? 0 : GAS_OPEN) + (live ? 0 : GAS_BIND));
  const cost = gas * gasPrice + (opened ? 0n : fee) + (live ? 0n : monthly * months);
  const okb = (w: bigint) => (Number(w) / 1e18).toFixed(6);
  console.log(`Site ${name} (https://${idS}-2-${PROCESSOR}.tapekit.org/): ${m.paths.length} files in the manifest.`);
  console.log(`Container opened already: ${opened}. Name live already: ${live}. Opening fee ${okb(fee)} OKB, monthly fee ${okb(monthly)} OKB x ${months}.`);
  console.log(`Still to send: ${txs} transactions, ${bytes} bytes${todo.length ? ': ' + todo.join(', ') : ''}.`);
  if (txs === 0) { console.log('Nothing to send: everything in the manifest is on chain.'); return; }
  console.log(`Estimated cost ${okb(cost)} OKB at ${gasPrice} wei (gas estimated from the fork rehearsal). Deployer holds ${okb(balance)} OKB.`);
  if (balance < cost) console.log('WARNING: the deployer holds less than the estimate. Top it up before broadcasting.');
  console.log('Run from chain/. First without --broadcast (simulation only), then the same line with --broadcast:\n');
  // --gas-limit: forge simulates the whole script as one call, and a large publish (the sign-in build,
  // 1.26 billion gas over 470 transactions) passes forge's default limit for that call. It does not
  // change the gas of any transaction sent (docs/evidence/p2/privy.md).
  console.log(`forge script script/DeWebPublish.s.sol --sig "run(uint256,uint256)" ${idS} ${monthsS} ` +
    `--rpc-url ${url} --chain 196 --sender ${DEPLOYER} --account ${ACCOUNT} --legacy --with-gas-price ${gasPrice} --slow ` +
    `--gas-limit 100000000000`);
}

// Reads one file of a container back from SiteRegistry; null when it is not there.
async function readOnChain(rpc: ReturnType<typeof rpcAt>, container: string, p: string): Promise<Buffer | null> {
  try {
    const h = (await rpc('eth_call', [{ to: SITES, data: callAddrStr('read(address,string)', container, p) }, 'latest'])).slice(2);
    const off = Number(BigInt('0x' + h.slice(0, 64))) * 2, len = Number(BigInt('0x' + h.slice(off, off + 64)));
    return Buffer.from(h.slice(off + 64, off + 64 + len * 2), 'hex');
  } catch { return null; }
}
const containerOf = async (rpc: ReturnType<typeof rpcAt>, id: bigint) =>
  '0x' + (await rpc('eth_call', [{ to: OPENER, data: callAddrUint('accountOf(address,uint256)', CIRCUITS, id) }, 'latest'])).slice(26);

async function mirror(url: string, site: string, idS: string, base: string, out: string) {
  const rpc = rpcAt(url);
  const m = readManifest(site);
  const block = Number(BigInt(await rpc('eth_blockNumber', [])));
  const container = await containerOf(rpc, BigInt(idS));
  const root = base.endsWith('/') ? base : base + '/';
  const checks = [];
  for (let i = 0; i < m.paths.length; i++) {
    const p = m.paths[i];
    const chain = await readOnChain(rpc, container, p);
    let served: Buffer | null = null, status = 0, contentType = '';
    for (let t = 1; t <= 5 && !served; t++) {
      try {
        const r = await fetch(root + p, { cache: 'no-store' });
        status = r.status; contentType = r.headers.get('content-type') ?? '';
        if (r.ok) served = Buffer.from(await r.arrayBuffer());
      } catch { /* retried */ }
      if (!served) await new Promise((r) => setTimeout(r, 3000 * t));
    }
    const sameAsChain = !!chain && !!served && Buffer.compare(chain, served) === 0;
    checks.push({ path: p, status, contentType, mirrorSha: served ? sha(served) : null, chainSha: chain ? sha(chain) : null, manifestSha: m.sha256[i], sameAsChain });
  }
  const ok = checks.every((c) => c.sameAsChain && c.chainSha === c.manifestSha);
  const res = { rpc: url, block, circuitId: idS, container, mirror: root, checks, ok };
  writeFileSync(out, JSON.stringify(res, null, 2) + '\n');
  console.log(JSON.stringify(res));
  process.exit(ok ? 0 : 1);
}

async function landed(url: string, site: string, idS: string, out: string) {
  const rpc = rpcAt(url);
  const m = readManifest(site);
  const id = BigInt(idS);
  const name = `${idS}.2.${PROCESSOR}.tape`;
  const block = Number(BigInt(await rpc('eth_blockNumber', [])));
  const container = '0x' + (await rpc('eth_call', [{ to: OPENER, data: callAddrUint('accountOf(address,uint256)', CIRCUITS, id) }, 'latest'])).slice(26);
  const opened = BigInt(await rpc('eth_call', [{ to: OPENER, data: callAddrUint('isOpened(address,uint256)', CIRCUITS, id) }, 'latest'])) === 1n;
  const checks = [];
  for (let i = 0; i < m.paths.length; i++) {
    const p = m.paths[i];
    const want = new Uint8Array(readFileSync(join(site, p)));
    let sameBytes = false, declaredSha = false, chunkCount = 0, contentTypeOk = false;
    try {
      const info = (await rpc('eth_call', [{ to: SITES, data: callAddrStr('fileInfo(address,string)', container, p) }, 'latest'])).slice(2);
      const w = (k: number) => BigInt('0x' + info.slice(64 * k, 64 * (k + 1)));
      chunkCount = Number(w(4));
      declaredSha = '0x' + info.slice(128, 192) === m.sha256[i];
      const tOff = Number(w(1)) * 2, tLen = Number(BigInt('0x' + info.slice(tOff, tOff + 64)));
      contentTypeOk = Buffer.from(info.slice(tOff + 64, tOff + 64 + tLen * 2), 'hex').toString('utf8') === m.types[i];
      const h = (await rpc('eth_call', [{ to: SITES, data: callAddrStr('read(address,string)', container, p) }, 'latest'])).slice(2);
      const off = Number(BigInt('0x' + h.slice(0, 64))) * 2, len = Number(BigInt('0x' + h.slice(off, off + 64)));
      const back = Buffer.from(h.slice(off + 64, off + 64 + len * 2), 'hex');
      sameBytes = Buffer.compare(back, Buffer.from(want)) === 0 && sha(back) === m.sha256[i];
    } catch (e) { /* missing file: reported below */ }
    checks.push({ path: p, bytes: want.length, chunkCount, sameBytes, declaredSha, contentTypeOk });
  }
  const live = BigInt(await rpc('eth_call', [{ to: DOMAIN, data: callStrAddr('isLive(string,address)', name, container) }, 'latest'])) === 1n;
  const containerLive = BigInt(await rpc('eth_call', [{ to: DOMAIN, data: '0x' + sel('isContainerLive(address)') + addrW(container) }, 'latest'])) === 1n;
  const ok = opened && live && containerLive && checks.every((c) => c.sameBytes && c.declaredSha && c.contentTypeOk);
  const res = { rpc: url, block, circuitId: idS, name, gatewayUrl: `https://${idS}-${2}-${PROCESSOR}.tapekit.org/`, container, opened, live, containerLive, checks, ok };
  writeFileSync(out, JSON.stringify(res, null, 2) + '\n');
  console.log(JSON.stringify(res));
  process.exit(ok ? 0 : 1);
}

// Rehearsal only: calldata for putFile of the first chunk of one file, to leave a file half
// written on a fork and check that the publish script carries on from there.
function firstChunk(site: string, idS: string, path: string, container: string) {
  const m = readManifest(site);
  const i = m.paths.indexOf(path);
  if (i < 0) throw new Error(`${path} is not in the manifest`);
  const data = new Uint8Array(readFileSync(join(site, path))).subarray(0, CHUNK);
  const bytesTail = (b: Uint8Array) => { const h = Buffer.from(b).toString('hex'); return word(BigInt(b.length)) + h.padEnd(Math.ceil(h.length / 64) * 64, '0'); };
  const pTail = strTail(path), tTail = strTail(m.types[i]);
  const head = 5 * 32;
  const o1 = head, o2 = o1 + pTail.length / 2, o3 = o2 + tTail.length / 2;
  void idS;
  console.log('0x' + sel('putFile(address,string,string,bytes32,bytes)') + addrW(container) + word(BigInt(o1)) + word(BigInt(o2)) +
    m.sha256[i].slice(2) + word(BigInt(o3)) + pTail + tTail + bytesTail(data));
}

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'first-chunk') { firstChunk(a[0], a[1], a[2], a[3]); process.exit(0); }
if (cmd === 'prepare') prepare(a[0], a[1]);
else if (cmd === 'command') await command(a[0], a[1], a[2], a[3]);
else if (cmd === 'landed') await landed(a[0], a[1], a[2], a[3]);
else if (cmd === 'mirror') await mirror(a[0], a[1], a[2], a[3], a[4]);
else { console.error('commands: prepare, command, landed, mirror (see the header)'); process.exit(2); }
