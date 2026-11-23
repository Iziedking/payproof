// P2: the explanation and validity circuits (docs/specs/explain-validity.md). Holds no key and
// sends nothing to the live chain.
//
//   node scripts/p2/explain-tapeout.mts fork <fork rpc> <json dir> <netlist dir> <out.json>
//       SIMULATION on an anvil fork of X Layer, as the impersonated deployer: tape out
//       split_v1_validity, then split_v1_explain (REF to circuits 3, 4, 6, 7 already on chain and
//       to the new validity id), cn_bonus_explain and ng_paye_explain. Then, for each, compare
//       `eval` by eth_call on the fork with the local simulator and with the formula in the spec,
//       and test the relation to the live decision circuit (8, 9, 10), evaluated locally from
//       <netlist dir>. Tests, not proofs.
//   node scripts/p2/explain-tapeout.mts check <rpc> <json dir> <netlist dir> <ids.json> <out.json> [piece,piece]
//       The same tests on the circuits already taped out, by their live ids, with no tape-out. Read-only.
//       On the public RPC for the pieces it can run; split_v1_explain (about 93 M gas) on a fork.
//   node scripts/p2/explain-tapeout.mts prepare <json dir> <netlist dir> <out dir>
//       Writes <out dir>/<piece>.bin and manifest.json for the owner's tape-outs, in the format of
//       scripts/p2/tapeout-plan.mts (so its `args`, `command` and `landed` work on <out dir>).
//       split_v1_explain is written only once <out dir>/ids.json has the live split_v1_validity id.
//
// Both commands first check that the modules the explanation references convert to exactly the
// bytes taped out as circuits 3, 4, 6 and 7 (keccak from <netlist dir>/manifest.json), and that
// the validity module inside the REF JSON converts to the same bytes as its flat synthesis.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fromYosys, type Compiled, type RefTarget, type YosysJson } from '../../compiler/src/yosys.ts';
import { evaluate, load, refKey, type Circuit } from '../../compiler/src/netlist.ts';
import { pack, unpack } from '../../compiler/src/layout.ts';
// @ts-ignore: plain JS module, vendored unchanged
import { keccakHex } from '../../vendor/tapekit/keccak.js';

const DEPLOYER = '0x5c807eA36fC11a72192d83ecff2b3D4746767612';
const CIRCUITS = '0x1900801e311184063b9d9c119c9d98aa4950e12c';
const CPU = Uint8Array.from(Buffer.from(CIRCUITS.slice(2), 'hex'));
const LIVE_GAS_PRICE = 20000001n; // live, read for the P2 tape-outs (docs/evidence/p2.md)
const EXPLAIN_TOP = 'split_v1_explain';
const REUSED = ['m_mul_tmc_32', 'm_x8500', 'm_x10000_narrow', 'm_x10000_wide'];

const hex = (b: Uint8Array) => '0x' + Buffer.from(b).toString('hex');
const sel = (s: string) => keccakHex(new TextEncoder().encode(s)).slice(0, 10);
const w = (n: bigint | number) => BigInt(n).toString(16).padStart(64, '0');
const bytesArg = (h: string) => { const x = h.replace(/^0x/, ''); return w(x.length / 2) + x.padEnd(Math.ceil(x.length / 64) * 64, '0'); };
const shortName = (m: string) => m.replace(/^\$paramod(\$[0-9a-f]+)?\\/, '').replace(/\\.*$/, '');
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const num = (h: string) => Number(BigInt(h));
const mask = (bits: number) => (1n << BigInt(bits)) - 1n;

type Piece = { name: string; yosysModule: string; file: string; nIn: number; nOut: number; nandRecords: number;
  refRecords: number; bytes: number; keccak256: string; sha256: string; inputs: Compiled['inputs']; outputs: Compiled['outputs'];
  refs?: Record<string, string> };

