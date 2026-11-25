// P3: gather every proof result into one file the app reads, so no result on a page is typed
// by hand (PLAN section 13, P3 "no hand-typed result").
// Usage: node scripts/p3/collect-proofs.mts [--check]
//   writes  app/src/proofs/records.json
//   --check compares the file in the repo with a fresh build from the evidence and exits 1 on
//           any difference (run by the app test task on the test host).
//
// Sources, all in docs/evidence/p3:
//   cn-bonus/records.json, cn-bonus-smt/records.json      facts and traps on circuits 9 and 12
//   ng-paye/records.json,  ng-paye-smt/records.json       facts and the trap on circuits 10 and 11
//   split/summary.txt, split/chain.json                    split facts: integer predicate + chain
//   engines/records.json                                   SIMULATED engines against circuit 9
// and docs/evidence/p4/fee-onchain/fee-is-fixed.json: the split fee circuit (17), as a split-v1 fact.
// A fact's status: "fails" if any tool found an input that breaks it (each such input was
// replayed in the simulator and with eval on chain before it was recorded); else "holds" if at
// least one tool proved it; else "undecided". `holdsBy` lists every tool that proved it, so the
// page can say when only one tool did (PLAN 11.2 rule 4).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const EV = 'docs/evidence/p3';
const OUT = 'app/src/proofs/records.json';

type Answer = { tool: string; status: 'holds' | 'fails' | 'undecided'; seconds: number };
type Rec = {
  factId: string; blockNumber: number; status: string; statement: { en: string; zh: string };
  circuits: { id: string; netlistKeccak: string; gateCount: number }[];
  answers?: Answer[]; mutant?: { status: string; answers: Answer[] } | null;
  counterexample?: unknown; traps?: Record<string, unknown>; publishedTable?: Record<string, unknown>;
  expectedFromReadme?: Record<string, unknown>; selectedFacts?: string[]; timeoutSeconds: number;
};
type Run = { block: number; evidence: string; tools: { tool: string; status: string; seconds: number }[]; mutant: string | null };
type Fact = {
  factId: string; statement: { en: string; zh: string }; status: 'holds' | 'fails' | 'undecided';
  holdsBy: string[]; failsBy: string[]; method: 'circuit' | 'chain'; circuits: string[];
  counterexample: unknown; runs: Run[];
};

const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const limits = new Set<number>();   // every run's time limit per query; the page states it
const round = (s: number) => Math.round(s * 10) / 10;

function facts(dirs: string[]): { facts: Fact[]; recs: Rec[] } {
  const byId = new Map<string, Fact>();
  const recs: Rec[] = [];
  for (const dir of dirs) {
    const file = `${EV}/${dir}/records.json`;
    for (const r of json(file).records as Rec[]) {
      recs.push(r);
      limits.add(r.timeoutSeconds);
      const f = byId.get(r.factId) ?? {
        factId: r.factId, statement: r.statement, status: 'undecided', holdsBy: [], failsBy: [], method: 'circuit',
        circuits: [...new Set(r.circuits.map((c) => c.id))], counterexample: null, runs: [],
      } satisfies Fact;
      const answers = r.answers ?? [];
      for (const a of answers) {
        if (a.status === 'holds' && !f.holdsBy.includes(a.tool)) f.holdsBy.push(a.tool);
        if (a.status === 'fails' && !f.failsBy.includes(a.tool)) f.failsBy.push(a.tool);
      }
      // The bonus trap record has no answers list: the trap finder ran instead, each query by ABC.
      const finder = r.status === 'fails' && !answers.length && r.traps
        ? [{ tool: 'trap-finder (abc-iprove)', status: 'fails' as const, seconds: (r.traps as { seconds: number }).seconds }] : [];
      if (finder.length) f.failsBy.push(finder[0].tool);
      if (r.counterexample) f.counterexample = r.counterexample;
      f.runs.push({ block: r.blockNumber, evidence: `${EV}/${dir}/${r.factId}.json`,
        tools: [...answers, ...finder].map((a) => ({ tool: a.tool, status: a.status, seconds: round(a.seconds) })),
        mutant: r.mutant ? r.mutant.status : null });
      byId.set(r.factId, f);
    }
  }
  for (const f of byId.values()) f.status = f.failsBy.length ? 'fails' : f.holdsBy.length ? 'holds' : 'undecided';
  return { facts: [...byId.values()], recs };
}

