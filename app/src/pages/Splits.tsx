// Splits: every split SplitVault holds on X Layer, with its pinned rule and fee circuit and each
// round as the vault records it. Read-only; no sign-in.
import { useI18n } from '../i18n/i18n'
import { href } from '../router'
import { Addr, ReadState, useRead } from '../live-ui'
import { FEE_CIRCUIT, RULE_NAMES, VAULT, readRounds, readSplits, vaultUnits } from '../chain/live'

export function Splits() {
  const { t } = useI18n()
  const s = useRead(async () => {
    const splits = await readSplits()
    return Promise.all(splits.map(async (sp) => ({ sp, rounds: await readRounds(sp) })))
  }, [])
  return (
    <div className="page live-page">
      <header className="head">
        <h1>{t('splits.title')}</h1>
        <p className="lede wide">{t('splits.lede')}</p>
        <p className="fine">{t('splits.vault')} <Addr a={VAULT} /></p>
      </header>
      <ReadState s={s}>{() => s.status === 'ok' && (
        s.data.length === 0 ? <p className="empty">{t('splits.none')}</p> : s.data.map(({ sp, rounds }) => (
          <section key={sp.id} className="card live-card">
            <h2>{t('splits.split', { id: sp.id })} <span className="mono small">{RULE_NAMES[sp.ruleId.toString()] ?? `rule ${sp.ruleId}`}</span></h2>
            <dl className="rows">
              <div className="row"><dt>{t('splits.operator')}</dt><dd><Addr a={sp.operator} /></dd></div>
              <div className="row"><dt>{t('splits.shares')}</dt><dd><Addr a={sp.shareToken} /></dd></div>
              <div className="row"><dt>{t('splits.token')}</dt><dd>{sp.symbol} <Addr a={sp.payToken} /></dd></div>
              <div className="row"><dt>{t('splits.circuits')}</dt><dd className="mono">{t('splits.circuitsVal', { fee: FEE_CIRCUIT })}</dd></div>
              <div className="row"><dt>{t('splits.window')}</dt><dd className="mono">{t('splits.days', { n: Number(sp.claimWindow) / 86400 })}</dd></div>
              <div className="row"><dt>{t('splits.carry')}</dt><dd className="mono">{vaultUnits(sp.carry, sp)} {sp.symbol}</dd></div>
            </dl>
            <h3 className="h3">{t('splits.rounds')}</h3>
            {rounds.length === 0 ? <p className="fine">{t('splits.noRounds')}</p> : (
              <div className="scroll-x">
                <table className="proof-table live-table">
                  <thead><tr>
                    <th scope="col">{t('splits.round')}</th><th scope="col">{t('splits.pot')}</th><th scope="col">{t('splits.fee')}</th>
                    <th scope="col">{t('splits.total')}</th><th scope="col">{t('splits.snapshot')}</th><th scope="col">{t('splits.paid')}</th>
                    <th scope="col">{t('splits.state')}</th>
                  </tr></thead>
                  <tbody>{rounds.map((r) => {
                    const open = !r.rolledOver && BigInt(Math.floor(Date.now() / 1000)) <= r.deadline
                    return (
                      <tr key={r.id}>
                        <th scope="row" className="mono">{r.id}</th>
                        <td className="mono">{vaultUnits(r.pot, sp)}</td>
                        <td className="mono">{vaultUnits(r.fee + r.protocolFee, sp)}</td>
                        <td className="mono">{r.totalShares}</td>
                        <td className="mono">{r.snapshotBlock.toLocaleString('en-US')}</td>
                        <td className="mono">{vaultUnits(r.claimed, sp)}</td>
                        <td>{r.rolledOver ? t('splits.rolled') : open
                          ? t('splits.openUntil', { date: new Date(Number(r.deadline) * 1000).toISOString().slice(0, 10) }) : t('splits.closed')}</td>
                      </tr>
                    )
                  })}</tbody>
                </table>
              </div>
            )}
            <p className="acts">
              <a className="btn btn-ink" href={href('/check/payout', { split: String(sp.id) })}>{t('splits.check')}</a>
              <a className="btn btn-soft" href={href('/run')}>{t('splits.run')}</a>
            </p>
          </section>
        ))
      )}</ReadState>
    </div>
  )
}