// ---------- conversion and the identity checks ----------
function load_(jsonDir: string, netDir: string) {
  const main = readJson(join(netDir, 'manifest.json'));
  const mainIds: Record<string, string> = readJson(join(netDir, 'ids.json'));
  const j = readJson(join(jsonDir, 'split_v1_explain_32.ref.json')) as YosysJson;
  const subs = Object.keys(j.modules).filter((m) => m !== EXPLAIN_TOP);
  const reusedMods = new Map<string, string>(); // yosys module -> short name
  let validityMod = '';
  const identity: string[] = [];
  for (const m of subs) {
    const name = shortName(m);
    const c = fromYosys(j, m);
    if (c.refRecords !== 0) throw new Error(`${m} has REF records`);
    if (REUSED.includes(name)) {
      const p = main.pieces.find((x: any) => x.name === name);
      if (!p || p.keccak256 !== keccakHex(c.bytes)) throw new Error(`${name} in the explanation JSON is not the taped-out circuit ${mainIds[name]}`);
      reusedMods.set(m, name);
      identity.push(`${name}: same bytes as circuit ${mainIds[name]} (keccak ${p.keccak256})`);
    } else if (name === 'split_v1_validity') validityMod = m;
    else throw new Error(`unexpected module ${m}`);
  }
  if (reusedMods.size !== REUSED.length || !validityMod) throw new Error('the explanation JSON lacks a referenced module');
  const validity = fromYosys(j, validityMod);
  const flat = fromYosys(readJson(join(jsonDir, 'split_v1_validity_32.json')), 'split_v1_validity_32');
  if (hex(flat.bytes) !== hex(validity.bytes)) throw new Error('split_v1_validity: REF-JSON module and flat synthesis differ');
  identity.push(`split_v1_validity: REF-JSON module and flat synthesis give the same bytes (keccak ${keccakHex(validity.bytes)})`);
  const cn = fromYosys(readJson(join(jsonDir, 'cn_bonus_explain.json')), 'cn_bonus_explain');
  const ng = fromYosys(readJson(join(jsonDir, 'ng_paye_explain.json')), 'ng_paye_explain');
  const topWith = (validityId: bigint) => {
    const refs = new Map<string, RefTarget>();
    const refIds: Record<string, string> = {};
    for (const [m, name] of reusedMods) { refs.set(m, { cpu: CPU, id: BigInt(mainIds[name]) }); refIds[name] = mainIds[name]; }
    refs.set(validityMod, { cpu: CPU, id: validityId }); refIds.split_v1_validity = validityId.toString();
    return { top: fromYosys(j, EXPLAIN_TOP, refs), refIds };
  };
  // Local copies of the live decision circuits and their modules, keyed by live id.
  const local = new Map<string, Circuit>();
  for (const p of main.pieces) if (p.refRecords === 0 && mainIds[p.name] !== undefined)
    local.set(refKey(CPU, BigInt(mainIds[p.name])), load(readFileSync(join(netDir, `${p.name}.bin`)), p.nIn, p.nOut));
  const decision = (name: string) => { const p = main.pieces.find((x: any) => x.name === name); return { p, bytes: readFileSync(join(netDir, `${name}.bin`)) }; };
  return { j, validityMod, validity, cn, ng, topWith, identity, local, decision, mainIds };
}

// ---------- the formulas of docs/specs/explain-validity.md ----------
const L = [3600000n, 14400000n, 30000000n, 42000000n, 66000000n, 96000000n];
const RATE = [3n, 10n, 20n, 25n, 30n, 35n, 45n];
const QD = [0n, 21000n, 141000n, 266000n, 441000n, 716000n, 1516000n];
function cnExplain(bonus: bigint) {
  let i = L.findIndex((l) => bonus <= l); if (i < 0) i = 6;
  return { bracket: BigInt(i + 1), rate: RATE[i], quick_deduction: QD[i], tax_before_deduction: ((bonus * RATE[i]) / 100n) & mask(32) };
}
function ngExplain(v: Record<string, bigint>) {
  const fifth = v.rent / 5n; const relief = fifth > 500000n ? 500000n : fifth;
  const ded = (v.pension + v.nhf + v.nhis + v.life + v.mortgage + relief) & mask(32);
  const ch = v.gross > ded ? v.gross - ded : 0n;
  const slice = (lo: bigint, width: bigint) => (ch <= lo ? 0n : ch - lo >= width ? width : ch - lo);
  return { rent_relief: relief, deductions: ded, chargeable: ch, exempt: v.gross <= 840000n ? 1n : 0n,
    band1: ch > 800000n ? 800000n : ch, band2: slice(800000n, 2200000n), band3: slice(3000000n, 9000000n),
    band4: slice(12000000n, 13000000n), band5: slice(25000000n, 25000000n), band6: ch > 50000000n ? ch - 50000000n : 0n };
}
const splitValid = (v: Record<string, bigint>) => (v.total !== 0n && v.shares <= v.total ? 1n : 0n);
const splitExplain = (v: Record<string, bigint>) => ({ exact_num: v.pot * v.shares * 8500n, paid_num: v.payout * v.total * 10000n,
  den: v.total * 10000n, valid: splitValid(v) });

