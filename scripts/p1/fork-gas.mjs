// P1: measure the `eval` gas of the split-v1 check circuit on a fork of X Layer.
// SIMULATION: runs against a local anvil fork, never against the live chain for writes.
// The deployer is impersonated on the fork only; no key is used anywhere.
//
//   node scripts/p1/fork-gas.mjs <fork rpc> <live rpc> <tap.json> <out.json>
//
// Steps:
//   1. Calibration: eth_estimateGas of eval on circuits already on X Layer, on the fork and on
//      the live RPC at the fork block. They must agree, or the fork's gas is not X Layer's.
//   2. Tape out the circuit on the fork from the owner's deployer (impersonated), paying
//      TAPEOUT_FEE as on the chain. Read the circuit id from the ERC-721 Transfer event.
//   3. For each test case: eth_call eval and compare with a plain BigInt version of the rule,
//      then eth_estimateGas. Send one eval as a transaction and read its receipt.
//
// Sources: function signatures and the REF-free tapeout call from scripts/p0/tx/print-tx.mjs
// (tapeout.net bundle read 2026-11-17); input bit order from TAP-02 reference.py `pack`
// (bit i in byte i >> 3, least significant bit first); input layout from the TAP file;
// anvil methods anvil_impersonateAccount from `anvil --help` 1.8.6 (--auto-impersonate).
import { readFileSync, writeFileSync } from 'node:fs';
import { keccakHex } from '../../vendor/tapekit/keccak.js';

const [FORK, LIVE, TAP, OUT] = process.argv.slice(2);
const DEPLOYER = '0x5c807eA36fC11a72192d83ecff2b3D4746767612';
const CIRCUITS = '0x1900801e311184063b9d9c119c9d98aa4950e12c';   // Payproof processor, P0 tx 2
const CALIBRATE = [
  { cpu: CIRCUITS, id: 1, input: '0x0305', note: 'Payproof #1 adder8, 90 gates' },
  { cpu: '0x69f663931209096037474d7c20402232e5c762ca', id: 1386, input: '0x00', note: '10,000 gates flat' },
  { cpu: '0xb00e17789f905234f1890c22e6c01015c10d2f54', id: 40, input: '0x00000000', note: '14,985 gates, 27 REF records' },
];

let rid = 1;
async function rpc(url, method, params) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method, params }) });
  const j = await r.json();
  if (j.error) return { error: j.error.message, data: j.error.data };
  return j.result;
}
const must = (x, what) => { if (x && x.error) throw new Error(`${what}: ${JSON.stringify(x)}`); return x; };
const sel = (s) => keccakHex(new TextEncoder().encode(s)).slice(0, 10);
const w = (n) => BigInt(n).toString(16).padStart(64, '0');
const bytesArg = (hex) => { const h = hex.replace(/^0x/, ''); return w(h.length / 2) + h.padEnd(Math.ceil(h.length / 64) * 64, '0'); };
function encodeDynamic(heads) {
  let off = heads.length * 32; const h = []; const t = [];
  for (const x of heads) {
    if (typeof x === 'string') h.push(x);
    else { h.push(w(off)); t.push(x.tail); off += x.tail.length / 2; }
  }
  return h.join('') + t.join('');
}
const evalData = (id, input) => sel('eval(uint256,bytes)') + encodeDynamic([w(id), { tail: bytesArg(input) }]);
const decodeBytes = (ret) => { const h = ret.slice(2); const off = Number(BigInt('0x' + h.slice(0, 64))) * 2;
  const len = Number(BigInt('0x' + h.slice(off, off + 64))); return '0x' + h.slice(off + 64, off + 64 + len * 2); };
async function receipt(hash, what) {
  // anvil mines on send; if the receipt is not there, record the pool state and mine one block.
  for (let i = 0; i < 30; i++) {
    const r = await rpc(FORK, 'eth_getTransactionReceipt', [hash]);
    if (r && !r.error) return r;
    if (i === 10) {
      const b = await rpc(FORK, 'eth_getBlockByNumber', ['pending', false]);
      (out.notes ||= []).push(`${what}: no receipt after 10 polls; pending block baseFee ${b && b.baseFeePerGas}; mined one block with evm_mine`);
      await rpc(FORK, 'evm_mine', []);
    }
    await new Promise((z) => setTimeout(z, 1000));
  }
  throw new Error(`${what}: no receipt for ${hash}`);
}
const num = (h) => (typeof h === 'string' ? Number(BigInt(h)) : h);

