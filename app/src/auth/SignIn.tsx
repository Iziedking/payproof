// Sign-in by email through Privy (L24). Loaded only when /sign-in is opened (App.tsx), so the
// check pages never download Privy and never contact it (L4, L25). Our own form drives Privy's
// headless email flow; Privy's modal is not used.
//
// Privy React SDK @privy-io/react-auth 3.52.1, read 2026-11-24 (VERSIONS.md):
//   PrivyProvider { appId, config }    https://docs.privy.io/basics/react/setup.md
//   useLoginWithEmail().sendCode / loginWithCode    https://docs.privy.io/basics/react/quickstart.md
//   usePrivy().ready / authenticated / user / logout
//   config.defaultChain and supportedChains, a custom chain by viem defineChain
//     https://docs.privy.io/basics/react/advanced/configuring-evm-networks.md
// The app ID is public configuration; no Privy secret is in this app.
import { useState, type FormEvent } from 'react'
import { PrivyProvider, useLoginWithEmail, usePrivy } from '@privy-io/react-auth'
import { xLayer } from '../chain/xlayer'
import { useI18n } from '../i18n/i18n'

export const PRIVY_APP_ID = 'cmwuj4hbm00ts0hk17hepnkzx'

export { xLayer }

export default function SignInPage() {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={{
      defaultChain: xLayer,
      supportedChains: [xLayer],
      embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
    }}>
      <SignIn />
    </PrivyProvider>
  )
}

function SignIn() {
  const { t } = useI18n()
  const { ready, authenticated, user, logout } = usePrivy()
  const { sendCode, loginWithCode } = useLoginWithEmail()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!ready) return <div className="page narrow"><p className="lede">{t('auth.loading')}</p></div>

  if (authenticated && user) {
    const wallet = user.wallet?.address
    return (
      <div className="page narrow">
        <h1 className="h2">{t('auth.in.title')}</h1>
        <p className="lede">{t('auth.in.body', { email: user.email?.address ?? '' })}</p>
        {wallet && (
          <details className="details">
            <summary>{t('auth.details')}</summary>
            <p className="fine">{t('auth.wallet')}</p>
            <p className="mono">{wallet}</p>
          </details>
        )}
        <p><button type="button" className="btn btn-soft" onClick={() => { void logout() }}>{t('auth.out')}</button></p>
      </div>
    )
  }

  const run = async (e: FormEvent, step: () => Promise<unknown>) => {
    e.preventDefault()
    setError(null); setBusy(true)
    try { await step() } catch (err) { setError(err instanceof Error ? err.message : String(err)) } finally { setBusy(false) }
  }
  const onEmail = (e: FormEvent) => run(e, async () => { await sendCode({ email: email.trim() }); setSent(true) })
  const onCode = (e: FormEvent) => run(e, () => loginWithCode({ code: code.trim() }))

  return (
    <div className="page narrow">
      <h1 className="h2">{t('auth.title')}</h1>
      <p className="lede">{t('auth.body')}</p>
      {!sent ? (
        <form className="fields" onSubmit={onEmail} noValidate>
          <div className="field">
            <div className="field-top"><label htmlFor="f-email">{t('auth.email')}</label></div>
            <div className="input"><input id="f-email" type="email" autoComplete="email" inputMode="email" spellCheck={false}
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
          </div>
          <button type="submit" className="btn btn-ink" disabled={busy || !email.includes('@')}>{t('auth.send')}</button>
        </form>
      ) : (
        <form className="fields" onSubmit={onCode} noValidate>
          <p>{t('auth.sent', { email: email.trim() })}</p>
          <div className="field">
            <div className="field-top"><label htmlFor="f-code">{t('auth.code')}</label></div>
            <div className="input"><input id="f-code" className="mono" inputMode="numeric" autoComplete="one-time-code"
              value={code} onChange={(e) => setCode(e.target.value)} /></div>
          </div>
          <button type="submit" className="btn btn-ink" disabled={busy || code.trim().length === 0}>{t('auth.verify')}</button>
          <button type="button" className="link-btn" onClick={() => { setSent(false); setCode('') }}>{t('auth.other')}</button>
        </form>
      )}
      {error && <p className="err" role="alert">{t('auth.error')} {error ?? ''}</p>}
      <p className="fine">{t('auth.note')}</p>
    </div>
  )
}
