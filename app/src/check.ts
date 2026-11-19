// What a check needs to show, worked out once from typed figures, for both
// the Check page and the Result page.
import { cnBonus, cnKeep, cnTraps, CN_MAX_FEN } from './rules/cnBonus'
import { ngPaye, ngTrap, NG_DEDUCTION_MAX, NG_GROSS_MAX, NG_RENT_MAX, type NgInput } from './rules/ngPaye'
import { fen, fenPlain, naira, parseAmount, type Parsed } from './rules/money'
import type { Key } from './i18n/i18n'

export type RuleKey = 'cn' | 'ng'
export const RULE_ID: Record<RuleKey, string> = { cn: 'cn-bonus-2023-30', ng: 'ng-paye-nta2025' }

export interface Line { label: Key; vars?: Record<string, string>; value: string; valueKey?: Key; strong?: boolean }
export interface TrapView {
  kind: 'inside' | 'next' | 'none' | 'past'
  vars: Record<string, string>
}
export interface ChartView { lo: number; hi: number; you: number; trap?: [number, number]; keep: (x: number) => number }
export interface Compare { kind: 'match' | 'more' | 'less'; paid: string; diff: string }
export interface CheckView {
  rule: RuleKey
  keep: string
  ofKey: Key
  ofAmount: string
  extra?: { label: Key; value: string }[]
  lines: Line[]
  compare?: Compare
  trap: TrapView
  chart?: ChartView
  link: Record<string, string> // query for the Result page
}

export const CN_FIELDS = ['bonus', 'paid'] as const
export const NG_FIELDS = ['gross', 'paid', 'pension', 'nhf', 'nhis', 'life', 'mortgage', 'rent'] as const
export type CnForm = Record<(typeof CN_FIELDS)[number], string>
export type NgForm = Record<(typeof NG_FIELDS)[number], string>

export const CN_LIMITS = { min: fen(0), max: fen(CN_MAX_FEN) }
export const NG_LIMITS = { min: naira(0), max: naira(NG_GROSS_MAX) }

export function parseCn(form: CnForm) {
  return { bonus: parseAmount(form.bonus, 2, CN_MAX_FEN), paid: parseAmount(form.paid, 2, CN_MAX_FEN) }
}

export function parseNg(form: NgForm): Record<keyof NgForm, Parsed> {
  const cap = (k: keyof NgForm) => (k === 'gross' ? NG_GROSS_MAX : k === 'rent' ? NG_RENT_MAX : k === 'paid' ? NG_GROSS_MAX : NG_DEDUCTION_MAX)
  return Object.fromEntries(NG_FIELDS.map((k) => [k, parseAmount(form[k], 0, cap(k))])) as Record<keyof NgForm, Parsed>
}

const val = (p: Parsed) => (p.kind === 'ok' ? p.value : 0)
const okOrEmpty = (p: Parsed) => p.kind === 'ok' || p.kind === 'empty'

function compare(ruleTax: number, paid: Parsed, fmt: (n: number) => string): Compare | undefined {
  if (paid.kind !== 'ok') return undefined
  const d = paid.value - ruleTax
  return { kind: d === 0 ? 'match' : d > 0 ? 'more' : 'less', paid: fmt(paid.value), diff: fmt(Math.abs(d)) }
}

export function viewCn(form: CnForm): CheckView | null {
  const p = parseCn(form)
  if (p.bonus.kind !== 'ok' || !okOrEmpty(p.paid)) return null
  const r = cnBonus(p.bonus.value)
  const b = r.bracket
  const lines: Line[] = [
    { label: 'cn.bonus', value: fen(r.bonusFen) },
    { label: 'cn.monthly', value: fen(r.monthlyFen) },
    { label: 'cn.band', value: `${b.rate}%` },
    { label: 'cn.product', vars: { amount: fenPlain(r.bonusFen), rate: String(b.rate) }, value: fen(r.productFen) },
    { label: 'cn.quick', value: fen(b.quickFen) },
    { label: 'cn.tax', value: fen(r.taxFen) },
    { label: 'cn.keep', value: fen(r.keepFen), strong: true },
  ]
  const traps = cnTraps()
  const x = r.bonusFen
  const inside = traps.find((t) => x >= t.fromFen && x <= t.toFen)
  const next = traps.find((t) => t.fromFen > x)
  let trap: TrapView
  let shown: (typeof traps)[number] | undefined
  if (inside) {
    shown = inside
    trap = { kind: 'inside', vars: { edge: fen(inside.edgeFen), diff: fen(cnKeep(inside.edgeFen) - r.keepFen), from: fen(inside.fromFen), to: fen(inside.toFen) } }
  } else if (next) {
    shown = next.fromFen - x <= Math.max(x * 0.5, 2_000_000) ? next : undefined
    trap = { kind: 'next', vars: { from: fen(next.fromFen), to: fen(next.toFen), edge: fen(next.edgeFen), gap: fen(next.fromFen - x) } }
  } else trap = { kind: 'past', vars: {} }
  return {
    rule: 'cn', keep: fen(r.keepFen), ofKey: 'ans.ofBonus', ofAmount: fen(r.bonusFen), lines,
    compare: compare(r.taxFen, p.paid, fen), trap,
    chart: chartFor(x, shown && [shown.edgeFen, shown.toFen], cnKeep, CN_MAX_FEN),
    link: { rule: 'cn', bonus: fenPlain(x), ...(p.paid.kind === 'ok' ? { paid: fenPlain(p.paid.value) } : {}) },
  }
}

