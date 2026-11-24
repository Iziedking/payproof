// One fact question: "is there an input x with bad(x) = 1?" (PLAN 11.2 prover rule 2).
//
// The question is a Verilog module `q (input [W-1:0] x, output bad)` that instantiates the
// circuit exported from the chain bytes. Three tools can answer it:
//   ABC   : Yosys maps q to an AIG, then `yosys-abc -c "read_aiger q.aig; strash; iprove; write_cex -n q.cex"`
//           (the invocation P0 used for the bonus traps, scripts/p0/bonus-traps.sh).
//   Yosys : `sat -prove bad 0 -show-inputs` on the same flattened design (P0's "sat" column).
//   SMT   : Yosys `write_smt2 -tpl` writes the flattened design, word-level (no techmap), as
//           SMT-LIB 2 with one uninterpreted state sort; the template asserts the hierarchy
//           function |q_h| and the output |q_n bad|, then asks (check-sat) and (get-value) of x.
//           Bitwuzla 0.9.1 (OSS CAD Suite 2026-10-29) answers. Sources: `yosys -h write_smt2` and
//           `bitwuzla --help` from that suite, read on the test host 2026-11-24 (task p3-smt-help).
//           It shares only the Verilog front end with the other two.
// By default ABC and Yosys sat are asked, as in the first P3 runs.
// "holds" means a tool proved bad can never be 1; "fails" comes with an x, which the caller
// replays in the simulator and with eval on chain before reporting it (rule 3).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { yosys, type Tools } from './run.ts';

export type Answer = {
  tool: ToolName;
  status: 'holds' | 'fails' | 'undecided';
  x: bigint | null;
  seconds: number;
  command: string;
  tail: string;
};
export type ToolName = 'abc-iprove' | 'yosys-sat' | 'smt-bitwuzla' | 'smt-z3';
export type Question = { answers: Answer[]; aigSha256: string | null; smt2Sha256?: string };

const SMT_TEMPLATE = `(set-option :produce-models true)
(set-logic QF_UFBV)
%%
(declare-fun s () |q_s|)
(assert (|q_h| s))
(assert (|q_n bad| s))
(check-sat)
(get-value ((|q_n x| s)))
`;

/** Tools named in PAYPROOF_TOOLS (comma list), or null for the default. */
export function toolsFromList(list: string | undefined): ToolName[] | null {
  if (!list) return null;
  const names = list.split(',').map((t) => t.trim()).filter(Boolean);
  for (const n of names) if (!['abc-iprove', 'yosys-sat', 'smt-bitwuzla', 'smt-z3'].includes(n)) throw new Error(`unknown tool ${n}`);
  return names as ToolName[];
}

const PREP = 'read_verilog c.v; read_verilog q.v; hierarchy -top q; proc; flatten; opt_clean; techmap; opt -fast';

function run(cmd: string, args: string[], cwd: string): string {
  try {
    return execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return String((e as { stdout?: string }).stdout ?? '') + String((e as { stderr?: string }).stderr ?? '');
  }
}

const tailOf = (log: string) => log.trim().split('\n').slice(-6).join('\n');

/**
 * Ask the tools in `which`: true (the default) means ABC and Yosys sat, false means ABC only.
 * `w` is the width of x.
 */
export function ask(tools: Tools, circuitV: string, question: string, w: number, timeoutSec: number,
  which: boolean | ToolName[] = true): Question {
  const use: ToolName[] = which === true ? ['abc-iprove', 'yosys-sat'] : which === false ? ['abc-iprove'] : which;
  const d = mkdtempSync(join(tmpdir(), 'payproof-fact-'));
  try {
    writeFileSync(join(d, 'c.v'), circuitV);
    writeFileSync(join(d, 'q.v'), question);
    const answers: Answer[] = [];
    let aigSha256: string | null = null;
    let smt2Sha256: string | undefined;
    let t0: bigint, log: string, seconds: number;

    if (use.includes('abc-iprove')) {
    yosys(tools, `${PREP}; aigmap; write_aiger -zinit q.aig`, d);
    aigSha256 = createHash('sha256').update(readFileSync(join(d, 'q.aig'))).digest('hex');
    const abcScript = 'read_aiger q.aig; strash; iprove; write_cex -n q.cex';
    t0 = process.hrtime.bigint();
    log = run('timeout', ['--kill-after=10', String(timeoutSec), tools.abc, '-c', abcScript], d);
    seconds = Number(process.hrtime.bigint() - t0) / 1e9;
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
    }

    if (use.includes('yosys-sat')) {
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

    // The SMT tools read one file, written once: Bitwuzla, and Z3 4.15.5 from the same suite
    // (`z3 <file>` runs an SMT-LIB 2 script). Each is an independent solver.
    const smtTools = (['smt-bitwuzla', 'smt-z3'] as const).filter((x) => use.includes(x));
    if (smtTools.length) {
      writeFileSync(join(d, 'q.tpl'), SMT_TEMPLATE);
      // Word-level on purpose: no techmap or aigmap, so the solver sees the question's arithmetic.
      yosys(tools, 'read_verilog c.v; read_verilog q.v; hierarchy -top q; proc; flatten; opt_clean; write_smt2 -tpl q.tpl q.smt2', d);
      smt2Sha256 = createHash('sha256').update(readFileSync(join(d, 'q.smt2'))).digest('hex');
    }
    for (const name of smtTools) {
      const bin = name === 'smt-bitwuzla' ? tools.bitwuzla : tools.z3;
      if (!bin) throw new Error(`no binary for ${name} in the tool set`);
      t0 = process.hrtime.bigint();
      log = run('timeout', ['--kill-after=10', String(timeoutSec), bin, 'q.smt2'], d);
      seconds = Number(process.hrtime.bigint() - t0) / 1e9;
      const c: Answer = { tool: name, status: 'undecided', x: null, seconds,
        command: `yosys -p "read_verilog c.v; read_verilog q.v; hierarchy -top q; proc; flatten; opt_clean; write_smt2 -tpl q.tpl q.smt2"; ${name === 'smt-bitwuzla' ? 'bitwuzla' : 'z3'} q.smt2`,
        tail: tailOf(log) };
      // The first answer line; a solver may exit non-zero on sat or unsat, and an error from
      // (get-value) after unsat goes to stderr, which run() appends after stdout.
      const first = log.match(/^(sat|unsat|unknown)$/m)?.[1];
      if (first === 'unsat') c.status = 'holds';
      else if (first === 'sat') {
        // (get-value) prints ((|q_n x| s) <value>): #b binary (Bitwuzla's default), or #x hex,
        // or (_ bvN w), as Z3 may print depending on the width.
        const m = log.match(/\|q_n x\| s\)\s+(#b[01]+|#x[0-9a-fA-F]+|\(_ bv(\d+) \d+\))/);
        if (!m) throw new Error(`${name} said sat but printed no value for x`);
        c.status = 'fails';
        c.x = m[2] ? BigInt(m[2]) : BigInt('0' + m[1].slice(1));
      }
      answers.push(c);
    }
    return { answers, aigSha256, smt2Sha256 };
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
