// P0: print ONE X Layer transaction as a cast command for the owner to sign with
// their own keystore account. Holds no key, sends nothing, reads nothing secret.
// Every transaction is checked first with eth_estimateGas from the owner's address.
//
//   node scripts/p0/tx/print-tx.mjs <owner> <step> [args]
//
// Steps, in order (one at a time; wait for the owner to confirm it landed):
//   approve-factory                    BEM.approve(factory, deployFee) - exact, not unlimited
//   create <name> <symbol> <story> <supply> <mintPrice>
//   created <tx-hash>                  read-only: the processor addresses from the receipt
//   approve-transistors <transistors> <units>   BEM.approve(transistors, units) - exact
//   mint <transistors> <count>         transistors.mint(0 = NAND, count), no OKB value
//   tapeout <circuits> <tap.json>      circuits.tapeout(netlist, nIn, nOut), value TAPEOUT_FEE
//   tapeout-ref <circuits> <childId> <tap.json of the child>
//   estimate-tapeout <circuits> <tap.json>   read-only: gas for a tape-out, prints no command
//   eval-tx <circuits> <id> <nIn>      eval(id, zero inputs) sent as a transaction
//
// Destinations are limited to: the BEM token, the TapeOut factory, and a transistor
// or circuits contract that the factory lists and whose creator is the owner.
// Sources: function names and argument order from the tapeout.net app bundle
// index-DizVcbig.js (read 2026-11-17); selectors and the REF record from TAP-02;
// cast 1.7.1 `cast send --help` (signature and args, --account, --gas-limit, --value).
import { readFileSync } from 'node:fs';
import { keccakHex } from '../../../vendor/tapekit/keccak.js';

const RPC = process.env.XLAYER_RPC || 'https://xlayerrpc.okx.com';
const FACTORY = '0x1f09DAeFA827f02CBb40967cc91b259763760761';
const BEM = '0x60e62Efa9405d6873C5deaBD4E6CC91c25363952';
const EXPECTED_DEPLOY_FEE = 10000000n;          // 0.1 BEM, read 2026-11-17
const ACCOUNT = 'payproof-deployer';
const CMD_LIMIT = 30000;                       // Windows command lines stop at 32,767 characters
const [owner, step, ...args] = process.argv.slice(2);
if (!/^0x[0-9a-fA-F]{40}$/.test(owner || '')) throw new Error('first argument: the owner address (public)');