// Relation to the decision, from the decision's outputs d and the explanation's outputs e.
function relation(kind: string, d: Record<string, bigint>, e: Record<string, bigint>): string | null {
  if (kind === 'cn') {
    if (d.tax !== ((e.tax_before_deduction - e.quick_deduction) & mask(32))) return 'tax != tax_before_deduction - quick_deduction';
    return null;
  }
  if (kind === 'ng') {
    if (e.chargeable !== e.band1 + e.band2 + e.band3 + e.band4 + e.band5 + e.band6) return 'chargeable != sum of bands';
    const t = (15n * e.band2 + 18n * e.band3 + 21n * e.band4 + 23n * e.band5 + 25n * e.band6) / 100n;
    if (d.annual_tax !== (e.exempt ? 0n : t & mask(30))) return 'annual_tax != breakdown';
    return null;
  }
  if (kind === 'split') {
    const ok = e.valid === 1n && e.paid_num <= e.exact_num && e.exact_num < e.paid_num + e.den ? 1n : 0n;
    if (d.ok !== ok) return 'ok != explanation comparison';
    return null;
  }
  if (kind === 'validity') { if (e.valid === 0n && d.ok !== 0n) return 'ok = 1 on an invalid input'; return null; }
  throw new Error(kind);
}

// ---------- inputs ----------
let seed = 20261122n;
const rnd = (bits: number) => { let v = 0n; for (let k = 0; k < bits; k += 32) { seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); v = (v << 32n) | (seed >> 32n); } return v & mask(bits); };
const vectors = (rule: string) => JSON.parse(readFileSync(new URL(`../../rules/${rule}/vectors.json`, import.meta.url), 'utf8')).vectors
  .map((v: any) => Object.fromEntries(Object.entries(v.inputs).map(([k, s]) => [k, BigInt(s as string)])));
function splitInputs(n: number) {
  const xs: Record<string, bigint>[] = vectors('split-v1');
  for (let i = 0; i < n; i++) {
    if (i % 10 === 0) { xs.push({ pot: rnd(32), shares: rnd(32), total: i % 20 === 0 ? 0n : rnd(31), payout: rnd(32) }); continue; } // mostly invalid
    const total = rnd(32) | 1n; const shares = rnd(32) % (total + 1n); const pot = rnd(32);
    const exact = (pot * shares * 8500n) / (10000n * total);
    xs.push({ pot, shares, total, payout: i % 4 === 0 ? rnd(32) : (exact + BigInt((i % 3) - 1)) & mask(32) });
  }
  return xs;
}
function cnInputs(n: number) {
  const xs: Record<string, bigint>[] = vectors('cn-bonus-2023-30');
  for (const l of L) for (const d of [-1n, 0n, 1n]) xs.push({ bonus: l + d });
  xs.push({ bonus: 0n }, { bonus: mask(32) });
  for (let i = 0; i < n; i++) xs.push({ bonus: i % 2 ? rnd(32) : rnd(27) });
  return xs;
}
function ngInputs(n: number) {
  const xs: Record<string, bigint>[] = vectors('ng-paye-nta2025');
  const f = ['pension', 'nhf', 'nhis', 'life', 'mortgage'];
  for (let i = 0; i < n; i++) {
    const v: Record<string, bigint> = { gross: rnd(30), rent: rnd(30) };
    for (const k of f) v[k] = i % 2 ? rnd(27) : rnd(18); // half with deductions small next to gross
    if (i % 5 === 0) v.gross = 840000n + BigInt(i % 3) - 1n;
    xs.push(v);
  }
  xs.push({ gross: mask(30), pension: mask(27), nhf: mask(27), nhis: mask(27), life: mask(27), mortgage: mask(27), rent: mask(30) });
  return xs;
}

