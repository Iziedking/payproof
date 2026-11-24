// The fact runner (prover/src/fact.ts) on a hand-built circuit, exported from its TAP-02 bytes:
//   y = x < 50 ? x : x - 30      (8-bit x and y; synthesised to NAND gates with the real tools)
// By hand: y <= x for every x, so "y > x" can never happen (holds). y(50) = 20 < y(49) = 49, so
// "a bigger x never gives a smaller y" is broken, and the only x with y(x + 1) < y(x) is 49.
// A forced one-second limit on a question no tool answers in time must give "undecided".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fromYosys } from '../../compiler/src/yosys.ts';
import { toVerilog } from '../src/export.ts';
import { toolsFromEnv, yosys } from '../src/run.ts';
import { ask, verdict } from '../src/fact.ts';

const skip = !process.env.OSS_CAD_SUITE;
const STEP = `module step (input [7:0] x, output [7:0] y);
  assign y = (x < 8'd50) ? x : x - 8'd30;
endmodule
`;

function circuit() {
  const tools = toolsFromEnv();
  const d = mkdtempSync(join(tmpdir(), 'payproof-fact-test-'));
  try {
    writeFileSync(join(d, 'step.v'), STEP);
    yosys(tools, 'read_verilog step.v; synth -flatten -top step -noabc; abc -g NAND; opt_clean -purge; write_json step.json', d);
    const c = fromYosys(JSON.parse(readFileSync(join(d, 'step.json'), 'utf8')), 'step');
    return { tools, v: toVerilog(c.bytes, c.nIn, c.nOut, 'step_tap') };
  } finally { rmSync(d, { recursive: true, force: true }); }
}

test('a true fact holds in both tools, a broken one fails with the hand-worked input', { skip, timeout: 600_000 }, () => {
  const { tools, v } = circuit();
  const holds = ask(tools, v, `module q (input [7:0] x, output bad);
  wire [7:0] y; step_tap c (.in(x), .out(y));
  assign bad = y > x;
endmodule
`, 8, 120);
  assert.deepEqual(holds.answers.map((a) => a.status), ['holds', 'holds']);
  assert.equal(verdict(holds), 'holds');

  const fails = ask(tools, v, `module q (input [7:0] x, output bad);
  wire [7:0] y0, y1; wire [7:0] x1 = x + 8'd1;
  step_tap c0 (.in(x), .out(y0)); step_tap c1 (.in(x1), .out(y1));
  assign bad = (x != 8'd255) && (y1 < y0);
endmodule
`, 8, 120);
  assert.equal(verdict(fails), 'fails');
  for (const a of fails.answers) {
    assert.equal(a.status, 'fails', a.tool);
    assert.equal(a.x, 49n, `${a.tool} gives the only failing input`);
  }
});

test('a forced timeout gives undecided, never holds', { skip, timeout: 600_000 }, () => {
  const tools = toolsFromEnv();
  // 64-bit multiplication commutes: true, but out of reach in one second for both tools.
  const v = `module m (input [127:0] in, output [127:0] out);
  assign out = in[63:0] * in[127:64];
endmodule
`;
  const r = ask(tools, v, `module q (input [127:0] x, output bad);
  wire [127:0] a, b; m c0 (.in(x), .out(a)); m c1 (.in({x[63:0], x[127:64]}), .out(b));
  assign bad = a != b;
endmodule
`, 128, 1);
  for (const a of r.answers) assert.equal(a.status, 'undecided', a.tool);
  assert.equal(verdict(r), 'undecided');
});
