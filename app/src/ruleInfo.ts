// What the Rules and One rule pages show for each rule. Every figure here comes from the
// repository: circuit ids and gate counts from docs/evidence/p2/live-tapeouts.jsonl, hashes
// from chain/netlists, case counts from docs/evidence/p2.md sections 4 and 8. A fact with a
// `factId` takes its result from the proof records (src/proofs/records.json, built from
// docs/evidence/p3); the others are tested or not run, and say so.
import type { Key } from './i18n/i18n'
import { proofsFor } from './proofs/proofs'
import { CN_ANSWER, CN_WORKING, CIRCUITS_ADDRESS, NG_ANSWER, NG_WORKING, SPLIT_INFO, short } from './chain/circuits'

export type FactStatus = 'notRun' | 'expectFail' | 'tested'
export interface Fact { label: Key; factId?: string; status?: FactStatus; cases?: number }
export interface Detail { label: Key; value: string; vars?: Record<string, string | number>; mono?: boolean; key?: Key }

export interface RuleInfo {
  id: string
  kind: Key
  title: Key
  other: { zh: string; en: string } // the rule's name, shown small under the title in the other language
  lede: Key
  check?: { label: Key; rule: 'cn' | 'ng' }
  status: { label: Key; value: Key; warn?: boolean; vars?: Record<string, string | number> }[]
  plain: Key[]
  source: Key
  table: 'cn' | 'ng' | 'split'
  how: Key
  formula: string[]
  facts: Fact[]
  traps: { title: Key; body: Key; bodyVars?: Record<string, string>; list?: string; after: Key; afterVars?: Record<string, string> }
  open: { label: Key; value: Key; warn?: boolean }[]
  details: Detail[]
}

const common = (a: { id: number; gates: number; keccak: string }, w: { id: number; gates: number; keccak: string }): Detail[] => [
  { label: 'rule.d.network', value: '', key: 'rule.d.networkV' },
  { label: 'rule.d.answer', value: '', key: 'rule.d.circuitGates', vars: { id: a.id, gates: a.gates.toLocaleString('en-US') }, mono: true },
  { label: 'rule.d.working', value: '', key: 'rule.d.circuitGates', vars: { id: w.id, gates: w.gates.toLocaleString('en-US') }, mono: true },
]
const tail = (a: { keccak: string }, w: { keccak: string }): Detail[] => [
  { label: 'rule.d.answerHash', value: short(a.keccak), mono: true },
  { label: 'rule.d.workingHash', value: short(w.keccak), mono: true },
  { label: 'rule.d.contract', value: short(CIRCUITS_ADDRESS), mono: true },
]

// "n of m proved", from the records: a fact counts once at least one tool proved it.
const factsRow = (ruleId: string) => {
  const fs = proofsFor(ruleId)?.facts ?? []
  const proved = fs.filter((f) => f.status === 'holds').length
  return { label: 'rule.s.facts' as Key, value: 'rule.s.factsN' as Key, vars: { proved, total: fs.length }, warn: proved < fs.length }
}
const yuanOf = (f: string) => (Number(f) / 100).toLocaleString('en-US')
const nairaOf = (n: string | number) => `₦${Number(n).toLocaleString('en-US')}`
const CN_TRAP = proofsFor('cn-bonus-2023-30')!.trap!
const NG_TRAP = proofsFor('ng-paye-nta2025')!.trap!
const NG_R = NG_TRAP.ranges[0]
const SPLIT_CHAIN = proofsFor('split-v1')!.chain!
const threePerLine = (xs: string[]) => xs.reduce((a, x, i) => a + (i === 0 ? '' : i % 3 === 0 ? '\n' : ' · ') + x, '')

