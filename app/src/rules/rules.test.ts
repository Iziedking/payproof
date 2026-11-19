import { describe, expect, it } from 'vitest'
import { CN_BRACKETS, CN_MAX_FEN, cnBonus, cnKeep, cnTraps } from './cnBonus'
import { NG_EXEMPT_UPTO, ngPaye, ngTrap } from './ngPaye'
import { fen, naira, parseAmount } from './money'

const Y = (yuan: number) => Math.round(yuan * 100)

describe('cn-bonus-2023-30', () => {
  // Figures worked by hand from the bracket table (landing page and film).
  it.each([
    [36_000, 34_920],
    [36_000.01, 32_610.01],
    [36_001, 32_610.9],
    [120_000, 108_210],
    [360_000, 272_660],
    [960_000.01, 543_160.01],
  ])('bonus %d keeps %d', (bonus, keep) => {
    expect(cnBonus(Y(bonus)).keepFen).toBe(Y(keep))
  })

  it('36,001 breaks down as the screen shows', () => {
    const r = cnBonus(Y(36_001))
    expect(r.bracket.rate).toBe(10)
    expect(r.productFen).toBe(Y(3_600.1))
    expect(r.taxFen).toBe(Y(3_390.1))
    expect(r.monthlyFen).toBe(Y(3_000.08))
  })

  it('one yuan more costs 2,309.10', () => {
    expect(cnKeep(Y(36_000)) - cnKeep(Y(36_001))).toBe(Y(2_309.1))
  })

  it('never makes tax negative and keeps the quick deduction below the product', () => {
    for (const b of CN_BRACKETS) {
      if (b.limitFen === null) continue
      const above = b.limitFen + 1
      const next = CN_BRACKETS[CN_BRACKETS.indexOf(b) + 1]
      expect(Math.floor((above * next.rate) / 100)).toBeGreaterThanOrEqual(next.quickFen)
    }
    expect(cnBonus(0).taxFen).toBe(0)
    expect(cnBonus(CN_MAX_FEN).keepFen).toBeGreaterThan(0)
  })

  it('refuses amounts outside the circuit input', () => {
    expect(() => cnBonus(-1)).toThrow(RangeError)
    expect(() => cnBonus(CN_MAX_FEN + 1)).toThrow(RangeError)
    expect(() => cnBonus(1.5)).toThrow(RangeError)
  })

  it('finds the six known traps, starting one fen above each limit', () => {
    const traps = cnTraps()
    expect(traps.map((t) => t.edgeFen / 100)).toEqual([36_000, 144_000, 300_000, 420_000, 660_000, 960_000])
    // The draft circuit floors the product to the fen, so 38,566.66 pays tax
    // 3,646.66 and keeps exactly 34,920.00: the trap ends one fen earlier than
    // it would with rounding to the nearest fen. Rounding is still an open point.
    expect(traps[0]).toEqual({ fromFen: Y(36_000.01), toFen: Y(38_566.65), edgeFen: Y(36_000) })
    for (const t of traps) {
      const edgeKeep = cnKeep(t.edgeFen)
      expect(cnKeep(t.fromFen)).toBeLessThan(edgeKeep)
      expect(cnKeep(t.toFen)).toBeLessThan(edgeKeep)
      expect(cnKeep(t.toFen + 1)).toBeGreaterThanOrEqual(edgeKeep)
      // the search window ends where the edge keeps more
      expect(cnKeep(Math.min(CN_MAX_FEN, t.edgeFen * 2))).toBeGreaterThanOrEqual(edgeKeep)
    }
  })
})

describe('ng-paye-nta2025', () => {
  const zero = { pension: 0, nhf: 0, nhis: 0, life: 0, mortgage: 0, rent: 0 }

  it('exempts gross up to 840,000', () => {
    expect(ngPaye({ ...zero, gross: NG_EXEMPT_UPTO }).annualTax).toBe(0)
  })

  it('taxes 840,001 in the 15% band', () => {
    // chargeable 840,001; 40,001 x 15% = 6,000.15, floored once
    expect(ngPaye({ ...zero, gross: 840_001 }).annualTax).toBe(6_000)
  })

  it('works through every band', () => {
    // 2,200,000 x 15% + 9,000,000 x 18% + 13,000,000 x 21% + 25,000,000 x 23% + 10,000,000 x 25%
    const r = ngPaye({ ...zero, gross: 60_000_000 })
    expect(r.annualTax).toBe(330_000 + 1_620_000 + 2_730_000 + 5_750_000 + 2_500_000)
    expect(r.monthlyTax).toBe(Math.floor(r.annualTax / 12))
  })

  it('caps rent relief at 500,000 and subtracts deductions', () => {
    const r = ngPaye({ ...zero, gross: 6_000_000, pension: 480_000, rent: 3_000_000 })
    expect(r.relief).toBe(500_000)
    expect(r.chargeable).toBe(6_000_000 - 480_000 - 500_000)
    const small = ngPaye({ ...zero, gross: 6_000_000, rent: 1_200_000 })
    expect(small.relief).toBe(240_000)
  })

  it('has a trap just above the exemption', () => {
    const t = ngTrap(zero)!
    // keep = gross - floor(15% of (gross - 800,000)); 847,058 keeps exactly 840,000
    expect(t).toEqual({ from: 840_001, to: 847_057, edge: 840_000 })
    expect(ngPaye({ ...zero, gross: t.to }).keep).toBeLessThan(840_000)
    expect(ngPaye({ ...zero, gross: t.to + 1 }).keep).toBeGreaterThanOrEqual(840_000)
  })

  it('has no trap when deductions cover the 0% band', () => {
    expect(ngTrap({ ...zero, pension: 30_000 })).not.toBeNull()
    expect(ngTrap({ ...zero, pension: 40_001 })).toBeNull()
  })

  it('refuses inputs outside the circuit layout', () => {
    expect(() => ngPaye({ ...zero, gross: 2 ** 30 })).toThrow(RangeError)
    expect(() => ngPaye({ ...zero, gross: 1, pension: 2 ** 27 })).toThrow(RangeError)
  })
})

describe('money', () => {
  it('parses yuan to fen', () => {
    expect(parseAmount('36,001.00', 2, CN_MAX_FEN)).toEqual({ kind: 'ok', value: 3_600_100 })
    expect(parseAmount(' 36001.5 ', 2, CN_MAX_FEN)).toEqual({ kind: 'ok', value: 3_600_150 })
    expect(parseAmount('', 2, CN_MAX_FEN)).toEqual({ kind: 'empty' })
    expect(parseAmount('3.141', 2, CN_MAX_FEN)).toEqual({ kind: 'invalid' })
    expect(parseAmount('-5', 2, CN_MAX_FEN)).toEqual({ kind: 'invalid' })
    expect(parseAmount('99999999999', 2, CN_MAX_FEN)).toEqual({ kind: 'range' })
  })
  it('parses naira as whole numbers', () => {
    expect(parseAmount('6,000,000', 0, 2 ** 30)).toEqual({ kind: 'ok', value: 6_000_000 })
    expect(parseAmount('6000.50', 0, 2 ** 30)).toEqual({ kind: 'invalid' })
  })
  it('formats', () => {
    expect(fen(3_261_090)).toBe('¥32,610.90')
    expect(fen(5)).toBe('¥0.05')
    expect(naira(6_000_000)).toBe('₦6,000,000')
  })
})
