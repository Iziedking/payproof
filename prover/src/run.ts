// Run Yosys and ABC on the test host and read their verdicts.
//
// Invocations are the ones P0 checked against the help text of OSS CAD Suite 2026-10-29
// (scripts/p0/prove-split.sh, part comp): both designs in one Yosys session, joined with
// `miter -equiv -flatten` (ports matched by name), mapped to an AIG and written with symbols;
// then yosys-abc `&r <aig>; &cec -m -v -T <seconds>`. &cec may print "UNDECIDED after the new
// CEC engine" and then run the old engine, so the verdict is the LAST verdict line.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Tools = { yosys: string; abc: string; bitwuzla?: string };
export type Verdict = {
  status: 'holds' | 'fails' | 'undecided';
  verdictLine: string;
  counterexample: Record<string, string> | null;   // port name -> Verilog literal, as &cec prints it
  seconds: number;
  miterSha256: string;
  log: string;
};

export function toolsFromEnv(): Tools {
  const dir = process.env.OSS_CAD_SUITE ?? '';
  if (!dir) throw new Error('set OSS_CAD_SUITE to the oss-cad-suite directory');
  return { yosys: join(dir, 'bin', 'yosys'), abc: join(dir, 'bin', 'yosys-abc'), bitwuzla: join(dir, 'bin', 'bitwuzla') };
}

export function yosys(tools: Tools, script: string, cwd: string): string {
  return execFileSync(tools.yosys, ['-q', '-p', script], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
}

/** Last "Networks are ..." line, and the counterexample line &cec -v prints after a failure. */
export function parseCec(log: string): Pick<Verdict, 'status' | 'verdictLine' | 'counterexample'> {
  const lines = log.split('\n');
  const verdicts = lines.filter((l) => /Networks are (equivalent|NOT EQUIVALENT)|UNDECIDED/i.test(l));
  const last = verdicts.length ? verdicts[verdicts.length - 1].trim() : '';
  const status = /Networks are equivalent/.test(last) ? 'holds' : /NOT EQUIVALENT/.test(last) ? 'fails' : 'undecided';
  let counterexample: Record<string, string> | null = null;
  const inLine = lines.find((l) => /^INPUT:/.test(l.trim()));
  if (status === 'fails' && inLine) {
    counterexample = {};
    const body = inLine.trim().replace(/^INPUT:\s*/, '').split('.')[0];
    for (const part of body.split(',')) {
      const m = part.trim().match(/^(\S+)\s*=\s*(\S+)$/);
      if (m) counterexample[m[1]] = m[2];
    }
  }
  return { status, verdictLine: last, counterexample };
}

/**
 * Equality of two designs with the same port names. `files` are Verilog sources written to a
 * scratch directory; `gold` and `gate` are their top modules.
 */
export function equivalent(tools: Tools, files: Record<string, string>, gold: string, gate: string,
  timeoutSec: number): Verdict {
  const dir = mkdtempSync(join(tmpdir(), 'payproof-miter-'));
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    const reads = Object.keys(files).map((f) => `read_verilog ${f};`).join(' ');
    yosys(tools, `${reads} hierarchy; proc; miter -equiv -flatten ${gold} ${gate} miter; hierarchy -top miter; ` +
      'techmap; opt -fast; aigmap; write_aiger -symbols miter.aig', dir);
    const aig = readFileSync(join(dir, 'miter.aig'));
    const t0 = process.hrtime.bigint();
    let log: string;
    try {
      log = execFileSync('timeout', ['--kill-after=10', String(timeoutSec + 60), tools.abc, '-c',
        `&r miter.aig; &cec -m -v -T ${timeoutSec}`], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 28 });
    } catch (e) {
      log = String((e as { stdout?: string }).stdout ?? '') + String((e as { stderr?: string }).stderr ?? '');
    }
    const seconds = Number(process.hrtime.bigint() - t0) / 1e9;
    return { ...parseCec(log), seconds, miterSha256: createHash('sha256').update(aig).digest('hex'), log };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A Verilog literal as &cec prints it (e.g. 32'h006EB900) to a bigint. */
export function literalToBigInt(lit: string): bigint {
  const m = lit.match(/^(\d+)'([hbd])([0-9a-fA-F_xXzZ]+)$/);
  if (!m) throw new Error(`cannot read literal ${lit}`);
  const digits = m[3].replace(/_/g, '').replace(/[xXzZ]/g, '0');
  return m[2] === 'h' ? BigInt('0x' + digits) : m[2] === 'b' ? BigInt('0b' + digits) : BigInt(digits);
}