export const RULES: RuleInfo[] = [
  {
    id: 'cn-bonus-2023-30', kind: 'rule.cn.kind', title: 'rule.cn.title', other: { zh: '全年一次性奖金 单独计税', en: 'Year-end bonus tax · China' }, lede: 'rule.cn.lede',
    check: { label: 'rule.cn.check', rule: 'cn' },
    status: [
      { label: 'rule.s.source', value: 'rule.cn.source' }, { label: 'rule.s.gives', value: 'rule.cn.gives' },
      { label: 'rule.s.works', value: 'rule.cn.works' }, { label: 'rule.s.live', value: 'rule.s.liveYes' },
      factsRow('cn-bonus-2023-30'), { label: 'rule.s.review', value: 'rule.s.notYet', warn: true },
    ],
    plain: ['rule.cn.p1', 'rule.cn.p2', 'rule.cn.p3'], source: 'rule.cn.sourceLong', table: 'cn',
    how: 'rule.cn.how', formula: ['row  = first row where bonus <= 12 x limit', 'tax  = floor(bonus x rate / 100) - deduction', 'keep = bonus - tax'],
    facts: [
      { label: 'fact.taxWithinBonus', factId: 'tax-within-bonus' }, { label: 'fact.raiseNeverLowers', factId: 'raise-never-lowers-take-home' },
      { label: 'fact.breakdownAddsUp', factId: 'breakdown-adds-up' }, { label: 'fact.noOverflow', status: 'notRun' },
    ],
    traps: { title: 'rule.cn.trapTitle', body: 'rule.cn.trapBody', list: threePerLine(CN_TRAP.ranges.map((r) => yuanOf(r.edge))),
      after: CN_TRAP.matches ? 'rule.cn.trapProved' : 'rule.trapNoMatch', afterVars: { block: CN_TRAP.block.toLocaleString('en-US') } },
    open: [
      { label: 'rule.o.rounding', value: 'rule.cn.rounding' }, { label: 'rule.o.later', value: 'rule.cn.later' },
      { label: 'rule.o.review', value: 'rule.s.notYet', warn: true },
    ],
    details: [...common(CN_ANSWER, CN_WORKING), { label: 'rule.d.valid', value: '', key: 'rule.cn.valid' }, ...tail(CN_ANSWER, CN_WORKING),
      { label: 'rule.d.cases', value: '', key: 'rule.d.casesV', vars: { sourced: 22, checked: '1,042' } }],
  },
  {
    id: 'ng-paye-nta2025', kind: 'rule.ng.kind', title: 'rule.ng.title', other: { zh: '尼日利亚 个人所得税', en: 'Pay tax (PAYE) · Nigeria' }, lede: 'rule.ng.lede',
    check: { label: 'rule.ng.check', rule: 'ng' },
    status: [
      { label: 'rule.s.source', value: 'rule.ng.source' }, { label: 'rule.s.gives', value: 'rule.ng.gives' },
      { label: 'rule.s.works', value: 'rule.ng.works' }, { label: 'rule.s.live', value: 'rule.s.liveYes' },
      { label: 'rule.s.open', value: 'rule.ng.openCount', warn: true }, factsRow('ng-paye-nta2025'),
    ],
    plain: ['rule.ng.p1', 'rule.ng.p2', 'rule.ng.p3'], source: 'rule.ng.sourceLong', table: 'ng',
    how: 'rule.ng.how', formula: ['relief     = min(floor(rent / 5), 500000)', 'chargeable = gross - deductions - relief, not below 0', 'tax        = exempt ? 0 : floor(sum of band x rate / 100)', 'monthly    = floor(tax / 12)'],
    facts: [
      { label: 'fact.taxWithinIncome', factId: 'tax-within-income' }, { label: 'fact.morePayMoreTax', factId: 'more-pay-more-tax' },
      { label: 'fact.raiseNeverLowers', factId: 'raise-never-lowers-take-home' }, { label: 'fact.reliefNeverRaises', factId: 'relief-never-raises-tax' },
      { label: 'fact.breakdownAddsUp', factId: 'breakdown-adds-up' }, { label: 'fact.noOverflow', status: 'notRun' },
    ],
    traps: { title: 'rule.ng.trapTitle', body: 'rule.ng.trapBody',
      bodyVars: { edge: nairaOf(NG_R.edge), from: nairaOf(NG_R.from), tax: nairaOf(Number(NG_R.from) - Number(NG_R.atFrom)), loss: nairaOf(Number(NG_R.atEdge) - Number(NG_R.atFrom)) },
      after: NG_TRAP.matches ? 'rule.ng.trapProved' : 'rule.trapNoMatch', afterVars: { block: NG_TRAP.block.toLocaleString('en-US'), from: nairaOf(NG_R.from), to: nairaOf(NG_R.to) } },
    open: [
      { label: 'rule.o.minWage', value: 'rule.ng.minWage', warn: true }, { label: 'rule.o.rounding', value: 'rule.ng.rounding', warn: true },
      { label: 'rule.o.monthly', value: 'rule.ng.monthly' }, { label: 'rule.o.review', value: 'rule.s.notYet', warn: true },
    ],
    details: [...common(NG_ANSWER, NG_WORKING), { label: 'rule.d.valid', value: '', key: 'rule.ng.valid' }, ...tail(NG_ANSWER, NG_WORKING),
      { label: 'rule.d.cases', value: '', key: 'rule.d.casesV', vars: { sourced: 32, checked: '1,033' } }],
  },
  {
    id: 'split-v1', kind: 'rule.sp.kind', title: 'rule.sp.title', other: { zh: '收益分配', en: 'Pool split' }, lede: 'rule.sp.lede',
    status: [
      { label: 'rule.s.source', value: 'rule.sp.source' }, { label: 'rule.s.gives', value: 'rule.sp.gives' },
      { label: 'rule.s.works', value: 'rule.sp.works' }, { label: 'rule.s.live', value: 'rule.s.liveYes' },
      factsRow('split-v1'), { label: 'rule.s.funds', value: 'rule.sp.funds' },
    ],
    plain: ['rule.sp.p1', 'rule.sp.p2', 'rule.sp.p3'], source: 'rule.sp.sourceLong', table: 'split',
    how: 'rule.sp.how', formula: ['valid = total > 0 and shares <= total', 'ok    = valid and payout x total x 10000', '        <= pot x shares x 8500', '        <  (payout + 1) x total x 10000'],
    facts: [
      { label: 'fact.neverOverpays', factId: 'never-overpays' }, { label: 'fact.oneUnitShort', factId: 'at-most-one-unit-short' },
      { label: 'fact.moreSharesNeverLess', factId: 'more-shares-never-less' }, { label: 'fact.splittingNeverMore', factId: 'splitting-never-pays-more' },
      { label: 'fact.explainMatches', status: 'tested', cases: 123 }, { label: 'fact.validityMatches', status: 'tested', cases: 423 },
    ],
    traps: { title: 'rule.sp.trapTitle', body: 'rule.sp.trapBody',
      after: Object.values(SPLIT_CHAIN.links).every(Boolean) ? 'rule.sp.trapProved' : 'rule.sp.trapAfter', afterVars: { block: SPLIT_CHAIN.block.toLocaleString('en-US') } },
    open: [{ label: 'rule.o.units', value: 'rule.sp.units' }, { label: 'rule.o.vault', value: 'rule.sp.vault' }],
    details: [...common(SPLIT_INFO.answer, SPLIT_INFO.working),
      { label: 'rule.d.validity', value: '', key: 'rule.d.circuitGates', vars: { id: SPLIT_INFO.validity.id, gates: SPLIT_INFO.validity.gates }, mono: true },
      ...tail(SPLIT_INFO.answer, SPLIT_INFO.working),
      { label: 'rule.d.cases', value: '', key: 'rule.d.casesV', vars: { sourced: 23, checked: '123' } }],
  },
]

export const ruleById = (id: string) => RULES.find((r) => r.id === id)
