// P0: print one X Layer transaction for the owner to sign. Holds no key and sends
// nothing. Each transaction is checked first with eth_estimateGas from the owner's
// address, so a revert shows up here before anything is signed.
//
//   node scripts/p0/tx/print-tx.mjs <owner-address> <step> [args]
//
// Steps, in order:
//   approve-factory                    BEM.approve(factory, 0.1 BEM)
//   create <name> <symbol> <story> <supply> <mintPrice>
//                                      factory.createCPU(...)   (owner pays 0.1 BEM)
//   approve-transistors <transistors> <bemUnits>
//                                      BEM.approve(transistors, bemUnits)
//   mint <transistors> <count>         transistors.mint(0 = NAND, count)
//   tapeout <circuits> <tap.json>      circuits.tapeout(netlist, nIn, nOut), value TAPEOUT_FEE
//   tapeout-ref <circuits> <childId> <tap.json of the child>
//                                      a circuit made of one REF to the child, same pins
//   eval-tx <circuits> <id> <nIn>      eval(id, zero inputs) sent as a transaction, to
//                                      measure a real eval above the gas seen so far
//
// Function names and argument order: tapeout.net app bundle index-DizVcbig.js,
// read 2026-11-17 (mint(id, amount) with id 0 = NAND, 1 = LATCH; createCPU(name,
// symbol, story, transistorSupply, mintPrice)); tapeout selector 0x7bd3ac1d and
// REF record layout from TAP-02 sections 2 and 6.
import { readFileSync } from 'node:fs';
import { keccakHex } from '../../../vendor/tapekit/keccak.js';

const RPC = process.env.XLAYER_RPC || 'https://xlayerrpc.okx.com';
const FACTORY = '0x1f09DAeFA827f02CBb40967cc91b259763760761';
const BEM = '0x60e62efa9405d6873c5deabd4e6cc91c25363952';
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
const addr = (a) => { if (!/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error(`bad address ${a}`); return a.slice(2).toLowerCase().padStart(64, '0'); };
const bytesArg = (hex) => { const h = hex.replace(/^0x/, ''); return w(h.length / 2) + h.padEnd(Math.ceil(h.length / 64) * 64, '0'); };
const strArg = (s) => bytesArg(Buffer.from(s, 'utf8').toString('hex'));

function encodeDynamic(heads, tails) { // heads: array of 32-byte hex or {tail}
  let off = heads.length * 32; const h = []; const t = [];
  for (const x of heads) {
    if (typeof x === 'string') h.push(x);
    else { h.push(w(off)); t.push(x.tail); off += x.tail.length / 2; }
  }
  return h.join('') + t.join('');
}

async function tx(to, data, value = 0n, note = '') {
  const v = '0x' + BigInt(value).toString(16);
  const est = await rpc('eth_estimateGas', [{ from: owner, to, data, value: v }, 'latest']);
  const gasPrice = await rpc('eth_gasPrice', []);
  const out = { chainId: 196, from: owner, to, valueWei: BigInt(value).toString(), data, note };
  if (typeof est === 'string') {
    const g = BigInt(est);
    out.estimatedGas = g.toString();
    out.suggestedGasLimit = (g * 12n / 10n).toString();
    out.estimatedNetworkFeeOKB = Number(g * BigInt(gasPrice)) / 1e18;
  } else out.estimateFailed = est;
  out.dataBytes = (data.length - 2) / 2;
  console.log(JSON.stringify(out, null, 2));
}

const steps = {
  'approve-factory': async () => {
    const fee = BigInt(await rpc('eth_call', [{ to: FACTORY, data: sel('deployFee()') }, 'latest']));
    await tx(BEM, sel('approve(address,uint256)') + addr(FACTORY) + w(fee), 0n, `BEM.approve(factory, ${fee} units = deployFee)`);
  },
  create: async () => {
    const [name, symbol, story, supply, price] = args;
    const data = sel('createCPU(string,string,string,uint256,uint256)') +
      encodeDynamic([{ tail: strArg(name) }, { tail: strArg(symbol) }, { tail: strArg(story) }, w(supply), w(price)]);
    const sim = await rpc('eth_call', [{ from: owner, to: FACTORY, data }, 'latest']);
    await tx(FACTORY, data, 0n, `createCPU; eth_call returns (transistors, circuits): ${JSON.stringify(sim)}`);
  },
  'approve-transistors': async () => {
    const [tr, units] = args;
    await tx(BEM, sel('approve(address,uint256)') + addr(tr) + w(units), 0n, `BEM.approve(transistors, ${units})`);
  },
  mint: async () => {
    const [tr, count] = args;
    const price = BigInt(await rpc('eth_call', [{ to: tr, data: sel('mintPrice()') }, 'latest']));
    const fee = BigInt(await rpc('eth_call', [{ to: tr, data: sel('protocolFee()') }, 'latest']));
    await tx(tr, sel('mint(uint256,uint256)') + w(0) + w(count), 0n,
      `mint ${count} NAND; BEM cost = ${price} * ${count} + ${fee} = ${price * BigInt(count) + fee} units`);
  },
  tapeout: async () => {
    const [circuits, file] = args;
    const t = JSON.parse(readFileSync(file, 'utf8'));
    const fee = BigInt(await rpc('eth_call', [{ to: circuits, data: sel('TAPEOUT_FEE()') }, 'latest']));
    const data = sel('tapeout(bytes,uint32,uint32)') + encodeDynamic([{ tail: bytesArg(t.netlistHex) }, w(t.nIn), w(t.nOut)]);
    await tx(circuits, data, fee, `tapeout ${t.module}: ${t.gates} gates, ${t.bytes} bytes, nIn ${t.nIn}, nOut ${t.nOut}`);
  },
  'tapeout-ref': async () => {
    const [circuits, childId, file] = args;
    const t = JSON.parse(readFileSync(file, 'utf8'));
    if (t.nIn > 255 || t.nOut > 255) throw new Error('REF target needs at most 255 inputs and 255 outputs');
    // REF record: 0x02 cpu:20 id:u64 nIns:u8 nOuts:u8 ins:u24 x nIns (TAP-02 section 2)
    let rec = '02' + circuits.slice(2).toLowerCase() + BigInt(childId).toString(16).padStart(16, '0') +
      t.nIn.toString(16).padStart(2, '0') + t.nOut.toString(16).padStart(2, '0');
    for (let i = 0; i < t.nIn; i++) rec += (2 + i).toString(16).padStart(6, '0');
    const fee = BigInt(await rpc('eth_call', [{ to: circuits, data: sel('TAPEOUT_FEE()') }, 'latest']));
    const data = sel('tapeout(bytes,uint32,uint32)') + encodeDynamic([{ tail: bytesArg('0x' + rec) }, w(t.nIn), w(t.nOut)]);
    await tx(circuits, data, fee, `tapeout of one REF to circuit #${childId} (${t.module}), ${rec.length / 2} bytes`);
  },
  'eval-tx': async () => {
    const [circuits, id, nIn] = args;
    const n = Math.ceil(Number(nIn) / 8);
    const data = sel('eval(uint256,bytes)') + encodeDynamic([w(id), { tail: bytesArg('0x' + '00'.repeat(n)) }]);
    await tx(circuits, data, 0n, `eval(${id}, ${n} zero bytes) sent as a transaction`);
  },
};
if (!steps[step]) throw new Error(`unknown step ${step}; see the header`);
await steps[step]();
