// Engines (PLAN section 12): every engine listed against a rule on Listings, with its bounty and
// status. The engines listed for the hackathon are SIMULATED vendor engines (rules/sim-engines)
// and are labelled so wherever they appear.
import { useI18n } from '../i18n/i18n'
import { href } from '../router'
import { Addr, ReadState, SimTag, useRead } from '../live-ui'
import { ENGINES } from '../proofs/proofs'
import { ENGINE_REFS, LISTINGS, RULE_NAMES, readListings, units } from '../chain/live'

export function Engines() {
  const { t } = useI18n()
  const s = useRead(readListings, [])
  return (
    <div className="page live-page">
      <header className="head">
        <h1>{t('eng.title')}</h1>
        <p className="lede wide">{t('eng.lede')}</p>
        <p className="fine">{t('eng.contract')} <Addr a={LISTINGS} /></p>
      </header>
      <ReadState s={s}>{() => s.status === 'ok' && (
        s.data.length === 0 ? <p className="empty">{t('eng.none')}</p> : (
          <div className="scroll-x">
            <table className="proof-table live-table">
              <thead><tr>
                <th scope="col">{t('eng.listing')}</th><th scope="col">{t('eng.engine')}</th><th scope="col">{t('eng.rule')}</th>
                <th scope="col">{t('eng.bounty')}</th><th scope="col">{t('eng.proof')}</th><th scope="col">{t('splits.state')}</th><th scope="col"><span className="sr">{t('eng.act')}</span></th>
              </tr></thead>
              <tbody>{s.data.map((l) => {
                const id = Number(l.engine.id)
                const ref = ENGINE_REFS[id]
                const proof = ref && ENGINES.find((e) => e.engine === ref.name)
                return (
                  <tr key={l.id}>
                    <th scope="row" className="mono">{l.id}</th>
                    <td>{ref ? <>{t('eng.circuit', { id })} <span className="mono small">{ref.name}</span> <SimTag /></> : t('eng.circuit', { id })}</td>
                    <td className="mono">{RULE_NAMES[l.ruleId.toString()] ?? l.ruleId.toString()}</td>
                    <td className="mono">{l.status === 'disproved' ? t('eng.paidOut') : `${units(l.bounty, l.decimals)} ${l.symbol}`}</td>
                    <td>{proof ? <a href={href('/proofs')}>{t(proof.result === 'equal' ? 'eng.pEqual' : proof.result === 'differs' ? 'eng.pDiffers' : 'eng.pOpen')}</a> : '–'}</td>
                    <td>{l.status === 'disproved' ? <><span className="pill warn">{t('eng.disproved')}</span> <Addr a={l.hunter} /></>
                      : l.status === 'withdrawn' ? t('eng.withdrawn') : <span className="pill ok">{t('eng.open')}</span>}</td>
                    <td><a className="btn btn-soft small" href={href(`/hunt/${l.id}`)}>{t(l.status === 'open' ? 'eng.hunt' : 'eng.view')}</a></td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        )
      )}</ReadState>
      <p className="fine">{t('eng.how')}</p>
    </div>
  )
}
