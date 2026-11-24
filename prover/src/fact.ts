// One fact question: "is there an input x with bad(x) = 1?" (PLAN 11.2 prover rule 2).
//
// The question is a Verilog module `q (input [W-1:0] x, output bad)` that instantiates the
// circuit exported from the chain bytes. Two independent tools answer it:
//   ABC   : Yosys maps q to an AIG, then `yosys-abc -c "read_aiger q.aig; strash; iprove; write_cex -n q.cex"`
//           (the invocation P0 used for the bonus traps, scripts/p0/bonus-traps.sh).
//   Yosys : `sat -prove bad 0 -show-inputs` on the same flattened design (P0's "sat" column).
// "holds" means a tool proved bad can never be 1; "fails" comes with an x, which the caller
// replays in the simulator and with eval on chain before reporting it (rule 3).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { yosys, type Tools } from './run.ts';

export type Answer = {
  tool: 'abc-iprove' | 'yosys-sat';
  status: 'holds' | 'fails' | 'undecided';
  x: bigint | null;
  seconds: number;
  command: string;
  tail: string;
};
export type Question = { answers: Answer[]; aigSha256: string };

const PREP = 'read_verilog c.v; read_verilog q.v; hierarchy -top q; proc; flatten; opt_clean; techmap; opt -fast';

function run(cmd: string, args: string[], cwd: string): string {
  try {
    return execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return String((e as { stdout?: string }).stdout ?? '') + String((e as { stderr?: string }).stderr ?? '');
  }
}

const tailOf = (log: string) => log.trim().split('\n').slice(-6).join('\n');

/** Ask both tools (or only ABC when `second` is false). `w` is the width of x. */
export function ask(tools: Tools, circuitV: string, question: string, w: number, timeoutSec: number,
  second = true): Question {
  const d = mkdtempSync(join(tmpdir(), 'payproof-fact-'));
  try {
    writeFileSync(join(d, 'c.v'), circuitV);
    writeFileSync(join(d, 'q.v'), question);
    yosys(tools, `${PREP}; aigmap; write_aiger -zinit q.aig`, d);
    const aigSha256 = createHash('sha256').update(readFileSync(join(d, 'q.aig'))).digest('hex');
    const answers: Answer[] = [];

    const abcScript = 'read_aiger q.aig; strash; iprove; write_cex -n q.cex';
    let t0 = process.hrtime.bigint();
    let log = run('timeout', ['--kill-after=10', String(timeoutSec), tools.abc, '-c', abcScript], d);
    let seconds = Number(process.hrtime.bigint() - t0) / 1e9;
    let a: Answer = { tool: 'abc-iprove', status: 'undecided', x: null, seconds,
      command: `yosys-abc -c "${abcScript}"`, tail: tailOf(log) };
    if (/^UNSATISFIABLE/m.test(log)) a.status = 'holds';
    else if (/^SATISFIABLE/m.test(log) && existsSync(join(d, 'q.cex'))) {
      let x = 0n;
      for (const m of readFileSync(join(d, 'q.cex'), 'utf8').matchAll(/pi(\d+)@0=([01])/g)) {
        if (Number(m[1]) < w && m[2] === '1') x |= 1n << BigInt(m[1]);
      }
      a = { ...a, status: 'fails', x };
    }
    answers.push(a);

    if (second) {
      const satScript = `${PREP}; sat -prove bad 0 -show-inputs`;
      t0 = process.hrtime.bigint();
      log = run('timeout', ['--kill-after=10', String(timeoutSec), tools.yosys, '-p', satScript], d);
      seconds = Number(process.hrtime.bigint() - t0) / 1e9;
      const b: Answer = { tool: 'yosys-sat', status: 'undecided', x: null, seconds,
        command: `yosys -p "${satScript}"`, tail: tailOf(log) };
      if (/SAT proof finished - no model found: SUCCESS/.test(log)) b.status = 'holds';
      else if (/SAT proof finished - model found: FAIL/.test(log)) {
        // The model table prints "\x  <bits>  <hex>  <binary>" for the input; read the binary column.
        const m = log.match(/\\x\s+\d+\s+\S+\s+([01]+)/);
        b.status = 'fails';
        b.x = m ? BigInt('0b' + m[1]) : null;
      }
      answers.push(b);
    }
    return { answers, aigSha256 };
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}

/** Combine the tools: a disagreement between a proof and a counterexample stops the run. */
export function verdict(q: Question): 'holds' | 'fails' | 'undecided' {
  const s = q.answers.map((a) => a.status);
  if (s.includes('holds') && s.includes('fails')) {
    throw new Error('tools disagree: one proved the fact, the other found a counterexample');
  }
  return s.includes('fails') ? 'fails' : s.includes('holds') ? 'holds' : 'undecided';
}
