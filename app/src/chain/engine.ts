// A rule engine gives the pages a rule's answer and its working. Two kinds:
// - chain: the rule's answer and working circuits, read from X Layer (read.ts) and
//   run here with the same simulator the build scripts and prover use
//   (compiler/src/netlist.ts). The figures never leave the device.
// - copy: the page's own copy of the rule (src/rules), used only while the circuits
//   load or when X Layer cannot be reached, and always labelled as such.
// The chain engine returns the same shapes as the copy, so the pages need no
// second code path; check.ts compares the two and flags any difference.
import { beat, load, packBits, unpackBits } from '../../../compiler/src/netlist'
import { pack, unpack } from '../../../compiler/src/layout'
import { CN_BRACKETS, CN_MAX_FEN, cnBonus, type CnResult } from '../rules/cnBonus'
import { NG_BANDS, ngPaye, type NgInput, type NgResult } from '../rules/ngPaye'
import { CN_ANSWER, CN_WORKING, NG_ANSWER, NG_WORKING, type CircuitRef } from './circuits'
import { blockNumber, readNetlist } from './read'

export interface Engine {
  source: 'chain' | 'copy'
  cn: (bonusFen: number) => CnResult
  ng: (input: NgInput) => NgResult
  block?: number // the X Layer block at which the circuits were read
}

export const copyEngine: Engine = { source: 'copy', cn: cnBonus, ng: ngPaye }

export class CircuitDisagrees extends Error {}

type Run = (values: Record<string, bigint>) => Record<string, bigint>

/** Loads a stateless circuit once and returns a function that runs it on named field values. */
export function runner(bytes: Uint8Array, ref: CircuitRef): Run {
  const c = load(bytes, ref.nIn, ref.nOut)
  if (c.nState !== 0) throw new Error(`circuit ${ref.id} has state`)
  const empty = new Uint8Array(0)
  return (values) => unpack(ref.outputs, packBits(beat(c, empty, unpackBits(pack(ref.inputs, values, ref.nIn), ref.nIn)).outputs))
}

export interface Netlists { cnAnswer: Uint8Array; cnWorking: Uint8Array; ngAnswer: Uint8Array; ngWorking: Uint8Array }

export function chainEngine(n: Netlists, block?: number): Engine {
  const cnA = runner(n.cnAnswer, CN_ANSWER)
  const cnW = runner(n.cnWorking, CN_WORKING)
  const ngA = runner(n.ngAnswer, NG_ANSWER)
  const ngW = runner(n.ngWorking, NG_WORKING)
  return {
    source: 'chain',
    block,
    cn(bonusFen) {
      if (!Number.isInteger(bonusFen) || bonusFen < 0 || bonusFen > CN_MAX_FEN) throw new RangeError('bonus out of range')
      const x = { bonus: BigInt(bonusFen) }
      const a = cnA(x)
      const w = cnW(x)
      const bracket = CN_BRACKETS[Number(w.bracket) - 1]
      if (!bracket || bracket.rate !== Number(w.rate) || bracket.quickFen !== Number(w.quick_deduction)) {
        throw new CircuitDisagrees(`circuit ${CN_WORKING.id} gave row ${w.bracket} at ${w.rate}% less ${w.quick_deduction}, not a row of the table`)
      }
      return {
        bonusFen, monthlyFen: Math.round(bonusFen / 12), bracket,
        productFen: Number(w.tax_before_deduction), taxFen: Number(a.tax), keepFen: Number(a.net),
      }
    },
    ng(input) {
      const x = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, BigInt(v)]))
      const a = ngA(x)
      const w = ngW(x)
      const bands = NG_BANDS.map((b, k) => ({ rate: b.rate, amount: Number(w[`band${k + 1}`]) }))
      const annualTax = Number(a.annual_tax)
      return {
        input, relief: Number(w.rent_relief), deductions: Number(w.deductions), chargeable: Number(w.chargeable),
        exempt: w.exempt === 1n, bands, annualTax, monthlyTax: Number(a.monthly_tax), keep: input.gross - annualTax,
      }
    },
  }
}

let loading: Promise<Engine> | null = null

/** Reads the four wage circuits from X Layer once per page load. */
export function loadChainEngine(fetchImpl?: typeof fetch): Promise<Engine> {
  if (!loading) {
    loading = (async () => {
      const [cnAnswer, cnWorking, ngAnswer, ngWorking] = await Promise.all(
        [CN_ANSWER, CN_WORKING, NG_ANSWER, NG_WORKING].map((r) => readNetlist(r, fetchImpl)))
      const block = await blockNumber(fetchImpl).catch(() => undefined)
      return chainEngine({ cnAnswer, cnWorking, ngAnswer, ngWorking }, block)
    })()
    loading.catch(() => { loading = null }) // let a later visit try again
  }
  return loading
}
