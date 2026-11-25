// P4: which newer opcodes does X Layer accept? Read-only: each probe is an eth_call with no
// `to`, whose data is a few bytes of init code that use one opcode and then return. If the
// chain does not know the opcode, the call fails. A control with the designated invalid opcode
// (0xfe) shows what a failure looks like. Nothing is sent and nothing is signed.
// The answer decides `evm_version` in contracts/foundry.toml before anything is deployed.
// Usage: node scripts/p4/evm-probe.mts <rpc> <out.json>
import { writeFileSync } from 'node:fs';
import { latestBlock, rpcAt } from '../../prover/src/chain.ts';

const [rpcUrl, outPath] = process.argv.slice(2);
if (!rpcUrl || !outPath) throw new Error('usage: evm-probe.mts <rpc> <out.json>');
const rpc = rpcAt(rpcUrl);
const block = await latestBlock(rpc);
const tag = '0x' + block.toString(16);

const probes: { name: string; fork: string; code: string }[] = [
  { name: 'control: RETURN only', fork: '-', code: '0x60006000f3' }, // PUSH1 0 PUSH1 0 RETURN
  { name: 'control: INVALID (0xfe)', fork: '-', code: '0xfe' },
  { name: 'PUSH0 (0x5f)', fork: 'Shanghai', code: '0x5f5ff3' }, // PUSH0 PUSH0 RETURN
  { name: 'TSTORE/TLOAD (0x5d/0x5c)', fork: 'Cancun', code: '0x600160005d60005c5060006000f3' },
  { name: 'MCOPY (0x5e)', fork: 'Cancun', code: '0x6000600060005e60006000f3' },
  { name: 'BLOBBASEFEE (0x4a)', fork: 'Cancun', code: '0x4a5060006000f3' },
];

const results = [];
for (const p of probes) {
  let ok = true, detail = '';
  try {
    detail = String(await rpc('eth_call', [{ data: p.code, gas: '0x100000' }, tag]));
  } catch (e) {
    ok = false;
    detail = String((e as Error).message).slice(0, 300);
  }
  results.push({ ...p, accepted: ok, detail });
  console.log(`${p.name} [${p.fork}]: ${ok ? 'accepted' : 'refused'} ${detail}`);
}
writeFileSync(outPath, JSON.stringify({ rpc: rpcUrl, block, ranAt: new Date().toISOString(), results }, null, 2) + '\n');
const control = results[1];
if (control.accepted) { console.error('FAIL: the invalid-opcode control was accepted, so the probe cannot tell'); process.exit(1); }