// ---------- fork rehearsal ----------
async function fork(rpcUrl: string, jsonDir: string, netDir: string, outFile: string,
  live?: { ids: Record<string, string>; pick: Set<string> | null; label: string }) {
  let rid = 1;
  const rpc = async (method: string, params: unknown[]): Promise<any> => {
    // Retries a dropped connection or an unreadable reply (the public RPC drops some); an RPC error is final.
    let x: any;
    for (let t = 1; ; t++) {
      try { x = await (await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method, params }) })).json(); break; }
      catch (e) { if (t >= 5) throw e; await new Promise((z) => setTimeout(z, 1000 * t)); }
    }
    if (x.error) throw new Error(`${method}: ${JSON.stringify(x.error)}`); return x.result;
  };
  const receipt = async (h: string) => { for (let i = 0; i < 60; i++) { const r = await rpc('eth_getTransactionReceipt', [h]); if (r) return r; await new Promise((z) => setTimeout(z, 1000)); } throw new Error(`no receipt ${h}`); };
  const TRANSFER = keccakHex(new TextEncoder().encode('Transfer(address,address,uint256)'));
  const d = load_(jsonDir, netDir);
  const fee = BigInt(await rpc('eth_call', [{ to: CIRCUITS, data: sel('TAPEOUT_FEE()') }, 'latest']));
  if (!live) await rpc('anvil_impersonateAccount', [DEPLOYER]);
  const balanceBefore = BigInt(await rpc('eth_getBalance', [DEPLOYER, 'latest']));
  const blockGasLimit = num((await rpc('eth_getBlockByNumber', ['latest', false])).gasLimit);
  const out: any = { simulation: live ? live.label : true, ids: live?.ids, startedUtc: new Date().toISOString(), forkBlock: num(await rpc('eth_blockNumber', [])),
    tapeoutFeeWei: fee.toString(), gasPriceWei: LIVE_GAS_PRICE.toString(), deployerBalanceWei: balanceBefore.toString(),
    identity: d.identity, tapeouts: [], checks: [] };
  d.identity.forEach((s) => console.log(s));

  const tapeout = async (label: string, c: Compiled) => {
    const data = sel('tapeout(bytes,uint32,uint32)') + w(96) + w(c.nIn) + w(c.nOut) + bytesArg(hex(c.bytes));
    const tx = { from: DEPLOYER, to: CIRCUITS, data, value: '0x' + fee.toString(16) };
    const est = num(await rpc('eth_estimateGas', [tx, 'latest']));
    const h = await rpc('eth_sendTransaction', [{ ...tx, gas: '0x' + Math.min(Math.ceil(est * 1.1), blockGasLimit).toString(16), gasPrice: '0x' + LIVE_GAS_PRICE.toString(16) }]);
    const r = await receipt(h);
    if (num(r.status) !== 1) throw new Error(`${label} tape-out reverted`);
    const id = BigInt(r.logs.find((l: any) => l.address.toLowerCase() === CIRCUITS && l.topics[0] === TRANSFER).topics[3]);
    const info = await rpc('eth_call', [{ to: CIRCUITS, data: sel('circuitInfo(uint256)') + w(id) }, 'latest']);
    const row = { label, id: id.toString(), bytes: c.bytes.length, nIn: c.nIn, nOut: c.nOut, nandRecords: c.gates, refRecords: c.refRecords,
      keccak256: keccakHex(c.bytes), status: 1, gasEstimate: est, gasUsed: num(r.gasUsed),
      circuitInfoGates: Number(BigInt('0x' + info.slice(2 + 3 * 64, 2 + 4 * 64))) };
    out.tapeouts.push(row); console.log(JSON.stringify(row));
    return id;
  };
  const evalChain = async (id: bigint, x: Uint8Array) => {
    const ret = (await rpc('eth_call', [{ from: DEPLOYER, to: CIRCUITS, data: sel('eval(uint256,bytes)') + w(id) + w(64) + bytesArg(hex(x)) }, 'latest'])).slice(2);
    const off = Number(BigInt('0x' + ret.slice(0, 64))) * 2; const len = Number(BigInt('0x' + ret.slice(off, off + 64)));
    return '0x' + ret.slice(off + 64, off + 64 + len * 2);
  };
  const local = new Map(d.local);
  const resolve = (cpu: Uint8Array, id: bigint) => local.get(refKey(cpu, id)) ?? null;

  // Live mode: no tape-out; the ids are the live ones, already checked by tapeout-plan.mts landed.
  const vId = live ? BigInt(live.ids.split_v1_validity) : await tapeout('split-v1 validity', d.validity);
  local.set(refKey(CPU, vId), load(d.validity.bytes, d.validity.nIn, d.validity.nOut));
  const { top } = d.topWith(vId);
  const eId = live ? BigInt(live.ids.split_v1_explain) : await tapeout('split-v1 explanation (REF top)', top);
  const cId = live ? BigInt(live.ids.cn_bonus_explain) : await tapeout('cn-bonus explanation', d.cn);
  const nId = live ? BigInt(live.ids.ng_paye_explain) : await tapeout('ng-paye explanation', d.ng);
  const want = (piece: string) => !live?.pick || live.pick.has(piece);

  const run = async (label: string, kind: string, id: bigint, c: Compiled, decisionName: string,
    xs: Record<string, bigint>[], formula: (v: Record<string, bigint>) => Record<string, bigint>, gasCases: number) => {
    const dec = d.decision(decisionName);
    let chainVsLocal = 0, formulaVsLocal = 0, relationFails = 0; const examples: string[] = []; const gas: number[] = [];
    for (let i = 0; i < xs.length; i++) {
      const v = xs[i];
      const x = pack(c.inputs, v, c.nIn);
      const loc = evaluate(c.bytes, c.nIn, c.nOut, x, resolve);
      const chain = await evalChain(id, x);
      if (chain !== hex(loc)) { chainVsLocal++; if (examples.length < 4) examples.push(`chain ${chain} local ${hex(loc)} in ${JSON.stringify(v, (_, y) => typeof y === 'bigint' ? y.toString() : y)}`); }
      const e = unpack(c.outputs, loc);
      const f = formula(v);
      if (Object.keys(f).some((k) => f[k] !== e[k])) { formulaVsLocal++; if (examples.length < 4) examples.push(`formula differs in ${JSON.stringify(v, (_, y) => typeof y === 'bigint' ? y.toString() : y)}`); }
      const dx = pack(dec.p.inputs, v, dec.p.nIn);
      const dOut = unpack(dec.p.outputs, evaluate(dec.bytes, dec.p.nIn, dec.p.nOut, dx, resolve));
      const rel = relation(kind, dOut, e);
      if (rel) { relationFails++; if (examples.length < 4) examples.push(`${rel} in ${JSON.stringify(v, (_, y) => typeof y === 'bigint' ? y.toString() : y)}`); }
      if (i < gasCases) gas.push(num(await rpc('eth_estimateGas', [{ from: DEPLOYER, to: CIRCUITS, data: sel('eval(uint256,bytes)') + w(id) + w(64) + bytesArg(hex(x)) }, 'latest'])));
    }
    const row = { label, id: id.toString(), against: `decision ${decisionName} #${d.mainIds[decisionName]}`, cases: xs.length,
      chainVsLocalMismatches: chainVsLocal, formulaVsLocalMismatches: formulaVsLocal, relationFailures: relationFails,
      evalGasEstimate: gas.length ? [Math.min(...gas), Math.max(...gas)] : null, examples };
    out.checks.push(row); console.log(JSON.stringify(row));
  };
  if (want('split_v1_validity')) await run('split-v1 validity', 'validity', vId, d.validity, 'split_v1_top', splitInputs(400), (v) => ({ valid: splitValid(v) }), 3);
  if (want('split_v1_explain')) await run('split-v1 explanation', 'split', eId, top, 'split_v1_top', splitInputs(100), splitExplain, 3);
  if (want('cn_bonus_explain')) await run('cn-bonus explanation', 'cn', cId, d.cn, 'cn_bonus', cnInputs(1000), (v) => cnExplain(v.bonus), 3);
  if (want('ng_paye_explain')) await run('ng-paye explanation', 'ng', nId, d.ng, 'ng_paye', ngInputs(1000), ngExplain, 3);

  const gasUsed = out.tapeouts.reduce((s: number, r: any) => s + r.gasUsed, 0);
  const totalWei = BigInt(gasUsed) * LIVE_GAS_PRICE + fee * BigInt(out.tapeouts.length);
  out.cost = { tapeouts: out.tapeouts.length, gasUsed, feesWei: (fee * BigInt(out.tapeouts.length)).toString(),
    networkWei: (BigInt(gasUsed) * LIVE_GAS_PRICE).toString(), totalWei: totalWei.toString(), totalOkb: Number(totalWei) / 1e18,
    deployerBalanceOkb: Number(balanceBefore) / 1e18, shortfallOkb: totalWei > balanceBefore ? Number(totalWei - balanceBefore) / 1e18 : 0 };
  if (!live) console.log(JSON.stringify(out.cost)); else delete out.cost;
  out.finishedUtc = new Date().toISOString();
  writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
  const bad = out.checks.reduce((s: number, r: any) => s + r.chainVsLocalMismatches + r.formulaVsLocalMismatches + r.relationFailures, 0);
  console.log(`total mismatches ${bad}`);
  process.exit(bad ? 1 : 0);
}

