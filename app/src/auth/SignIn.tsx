// Account pages: Create your account, Welcome back, the code step, and sign-out. Loaded only on
// these routes (App.tsx), so guests checking pay never download Privy or contact it (L4).
// Our own screens drive Privy's headless email flow; Privy's modal is not used.
//
// Privy React SDK @privy-io/react-auth 3.52.1, read 2026-11-24 (VERSIONS.md):
//   PrivyProvider { appId, config }    https://docs.privy.io/basics/react/setup.md
//   useLoginWithEmail().sendCode / loginWithCode    https://docs.privy.io/basics/react/quickstart.md
//   usePrivy().ready / authenticated / user / logout
// The app ID is public configuration; no Privy secret is in this app.
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { PrivyProvider, useLoginWithEmail, usePrivy } from '@privy-io/react-auth'
import { xLayer } from '../chain/xlayer'
import { useI18n } from '../i18n/i18n'
import { go, href } from '../router'
import { Mark } from '../components'
import { USERNAME_RE, rememberUsername, safeNext, setSession, setToast, usernameFor } from './session'

export const PRIVY_APP_ID = 'cmwuj4hbm00ts0hk17hepnkzx'
export { xLayer }

export type Mode = 'signup' | 'signin' | 'signout'

export default function AccountPage({ mode, next }: { mode: Mode; next: string | null }) {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={{
      defaultChain: xLayer,
      supportedChains: [xLayer],
      embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
    }}>
      {mode === 'signout' ? <SignOut /> : <Account mode={mode} next={safeNext(next)} />}
    </PrivyProvider>
  )
}

function SignOut() {
  const { ready, logout } = usePrivy()
  const { t } = useI18n()
  useEffect(() => {
    if (!ready) return
    void logout().finally(() => { setSession(null); setToast('acct.toastOut'); go('/check/pay') })
  }, [ready, logout])
  return <div className="page narrow"><p className="lede">{t('acct.signingOut')}</p></div>
}

const RESEND_AFTER = 30