type Range = { edge: string; from: string; to: string; atEdge: string; atFrom: string; atTo: string };
function trap(recs: Rec[], dir: string, unit: 'fen' | 'naira') {
  const r = recs.find((x) => x.factId === 'raise-never-lowers-take-home' && x.traps)!;
  const t = r.traps as { over: string; fixed?: string; complete: boolean; seconds: number; queries: unknown[] | number;
    ranges: { edge: string; from: string; to: string; onChain: Record<string, string> }[] };
  const ranges: Range[] = t.ranges.map((x) => {
    const v = Object.values(x.onChain);   // at edge, at from, at to, in that order in both records
    return { edge: x.edge, from: x.from, to: x.to, atEdge: v[0], atFrom: v[1], atTo: v[2] };
  });
  const cmp = (r.publishedTable ?? r.expectedFromReadme) as { source?: string; note?: string; match: boolean };
  return { factId: r.factId, over: t.over, unit, fixed: t.fixed ?? null, block: r.blockNumber, complete: t.complete,
    seconds: round(t.seconds), queries: Array.isArray(t.queries) ? t.queries.length : t.queries, ranges,
    comparedWith: cmp.source ?? cmp.note ?? '', matches: cmp.match, evidence: `${EV}/${dir}/raise-never-lowers-take-home.json` };
}

