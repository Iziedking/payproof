// P2: prepare the netlist files for the owner's Foundry tape-outs, record each one that lands,
// and compare on-chain `eval` with the local simulator. Holds no key and sends no transaction:
// every command here is a file write or a read-only RPC call.
//
//   node scripts/p2/tapeout-plan.mts prepare <json dir> <netlist dir>
//       Writes <piece>.bin and manifest.json. The split-v1 top is written only once every
//       module it uses has an id in <netlist dir>/ids.json, because its REF records name them.
//   node scripts/p2/tapeout-plan.mts args <netlist dir> <piece>
//       Prints "netlists/<piece>.bin nIn nOut keccak" for `forge script --sig run(...)`.
//   node scripts/p2/tapeout-plan.mts command <rpc> <netlist dir> <piece>
//       Prints the owner's forge command, with the live gas price read from <rpc>.
//   node scripts/p2/tapeout-plan.mts landed <rpc> <netlist dir> <piece> <tx hash | run-latest.json>
//       Reads the receipt, takes the new circuit id from the Transfer log, checks circuitInfo,
//       and records the id in ids.json.
//   node scripts/p2/tapeout-plan.mts check <rpc> <netlist dir> <out.json> [piece,piece]
//       eth_call `eval` on every final circuit in ids.json against the local simulator: the rule
//       vectors plus random inputs.
//
// Pieces, in tape-out order: the five split-v1 modules (m_mul_tmc_32 first), split_v1_top,
// cn_bonus, ng_paye. Encodings as in scripts/p2/fork-tapeout.mts.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fromYosys, type Compiled, type RefTarget, type YosysJson } from '../../compiler/src/yosys.ts';
import { evaluate, load, refKey, type Circuit } from '../../compiler/src/netlist.ts';
import { pack } from '../../compiler/src/layout.ts';
// @ts-ignore: plain JS module, vendored unchanged
import { keccakHex } from '../../vendor/tapekit/keccak.js';

const DEPLOYER = '0x5c807eA36fC11a72192d83ecff2b3D4746767612';
const CIRCUITS = '0x1900801e311184063b9d9c119c9d98aa4950e12c';
const CPU = Uint8Array.from(Buffer.from(CIRCUITS.slice(2), 'hex'));
const ACCOUNT = 'payproof-deployer';
const SPLIT_TOP = 'split_check_mod';
const FINAL: Record<string, string> = { split_v1_top: 'split-v1', cn_bonus: 'cn-bonus-2023-30', ng_paye: 'ng-paye-nta2025' };

type Piece = { name: string; yosysModule: string; file: string; nIn: number; nOut: number; nandRecords: number;
  refRecords: number; bytes: number; keccak256: string; sha256: string; inputs: Compiled['inputs']; outputs: Compiled['outputs'];
  refs?: Record<string, string> };
type Manifest = { circuits: string; note: string; pieces: Piece[] };

const hex = (b: Uint8Array) => '0x' + Buffer.from(b).toString('hex');
const sel = (s: string) => keccakHex(new TextEncoder().encode(s)).slice(0, 10);
const w = (n: bigint | number) => BigInt(n).toString(16).padStart(64, '0');
const bytesArg = (h: string) => { const x = h.replace(/^0x/, ''); return w(x.length / 2) + x.padEnd(Math.ceil(x.length / 64) * 64, '0'); };
const TRANSFER = keccakHex(new TextEncoder().encode('Transfer(address,address,uint256)'));
// "$paramod$<hash>\m_x8500" or "$paramod\m_add\W=s32'..." to "m_x8500" / "m_add"
const shortName = (m: string) => m.replace(/^\$paramod(\$[0-9a-f]+)?\\/, '').replace(/\\.*$/, '');

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const idsOf = (dir: string): Record<string, string> => existsSync(join(dir, 'ids.json')) ? readJson(join(dir, 'ids.json')) : {};
const manifestOf = (dir: string): Manifest => readJson(join(dir, 'manifest.json'));
const pieceOf = (dir: string, name: string) => { const p = manifestOf(dir).pieces.find((x) => x.name === name); if (!p) throw new Error(`no piece ${name} in the manifest`); return p; };

function rpcAt(url: string) {
  let rid = 1;
  return async (method: string, params: unknown[]): Promise<any> => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method, params }) });
    const j = await r.json();
    if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
    return j.result;
  };
}

function piece(name: string, yosysModule: string, c: Compiled, refs?: Record<string, string>): { p: Piece; bytes: Uint8Array } {
  return { bytes: c.bytes, p: { name, yosysModule, file: `netlists/${name}.bin`, nIn: c.nIn, nOut: c.nOut, nandRecords: c.gates,
    refRecords: c.refRecords, bytes: c.bytes.length, keccak256: keccakHex(c.bytes),
    sha256: createHash('sha256').update(c.bytes).digest('hex'), inputs: c.inputs, outputs: c.outputs, ...(refs ? { refs } : {}) } };
}