let rid = 1;
async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method, params }) });
  const j = await r.json();
  return j.error ? { error: j.error.message, data: j.error.data } : j.result;
}
const sel = (s) => keccakHex(new TextEncoder().encode(s)).slice(0, 10);
const w = (n) => BigInt(n).toString(16).padStart(64, '0');
const lc = (a) => a.toLowerCase();
const addrW = (a) => { if (!/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error(`bad address ${a}`); return lc(a).slice(2).padStart(64, '0'); };
const bytesArg = (hex) => { const h = hex.replace(/^0x/, ''); return w(h.length / 2) + h.padEnd(Math.ceil(h.length / 64) * 64, '0'); };
const strArg = (s) => bytesArg(Buffer.from(s, 'utf8').toString('hex'));
const call = async (to, sig, a = '') => rpc('eth_call', [{ to, data: sel(sig) + a }, 'latest']);
const asAddr = (h) => '0x' + h.slice(26, 66);
const okb = (wei) => `${(Number(wei) / 1e18).toFixed(8)} OKB`;
const bem = (u) => `${(Number(u) / 1e8).toFixed(8)} BEM`;

function encodeDynamic(heads) {
  let off = heads.length * 32; const h = []; const t = [];
  for (const x of heads) {
    if (typeof x === 'string') h.push(x);
    else { h.push(w(off)); t.push(x.tail); off += x.tail.length / 2; }
  }
  return h.join('') + t.join('');
}

// A transistor or circuits contract is allowed only if the factory lists the circuits
// contract (isCPU), the two point at each other, and the creator is the owner.
async function checkOurs(circuits, transistors) {
  const read = async (to, sig, a) => {
    const r = await call(to, sig, a);
    if (typeof r !== 'string' || r.length < 66) throw new Error(`refusing destination: ${sig} on ${to} did not answer (${JSON.stringify(r)})`);
    return r;
  };
  const isCpu = BigInt(await read(FACTORY, 'isCPU(address)', addrW(circuits)));
  if (isCpu !== 1n) throw new Error(`refusing destination: factory.isCPU(${circuits}) is not true`);
  const tr = asAddr(await read(circuits, 'transistors()'));
  const back = asAddr(await read(tr, 'circuits()'));
  const creator = asAddr(await read(tr, 'creator()'));
  const problems = [];
  if (isCpu !== 1n) problems.push('factory.isCPU(circuits) is not true');
  if (transistors && lc(tr) !== lc(transistors)) problems.push(`circuits.transistors() is ${tr}, not ${transistors}`);
  if (lc(back) !== lc(circuits)) problems.push('transistors.circuits() does not point back');
  if (lc(creator) !== lc(owner)) problems.push(`creator is ${creator}, not the owner`);
  if (problems.length) throw new Error('refusing destination: ' + problems.join('; '));
  return tr;
}

async function emit({ to, toName, fn, readable, castArgs, data, value = 0n, amounts }) {
  const v = '0x' + BigInt(value).toString(16);
  const est = await rpc('eth_estimateGas', [{ from: owner, to, data, value: v }, 'latest']);
  const gasPrice = BigInt(await rpc('eth_gasPrice', []));
  console.log(`Destination : ${to} (${toName})`);
  console.log(`Function    : ${readable}`);
  console.log(`Amounts     : ${amounts}`);
  if (typeof est !== 'string') {
    console.log(`Gas estimate: FAILED ${JSON.stringify(est)}`);
    console.log('No command printed: the transaction would revert as things stand.');
    return;
  }
  const g = BigInt(est); const limit = g * 12n / 10n;
  console.log(`Gas estimate: ${g} (limit set to ${limit}); network fee about ${okb(g * gasPrice)} at ${gasPrice} wei/gas`);
  const parts = ['cast send', to, `"${fn}"`, ...castArgs,
    ...(value ? ['--value', String(value)] : []),
    '--gas-limit', String(limit), '--chain', '196', '--rpc-url', RPC, '--account', ACCOUNT];
  const cmd = parts.join(' ');
  if (cmd.length > CMD_LIMIT) {
    console.log(`No command printed: it would be ${cmd.length} characters, over the ${CMD_LIMIT} Windows limit.`);
    return;
  }
  console.log('\nCommand (cast asks for the keystore password):\n');
  console.log(cmd);
}

const steps = {
  'approve-factory': async () => {
    const fee = BigInt(await call(FACTORY, 'deployFee()'));
    if (fee !== EXPECTED_DEPLOY_FEE) throw new Error(`deployFee is now ${fee}, not ${EXPECTED_DEPLOY_FEE}: stop and tell the owner`);
    await emit({ to: BEM, toName: 'BEM token', fn: 'approve(address,uint256)', readable: `approve(factory ${FACTORY}, ${fee})`,
      castArgs: [FACTORY, String(fee)], data: sel('approve(address,uint256)') + addrW(FACTORY) + w(fee),
      amounts: `allowance of exactly ${fee} units = ${bem(fee)} for the factory; no BEM moves in this transaction` });
  },
  create: async () => {
    const [name, symbol, story, supply, price] = args;
    const fee = BigInt(await call(FACTORY, 'deployFee()'));
    if (fee !== EXPECTED_DEPLOY_FEE) throw new Error(`deployFee is now ${fee}: stop and tell the owner`);
    const data = sel('createCPU(string,string,string,uint256,uint256)') +
      encodeDynamic([{ tail: strArg(name) }, { tail: strArg(symbol) }, { tail: strArg(story) }, w(supply), w(price)]);
    const sim = await rpc('eth_call', [{ from: owner, to: FACTORY, data }, 'latest']);
    if (typeof sim === 'string') console.log(`Simulation: would create transistors ${asAddr(sim.slice(0, 66))} and circuits ${asAddr('0x' + sim.slice(66, 130))} (addresses depend on order; read the real ones from the receipt)`);
    await emit({ to: FACTORY, toName: 'TapeOut processor factory', fn: 'createCPU(string,string,string,uint256,uint256)',
      readable: `createCPU("${name}", "${symbol}", "${story}", supply ${supply}, mintPrice ${price})`,
      castArgs: [`"${name}"`, `"${symbol}"`, `"${story}"`, String(supply), String(price)], data,
      amounts: `factory pulls ${fee} units = ${bem(fee)} from you; no OKB value` });
  },
  created: async () => {
    const [hash] = args;
    const r = await rpc('eth_getTransactionReceipt', [hash]);
    if (!r || typeof r !== 'object' || r.error) throw new Error('receipt not found yet');
    const topic = keccakHex(new TextEncoder().encode('CPUCreated(address,address,address,string,uint256,uint256)'));
    const log = r.logs.find((l) => lc(l.address) === lc(FACTORY) && l.topics[0] === topic);
    if (r.status !== '0x1' || !log) throw new Error(`status ${r.status}; no CPUCreated event`);
    const circuits = asAddr(log.topics[1]); const transistors = asAddr(log.topics[2]); const creator = asAddr(log.topics[3]);
    await checkOurs(circuits, transistors);
    console.log(JSON.stringify({ tx: hash, block: Number(r.blockNumber), gasUsed: Number(r.gasUsed), circuits, transistors, creator }, null, 2));
  },
  'approve-transistors': async () => {
    const [tr, units] = args;
    const circuits = asAddr(await call(tr, 'circuits()'));
    await checkOurs(circuits, tr);
    await emit({ to: BEM, toName: 'BEM token', fn: 'approve(address,uint256)', readable: `approve(transistors ${tr}, ${units})`,
      castArgs: [tr, String(units)], data: sel('approve(address,uint256)') + addrW(tr) + w(units),
      amounts: `allowance of exactly ${units} units = ${bem(units)} for our transistor contract` });
  },
  mint: async () => {
    const [tr, count] = args;
    const circuits = asAddr(await call(tr, 'circuits()'));
    await checkOurs(circuits, tr);
    const price = BigInt(await call(tr, 'mintPrice()'));
    const fee = BigInt(await call(tr, 'protocolFee()'));
    const cost = price * BigInt(count) + fee;
    await emit({ to: tr, toName: 'our transistor contract', fn: 'mint(uint256,uint256)', readable: `mint(0 = NAND, ${count})`,
      castArgs: ['0', String(count)], data: sel('mint(uint256,uint256)') + w(0) + w(count),
      amounts: `BEM pulled: ${price} x ${count} + ${fee} = ${cost} units = ${bem(cost)}; no OKB value` });
  },
  tapeout: async () => {
    const [circuits, file] = args;
    await checkOurs(circuits);
    const t = JSON.parse(readFileSync(file, 'utf8'));
    const fee = BigInt(await call(circuits, 'TAPEOUT_FEE()'));
    const data = sel('tapeout(bytes,uint32,uint32)') + encodeDynamic([{ tail: bytesArg(t.netlistHex) }, w(t.nIn), w(t.nOut)]);
    await emit({ to: circuits, toName: 'our circuits contract', fn: 'tapeout(bytes,uint32,uint32)',
      readable: `tapeout(${t.module}: ${t.bytes} bytes, nIn ${t.nIn}, nOut ${t.nOut})`,
      castArgs: [t.netlistHex, String(t.nIn), String(t.nOut)], data, value: fee,
      amounts: `value ${fee} wei = ${okb(fee)} tape-out fee; burns ${t.gates} of your NAND transistors` });
  },
  'tapeout-ref': async () => {
    const [circuits, childId, file] = args;
    await checkOurs(circuits);
    const t = JSON.parse(readFileSync(file, 'utf8'));
    if (t.nIn > 255 || t.nOut > 255) throw new Error('REF target needs at most 255 inputs and 255 outputs');
    const info = await call(circuits, 'circuitInfo(uint256)', w(childId));
    if (typeof info !== 'string') throw new Error(`circuit #${childId} not found`);
    let rec = '02' + lc(circuits).slice(2) + BigInt(childId).toString(16).padStart(16, '0') +
      t.nIn.toString(16).padStart(2, '0') + t.nOut.toString(16).padStart(2, '0');
    for (let i = 0; i < t.nIn; i++) rec += (2 + i).toString(16).padStart(6, '0');
    const fee = BigInt(await call(circuits, 'TAPEOUT_FEE()'));
    const data = sel('tapeout(bytes,uint32,uint32)') + encodeDynamic([{ tail: bytesArg('0x' + rec) }, w(t.nIn), w(t.nOut)]);
    await emit({ to: circuits, toName: 'our circuits contract', fn: 'tapeout(bytes,uint32,uint32)',
      readable: `tapeout(one REF to circuit #${childId}, ${rec.length / 2} bytes, nIn ${t.nIn}, nOut ${t.nOut})`,
      castArgs: ['0x' + rec, String(t.nIn), String(t.nOut)], data, value: fee,
      amounts: `value ${fee} wei = ${okb(fee)} tape-out fee; burns no transistors (REF gates are not burned again, TAP-02 section 6)` });
  },
  'estimate-tapeout': async () => {
    const [circuits, file] = args;
    await checkOurs(circuits);
    const t = JSON.parse(readFileSync(file, 'utf8'));
    const fee = BigInt(await call(circuits, 'TAPEOUT_FEE()'));
    const data = sel('tapeout(bytes,uint32,uint32)') + encodeDynamic([{ tail: bytesArg(t.netlistHex) }, w(t.nIn), w(t.nOut)]);
    const est = await rpc('eth_estimateGas', [{ from: owner, to: circuits, data, value: '0x' + fee.toString(16) }, 'latest']);
    console.log(JSON.stringify({ simulationOnly: true, module: t.module, gates: t.gates, bytes: t.bytes,
      estimatedGas: typeof est === 'string' ? BigInt(est).toString() : est }, null, 2));
  },
  'eval-tx': async () => {
    const [circuits, id, nIn] = args;
    const n = Math.ceil(Number(nIn) / 8);
    const input = '0x' + '00'.repeat(n);
    const data = sel('eval(uint256,bytes)') + encodeDynamic([w(id), { tail: bytesArg(input) }]);
    await emit({ to: circuits, toName: 'circuits contract', fn: 'eval(uint256,bytes)', readable: `eval(${id}, ${n} zero bytes)`,
      castArgs: [String(id), input], data, amounts: 'no value; gas only' });
  },
};
if (!steps[step]) throw new Error(`unknown step ${step}; see the header`);
await steps[step]();
