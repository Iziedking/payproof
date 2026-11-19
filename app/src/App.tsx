import { useEffect } from 'react'
import { useI18n, type Key } from './i18n/i18n'
import { href, useRoute } from './router'
import { AppBar } from './components'
import { CheckPay } from './pages/CheckPay'
import { Result } from './pages/Result'

const SOON: Record<string, Key> = {
  '/rules': 'nav.rules', '/splits': 'nav.splits', '/engines': 'nav.engines', '/how': 'nav.how', '/sign-in': 'nav.signin',
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