async function prepare(jsonDir: string, dir: string) {
  mkdirSync(dir, { recursive: true });
  const ids = idsOf(dir);
  const out: { p: Piece; bytes: Uint8Array }[] = [];
  const j = readJson(join(jsonDir, 'split_check_modc_32.ref.json')) as YosysJson;
  const mods = ['m_mul_tmc_32', ...Object.keys(j.modules).filter((m) => m !== SPLIT_TOP && m !== 'm_mul_tmc_32')];
  const refs = new Map<string, RefTarget>();
  const refIds: Record<string, string> = {};
  for (const m of mods) {
    const c = fromYosys(j, m);
    if (c.refRecords !== 0) throw new Error(`${m} has REF records; order modules by dependency`);
    const name = shortName(m);
    out.push(piece(name, m, c));
    if (ids[name] !== undefined) { refs.set(m, { cpu: CPU, id: BigInt(ids[name]) }); refIds[name] = ids[name]; }
  }
  if (refs.size === mods.length) out.push(piece('split_v1_top', SPLIT_TOP, fromYosys(j, SPLIT_TOP, refs), refIds));
  else console.log(`split_v1_top not written: ${mods.length - refs.size} module ids missing from ids.json`);
  for (const name of ['cn_bonus', 'ng_paye']) out.push(piece(name, name, fromYosys(readJson(join(jsonDir, `${name}.json`)), name)));
  for (const { p, bytes } of out) writeFileSync(join(dir, `${p.name}.bin`), bytes);
  const m: Manifest = { circuits: CIRCUITS, note: 'TAP-02 netlists for tapeout(bytes,uint32,uint32); made by scripts/p2/tapeout-plan.mts prepare', pieces: out.map((x) => x.p) };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
  for (const { p } of out) console.log(`${p.name}: ${p.bytes} bytes, ${p.nandRecords} NAND + ${p.refRecords} REF, nIn ${p.nIn}, nOut ${p.nOut}, keccak ${p.keccak256}`);
}

const argsLine = (p: Piece) => `${p.file} ${p.nIn} ${p.nOut} ${p.keccak256}`;

async function command(rpcUrl: string, dir: string, name: string) {
  const p = pieceOf(dir, name);
  const gasPrice = BigInt(await rpcAt(rpcUrl)('eth_gasPrice', []));
  console.log(`Piece ${name}: ${p.bytes} bytes, keccak ${p.keccak256}. Live gas price ${gasPrice} wei.`);
  console.log('Run from chain/. First without --broadcast (simulation only), then the same line with --broadcast:\n');
  console.log(`forge script script/TapeOut.s.sol --sig "run(string,uint32,uint32,bytes32)" ${argsLine(p)} ` +
    `--rpc-url ${rpcUrl} --chain 196 --sender ${DEPLOYER} --account ${ACCOUNT} --legacy --with-gas-price ${gasPrice} --slow`);
}

async function landed(rpcUrl: string, dir: string, name: string, ref: string) {
  const rpc = rpcAt(rpcUrl);
  const p = pieceOf(dir, name);
  let hash = ref;
  if (!/^0x[0-9a-fA-F]{64}$/.test(ref)) {
    const b = readJson(ref);
    hash = b.receipts?.at(-1)?.transactionHash ?? b.transactions?.at(-1)?.hash;
    if (!hash) throw new Error(`no transaction hash in ${ref}`);
  }
  const r = await rpc('eth_getTransactionReceipt', [hash]);
  if (!r) throw new Error(`no receipt yet for ${hash}`);
  if (Number(BigInt(r.status)) !== 1) throw new Error(`${hash} reverted`);
  const tx = await rpc('eth_getTransactionByHash', [hash]);
  if (tx.to.toLowerCase() !== CIRCUITS) throw new Error(`${hash} is not to the circuits contract`);
  const sent = tx.input.slice(10 + 3 * 64 + 64, 10 + 3 * 64 + 64 + p.bytes * 2);
  if ('0x' + sent !== hex(readFileSync(join(dir, `${name}.bin`)))) throw new Error(`${hash} carried a different netlist than ${name}.bin`);
  const log = r.logs.find((l: any) => l.address.toLowerCase() === CIRCUITS && l.topics[0] === TRANSFER);
  const id = BigInt(log.topics[3]);
  const info = await rpc('eth_call', [{ to: CIRCUITS, data: sel('circuitInfo(uint256)') + w(id) }, 'latest']);
  const infoGates = Number(BigInt('0x' + info.slice(2 + 3 * 64, 2 + 4 * 64)));
  const ids = idsOf(dir); ids[name] = id.toString();
  writeFileSync(join(dir, 'ids.json'), JSON.stringify(ids, null, 2) + '\n');
  console.log(JSON.stringify({ piece: name, tx: hash, block: Number(BigInt(r.blockNumber)), gasUsed: Number(BigInt(r.gasUsed)),
    gasPrice: tx.gasPrice ? BigInt(tx.gasPrice).toString() : null, id: id.toString(), circuitInfoGates: infoGates,
    nandRecords: p.nandRecords, refRecords: p.refRecords }));
  if (p.refRecords === 0 && infoGates !== p.nandRecords) throw new Error(`circuitInfo reports ${infoGates} gates, the file has ${p.nandRecords}`);
}

