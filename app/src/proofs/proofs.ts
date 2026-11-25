// The proof results, read from records.json, which scripts/p3/collect-proofs.mts builds from
// docs/evidence/p3. Pages show results from here only; none is typed by hand (PLAN P3).
import data from './records.json'

export type Status = 'holds' | 'fails' | 'undecided'
export interface ToolRun { tool: string; status: string; seconds: number }
export interface Run { block: number; evidence: string; tools: ToolRun[]; mutant: string | null }
export interface FactProof {
  factId: string
  statement: { en: string; zh: string }
  status: Status
  holdsBy: string[]
  failsBy: string[]
  method: 'circuit' | 'chain'
  circuits: string[]
  counterexample: unknown
  runs: Run[]
}
export interface TrapRange { edge: string; from: string; to: string; atEdge: string; atFrom: string; atTo: string }
export interface TrapProof {
  factId: string
  over: string
  unit: 'fen' | 'naira'
  fixed: string | null
  block: number
  complete: boolean
  seconds: number
  queries: number
  ranges: TrapRange[]
  comparedWith: string
  matches: boolean
  evidence: string
}
export interface RuleProofs {
  ruleId: string
  facts: FactProof[]
  trap?: TrapProof
  chain?: { block: number; links: Record<string, boolean>; support: { factId: string; holdsBy: string[]; mutantCaught: boolean }[]; evidence: string }
}

/** A SIMULATED engine checked against a rule's circuit on X Layer (scripts/p3/engines.mts). */
export interface EngineProof {
  engine: string
  label: string
  simulated: true
  ruleId: string
  statement: { en: string; zh: string }
  referenceCircuit: string
  circuit: string
  block: number
  result: 'equal' | 'differs' | 'undecided'
  holdsBy: string[]
  failsBy: string[]
  tools: ToolRun[]
  counterexample: { bonusFen: string; referenceTax: string; engineTax: string; referenceNet: string; engineNet: string } | null
  mutant: string
  evidence: string
}

export const PROOFS = (data as unknown as { rules: RuleProofs[] }).rules
export const ENGINES = (data as unknown as { engines: EngineProof[] }).engines
/** Each solver query's time limit in every run, in seconds (one value; the collector checks). */
export const LIMIT_SECONDS = (data as unknown as { limitSeconds: number }).limitSeconds
export const LIMIT_MINUTES = LIMIT_SECONDS / 60

export const proofsFor = (ruleId: string): RuleProofs | undefined => PROOFS.find((r) => r.ruleId === ruleId)
export const factProof = (ruleId: string, factId: string): FactProof | undefined =>
  proofsFor(ruleId)?.facts.find((f) => f.factId === factId)

/** The tools' names as the page shows them. */
export const TOOL_NAME: Record<string, string> = {
  'abc-iprove': 'ABC', 'yosys-sat': 'Yosys sat', 'smt-bitwuzla': 'Bitwuzla', 'smt-z3': 'Z3', z3: 'Z3', cvc5: 'cvc5',
  'trap-finder (abc-iprove)': 'ABC', 'abc-cec': 'ABC cec',
}

/** China bonus traps, in fen, from the trap finder's record (circuit 9 on X Layer). */
export function cnTrapsFromRecord() {
  const t = proofsFor('cn-bonus-2023-30')!.trap!
  return { block: t.block, traps: t.ranges.map((r) => ({ fromFen: Number(r.from), toFen: Number(r.to), edgeFen: Number(r.edge) })) }
}

/** Nigeria's trap with every deduction 0, in naira, from the trap finder's record (circuit 10). */
export function ngTrapFromRecord() {
  const t = proofsFor('ng-paye-nta2025')!.trap!
  const r = t.ranges[0]
  return { block: t.block, trap: { from: Number(r.from), to: Number(r.to), edge: Number(r.edge) } }
}