export function viewNg(form: NgForm): CheckView | null {
  const p = parseNg(form)
  if (p.gross.kind !== 'ok' || !NG_FIELDS.every((k) => okOrEmpty(p[k]))) return null
  const input: NgInput = { gross: val(p.gross), pension: val(p.pension), nhf: val(p.nhf), nhis: val(p.nhis), life: val(p.life), mortgage: val(p.mortgage), rent: val(p.rent) }
  const r = ngPaye(input)
  const lines: Line[] = [{ label: 'ng.gross', value: naira(r.input.gross) }]
  if (r.relief) lines.push({ label: 'ng.relief', value: naira(r.relief) })
  if (r.deductions) lines.push({ label: 'ng.deductions', value: `-${naira(r.deductions)}` })
  lines.push({ label: 'ng.chargeable', value: naira(r.chargeable) })
  if (r.exempt) lines.push({ label: 'ng.exempt', value: '', valueKey: 'ng.exemptYes' })
  else for (const b of r.bands) if (b.amount && b.rate) lines.push({ label: 'ng.band', vars: { rate: String(b.rate) }, value: `${naira(b.amount)} → ${naira(Math.floor((b.amount * b.rate) / 100))}` })
  lines.push({ label: 'ng.annual', value: naira(r.annualTax) })
  lines.push({ label: 'ng.monthly', value: naira(r.monthlyTax) })
  lines.push({ label: 'ng.keep', value: naira(r.keep), strong: true })
  const { gross: _g, ...rest } = input
  const t = ngTrap(rest)
  const keepAt = (g: number) => ngPaye({ ...rest, gross: g }).keep
  let trap: TrapView
  if (t && input.gross >= t.from && input.gross <= t.to) {
    trap = { kind: 'inside', vars: { edge: naira(t.edge), diff: naira(keepAt(t.edge) - r.keep), from: naira(t.from), to: naira(t.to) } }
  } else if (t && input.gross < t.from) {
    trap = { kind: 'next', vars: { from: naira(t.from), to: naira(t.to), edge: naira(t.edge), gap: naira(t.from - input.gross) } }
  } else trap = { kind: t ? 'past' : 'none', vars: {} }
  const near = t && Math.abs(input.gross - t.edge) <= t.edge
  const query: Record<string, string> = { rule: 'ng' }
  for (const k of NG_FIELDS) if (p[k].kind === 'ok') query[k] = String(val(p[k]))
  return {
    rule: 'ng', keep: naira(r.keep), ofKey: 'ans.ofGross', ofAmount: naira(input.gross),
    extra: [{ label: 'ans.taxMonth', value: naira(r.monthlyTax) }],
    lines, compare: compare(r.monthlyTax, p.paid, naira), trap,
    chart: chartFor(input.gross, near && t ? [t.edge, t.to] : undefined, keepAt, NG_GROSS_MAX),
    link: query,
  }
}

function chartFor(x: number, trap: [number, number] | undefined, keep: (x: number) => number, max: number): ChartView | undefined {
  if (x <= 0) return undefined
  let lo = x * 0.8
  let hi = x * 1.2
  if (trap) { lo = Math.min(lo, trap[0] * 0.94); hi = Math.max(hi, trap[1] * 1.06) }
  return { lo: Math.max(0, Math.floor(lo)), hi: Math.min(max, Math.ceil(hi)), you: x, trap, keep }
}

// Result links carry the typed figures. Rebuild the form from a link.
export function formFromQuery(q: URLSearchParams): { rule: RuleKey; cn: CnForm; ng: NgForm } | null {
  const rule = q.get('rule')
  if (rule === 'cn') {
    return { rule, cn: { bonus: q.get('bonus') ?? '', paid: q.get('paid') ?? '' }, ng: emptyNg() }
  }
  if (rule === 'ng') {
    const ng = emptyNg()
    for (const k of NG_FIELDS) ng[k] = q.get(k) ?? ''
    return { rule, cn: emptyCn(), ng }
  }
  return null
}

export const emptyCn = (): CnForm => ({ bonus: '', paid: '' })
export const emptyNg = (): NgForm => ({ gross: '', paid: '', pension: '', nhf: '', nhis: '', life: '', mortgage: '', rent: '' })
