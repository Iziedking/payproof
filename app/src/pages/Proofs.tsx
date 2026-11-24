// Every proof result, read from src/proofs/records.json (built from docs/evidence/p3 by
// scripts/p3/collect-proofs.mts). Holds, fails and undecided are all shown (PLAN L15). Nothing
// here is typed by hand: statuses, tools, times, blocks and ranges all come from the records.
import { useI18n, type Key } from '../i18n/i18n'
import { href } from '../router'
import { ruleById } from '../ruleInfo'
import { LIMIT_MINUTES, PROOFS, TOOL_NAME, type FactProof, type RuleProofs, type TrapProof } from '../proofs/proofs'
import { fen, naira } from '../rules/money'

const num = (n: number) => n.toLocaleString('en-US')

export function StatusPill({ f }: { f: FactProof }) {
  const { t } = useI18n()
  if (f.status === 'fails') return <span className="pill warn">{t('proof.fails')}</span>
  if (f.status === 'undecided') return <span className="pill quiet">{t('proof.undecided')}</span>
  const tools = f.holdsBy.map((x) => TOOL_NAME[x] ?? x)
  return tools.length >= 2
    ? <span className="pill ok">{t('proof.holds2', { tools: tools.join(' + ') })}</span>
    : <span className="pill ok-one">{t('proof.holds1', { tool: tools[0] })}</span>
}

function toolLine(f: FactProof, t: (k: Key, v?: Record<string, string | number>) => string) {
  const seen: string[] = []
  for (const run of f.runs) {
    for (const x of run.tools) {
      const word = t(x.status === 'holds' ? 'proof.tHolds' : x.status === 'fails' ? 'proof.tFails' : 'proof.tUndecided')
      seen.push(`${TOOL_NAME[x.tool] ?? x.tool}: ${word}, ${x.seconds} s`)
    }
  }
  return seen.join(' · ')
}