// The rule, as in scripts/p0/check_tap.py split_check (H = 8500), W = 32.
function splitCheck(pot, shares, total, payout) {
  const valid = total !== 0n && shares <= total;
  const lhs = payout * total * 10000n;
  const rhs = pot * shares * 8500n;
  return valid && lhs <= rhs && rhs < lhs + total * 10000n ? 1 : 0;
}
function packInput(tap, vals) {
  const bytes = new Uint8Array(Math.ceil(tap.nIn / 8));
  for (const p of tap.inputs) {
    const v = vals[p.name];
    for (let i = 0; i < p.width; i++) if ((v >> BigInt(i)) & 1n) { const b = p.offset + i; bytes[b >> 3] |= 1 << (b & 7); }
  }
  return '0x' + Buffer.from(bytes).toString('hex');
}
const M = (1n << 32n) - 1n;
const payoutOf = (pot, shares, total) => (pot * shares * 8500n) / (10000n * total);
const CASES = [
  { name: 'valid, exact payout', v: [1000000n, 250n, 1000n, payoutOf(1000000n, 250n, 1000n)] },
  { name: 'valid, payout one too high', v: [1000000n, 250n, 1000n, payoutOf(1000000n, 250n, 1000n) + 1n] },
  { name: 'valid, payout one too low', v: [1000000n, 250n, 1000n, payoutOf(1000000n, 250n, 1000n) - 1n] },
  { name: 'all inputs at maximum', v: [M, M, M, payoutOf(M, M, M)] },
  { name: 'total zero', v: [5n, 0n, 0n, 0n] },
  { name: 'shares above total', v: [1000n, 11n, 10n, 0n] },
  { name: 'all zero', v: [0n, 0n, 0n, 0n] },
];

const out = { simulation: true, startedUtc: new Date().toISOString() };
const tap = JSON.parse(readFileSync(TAP, 'utf8'));
out.circuit = { module: tap.module, gates: tap.gates, bytes: tap.bytes, nIn: tap.nIn, nOut: tap.nOut };

// Fork facts.
out.fork = {
  chainId: num(must(await rpc(FORK, 'eth_chainId', []), 'chainId')),
  block: num(must(await rpc(FORK, 'eth_blockNumber', []), 'blockNumber')),
  clientVersion: await rpc(FORK, 'web3_clientVersion', []),
};
const head = must(await rpc(FORK, 'eth_getBlockByNumber', ['latest', false]), 'head');
out.fork.blockGasLimit = num(head.gasLimit);
out.fork.baseFeePerGas = head.baseFeePerGas ? num(head.baseFeePerGas) : null;
const meta = must(await rpc(FORK, 'anvil_nodeInfo', []), 'nodeInfo');
out.fork.forkBlock = meta?.forkConfig?.forkBlockNumber ?? null;
out.fork.hardfork = meta?.hardFork ?? null;
out.liveGasPriceWei = num(must(await rpc(LIVE, 'eth_gasPrice', []), 'live gas price'));
const GP = '0x' + out.liveGasPriceWei.toString(16);
const forkTag = '0x' + BigInt(out.fork.forkBlock ?? out.fork.block).toString(16);

// 1. Calibration.
out.calibration = [];
for (const c of CALIBRATE) {
  const tx = { from: DEPLOYER, to: c.cpu, data: evalData(c.id, c.input) };
  const fork = await rpc(FORK, 'eth_estimateGas', [tx, 'latest']);
  const live = await rpc(LIVE, 'eth_estimateGas', [tx, forkTag]);
  out.calibration.push({ ...c, forkGas: typeof fork === 'string' ? num(fork) : fork,
    liveGasAtForkBlock: typeof live === 'string' ? num(live) : live });
}

// 2. Tape out on the fork.
const fee = BigInt(must(await rpc(FORK, 'eth_call', [{ to: CIRCUITS, data: sel('TAPEOUT_FEE()') }, 'latest']), 'fee'));
const nandBefore = BigInt(must(await rpc(FORK, 'eth_call', [{ to: '0x523161955d1963891640a111688678fe6a9523ea',
  data: sel('balanceOf(address,uint256)') + DEPLOYER.slice(2).toLowerCase().padStart(64, '0') + w(0) }, 'latest']), 'nand'));
