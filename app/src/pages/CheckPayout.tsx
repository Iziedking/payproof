// Check my payout (PLAN section 12): pick a split and an address, and see, round by round, the
// shares the address held at the snapshot, what the rule gives for them and what the vault paid.
// No sign-in: paste an address, or connect a browser wallet to claim. The rule's payout is
// floor(pot x 85% x shares / total) (rules/split-v1); the vault accepts a claim only when circuit
// 8 on X Layer agrees, so a claim that went through was paid exactly that amount.
import { useState, type FormEvent } from 'react'
import type { Address } from 'viem'
import { useI18n } from '../i18n/i18n'
import { go } from '../router'
import { Addr, ReadState, StepLine, WalletBar, useRead, useSteps, useWallet } from '../live-ui'
import { isAddress, readHolder, readRounds, readSplits, shareBalance, tx, vaultUnits } from '../chain/live'

export function CheckPayout({ query }: { query: URLSearchParams }) {
  const { t } = useI18n()
  const w = useWallet()
  const q = query.get('address') ?? ''
  const splitId = Number(query.get('split') ?? '1') || 1
  const [draft, setDraft] = useState(q)
  const who = (isAddress(q) ? q : null) as Address | null
  const { step, run } = useSteps()
  const [n, setN] = useState(0)

  const s = useRead(async () => {
    const splits = await readSplits()
    const sp = splits.find((x) => x.id === splitId) ?? splits[0]
    if (!sp) return null
    const rounds = await readRounds(sp)
    if (!who) return { splits, sp, rounds, rows: [], now: 0n }
    const [rows, now] = await Promise.all([readHolder(sp, rounds, who), shareBalance(sp.shareToken, who)])
    return { splits, sp, rounds, rows, now }
  }, [splitId, who, n])

  const submit = (e: FormEvent) => { e.preventDefault(); if (isAddress(draft)) go('/check/payout', { split: String(splitId), address: draft.trim() }) }
  const bad = draft.trim() !== '' && !isAddress(draft)

  return (
    <div className="page live-page">
      <header className="head">
        <h1>{t('payout.title')}</h1>
        <p className="lede wide">{t('payout.lede')}</p>
      </header>
      <form className="fields addr-form" onSubmit={submit} noValidate>
        <div className="field">
          <div className="field-top"><label htmlFor="f-addr">{t('payout.address')}</label></div>
          <div className={bad ? 'input bad' : 'input'}>
            <input id="f-addr" className="mono" spellCheck={false} autoComplete="off" placeholder="0x…" value={draft}
              onChange={(e) => setDraft(e.target.value)} aria-invalid={bad} aria-describedby={bad ? 'e-addr' : undefined} />
          </div>
          {bad && <p id="e-addr" className="err">{t('payout.badAddress')}</p>}
        </div>
        <div className="acts">
          <button type="submit" className="btn btn-ink" disabled={!isAddress(draft)}>{t('payout.go')}</button>
          {w.address
            ? <button type="button" className="btn btn-soft" onClick={() => { setDraft(w.address!); go('/check/payout', { split: String(splitId), address: w.address! }) }}>{t('payout.mine')}</button>
            : w.available && <button type="button" className="btn btn-soft" onClick={() => { void w.connect() }}>{t('live.connect')}</button>}
        </div>
        {w.error && <p className="err" role="alert">{w.error}</p>}
      </form>

      <ReadState s={s}>{() => {
        if (s.status !== 'ok') return null
        const d = s.data
        if (!d) return <p className="empty">{t('splits.none')}</p>
        const sp = d.sp
        return (
          <section className="card live-card" aria-live="polite">
            <h2>{t('splits.split', { id: sp.id })} <span className="mono small">split-v1 · {sp.symbol}</span></h2>
            {!who ? <p className="fine">{t('payout.enter')}</p> : (
              <>
                <p className="fine">{t('payout.for')} <Addr a={who} full /> · {t('payout.now', { n: d.now.toString() })}</p>
                {d.rows.length === 0 ? <p className="fine">{t('splits.noRounds')}</p> : (
                  <div className="scroll-x">
                    <table className="proof-table live-table">
                      <thead><tr>
                        <th scope="col">{t('splits.round')}</th><th scope="col">{t('payout.snapShares')}</th><th scope="col">{t('splits.pot')}</th>
                        <th scope="col">{t('payout.rule')}</th><th scope="col">{t('payout.received')}</th><th scope="col">{t('splits.state')}</th>
                      </tr></thead>
                      <tbody>{d.rows.map((r) => {
                        const open = !r.round.rolledOver && BigInt(Math.floor(Date.now() / 1000)) <= r.round.deadline
                        const mine = w.address && w.address.toLowerCase() === who.toLowerCase()
                        return (
                          <tr key={r.round.id}>
                            <th scope="row" className="mono">{r.round.id}</th>
                            <td className="mono">{t('payout.of', { n: r.shares.toString(), total: r.round.totalShares })}</td>
                            <td className="mono">{vaultUnits(r.round.pot, sp)} {sp.symbol}</td>
                            <td className="mono">{vaultUnits(r.rulePayout, sp)} {sp.symbol}</td>
                            <td className="mono">{r.received === null ? '–' : `${vaultUnits(r.received, sp)} ${sp.symbol}`}</td>
                            <td>{r.shares === 0n ? t('payout.noShares') : r.claimed ? <span className="pill ok">{t('payout.match')}</span>
                              : !open ? t('payout.missed')
                              : mine ? <button type="button" className="btn btn-ink small" disabled={step.status === 'busy'} onClick={async () => {
                                  const ok = await run([{ label: t('payout.claiming'), go: () => tx.claim(w.address!, sp.id, r.round.id, r.rulePayout) }])
                                  if (ok) setN((x) => x + 1)
                                }}>{t('payout.claim', { amount: vaultUnits(r.rulePayout, sp) })}</button>
                              : t('payout.unclaimed')}</td>
                          </tr>
                        )
                      })}</tbody>
                    </table>
                  </div>
                )}
                <StepLine step={step} />
                <p className="fine">{t('payout.how')}</p>
              </>
            )}
          </section>
        )
      }}</ReadState>
      {!w.address && !w.available && <WalletBar w={w} />}
    </div>
  )
}