function FactTable({ rule }: { rule: RuleProofs }) {
  const { t, lang } = useI18n()
  return (
    <div className="scroll-x">
      <table className="rate proof-table">
        <thead>
          <tr>
            <th scope="col">{t('proof.colFact')}</th>
            <th scope="col">{t('proof.colResult')}</th>
            <th scope="col">{t('proof.colTools')}</th>
            <th scope="col">{t('proof.colMutant')}</th>
            <th scope="col">{t('proof.colBlock')}</th>
          </tr>
        </thead>
        <tbody>
          {rule.facts.map((f) => {
            const mutants = f.runs.map((r) => r.mutant).filter((m) => m !== null)
            const mutant = mutants.length === 0 ? t('proof.mutantNone') : mutants.every((m) => m === 'fails') ? t('proof.mutantCaught') : t('proof.mutantMissed')
            return (
              <tr key={f.factId}>
                <th scope="row">
                  <span className="fact-name">{lang === 'zh' ? f.statement.zh : f.statement.en}</span>
                  <span className="mono fine">{f.factId}</span>
                </th>
                <td><StatusPill f={f} /></td>
                <td className="fine tools">{toolLine(f, t)}</td>
                <td className="fine">{mutant}</td>
                <td className="mono fine">{[...new Set(f.runs.map((r) => num(r.block)))].join(', ')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TrapTable({ trap }: { trap: TrapProof }) {
  const { t } = useI18n()
  const money = (s: string) => (trap.unit === 'fen' ? fen(Number(s)) : naira(Number(s)))
  return (
    <section className="trap trap-in" aria-labelledby={`trap-${trap.unit}`}>
      <h3 id={`trap-${trap.unit}`}><i className="dot" aria-hidden="true" />{t('proof.trapTitle', { n: trap.ranges.length })}</h3>
      <p>{t(trap.unit === 'fen' ? 'proof.trapCn' : 'proof.trapNg', { edge: money(trap.ranges[0]?.edge ?? '0') })}</p>
      <div className="scroll-x">
        <table className="rate">
          <thead>
            <tr>
              <th scope="col">{t('proof.colFrom')}</th>
              <th scope="col">{t('proof.colTo')}</th>
              <th scope="col">{t('proof.colKeepEdge')}</th>
              <th scope="col">{t('proof.colKeepFrom')}</th>
              <th scope="col">{t('proof.colLoss')}</th>
            </tr>
          </thead>
          <tbody>
            {trap.ranges.map((r) => (
              <tr key={r.from}>
                <th scope="row" className="mono">{money(r.from)}</th>
                <td className="mono">{money(r.to)}</td>
                <td className="mono">{money(r.atEdge)}</td>
                <td className="mono">{money(r.atFrom)}</td>
                <td className="mono">{money(String(Number(r.atEdge) - Number(r.atFrom)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small">{t('proof.trapHow', { queries: num(trap.queries), seconds: num(trap.seconds), block: num(trap.block) })}</p>
      <p className="small">{t(trap.matches ? 'proof.trapMatch' : 'proof.trapNoMatch', { source: trap.comparedWith })}</p>
      <p className="small">{t(trap.complete ? 'proof.trapComplete' : 'proof.trapIncomplete', { minutes: LIMIT_MINUTES })}</p>
    </section>
  )
}

function Chain({ rule }: { rule: RuleProofs }) {
  const { t } = useI18n()
  const c = rule.chain!
  const links: [string, Key][] = [['joinedRtl', 'proof.link1'], ['refTargets', 'proof.link2'], ['circuit8', 'proof.link3']]
  return (
    <section className="card" aria-labelledby="chain-h">
      <h3 id="chain-h">{t('proof.chainTitle')}</h3>
      <p className="fine">{t('proof.chainBody', { block: num(c.block) })}</p>
      <dl className="rows">
        {links.map(([k, label]) => (
          <div key={k} className="row"><dt>{t(label)}</dt><dd>{c.links[k] ? <span className="pill ok">{t('proof.linkHolds')}</span> : <span className="pill warn">{t('proof.linkOpen')}</span>}</dd></div>
        ))}
      </dl>
      <h4 className="sub">{t('proof.supportTitle')}</h4>
      <dl className="rows">
        {c.support.map((s) => (
          <div key={s.factId} className="row">
            <dt>{t(`proof.sup.${s.factId}` as Key)}</dt>
            <dd className="fine">{s.holdsBy.length ? t(s.holdsBy.length >= 2 ? 'proof.holds2' : 'proof.holds1', { tools: s.holdsBy.map((x) => TOOL_NAME[x] ?? x).join(' + '), tool: TOOL_NAME[s.holdsBy[0]] ?? s.holdsBy[0] }) : t('proof.undecided')}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function Proofs() {
  const { t } = useI18n()
  const all = PROOFS.flatMap((r) => r.facts)
  const count = (s: string) => all.filter((f) => f.status === s).length
  return (
    <div className="page proofs-page">
      <header className="head">
        <h1>{t('proof.title')}</h1>
        <p className="lede wide">{t('proof.lede', { minutes: LIMIT_MINUTES })}</p>
        <p className="fine">{t('proof.summary', { holds: count('holds'), fails: count('fails'), undecided: count('undecided') })}</p>
      </header>
      <section className="card legend" aria-labelledby="legend-h">
        <h2 id="legend-h">{t('proof.legend')}</h2>
        <dl className="rows">
          <div className="row"><dt><span className="pill ok">{t('proof.holds2', { tools: 'A + B' })}</span></dt><dd>{t('proof.legendHolds2')}</dd></div>
          <div className="row"><dt><span className="pill ok-one">{t('proof.holds1', { tool: 'A' })}</span></dt><dd>{t('proof.legendHolds1')}</dd></div>
          <div className="row"><dt><span className="pill warn">{t('proof.fails')}</span></dt><dd>{t('proof.legendFails')}</dd></div>
          <div className="row"><dt><span className="pill quiet">{t('proof.undecided')}</span></dt><dd>{t('proof.legendUndecided', { minutes: LIMIT_MINUTES })}</dd></div>
        </dl>
        <p className="fine">{t('proof.legendMutant')}</p>
      </section>
      {PROOFS.map((r) => {
        const info = ruleById(r.ruleId)
        return (
          <section key={r.ruleId} className="proof-rule" aria-labelledby={`p-${r.ruleId}`}>
            <div className="proof-rule-head">
              <h2 id={`p-${r.ruleId}`}>{info ? t(info.title) : r.ruleId}</h2>
              <a className="quiet" href={href(`/rules/${r.ruleId}`)}>{t('proof.readRule')}</a>
            </div>
            <p className="fine">{t(r.chain ? 'proof.onChainSplit' : 'proof.onChain', { circuits: [...new Set(r.facts.flatMap((f) => f.circuits))].join(', ') })}</p>
            <FactTable rule={r} />
            {r.trap && <TrapTable trap={r.trap} />}
            {r.chain && <Chain rule={r} />}
          </section>
        )
      })}
      <section className="card" aria-labelledby="repeat-h">
        <h2 id="repeat-h">{t('proof.repeatTitle')}</h2>
        <p className="body">{t('proof.repeatBody')}</p>
        <p className="mono fine">docs/evidence/p3.md · scripts/p3/collect-proofs.mts</p>
        <p className="fine">{t('proof.notAudited')}</p>
      </section>
    </div>
  )
}
