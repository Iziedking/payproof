// What the Rules and One rule pages show for each rule. Every figure here comes from the
// repository: circuit ids and gate counts from docs/evidence/p2/live-tapeouts.jsonl, hashes
// from chain/netlists, case counts from docs/evidence/p2.md sections 4 and 8. Fact statuses
// are "not run" until a P3 proof record exists; nothing here says "proved".
import type { Key } from './i18n/i18n'
import { CN_ANSWER, CN_WORKING, CIRCUITS_ADDRESS, NG_ANSWER, NG_WORKING, SPLIT_INFO, short } from './chain/circuits'

export type FactStatus = 'notRun' | 'expectFail' | 'tested'
export interface Fact { label: Key; status: FactStatus; cases?: number }
export interface Detail { label: Key; value: string; vars?: Record<string, string | number>; mono?: boolean; key?: Key }

export interface RuleInfo {
  id: string
  kind: Key
  title: Key
  other: { zh: string; en: string } // the rule's name, shown small under the title in the other language
  lede: Key
  check?: { label: Key; rule: 'cn' | 'ng' }
  status: { label: Key; value: Key; warn?: boolean }[]
  plain: Key[]
  source: Key
  table: 'cn' | 'ng' | 'split'
  how: Key
  formula: string[]
  facts: Fact[]
  traps: { title: Key; body: Key; list?: string; after: Key }
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

export const RULES: RuleInfo[] = [
  {
    id: 'cn-bonus-2023-30', kind: 'rule.cn.kind', title: 'rule.cn.title', other: { zh: '全年一次性奖金 单独计税', en: 'Year-end bonus tax · China' }, lede: 'rule.cn.lede',
    check: { label: 'rule.cn.check', rule: 'cn' },
    status: [
      { label: 'rule.s.source', value: 'rule.cn.source' }, { label: 'rule.s.gives', value: 'rule.cn.gives' },
      { label: 'rule.s.works', value: 'rule.cn.works' }, { label: 'rule.s.live', value: 'rule.s.liveYes' },
      { label: 'rule.s.facts', value: 'rule.s.factsNone', warn: true }, { label: 'rule.s.review', value: 'rule.s.notYet', warn: true },
    ],
    plain: ['rule.cn.p1', 'rule.cn.p2', 'rule.cn.p3'], source: 'rule.cn.sourceLong', table: 'cn',
    how: 'rule.cn.how', formula: ['row  = first row where bonus <= 12 x limit', 'tax  = floor(bonus x rate / 100) - deduction', 'keep = bonus - tax'],
    facts: [
      { label: 'fact.taxWithinBonus', status: 'notRun' }, { label: 'fact.raiseNeverLowers', status: 'expectFail' },
      { label: 'fact.breakdownAddsUp', status: 'tested', cases: 1042 }, { label: 'fact.noOverflow', status: 'notRun' },
    ],
    traps: { title: 'rule.cn.trapTitle', body: 'rule.cn.trapBody', list: '36,000 · 144,000 · 300,000\n420,000 · 660,000 · 960,000', after: 'rule.trapAfter' },
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
      { label: 'rule.s.open', value: 'rule.ng.openCount', warn: true }, { label: 'rule.s.facts', value: 'rule.s.factsNone', warn: true },
    ],
    plain: ['rule.ng.p1', 'rule.ng.p2', 'rule.ng.p3'], source: 'rule.ng.sourceLong', table: 'ng',
    how: 'rule.ng.how', formula: ['relief     = min(floor(rent / 5), 500000)', 'chargeable = gross - deductions - relief, not below 0', 'tax        = exempt ? 0 : floor(sum of band x rate / 100)', 'monthly    = floor(tax / 12)'],
    facts: [
      { label: 'fact.taxWithinIncome', status: 'notRun' }, { label: 'fact.morePayMoreTax', status: 'notRun' },
      { label: 'fact.raiseNeverLowers', status: 'expectFail' }, { label: 'fact.reliefNeverRaises', status: 'notRun' },
      { label: 'fact.breakdownAddsUp', status: 'tested', cases: 1033 }, { label: 'fact.noOverflow', status: 'notRun' },
    ],
    traps: { title: 'rule.ng.trapTitle', body: 'rule.ng.trapBody', after: 'rule.ng.trapAfter' },
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
      { label: 'rule.s.facts', value: 'rule.s.factsNone', warn: true }, { label: 'rule.s.funds', value: 'rule.sp.funds', warn: true },
    ],
    plain: ['rule.sp.p1', 'rule.sp.p2', 'rule.sp.p3'], source: 'rule.sp.sourceLong', table: 'split',
    how: 'rule.sp.how', formula: ['valid = total > 0 and shares <= total', 'ok    = valid and payout x total x 10000', '        <= pot x shares x 8500', '        <  (payout + 1) x total x 10000'],
    facts: [
      { label: 'fact.neverOverpays', status: 'notRun' }, { label: 'fact.oneUnitShort', status: 'notRun' },
      { label: 'fact.moreSharesNeverLess', status: 'notRun' }, { label: 'fact.splittingNeverMore', status: 'notRun' },
      { label: 'fact.explainMatches', status: 'tested', cases: 123 }, { label: 'fact.validityMatches', status: 'tested', cases: 423 },
    ],
    traps: { title: 'rule.sp.trapTitle', body: 'rule.sp.trapBody', after: 'rule.sp.trapAfter' },
    open: [{ label: 'rule.o.units', value: 'rule.sp.units' }, { label: 'rule.o.vault', value: 'rule.sp.vault', warn: true }],
    details: [...common(SPLIT_INFO.answer, SPLIT_INFO.working),
      { label: 'rule.d.validity', value: '', key: 'rule.d.circuitGates', vars: { id: SPLIT_INFO.validity.id, gates: SPLIT_INFO.validity.gates }, mono: true },
      ...tail(SPLIT_INFO.answer, SPLIT_INFO.working),
      { label: 'rule.d.cases', value: '', key: 'rule.d.casesV', vars: { sourced: 23, checked: '123' } }],
  },
]

export const ruleById = (id: string) => RULES.find((r) => r.id === id)
