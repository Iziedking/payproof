// Shared pieces for the pages that read and write the P4 contracts (splits, payouts, engines,
// hunt, run). Every address and transaction is shown in monospace with a copy button and an
// explorer link (PLAN section 12).
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Address, Hex } from 'viem'
import { useI18n } from './i18n/i18n'
import { EXPLORER, connectWallet, hasBrowserWallet, shortAddr } from './chain/live'

export function Copy({ text }: { text: string }) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="link-btn small copy" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) }, () => {})
    }}>{done ? t('live.copied') : t('live.copy')}</button>
  )
}

export function Addr({ a, full }: { a: string; full?: boolean }) {
  return (
    <span className="addr">
      <a className="mono" href={`${EXPLORER}/address/${a}`} target="_blank" rel="noreferrer" title={a}>{full ? a : shortAddr(a)}</a>
      <Copy text={a} />
    </span>
  )
}

export function TxLink({ hash }: { hash: string }) {
  return (
    <span className="addr">
      <a className="mono" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer" title={hash}>{`${hash.slice(0, 10)}…${hash.slice(-6)}`}</a>
      <Copy text={hash} />
    </span>
  )
}

/** Loading, error and empty states for a chain read, with a retry. */
export function useRead<T>(read: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ok'; data: T } | { status: 'error'; message: string }>({ status: 'loading' })
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    read().then((data) => { if (live) setState({ status: 'ok', data }) },
      (e: unknown) => { if (live) setState({ status: 'error', message: e instanceof Error ? e.message.split('\n')[0] : String(e) }) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n])
  return { ...state, retry: useCallback(() => setN((x) => x + 1), []) }
}

export function ReadState({ s, children }: { s: { status: string; message?: string; retry: () => void }; children: () => ReactNode }) {
  const { t } = useI18n()
  if (s.status === 'loading') return <p className="fine" role="status">{t('live.loading')}</p>
  if (s.status === 'error') return (
    <div className="trap trap-in" role="alert">
      <h3>{t('live.readError')}</h3>
      <p className="fine mono">{s.message}</p>
      <button type="button" className="btn btn-soft" onClick={s.retry}>{t('src.retry')}</button>
    </div>
  )
  return <>{children()}</>
}

/** The person's browser wallet (OKX Wallet, MetaMask and the like). Connected only when they ask. */
export function useWallet() {
  const [address, setAddress] = useState<Address | null>(null)
  const [error, setError] = useState<string | null>(null)
  const connect = useCallback(async () => {
    setError(null)
    try { setAddress(await connectWallet()) } catch (e) { setError(e instanceof Error ? e.message.split('\n')[0] : String(e)) }
  }, [])
  return { address, connect, error, available: hasBrowserWallet() }
}

export function WalletBar({ w }: { w: ReturnType<typeof useWallet> }) {
  const { t } = useI18n()
  if (w.address) return <p className="wallet-on"><span className="fine">{t('live.connected')}</span> <Addr a={w.address} /></p>
  return (
    <div className="wallet-off">
      {w.available
        ? <button type="button" className="btn btn-ink" onClick={() => { void w.connect() }}>{t('live.connect')}</button>
        : <p className="fine">{t('live.noWallet')}</p>}
      {w.error && <p className="err" role="alert">{w.error}</p>}
    </div>
  )
}

export type Step = { status: 'idle' } | { status: 'busy'; label: string } | { status: 'done'; hashes: Hex[] } | { status: 'error'; message: string }

/** Runs one or more transactions in order, showing each step: waiting for the wallet, confirming, done. */
export function useSteps() {
  const [step, setStep] = useState<Step>({ status: 'idle' })
  const run = useCallback(async (parts: { label: string; go: () => Promise<Hex> }[]) => {
    const hashes: Hex[] = []
    try {
      for (const p of parts) { setStep({ status: 'busy', label: p.label }); hashes.push(await p.go()) }
      setStep({ status: 'done', hashes })
      return hashes
    } catch (e) {
      const m = e instanceof Error ? (e as { shortMessage?: string }).shortMessage ?? e.message.split('\n')[0] : String(e)
      setStep({ status: 'error', message: m })
      return null
    }
  }, [])
  return { step, run, reset: () => setStep({ status: 'idle' }) }
}

export function StepLine({ step }: { step: Step }) {
  const { t } = useI18n()
  if (step.status === 'idle') return null
  if (step.status === 'busy') return <p className="tag tag-wait" role="status">{step.label}</p>
  if (step.status === 'error') return <p className="err" role="alert">{t('live.txError')} {step.message}</p>
  return (
    <div className="fine" role="status">
      {t('live.txDone')} {step.hashes.map((h) => <TxLink key={h} hash={h} />)}
    </div>
  )
}

export function SimTag() {
  const { t } = useI18n()
  return <span className="pill warn">{t('live.simulated')}</span>
}