function Account({ mode, next }: { mode: 'signup' | 'signin'; next: string }) {
  const { t } = useI18n()
  const { ready, authenticated, user } = usePrivy()
  const { sendCode, loginWithCode } = useLoginWithEmail()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)
  const done = useRef(false)

  // Signed in (just now, or already from before): record it and go on. Never a dead end.
  useEffect(() => {
    if (!ready || !authenticated || !user || done.current) return
    done.current = true
    const mail = user.email?.address ?? email.trim()
    const typed = username.trim()
    if (typed) rememberUsername(mail, typed)
    const fresh = step === 'code'
    setSession({ email: mail, username: typed || usernameFor(mail), address: user.wallet?.address, at: new Date().toISOString() })
    if (fresh) setToast('acct.toastIn')
    go(fresh ? next : '/me')
  }, [ready, authenticated, user, email, username, step, next])

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  const nameOk = mode === 'signin' || USERNAME_RE.test(username.trim())
  const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const send = async () => {
    setError(null); setBusy(true)
    try { await sendCode({ email: email.trim() }); setStep('code'); setWait(RESEND_AFTER); setDigits(Array(6).fill('')) }
    catch { setError(t('acct.errSend')) }
    finally { setBusy(false) }
  }
  const onEmail = (e: FormEvent) => { e.preventDefault(); if (nameOk && mailOk && !busy) void send() }
  const verify = async (code: string) => {
    setError(null); setBusy(true)
    try { await loginWithCode({ code }) }
    catch { setError(t('acct.errCode')); setDigits(Array(6).fill('')) }
    finally { setBusy(false) }
  }

  const other = mode === 'signup'
    ? <p className="auth-alt">{t('acct.haveAccount')} <a href={href('/sign-in', next !== '/check/pay' ? { next } : undefined)}>{t('acct.signIn')}</a></p>
    : <p className="auth-alt">{t('acct.newHere')} <a href={href('/sign-up', next !== '/check/pay' ? { next } : undefined)}>{t('acct.create')}</a></p>

  return (
    <div className="auth">
      <aside className="auth-brand" aria-hidden="true">
        <a className="lockup on-dark" href="../index.html" tabIndex={-1}><Mark /> <span>Payproof</span></a>
        <p className="auth-line">{t('acct.line')}</p>
        <svg className="auth-mark" viewBox="0 0 256 256">
          <path d="M40 40H156V100H100Z" fill="#F3F2EC" />
          <path d="M40 40L100 100V156H40Z" fill="#C9C7BE" />
          <path d="M216 216V100H156V156Z" fill="#F2552C" />
          <path d="M216 216L156 156H100V216Z" fill="#C9401C" />
        </svg>
      </aside>
      <a className="auth-guest" href={href('/check/pay')}>{t('acct.guest')} →</a>
      <section className="auth-form" aria-live="polite">
        {!ready ? <p className="lede">{t('auth.loading')}</p> : step === 'email' ? (
          <form onSubmit={onEmail} noValidate>
            <h1>{t(mode === 'signup' ? 'acct.createTitle' : 'acct.backTitle')}</h1>
            <p className="auth-sub">{t(mode === 'signup' ? 'acct.createSub' : 'acct.backSub')}</p>
            {mode === 'signup' && (
              <div className="field">
                <div className="field-top"><label htmlFor="f-user">{t('acct.username')}</label><span className="fine">{t('acct.usernameHint')}</span></div>
                <div className={username && !nameOk ? 'input bad' : 'input'}>
                  <input id="f-user" autoComplete="username" spellCheck={false} autoCapitalize="none" maxLength={24}
                    value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ada" autoFocus />
                </div>
                {username && !nameOk && <p className="err">{t('acct.usernameRule')}</p>}
              </div>
            )}
            <div className="field">
              <div className="field-top"><label htmlFor="f-email">{t('auth.email')}</label></div>
              <div className="input">
                <input id="f-email" type="email" autoComplete="email" inputMode="email" spellCheck={false}
                  value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus={mode === 'signin'} />
              </div>
            </div>
            <button type="submit" className="btn btn-ink btn-block" disabled={busy || !nameOk || !mailOk}>{busy ? t('acct.sending') : t('acct.continue')}</button>
            {error && <p className="err" role="alert">{error}</p>}
            {other}
            <p className="fine">{t('acct.secured')}</p>
          </form>
        ) : (
          <div>
            <button type="button" className="auth-back" onClick={() => { setStep('email'); setError(null) }}>← {t('acct.back')}</button>
            <h1>{t('acct.checkTitle')}</h1>
            <p className="auth-sub">{t('acct.checkSub', { email: email.trim() })}</p>
            <CodeBoxes digits={digits} setDigits={setDigits} disabled={busy} onFull={(c) => void verify(c)} />
            <button type="button" className="btn btn-ink btn-block" disabled={busy || digits.join('').length < 6}
              onClick={() => void verify(digits.join(''))}>{busy ? t('acct.checking') : t('acct.signIn')}</button>
            {error && <p className="err" role="alert">{error}</p>}
            <div className="auth-links">
              {wait > 0
                ? <span className="fine">{t('acct.resendIn', { s: `0:${String(wait).padStart(2, '0')}` })}</span>
                : <button type="button" className="link-btn" onClick={() => void send()} disabled={busy}>{t('acct.resend')}</button>}
              <button type="button" className="link-btn quiet-link" onClick={() => { setStep('email'); setEmail(''); setError(null) }}>{t('auth.other')}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function CodeBoxes({ digits, setDigits, disabled, onFull }: {
  digits: string[]; setDigits: (d: string[]) => void; disabled: boolean; onFull: (code: string) => void
}) {
  const { t } = useI18n()
  const refs = useRef<(HTMLInputElement | null)[]>([])
  useEffect(() => { refs.current[0]?.focus() }, [])
  const put = (start: number, text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 6 - start)
    if (!clean) return
    const d = [...digits]
    clean.split('').forEach((c, i) => { d[start + i] = c })
    setDigits(d)
    const nextIdx = Math.min(5, start + clean.length)
    refs.current[nextIdx]?.focus()
    if (d.every((x) => x)) onFull(d.join(''))
  }
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) { const d = [...digits]; d[i - 1] = ''; setDigits(d); refs.current[i - 1]?.focus() }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
  }
  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => { e.preventDefault(); put(i, e.clipboardData.getData('text')) }
  return (
    <div className="code" role="group" aria-label={t('acct.codeLabel')}>
      {digits.map((v, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el }} className="mono" inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={t('acct.digit', { n: i + 1 })} maxLength={6} value={v} disabled={disabled}
          onChange={(e) => {
            const val = e.target.value
            if (val === '') { const d = [...digits]; d[i] = ''; setDigits(d); return }
            put(i, val.slice(-6).length > 1 ? val : val.slice(-1))
          }}
          onKeyDown={(e) => onKey(i, e)} onPaste={(e) => onPaste(i, e)} />
      ))}
    </div>
  )
}

