// Trap finder for "a raise never lowers the result" over one input field (PLAN 11.2 rule 7).
//
// The circuit is given as its exported Verilog (module with ports `in` and `out`); the input
// field `over` and the output field `result` are named by layout. All other inputs are held at
// the values in `fixed`. The method is the one P0 used for the bonus rule (scripts/p0/bonus-traps.sh):
//   1. Edge query: is there x, not yet found, with result(x + 1) < result(x)?  ABC `iprove` on an
//      AIG of the question; SAT gives x (an edge), UNSAT proves no edge is left.
//   2. Widen: from edge e, the trap is every y > e with result(y) < result(e). Its end is found by
//      binary search with the query "is there y in (e, m] with result(y) >= result(e)?".
//   3. Each edge found is replayed in the simulator before it is reported (rule 3).
// The report says whether the final "none left" step was proved or ran out of time.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Field } from '../../compiler/src/layout.ts';
import { yosys, type Tools } from './run.ts';

export type TrapRange = { edge: string; from: string; to: string; resultAtEdge: string; lossAtFrom: string };
export type TrapReport = {
  over: string; result: string; ranges: TrapRange[]; complete: boolean;
  queries: { kind: 'edge' | 'widen'; answer: 'sat' | 'unsat' | 'undecided'; seconds: number; detail: string }[];
};
export type Evaluate = (values: Record<string, bigint>) => Record<string, bigint>;

type Q = { answer: 'sat' | 'unsat' | 'undecided'; x: bigint | null; seconds: number };

function assignFixed(nIn: number, inputs: Field[], over: Field, fixed: Record<string, bigint>, xExpr: string): string {
  // Build the `in` vector of the circuit from the free value and the fixed fields.
  const bits: string[] = new Array(nIn).fill("1'b0");
  for (const f of inputs) {
    for (let k = 0; k < f.width; k++) {
      bits[f.offset + k] = f.name === over.name ? `${xExpr}[${k}]`
        : (((fixed[f.name] ?? 0n) >> BigInt(k)) & 1n) ? "1'b1" : "1'b0";
    }
  }
  return `{${bits.slice().reverse().join(', ')}}`;
}

function ask(tools: Tools, circuitV: string, top: string, question: string, w: number, timeoutSec: number): Q {
  const d = mkdtempSync(join(tmpdir(), 'payproof-trap-'));
  try {
    writeFileSync(join(d, 'c.v'), circuitV);
    writeFileSync(join(d, 'q.v'), question);
    yosys(tools, `read_verilog c.v; read_verilog q.v; hierarchy -top q; proc; flatten; opt_clean; techmap; opt -fast; aigmap; write_aiger -zinit q.aig`, d);
    const t0 = process.hrtime.bigint();
    let log = '';
    try {
      log = execFileSync('timeout', ['--kill-after=10', String(timeoutSec), tools.abc, '-c',
        'read_aiger q.aig; strash; iprove; write_cex -n q.cex'], { cwd: d, encoding: 'utf8', maxBuffer: 1 << 26 });
    } catch (e) { log = String((e as { stdout?: string }).stdout ?? ''); }
    const seconds = Number(process.hrtime.bigint() - t0) / 1e9;
    if (/^UNSATISFIABLE/m.test(log)) return { answer: 'unsat', x: null, seconds };
    if (/^SATISFIABLE/m.test(log) && existsSync(join(d, 'q.cex'))) {
      // write_cex -n lists pi<i>@0=<bit>; the AIG inputs are x[0..w-1] in order (the only input).
      let x = 0n;
      for (const m of readFileSync(join(d, 'q.cex'), 'utf8').matchAll(/pi(\d+)@0=([01])/g)) {
        if (Number(m[1]) < w && m[2] === '1') x |= 1n << BigInt(m[1]);
      }
      return { answer: 'sat', x, seconds };
    }
    return { answer: 'undecided', x: null, seconds };
  } finally { rmSync(d, { recursive: true, force: true }); }
}

export function findTraps(tools: Tools, circuitV: string, top: string, nIn: number, nOut: number,
  inputs: Field[], outputs: Field[], over: string, result: string, fixed: Record<string, bigint>,
  evaluate: Evaluate, timeoutSec: number, maxTraps = 64): TrapReport {
  const fo = inputs.find((f) => f.name === over);
  const fr = outputs.find((f) => f.name === result);
  if (!fo || !fr) throw new Error('unknown field');
  const w = fo.width; const rw = fr.width;
  const maxX = (1n << BigInt(w)) - 1n;
  const res = (sig: string) => `${sig}[${fr.offset + rw - 1}:${fr.offset}]`;
  const inst = (name: string, x: string, o: string) =>
    `  wire [${nOut - 1}:0] ${o};\n  ${top} ${name} (.in(${assignFixed(nIn, inputs, fo, fixed, x)}), .out(${o}));\n`;
  const report: TrapReport = { over, result, ranges: [], complete: false, queries: [] };
  const edges: bigint[] = [];
  const valueAt = (x: bigint) => evaluate({ ...fixed, [over]: x })[result];

  for (let k = 0; k <= maxTraps; k++) {
    const excl = edges.map((e) => ` || (x == ${w}'d${e})`).join('');
    const q = `module q (input [${w - 1}:0] x, output bad);\n  wire [${w - 1}:0] x1 = x + ${w}'d1;\n` +
      inst('c0', 'x', 'o0') + inst('c1', 'x1', 'o1') +
      `  assign bad = (x != ${w}'d${maxX}) && !(1'b0${excl}) && (${res('o1')} < ${res('o0')});\nendmodule\n`;
    const a = ask(tools, circuitV, top, q, w, timeoutSec);
    report.queries.push({ kind: 'edge', answer: a.answer, seconds: a.seconds, detail: a.x === null ? '' : `x = ${a.x}` });
    if (a.answer === 'unsat') { report.complete = true; break; }
    if (a.answer === 'undecided') break;
    const e = a.x!;
    const r0 = valueAt(e); const r1 = valueAt(e + 1n);
    if (!(r1 < r0)) throw new Error(`edge ${e} does not replay in the simulator: ${r0} then ${r1}`);
    edges.push(e);
    // Widen: largest m with no y in (e, m] reaching result(e) again.
    let lo = e + 1n; let hi = maxX; let end = e + 1n;
    while (lo <= hi) {
      const m = (lo + hi) / 2n;
      const wq = `module q (input [${w - 1}:0] x, output bad);\n  wire [${w - 1}:0] e0 = ${w}'d${e};\n` +
        inst('c0', 'e0', 'o0') + inst('c1', 'x', 'o1') +
        `  assign bad = (x > ${w}'d${e}) && (x <= ${w}'d${m}) && (${res('o1')} >= ${res('o0')});\nendmodule\n`;
      const b = ask(tools, circuitV, top, wq, w, timeoutSec);
      report.queries.push({ kind: 'widen', answer: b.answer, seconds: b.seconds, detail: `(${e}, ${m}]` });
      if (b.answer === 'unsat') { end = m; lo = m + 1n; } else if (b.answer === 'sat') { hi = m - 1n; } else { break; }
    }
    report.ranges.push({ edge: String(e), from: String(e + 1n), to: String(end), resultAtEdge: String(r0), lossAtFrom: String(r0 - r1) });
  }
  report.ranges.sort((a, b) => (BigInt(a.edge) < BigInt(b.edge) ? -1 : 1));
  return report;
}
