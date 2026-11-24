import { lazy, Suspense, useEffect } from 'react'
import { useI18n, type Key } from './i18n/i18n'
import { href, useRoute } from './router'
import { AppBar } from './components'
import { CheckPay } from './pages/CheckPay'
import { Result } from './pages/Result'
import { Rules } from './pages/Rules'
import { Rule } from './pages/Rule'

// Privy is large and contacts its own servers, so it loads only on the sign-in page (L4, L25).
const SignIn = lazy(() => import('./auth/SignIn'))

const SOON: Record<string, Key> = {
  '/splits': 'nav.splits', '/engines': 'nav.engines', '/how': 'nav.how', 
  '/check/payout': 'nav.check', '/run': 'nav.splits', '/me': 'nav.signin', '/settings': 'nav.signin',
}

export function App() {
  const { path, query } = useRoute()
  const { t } = useI18n()
  useEffect(() => { scrollTo(0, 0) }, [path])

  let page
  let title = t('check.title')
  if (path === '/check/pay' || path === '/' || path === '/check') page = <CheckPay key={query.toString()} query={query} />
  else if (path === '/result') { page = <Result query={query} />; title = t('res.crumb') }
  else if (path === '/rules') { page = <Rules />; title = t('rules.title') }
  else if (path.startsWith('/rules/')) { page = <Rule key={path} id={path.slice('/rules/'.length)} />; title = t('rules.title') }
  else if (path === '/sign-in') {
    title = t('nav.signin')
    page = <Suspense fallback={<div className="page narrow"><p className="lede">{t('auth.loading')}</p></div>}><SignIn /></Suspense>
  }
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
  useEffect(() => { document.title = `${title} · Payproof` }, [title])

  return (
    <>
      <AppBar path={path} />
      <main id="main" tabIndex={-1}>{page}</main>
      <footer className="foot">
        <span>{t('foot.note')}</span>
        <a href="../">{t('foot.site')}</a>
      </footer>
    </>
  )
}
