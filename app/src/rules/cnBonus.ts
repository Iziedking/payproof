// China annual one-time bonus, separate taxation (rule id cn-bonus-2023-30).
// Mirrors spikes/p0/rtl/cn_bonus.v: the bracket is picked by comparing the
// bonus with twelve times each monthly limit, the product is floored to the
// fen, then the quick deduction is taken off. All amounts are in fen.
// Bracket figures are from secondary sources read 2026-11-16; the official
// text is still to be read, so the app labels this as our reading.

export const CN_MAX_FEN = 0xffff_ffff // the circuit input is 32 bits

export interface Bracket {
  limitFen: number | null // 12 x monthly limit; null for the top bracket
  monthlyLimit: number | null // yuan, for display
  rate: number // percent
  quickFen: number
}

export const CN_BRACKETS: Bracket[] = [
  { limitFen: 3_600_000, monthlyLimit: 3_000, rate: 3, quickFen: 0 },
  { limitFen: 14_400_000, monthlyLimit: 12_000, rate: 10, quickFen: 21_000 },
  { limitFen: 30_000_000, monthlyLimit: 25_000, rate: 20, quickFen: 141_000 },
  { limitFen: 42_000_000, monthlyLimit: 35_000, rate: 25, quickFen: 266_000 },
  { limitFen: 66_000_000, monthlyLimit: 55_000, rate: 30, quickFen: 441_000 },
  { limitFen: 96_000_000, monthlyLimit: 80_000, rate: 35, quickFen: 716_000 },
  { limitFen: null, monthlyLimit: null, rate: 45, quickFen: 1_516_000 },
]

export interface CnResult {
  bonusFen: number
  monthlyFen: number // bonus / 12, rounded to the fen, for display only
  bracket: Bracket
  productFen: number // floor(bonus x rate / 100)
  taxFen: number
  keepFen: number
}

export function bracketFor(bonusFen: number): Bracket {
  return CN_BRACKETS.find((b) => b.limitFen === null || bonusFen <= b.limitFen)!
}

export function cnBonus(bonusFen: number): CnResult {
  if (!Number.isInteger(bonusFen) || bonusFen < 0 || bonusFen > CN_MAX_FEN) {
    throw new RangeError('bonus out of range')
  }
  const bracket = bracketFor(bonusFen)
  const productFen = Math.floor((bonusFen * bracket.rate) / 100)
  // Below the quick deduction the circuit's subtraction would wrap; it never
  // happens for these brackets (checked in the tests), so clamp defensively.
  const taxFen = Math.max(0, productFen - bracket.quickFen)
  return {
    bonusFen,
    monthlyFen: Math.round(bonusFen / 12),
    bracket,
    productFen,
    taxFen,
    keepFen: bonusFen - taxFen,
  }
}

export const cnKeep = (fen: number) => cnBonus(fen).keepFen

export interface Trap {
  fromFen: number // first amount inside the trap
  toFen: number // last amount inside the trap
  edgeFen: number // the amount just below the trap that keeps more
}

// A trap starts one fen above each bracket limit, where a whole bracket's
// extra rate lands at once, and lasts while the bonus keeps less than the
// limit itself does. Inside a bracket "you keep" rises with the bonus, so the
// end is found by binary search. `keep` is the rule's "you keep" for a bonus: the page's
// copy by default, or the circuit from X Layer (src/chain/engine.ts).
export function cnTraps(keep: (fen: number) => number = cnKeep): Trap[] {
  const traps: Trap[] = []
  for (const b of CN_BRACKETS) {
    if (b.limitFen === null) continue
    const edge = b.limitFen
    const edgeKeep = keep(edge)
    if (keep(edge + 1) >= edgeKeep) continue
    let lo = edge + 1 // keeps less
    let hi = Math.min(CN_MAX_FEN, edge * 2) // keeps more (checked in tests)
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2)
      if (keep(mid) < edgeKeep) lo = mid
      else hi = mid
    }
    traps.push({ fromFen: edge + 1, toFen: lo, edgeFen: edge })
  }
  return traps
}
