// Run a split (PLAN section 12): create a split on rule split-v1 and open rounds, from the
// operator's own browser wallet. The page says, before any deposit, that nobody can recover a
// deposit if a pinned circuit changes for good (docs/threat-model.md, D13).
import { useState } from 'react'
import type { Address } from 'viem'
import { useI18n } from '../i18n/i18n'
import { href } from '../router'
import { Addr, ReadState, StepLine, WalletBar, useRead, useSteps, useWallet } from '../live-ui'
import { parseAmount } from '../rules/money'
import { FEE_CIRCUIT, SHARE_TOKEN, SPLIT_REFS, USDT0, VAULT, isAddress, readSplits, tx, vaultUnits } from '../chain/live'

export function Run() {
  const { t } = useI18n()
  const w = useWallet()
  const create = useSteps()
  const open = useSteps()
  const [n, setN] = useState(0)
  const s = useRead(readSplits, [n])
  const [shareToken, setShareToken] = useState<string>(SHARE_TOKEN)
  const [payToken, setPayToken] = useState<string>(USDT0)
  const [days, setDays] = useState('7')
  const [splitId, setSplitId] = useState('1')
  const [amount, setAmount] = useState('1.00')
  const dep = parseAmount(amount, 2, 42_949_672)
  const daysN = Number(days)
  const canCreate = isAddress(shareToken) && isAddress(payToken) && Number.isInteger(daysN) && daysN >= 1 && daysN <= 365

  return (
    <div className="page live-page">
      <header className="head">
        <h1>{t('run.title')}</h1>
        <p className="lede wide">{t('run.lede')}</p>
      </header>
      <WalletBar w={w} />

      <section className="card live-card">
        <h2>{t('run.openTitle')}</h2>
        <ReadState s={s}>{() => s.status === 'ok' && (s.data.length === 0 ? <p className="fine">{t('splits.none')}</p> : (() => {
          const sp = s.data.find((x) => String(x.id) === splitId) ?? s.data[0]
          const units = dep.kind === 'ok' ? dep.value : 0
          const mine = w.address && w.address.toLowerCase()
          return (
            <>
              <div className="fields">
                <div className="field">
                  <div className="field-top"><label htmlFor="f-split">{t('run.split')}</label></div>
                  <div className="input"><select id="f-split" value={String(sp.id)} onChange={(e) => setSplitId(e.target.value)}>
                    {s.data.map((x) => <option key={x.id} value={x.id}>{t('splits.split', { id: x.id })} · {x.symbol}</option>)}
                  </select></div>
                </div>
                <div className="field">
                  <div className="field-top"><label htmlFor="f-dep">{t('run.deposit', { sym: sp.symbol })}</label></div>
                  <div className={dep.kind === 'invalid' || dep.kind === 'range' ? 'input bad' : 'input'}>
                    <input id="f-dep" className="mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <p className="fine">{t('run.depositHint', { fee: vaultUnits(Math.floor(units / 10), sp), holders: vaultUnits(Math.floor(units * 85 / 100), sp), rest: vaultUnits(units - Math.floor(units / 10) - Math.floor(units * 85 / 100), sp), sym: sp.symbol })}</p>
                </div>
              </div>
              <div className="trap" role="note"><h3>{t('run.warnTitle')}</h3><p>{t('run.warn')}</p></div>
              <p className="acts"><button type="button" className="btn btn-ink" disabled={!w.address || units <= 0 || open.step.status === 'busy'} onClick={async () => {
                const need = BigInt(units) * sp.unit
                const have = await tx.allowance(sp.payToken, w.address!, VAULT)
                const ok = await open.run([
                  ...(have < need ? [{ label: t('run.approving'), go: () => tx.approve(w.address!, sp.payToken, VAULT, need) }] : []),
                  { label: t('run.opening'), go: () => tx.openRound(w.address!, sp.id, units) },
                ])
                if (ok) setN((x) => x + 1)
              }}>{t('run.open', { amount: dep.kind === 'ok' ? vaultUnits(units, sp) : '–', sym: sp.symbol })}</button></p>
              {mine && mine !== sp.operator.toLowerCase() && <p className="fine">{t('run.notOperator')}</p>}
              <StepLine step={open.step} />
              <p className="fine"><a href={href('/splits')}>{t('run.seeSplits')}</a></p>
            </>
          )
        })())}</ReadState>
      </section>

      <section className="card live-card">
        <h2>{t('run.createTitle')}</h2>
        <p className="fine">{t('run.createBody', { fee: FEE_CIRCUIT, refs: SPLIT_REFS.join(', ') })}</p>
        <div className="fields">
          <div className="field">
            <div className="field-top"><label htmlFor="f-share">{t('run.shareToken')}</label></div>
            <div className={isAddress(shareToken) ? 'input' : 'input bad'}><input id="f-share" className="mono" spellCheck={false} value={shareToken} onChange={(e) => setShareToken(e.target.value.trim())} /></div>
            <p className="fine">{t('run.shareHint')}</p>
          </div>
          <div className="field">
            <div className="field-top"><label htmlFor="f-pay">{t('run.payToken')}</label></div>
            <div className={isAddress(payToken) ? 'input' : 'input bad'}><input id="f-pay" className="mono" spellCheck={false} value={payToken} onChange={(e) => setPayToken(e.target.value.trim())} /></div>
          </div>
          <div className="field small">
            <div className="field-top"><label htmlFor="f-days">{t('run.window')}</label></div>
            <div className="input"><input id="f-days" className="mono" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></div>
          </div>
        </div>
        <p className="acts"><button type="button" className="btn btn-soft" disabled={!w.address || !canCreate || create.step.status === 'busy'} onClick={async () => {
          const ok = await create.run([{ label: t('run.creating'), go: () => tx.createSplit(w.address!, 1n, FEE_CIRCUIT, shareToken as Address, payToken as Address, BigInt(daysN * 86400)) }])
          if (ok) setN((x) => x + 1)
        }}>{t('run.create')}</button></p>
        <StepLine step={create.step} />
        <p className="fine">{t('splits.vault')} <Addr a={VAULT} /></p>
      </section>
    </div>
  )
}
