import { lazy, Suspense, useEffect, useState } from 'react'
import { useI18n, type Key } from './i18n/i18n'
import { go, href, useRoute } from './router'
import { AppBar, GuestBanner, Toast } from './components'
import { takeToast, useSession } from './auth/session'
import { Profile } from './pages/Profile'
import { CheckPay } from './pages/CheckPay'
import { Result } from './pages/Result'
import { Rules } from './pages/Rules'
import { Rule } from './pages/Rule'
import { Proofs } from './pages/Proofs'
import { Splits } from './pages/Splits'
import { CheckPayout } from './pages/CheckPayout'
import { Run } from './pages/Run'
import { Engines } from './pages/Engines'
import { Hunt } from './pages/Hunt'

// Privy is large and contacts its own servers, so it loads only on the account pages (L4).
const Account = lazy(() => import('./auth/SignIn'))

const SOON: Record<string, Key> = {
  '/how': 'nav.how', '/settings': 'acct.profile',
}
const ACCOUNT = { '/sign-up': 'signup', '/sign-in': 'signin', '/sign-out': 'signout' } as const

export function App() {
  const { path, query } = useRoute()
  const { t } = useI18n()
  const session = useSession()
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => { scrollTo(0, 0) }, [path])
  useEffect(() => {
    const k = takeToast()
    if (!k) return
    setToast(k)
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [path])

  const mode = ACCOUNT[path as keyof typeof ACCOUNT]
  // Signed in already: Sign in and Create account go to the profile; the profile needs an account.
  const redirect = session && (mode === 'signup' || mode === 'signin') ? '/me' : !session && path === '/me' ? '/sign-in' : null
  useEffect(() => { if (redirect) go(redirect, redirect === '/sign-in' ? { next: '/me' } : undefined) }, [redirect])

  if (mode) {
    const title = t(mode === 'signup' ? 'acct.createTitle' : mode === 'signin' ? 'acct.backTitle' : 'acct.signOut')
    document.title = `${title} · Payproof`
    return (
      <main id="main" tabIndex={-1} className="auth-main">
        <Suspense fallback={<div className="page narrow"><p className="lede">{t('auth.loading')}</p></div>}>
          {!redirect && <Account mode={mode} next={query.get('next')} />}
        </Suspense>
      </main>
    )
  }

  let page
  let title = t('check.title')
  if (path === '/me') { page = session ? <Profile session={session} showSaved={query.get('show') === 'saved'} /> : null; title = t('acct.profile') }
  else if (path === '/check/payout') { page = <CheckPayout key={query.toString()} query={query} />; title = t('payout.title') }
  else if (path === '/splits') { page = <Splits />; title = t('splits.title') }
  else if (path === '/run') { page = <Run />; title = t('run.title') }
  else if (path === '/engines') { page = <Engines />; title = t('eng.title') }
  else if (/^\/hunt\/\d+$/.test(path)) { page = <Hunt key={path} id={Number(path.slice('/hunt/'.length))} />; title = t('hunt.crumb', { id: path.slice('/hunt/'.length) }) }
  else if (path === '/check/pay' || path === '/' || path === '/check') page = <CheckPay key={query.toString()} query={query} />
  else if (path === '/result') { page = <Result query={query} />; title = t('res.crumb') }
  else if (path === '/rules') { page = <Rules />; title = t('rules.title') }
  else if (path === '/proofs') { page = <Proofs />; title = t('proof.title') }
  else if (path.startsWith('/rules/')) { page = <Rule key={path} id={path.slice('/rules/'.length)} />; title = t('rules.title') }
  else {
    const name = t(SOON[path] ?? SOON[`/${path.split('/')[1]}`] ?? 'nav.check')
    title = name
    page = (
      <div className="page narrow soon">
        <h1 className="h2">{t('soon.title', { page: name })}</h1>
        <p className="lede">{t('soon.body')}</p>
        <p><a className="btn btn-ink" href={href('/check/pay')}>{t('soon.back')}</a></p>
      </div>
    )
  }
  document.title = `${title} · Payproof`

  return (
    <>
      <AppBar path={path} session={session} />
      <main id="main" tabIndex={-1}>
        {!session && <div className="banner-wrap"><GuestBanner /></div>}
        {page}
      </main>
      {toast && <Toast text={t(toast as Key)} />}
      <footer className="foot">
        <span>{t('foot.note')}</span>
        <a href="../index.html">{t('foot.site')}</a>
      </footer>
    </>
  )
}