// Split: link A (integer predicate, Z3 and cvc5) and links 1 to 3 (circuit 8 computes it).
function split() {
  const lines = readFileSync(`${EV}/split/summary.txt`, 'utf8').split('\n');
  const chain = json(`${EV}/split/chain.json`);
  const A = new Map<string, { z3?: string; cvc5?: string; mz3?: string; mcvc5?: string; z3s?: string; cvc5s?: string }>();
  for (const l of lines) {
    const m = l.match(/^A (\S+?)(\.mutant)? (z3|cvc5) (\S+) \(want \S+\) ([\d.]+)/);
    if (!m) continue;
    const e = A.get(m[1]) ?? {};
    (e as Record<string, string>)[(m[2] ? 'm' : '') + m[3]] = m[4];
    if (!m[2]) (e as Record<string, string>)[m[3] + 's'] = m[5];
    A.set(m[1], e);
  }
  const want = (re: RegExp, word: string) => lines.some((l) => re.test(l) && l.includes(word));
  const links = {
    joinedRtl: want(/^s1-32 \[/, 'are equivalent') && want(/^s1-32mut \[/, 'NOT EQUIVALENT'),
    refTargets: ['m4', 'm5', 'm6', 'm7'].every((m) => want(new RegExp(`^${m} \\[`), 'are equivalent') && want(new RegExp(`^${m}-mut \\[`), 'NOT EQUIVALENT'))
      && want(/^amul gate pacheck/, 'TARGET CHECKED') && want(/^amul mutant verify/, 'INCORRECT MULTIPLIER'),
    circuit8: want(/^s3 \[/, 'are equivalent') && want(/^s3-mut \[/, 'NOT EQUIVALENT'),
  };
  const chainHolds = links.joinedRtl && links.refTargets && links.circuit8;
  // Supporting facts of the chain (PLAN 11.1 notes): shown with their own result.
  const support = ['one-payout-accepted', 'a-payout-accepted', 'no-overflow'].map((id) => {
    const e = A.get(id) ?? {};
    return { factId: id, holdsBy: [e.z3 === 'unsat' ? 'z3' : '', e.cvc5 === 'unsat' ? 'cvc5' : ''].filter(Boolean),
      mutantCaught: e.mz3 === 'sat' && e.mcvc5 === 'sat' };
  });
  for (const l of lines) { const m = l.match(/ none (want unsat) (d+).d+/); if (m) limits.add(Number(m[1])); }
  const STATEMENTS: Record<string, { en: string; zh: string }> = {
    'never-overpays': { en: "A payout is never more than the holder's exact share", zh: '每次分配都不超过持有人的精确份额' },
    'at-most-one-unit-short': { en: 'A payout is less than one unit below the exact share', zh: '分配额比精确份额少不到一个单位' },
    'more-shares-never-less': { en: 'With the same pot and total, more shares never pay less', zh: '奖池和总份额相同时，份额越多，分配不会更少' },
    'bigger-pot-never-less': { en: 'With the same shares and total, a bigger pot never pays less', zh: '份额和总份额相同时，奖池越大，分配不会更少' },
    'splitting-never-pays-more': { en: 'Holding shares in two wallets never earns more than in one', zh: '把份额分到两个钱包，所得不会比放在一个钱包更多' },
    'zero-in-zero-out': { en: 'No shares, no payout', zh: '没有份额，就没有分配' },
  };
  const tool = (s?: string) => (s === 'unsat' ? 'holds' : s === 'sat' ? 'fails' : 'undecided');
  const list: Fact[] = Object.entries(STATEMENTS).map(([id, statement]) => {
    const e = A.get(id) ?? {};
    const holdsBy = [e.z3 === 'unsat' ? 'z3' : '', e.cvc5 === 'unsat' ? 'cvc5' : ''].filter(Boolean);
    const mutantCaught = e.mz3 === 'sat' && e.mcvc5 === 'sat';
    return { factId: id, statement, status: chainHolds && holdsBy.length && mutantCaught ? 'holds' : 'undecided', holdsBy, failsBy: [],
      method: 'chain', circuits: ['8', ...chain.refs.map((r: { id: string }) => r.id)], counterexample: null,
      runs: [{ block: chain.block, evidence: `${EV}/split/summary.txt`,
        tools: [{ tool: 'z3', status: tool(e.z3), seconds: Number(e.z3s) }, { tool: 'cvc5', status: tool(e.cvc5), seconds: Number(e.cvc5s) }],
        mutant: mutantCaught ? 'fails' : 'not caught' }] };
  });
  return { facts: list, links, support, block: chain.block };
}

// Engine equality (scripts/p3/engines.mts): each SIMULATED engine against the rule's circuit.
// "equal" if a tool proved the outputs never differ, "differs" if a tool found a bonus where they
// do (replayed in the simulator and with eval on chain before it was recorded), else "undecided".
type EngRec = {
  engine: string; label: string; simulated: boolean; ruleId: string; blockNumber: number; result: string;
  statement: { en: string; zh: string }; circuits: { id: string }[]; answers: Answer[];
  counterexample: Record<string, string> | null; mutant: { status: string }; timeoutSeconds: number;
};
function engines() {
  const file = `${EV}/engines/records.json`;
  return (json(file).records as EngRec[]).map((r) => {
    limits.add(r.timeoutSeconds);
    if (!r.simulated) throw new Error(`${r.engine}: every engine shown must be labelled simulated`);
    return {
      engine: r.engine, label: r.label, simulated: true, ruleId: r.ruleId, statement: r.statement,
      referenceCircuit: r.circuits[0].id, circuit: r.circuits[r.circuits.length - 1].id, block: r.blockNumber,
      result: r.result, holdsBy: r.answers.filter((a) => a.status === 'holds').map((a) => a.tool),
      failsBy: r.answers.filter((a) => a.status === 'fails').map((a) => a.tool),
      tools: r.answers.map((a) => ({ tool: a.tool, status: a.status, seconds: round(a.seconds) })),
      counterexample: r.counterexample, mutant: r.mutant.status, evidence: `${EV}/engines/${r.engine}.json`,
    };
  });
}

const cn = facts(['cn-bonus', 'cn-bonus-smt']);
const ng = facts(['ng-paye', 'ng-paye-smt', 'ng-paye-z3']);
const sp = split();
// P4: the split's operator fee (fee circuit 17), proved on the bytes read from X Layer.
{
  const FEE = 'docs/evidence/p4/fee-onchain/fee-is-fixed.json';
  const r = json(FEE);
  limits.add(r.timeoutSeconds);
  const by = (s: string) => r.answers.filter((a: Answer) => a.status === s).map((a: Answer) => a.tool);
  const holdsBy = by('holds'), failsBy = by('fails');
  sp.facts.push({ factId: r.factId, statement: r.statement,
    status: failsBy.length ? 'fails' : holdsBy.length >= 2 && r.mutant.status === 'fails' ? 'holds' : 'undecided',
    holdsBy, failsBy, method: 'circuit', circuits: r.circuits.map((c: { id: string }) => c.id), counterexample: r.counterexample,
    runs: [{ block: r.blockNumber, evidence: FEE, tools: r.answers.map((a: Answer) => ({ tool: a.tool, status: a.status, seconds: round(a.seconds) })),
      mutant: r.mutant.status }] });
}
const out = {
  note: 'Generated by scripts/p3/collect-proofs.mts from docs/evidence/p3. Do not edit by hand.',
  rules: [
    { ruleId: 'cn-bonus-2023-30', facts: cn.facts, trap: trap(cn.recs, 'cn-bonus', 'fen') },
    { ruleId: 'ng-paye-nta2025', facts: ng.facts, trap: trap(ng.recs, 'ng-paye', 'naira') },
    { ruleId: 'split-v1', facts: sp.facts, chain: { block: sp.block, links: sp.links, support: sp.support, evidence: `${EV}/split/summary.txt` } },
  ],
  engines: engines(),
};
if (limits.size !== 1) throw new Error(`runs used different time limits: ${[...limits].join(', ')}`);
(out as Record<string, unknown>).limitSeconds = [...limits][0];
const text = JSON.stringify(out, null, 2) + '\n';
if (process.argv.includes('--check')) {
  const have = readFileSync(OUT, 'utf8');
  if (have !== text) { console.error(`FAIL: ${OUT} differs from the evidence; run scripts/p3/collect-proofs.mts`); process.exit(1); }
  console.log(`${OUT} matches the evidence`);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  for (const r of out.rules) console.log(r.ruleId, r.facts.map((f) => `${f.factId}=${f.status}[${f.holdsBy.join('+')}]`).join(' '));
  for (const e of out.engines) console.log(`${e.engine} (circuit ${e.circuit}): ${e.result} [${[...e.holdsBy, ...e.failsBy].join('+')}], mutant ${e.mutant}`);
}
