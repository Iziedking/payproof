// Nigeria pay tax under the Nigeria Tax Act 2025 (rule id ng-paye-nta2025).
// Mirrors spikes/p0/rtl/ng_paye.v. All amounts annual, whole naira.
// Open points kept as in the draft circuit: the minimum wage test is taken as
// gross <= 840,000, and tax is floored to the naira once on the annual total.

export const NG_GROSS_MAX = 2 ** 30 - 1 // 30-bit inputs
export const NG_DEDUCTION_MAX = 2 ** 27 - 1 // 27-bit inputs
export const NG_RENT_MAX = 2 ** 30 - 1
export const NG_EXEMPT_UPTO = 840_000
export const NG_RENT_RELIEF_CAP = 500_000

export interface NgInput {
  gross: number
  pension: number
  nhf: number
  nhis: number
  life: number
  mortgage: number
  rent: number
}

export const NG_BANDS = [
  { from: 0, width: 800_000, rate: 0 },
  { from: 800_000, width: 2_200_000, rate: 15 },
  { from: 3_000_000, width: 9_000_000, rate: 18 },
  { from: 12_000_000, width: 13_000_000, rate: 21 },
  { from: 25_000_000, width: 25_000_000, rate: 23 },
  { from: 50_000_000, width: null, rate: 25 },
] as const

export interface NgBandLine {
  rate: number
  amount: number // naira of chargeable income in this band
}

export interface NgResult {
  input: NgInput
  relief: number
  deductions: number
  chargeable: number
  exempt: boolean
  bands: NgBandLine[]
  annualTax: number
  monthlyTax: number
  keep: number // gross - annual tax, before the deductions themselves
}

export function ngPaye(input: NgInput): NgResult {
  const caps: Record<keyof NgInput, number> = {
    gross: NG_GROSS_MAX, pension: NG_DEDUCTION_MAX, nhf: NG_DEDUCTION_MAX, nhis: NG_DEDUCTION_MAX,
    life: NG_DEDUCTION_MAX, mortgage: NG_DEDUCTION_MAX, rent: NG_RENT_MAX,
  }
  for (const k of Object.keys(caps) as (keyof NgInput)[]) {
    const v = input[k]
    if (!Number.isInteger(v) || v < 0 || v > caps[k]) throw new RangeError(`${k} out of range`)
  }
  const relief = Math.min(Math.floor(input.rent / 5), NG_RENT_RELIEF_CAP)
  const deductions = input.pension + input.nhf + input.nhis + input.life + input.mortgage + relief
  const chargeable = input.gross > deductions ? input.gross - deductions : 0
  const exempt = input.gross <= NG_EXEMPT_UPTO
  const bands = NG_BANDS.map((b) => {
    let amount = 0
    if (chargeable > b.from) amount = b.width === null ? chargeable - b.from : Math.min(chargeable - b.from, b.width)
    return { rate: b.rate, amount }
  })
  const t100 = bands.reduce((s, b) => s + b.amount * b.rate, 0) // hundredths of a naira, exact
  const annualTax = exempt ? 0 : Math.floor(t100 / 100)
  return {
    input, relief, deductions, chargeable, exempt, bands, annualTax,
    monthlyTax: Math.floor(annualTax / 12),
    keep: input.gross - annualTax,
  }
}

export interface NgTrap {
  from: number
  to: number
  edge: number
}

// The only cliff in this rule is the minimum wage exemption: one naira above
// it, the whole chargeable income is taxed at once. With the same deductions,
// every gross from 840,001 up to the returned end keeps less than 840,000 does.
export function ngTrap(rest: Omit<NgInput, 'gross'>, rule: (input: NgInput) => NgResult = ngPaye): NgTrap | null {
  const keepAt = (gross: number) => rule({ ...rest, gross }).keep
  const edge = NG_EXEMPT_UPTO
  const edgeKeep = keepAt(edge)
  if (keepAt(edge + 1) >= edgeKeep) return null
  let lo = edge + 1
  let hi = edge * 2 // keeps more: tax there is under 840,000 x 0.15 (checked in tests)
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (keepAt(mid) < edgeKeep) lo = mid
    else hi = mid
  }
  return { from: edge + 1, to: lo, edge }
}