const okbBefore = BigInt(must(await rpc(FORK, 'eth_getBalance', [DEPLOYER, 'latest']), 'okb'));
out.deployerOnFork = { nandBefore: nandBefore.toString(), okbBeforeWei: okbBefore.toString(), tapeoutFeeWei: fee.toString() };
must(await rpc(FORK, 'anvil_impersonateAccount', [DEPLOYER]), 'impersonate');
const tapeData = sel('tapeout(bytes,uint32,uint32)') + encodeDynamic([{ tail: bytesArg(tap.netlistHex) }, w(tap.nIn), w(tap.nOut)]);
const tapeTx = { from: DEPLOYER, to: CIRCUITS, data: tapeData, value: '0x' + fee.toString(16) };
const tapeEst = await rpc(FORK, 'eth_estimateGas', [tapeTx, 'latest']);
out.tapeout = { estimate: typeof tapeEst === 'string' ? num(tapeEst) : tapeEst };
if (typeof tapeEst !== 'string') { writeFileSync(OUT, JSON.stringify(out, null, 2)); throw new Error('tapeout estimate failed'); }
const limit = Math.min(Math.ceil(num(tapeEst) * 1.1), out.fork.blockGasLimit);
const tapeHash = must(await rpc(FORK, 'eth_sendTransaction', [{ ...tapeTx, gas: '0x' + limit.toString(16), gasPrice: GP }]), 'tapeout send');
const tapeRcpt = await receipt(tapeHash, 'tapeout');
const TRANSFER = keccakHex(new TextEncoder().encode('Transfer(address,address,uint256)'));
const mintLog = tapeRcpt.logs.find((l) => l.address.toLowerCase() === CIRCUITS && l.topics[0] === TRANSFER);
const id = mintLog ? Number(BigInt(mintLog.topics[3])) : null;
Object.assign(out.tapeout, { gasPriceWei: out.liveGasPriceWei, tx: tapeHash, status: num(tapeRcpt.status), gasUsed: num(tapeRcpt.gasUsed), gasLimit: limit, circuitId: id });
if (id === null) { writeFileSync(OUT, JSON.stringify(out, null, 2)); throw new Error('no circuit id in tapeout receipt'); }
const info = must(await rpc(FORK, 'eth_call', [{ to: CIRCUITS, data: sel('circuitInfo(uint256)') + w(id) }, 'latest']), 'circuitInfo');
out.tapeout.circuitInfo = [0, 1, 2, 3].map((i) => Number(BigInt('0x' + info.slice(2 + i * 64, 2 + (i + 1) * 64))));

// 3. eval on test cases.
out.eval = [];
let mismatches = 0;
for (const c of CASES) {
  const [pot, shares, total, payout] = c.v;
  const input = packInput(tap, { pot, shares, total, payout });
  const tx = { from: DEPLOYER, to: CIRCUITS, data: evalData(id, input) };
  const ret = await rpc(FORK, 'eth_call', [tx, 'latest']);
  const est = await rpc(FORK, 'eth_estimateGas', [tx, 'latest']);
  const outBytes = typeof ret === 'string' ? decodeBytes(ret) : null;
  const got = outBytes ? Number(BigInt(outBytes.slice(0, 4)) & 1n) : null;
  const want = splitCheck(pot, shares, total, payout);
  if (got !== want) mismatches++;
  out.eval.push({ case: c.name, pot: String(pot), shares: String(shares), total: String(total), payout: String(payout),
    input, output: outBytes ?? ret, ok: got, expected: want, estimateGas: typeof est === 'string' ? num(est) : est });
}
out.evalMismatches = mismatches;

// One eval as a transaction, to show it executes inside a block.
const sendCase = CASES[0];
const sendTx = { from: DEPLOYER, to: CIRCUITS, data: evalData(id, packInput(tap, Object.fromEntries(
  ['pot', 'shares', 'total', 'payout'].map((k, i) => [k, sendCase.v[i]])))) };
const sendEst = num(out.eval[0].estimateGas);
const sendLimit = Math.min(Math.ceil(sendEst * 1.1), out.fork.blockGasLimit);
const evalHash = must(await rpc(FORK, 'eth_sendTransaction', [{ ...sendTx, gas: '0x' + sendLimit.toString(16), gasPrice: GP }]), 'eval send');
const evalRcpt = await receipt(evalHash, 'eval');
const evalBlock = must(await rpc(FORK, 'eth_getBlockByNumber', [evalRcpt.blockNumber, false]), 'eval block');
out.evalTx = { case: sendCase.name, tx: evalHash, status: num(evalRcpt.status), gasUsed: num(evalRcpt.gasUsed),
  gasLimit: sendLimit, blockGasUsed: num(evalBlock.gasUsed), blockGasLimit: num(evalBlock.gasLimit) };
out.gasPerGate = +(out.evalTx.gasUsed / tap.gates).toFixed(1);
out.finishedUtc = new Date().toISOString();
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ forkBlock: out.fork.forkBlock, calibration: out.calibration.map((c) => [c.note, c.forkGas, c.liveGasAtForkBlock]),
  tapeout: out.tapeout, evalMismatches: mismatches, evalTx: out.evalTx, gasPerGate: out.gasPerGate }, null, 2));
process.exit(mismatches ? 1 : 0);