// ---------- files for the owner's tape-outs ----------
function prepare(jsonDir: string, netDir: string, dir: string) {
  mkdirSync(dir, { recursive: true });
  const d = load_(jsonDir, netDir);
  const ids: Record<string, string> = existsSync(join(dir, 'ids.json')) ? readJson(join(dir, 'ids.json')) : {};
  const piece = (name: string, yosysModule: string, c: Compiled, refs?: Record<string, string>) => ({ bytes: c.bytes, p: {
    name, yosysModule, file: `netlists/explain/${name}.bin`, nIn: c.nIn, nOut: c.nOut, nandRecords: c.gates, refRecords: c.refRecords,
    bytes: c.bytes.length, keccak256: keccakHex(c.bytes), sha256: createHash('sha256').update(c.bytes).digest('hex'),
    inputs: c.inputs, outputs: c.outputs, ...(refs ? { refs } : {}) } as Piece });
  const out = [piece('split_v1_validity', d.validityMod, d.validity)];
  if (ids.split_v1_validity !== undefined) { const t = d.topWith(BigInt(ids.split_v1_validity)); out.push(piece(EXPLAIN_TOP, EXPLAIN_TOP, t.top, t.refIds)); }
  else console.log('split_v1_explain not written: split_v1_validity has no live id in ids.json yet');
  out.push(piece('cn_bonus_explain', 'cn_bonus_explain', d.cn), piece('ng_paye_explain', 'ng_paye_explain', d.ng));
  for (const { p, bytes } of out) writeFileSync(join(dir, `${p.name}.bin`), bytes);
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ circuits: CIRCUITS,
    note: 'TAP-02 netlists of the explanation and validity circuits; made by scripts/p2/explain-tapeout.mts prepare', identity: d.identity,
    pieces: out.map((x) => x.p) }, null, 2) + '\n');
  d.identity.forEach((s) => console.log(s));
  for (const { p } of out) console.log(`${p.name}: ${p.bytes} bytes, ${p.nandRecords} NAND + ${p.refRecords} REF, nIn ${p.nIn}, nOut ${p.nOut}, keccak ${p.keccak256}`);
}

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'fork') await fork(a[0], a[1], a[2], a[3]);
else if (cmd === 'prepare') prepare(a[0], a[1], a[2]);
else if (cmd === 'check') await fork(a[0], a[1], a[2], a[4], { ids: readJson(a[3]), pick: a[5] ? new Set(a[5].split(',')) : null,
  label: a[0].includes('127.0.0.1') ? 'fork of the live chain: no tape-out, live ids' : false as any });
else { console.error('commands: fork, prepare (see the header)'); process.exit(2); }