async function check(rpcUrl: string, dir: string, outFile: string, only?: string) {
  const pick = only ? new Set(only.split(',')) : null;
  const rpc = rpcAt(rpcUrl);
  const ids = idsOf(dir);
  const m = manifestOf(dir);
  const local = new Map<string, Circuit>();
  for (const p of m.pieces) if (p.refRecords === 0 && ids[p.name] !== undefined)
    local.set(refKey(CPU, BigInt(ids[p.name])), load(readFileSync(join(dir, `${p.name}.bin`)), p.nIn, p.nOut));
  const resolve = (cpu: Uint8Array, id: bigint) => local.get(refKey(cpu, id)) ?? null;
  let seed = 20261122n;
  const rnd = (bits: number) => { let v = 0n; for (let k = 0; k < bits; k += 32) { seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); v = (v << 32n) | (seed >> 32n); } return v & ((1n << BigInt(bits)) - 1n); };
  const rows: any[] = [];
  for (const [name, rule] of Object.entries(FINAL)) {
    if (pick && !pick.has(name)) continue;
    if (ids[name] === undefined) { console.log(`${name}: no id yet, skipped`); continue; }
    const p = pieceOf(dir, name);
    if (p.refs) for (const [mod, id] of Object.entries(p.refs)) if (ids[mod] !== id) throw new Error(`${name}.bin names ${mod} #${id}, ids.json has #${ids[mod]}`);
    const bytes = readFileSync(join(dir, `${name}.bin`));
    const id = BigInt(ids[name]);
    const xs: Uint8Array[] = JSON.parse(readFileSync(new URL(`../../rules/${rule}/vectors.json`, import.meta.url), 'utf8')).vectors
      .map((v: any) => pack(p.inputs, Object.fromEntries(Object.entries(v.inputs).map(([k, s]) => [k, BigInt(s as string)])), p.nIn));
    const nRandom = name === 'split_v1_top' ? 200 : 1000;
    for (let i = 0; i < nRandom; i++) xs.push(pack(p.inputs, Object.fromEntries(p.inputs.map((f) => [f.name, rnd(f.width)])), p.nIn));
    let mismatch = 0; const examples: string[] = [];
    for (const x of xs) {
      const data = sel('eval(uint256,bytes)') + w(id) + w(64) + bytesArg(hex(x));
      const ret = (await rpc('eth_call', [{ from: DEPLOYER, to: CIRCUITS, data }, 'latest'])).slice(2);
      const off = Number(BigInt('0x' + ret.slice(0, 64))) * 2; const len = Number(BigInt('0x' + ret.slice(off, off + 64)));
      const chain = '0x' + ret.slice(off + 64, off + 64 + len * 2);
      const want = hex(evaluate(bytes, p.nIn, p.nOut, x, resolve));
      if (chain !== want) { mismatch++; if (examples.length < 3) examples.push(`in ${hex(x)} chain ${chain} local ${want}`); }
    }
    const row = { piece: name, id: id.toString(), cases: xs.length, chainVsLocalMismatches: mismatch, examples };
    rows.push(row); console.log(JSON.stringify(row));
  }
  const block = Number(BigInt(await rpc('eth_blockNumber', [])));
  writeFileSync(outFile, JSON.stringify({ rpc: rpcUrl, block, checkedUtc: new Date().toISOString(), ids, rows }, null, 2) + '\n');
  const bad = rows.reduce((s, r) => s + r.chainVsLocalMismatches, 0);
  console.log(`total mismatches ${bad}`);
  if (bad) process.exit(1);
}

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'prepare') await prepare(a[0], a[1]);
else if (cmd === 'args') console.log(argsLine(pieceOf(a[0], a[1])));
else if (cmd === 'command') await command(a[0], a[1], a[2]);
else if (cmd === 'landed') await landed(a[0], a[1], a[2], a[3]);
else if (cmd === 'check') await check(a[0], a[1], a[2], a[3]);
else { console.error('commands: prepare, args, command, landed, check (see the header)'); process.exit(2); }
