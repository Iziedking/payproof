// The trap finder on a hand-built step function (P1 done criterion), synthesised to NAND gates
// with the real tools, imported, exported from its TAP-02 bytes and searched:
//   y = x < 50 ? x : (x < 120 ? x - 30 : x - 60)        (8-bit x and y)
// By hand: y drops after x = 49 (49 -> 20) and stays below 49 until x = 79, so the first trap is
// 50..78; y drops after x = 119 (89 -> 60) and stays below 89 until x = 149, so the second trap
// is 120..148. No other x has y(x + 1) < y(x), so the search must end with a proved "none left".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fromYosys } from '../../compiler/src/yosys.ts';
import { evaluate } from '../../compiler/src/netlist.ts';
import { pack, unpack } from '../../compiler/src/layout.ts';
import { toVerilog } from '../src/export.ts';
import { toolsFromEnv, yosys } from '../src/run.ts';
import { findTraps } from '../src/traps.ts';

const skip = !process.env.OSS_CAD_SUITE;
const STEP = `module step (input [7:0] x, output [7:0] y);
  assign y = (x < 8'd50) ? x : ((x < 8'd120) ? x - 8'd30 : x - 8'd60);
endmodule
`;

test('trap finder returns the two hand-worked ranges and proves none is left', { skip, timeout: 1_800_000 }, () => {
  const tools = toolsFromEnv();
  const d = mkdtempSync(join(tmpdir(), 'payproof-step-'));
  let c;
  try {
    writeFileSync(join(d, 'step.v'), STEP);
    yosys(tools, 'read_verilog step.v; synth -flatten -top step -noabc; abc -g NAND; opt_clean -purge; write_json step.json', d);
    c = fromYosys(JSON.parse(readFileSync(join(d, 'step.json'), 'utf8')), 'step');
  } finally { rmSync(d, { recursive: true, force: true }); }
  const ev = (v: Record<string, bigint>) => unpack(c.outputs, evaluate(c.bytes, c.nIn, c.nOut, pack(c.inputs, v, c.nIn)));
  for (const [x, y] of [[0n, 0n], [49n, 49n], [50n, 20n], [78n, 48n], [79n, 49n], [119n, 89n], [120n, 60n], [148n, 88n], [149n, 89n], [255n, 195n]]) {
    assert.equal(ev({ x }).y, y, `the netlist computes the step at x = ${x}`);
  }
  const v = toVerilog(c.bytes, c.nIn, c.nOut, 'step_tap');
  const r = findTraps(tools, v, 'step_tap', c.nIn, c.nOut, c.inputs, c.outputs, 'x', 'y', {}, ev, 300);
  console.log('  ' + JSON.stringify({ ranges: r.ranges, complete: r.complete, queries: r.queries.length,
    seconds: +r.queries.reduce((s, q) => s + q.seconds, 0).toFixed(2) }));
  assert.deepEqual(r.ranges.map((x) => [x.from, x.to]), [['50', '78'], ['120', '148']]);
  assert.equal(r.complete, true, 'the final "none left" query must be proved');
});
