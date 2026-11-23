// The chain engine against the page's copy of each rule, on the netlist files that were
// taped out (chain/netlists, the same bytes the app reads from X Layer and hash-checks).
// No network: the bytes come from the repository.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chainEngine, copyEngine } from './engine'
import { decodeBytes, keccak } from './read'
import { CN_ANSWER, CN_WORKING, NG_ANSWER, NG_WORKING } from './circuits'
import { NG_DEDUCTION_MAX, NG_GROSS_MAX, NG_RENT_MAX, type NgInput } from '../rules/ngPaye'
import { CN_MAX_FEN } from '../rules/cnBonus'
import cnVectors from '../../../rules/cn-bonus-2023-30/vectors.json'
import ngVectors from '../../../rules/ng-paye-nta2025/vectors.json'

const bin = (p: string) => new Uint8Array(readFileSync(new URL(`../../../chain/netlists/${p}`, import.meta.url)))
const files = { cnAnswer: bin('cn_bonus.bin'), cnWorking: bin('explain/cn_bonus_explain.bin'), ngAnswer: bin('ng_paye.bin'), ngWorking: bin('explain/ng_paye_explain.bin') }
const chain = chainEngine(files, 1)

let seed = 20261123n
const rnd = (max: number) => { seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return Number((seed >> 11n) % BigInt(max + 1)) }

describe('netlist files', () => {
  it('have the hashes the app expects from X Layer', () => {
    expect(keccak(files.cnAnswer)).toBe(CN_ANSWER.keccak)
    expect(keccak(files.cnWorking)).toBe(CN_WORKING.keccak)
    expect(keccak(files.ngAnswer)).toBe(NG_ANSWER.keccak)
    expect(keccak(files.ngWorking)).toBe(NG_WORKING.keccak)
  })
})

describe('decodeBytes', () => {
  it('reads an ABI bytes return value', () => {
    const ret = '0x' + (32).toString(16).padStart(64, '0') + (3).toString(16).padStart(64, '0') + 'abcdef'.padEnd(64, '0')
    expect(Array.from(decodeBytes(ret))).toEqual([0xab, 0xcd, 0xef])
  })
})

describe('China bonus: circuits 9 and 12 against the page copy', () => {
  it('agree on every rule vector, each limit and 1,000 random bonuses', () => {
    const xs: number[] = cnVectors.vectors.map((v) => Number(v.inputs.bonus))
    for (const l of [3_600_000, 14_400_000, 30_000_000, 42_000_000, 66_000_000, 96_000_000]) xs.push(l - 1, l, l + 1)
    xs.push(0, CN_MAX_FEN)
    for (let i = 0; i < 1000; i++) xs.push(i % 2 ? rnd(CN_MAX_FEN) : rnd(200_000_000))
    for (const x of xs) expect(chain.cn(x), `bonus ${x}`).toEqual(copyEngine.cn(x))
  })
  it('match the rule vectors', () => {
    for (const v of cnVectors.vectors) {
      const r = chain.cn(Number(v.inputs.bonus))
      expect(String(r.taxFen)).toBe(v.outputs.tax)
      expect(String(r.keepFen)).toBe(v.outputs.net)
    }
  })
})

describe('Nigeria pay tax: circuits 10 and 11 against the page copy', () => {
  it('agree on every rule vector and 1,000 random payslips', () => {
    const xs: NgInput[] = ngVectors.vectors.map((v) => Object.fromEntries(Object.entries(v.inputs).map(([k, s]) => [k, Number(s)])) as unknown as NgInput)
    for (let i = 0; i < 1000; i++) {
      const small = i % 2 === 0
      const d = () => rnd(small ? 300_000 : NG_DEDUCTION_MAX)
      xs.push({ gross: i % 5 === 0 ? 839_999 + (i % 3) : rnd(small ? 60_000_000 : NG_GROSS_MAX), pension: d(), nhf: d(), nhis: d(), life: d(), mortgage: d(), rent: rnd(small ? 5_000_000 : NG_RENT_MAX) })
    }
    for (const x of xs) expect(chain.ng(x), JSON.stringify(x)).toEqual(copyEngine.ng(x))
  })
})
