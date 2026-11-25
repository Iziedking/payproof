// The page shows trap ranges from the prover's records. Its own copy of each rule must find the
// same ranges, and every record the pages read must be complete enough to show.
import { describe, expect, it } from 'vitest'
import { cnKeep, cnTraps } from '../rules/cnBonus'
import { ngPaye, ngTrap } from '../rules/ngPaye'
import { cnTrapsFromRecord, ENGINES, ngTrapFromRecord, PROOFS, TOOL_NAME } from './proofs'
import { viewCn, viewNg, emptyNg } from '../check'

describe('proof records', () => {
  it('China: the six ranges the prover found on circuit 9 are the ones the page copy finds', () => {
    const { traps } = cnTrapsFromRecord()
    expect(traps).toEqual(cnTraps())
    const rec = PROOFS.find((r) => r.ruleId === 'cn-bonus-2023-30')!.trap!
    for (const r of rec.ranges) {
      // The on-chain take-home figures in the record match the page copy too.
      expect(cnKeep(Number(r.edge))).toBe(Number(r.atEdge))
      expect(cnKeep(Number(r.from))).toBe(Number(r.atFrom))
      expect(cnKeep(Number(r.to))).toBe(Number(r.atTo))
    }
  })

  it('Nigeria: the trap the prover found with no deductions is the one the page copy finds', () => {
    const zero = { pension: 0, nhf: 0, nhis: 0, life: 0, mortgage: 0, rent: 0 }
    expect(ngTrapFromRecord().trap).toEqual(ngTrap(zero))
    const r = PROOFS.find((x) => x.ruleId === 'ng-paye-nta2025')!.trap!.ranges[0]
    expect(ngPaye({ ...zero, gross: Number(r.from) }).keep).toBe(Number(r.atFrom))
  })

  it('a check shows where its trap range comes from', () => {
    const cn = viewCn({ bonus: '36000.01', paid: '' })!
    expect(cn.trap.kind).toBe('inside')
    expect(cn.trap.proof?.block).toBe(cnTrapsFromRecord().block)
    const ng = viewNg({ ...emptyNg(), gross: '840001' })!
    expect(ng.trap.proof?.block).toBe(ngTrapFromRecord().block)
    const withPension = viewNg({ ...emptyNg(), gross: '840001', pension: '10000' })!
    expect(withPension.trap.proof).toBeNull()
  })

  it('every engine shown is labelled simulated, names known tools, and a difference carries its input', () => {
    expect(ENGINES.length).toBeGreaterThan(0)
    for (const e of ENGINES) {
      expect(e.simulated).toBe(true)
      expect(e.label).toMatch(/^Simulated engine/)
      expect(e.statement.en && e.statement.zh).toBeTruthy()
      expect(['equal', 'differs', 'undecided']).toContain(e.result)
      for (const x of e.tools) expect(TOOL_NAME[x.tool], x.tool).toBeTruthy()
      if (e.result === 'differs') {
        expect(e.counterexample).not.toBeNull()
        expect(e.counterexample!.referenceTax).not.toBe(e.counterexample!.engineTax)
      }
      if (e.result === 'equal') expect(e.holdsBy.length).toBeGreaterThan(0)
    }
  })

  it('every fact has a statement in both languages, a status and a known tool name', () => {
    for (const r of PROOFS) {
      expect(r.facts.length).toBeGreaterThan(0)
      for (const f of r.facts) {
        expect(f.statement.en && f.statement.zh).toBeTruthy()
        expect(['holds', 'fails', 'undecided']).toContain(f.status)
        for (const t of [...f.holdsBy, ...f.failsBy]) expect(TOOL_NAME[t], t).toBeTruthy()
        expect(f.runs.length).toBeGreaterThan(0)
      }
    }
  })
})
