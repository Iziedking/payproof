import { useId, useState } from 'react'
import { useI18n, type Key } from './i18n/i18n'
import { href } from './router'
import type { ChartView, CheckView, TrapView } from './check'
import type { EngineState } from './chain/useEngine'
import { NG_BANDS, type NgResult } from './rules/ngPaye'
import { naira } from './rules/money'

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true">
      <path d="M40 40H156V100H100Z" fill="var(--mark-a)" />
      <path d="M40 40L100 100V156H40Z" fill="var(--mark-b)" />
      <path d="M216 216V100H156V156Z" fill="#F2552C" />
      <path d="M216 216L156 156H100V216Z" fill="#C9401C" />
    </svg>
  )
}

const TABS: { key: Key; path: string }[] = [
  { key: 'nav.check', path: '/check/pay' },
  { key: 'nav.rules', path: '/rules' },
  { key: 'nav.splits', path: '/splits' },
  { key: 'nav.engines', path: '/engines' },
  { key: 'nav.how', path: '/how' },
]

export function AppBar({ path }: { path: string }) {
  const { t, lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const active = (p: string) => (p === '/check/pay' ? path.startsWith('/check') || path.startsWith('/result') : path.startsWith(p))
  return (
    <header className="bar">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>{t('nav.skip')}</a>
      <div className="bar-row">
        <a className="lockup" href={href('/check/pay')} aria-label="Payproof">
          <Mark /> <span>Payproof</span>
        </a>
        <nav className="tabs" aria-label="Main">
          {TABS.map((x) => (
            <a key={x.path} href={href(x.path)} aria-current={active(x.path) ? 'page' : undefined}>{t(x.key)}</a>
          ))}
        </nav>
        <div className="bar-end">
          <div className="lang" role="group" aria-label={t('lang.label')}>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
            <button type="button" aria-pressed={lang === 'zh'} onClick={() => setLang('zh')} lang="zh-CN">中文</button>
          </div>
          <a className="quiet signin" href={href('/sign-in')}>{t('nav.signin')}</a>
          <button type="button" className="quiet menu-btn" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(!open)}>
            {open ? t('nav.close') : t('nav.menu')}
          </button>
        </div>
      </div>
      {open && (
        <nav id="menu" className="menu" aria-label="Main">
          {TABS.map((x) => (
            <a key={x.path} href={href(x.path)} onClick={() => setOpen(false)} aria-current={active(x.path) ? 'page' : undefined}>{t(x.key)}</a>
          ))}
          <a href={href('/sign-in')} onClick={() => setOpen(false)}>{t('nav.signin')}</a>
        </nav>
      )}
    </header>
  )
}

export function Breakdown({ view }: { view: CheckView }) {
  const { t } = useI18n()
  return (
    <dl className="rows">
      {view.lines.map((l, i) => (
        <div key={i} className={l.strong ? 'row strong' : 'row'}>
          <dt>{t(l.label, l.vars)}</dt>
          <dd className="mono">{l.valueKey ? t(l.valueKey) : l.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function CompareLine({ view }: { view: CheckView }) {
  const { t } = useI18n()
  const c = view.compare
  if (!c) return null
  return (
    <div className={`cmp cmp-${c.kind}`}>
      <div className="cmp-row">
        <span>{t('cmp.paid', { amount: c.paid })}</span>
        <strong>{c.kind === 'match' ? t('cmp.match') : t(c.kind === 'more' ? 'cmp.more' : 'cmp.less', { amount: c.diff })}</strong>
      </div>
      {c.kind !== 'match' && <p className="fine">{t('cmp.note')}</p>}
    </div>
  )
}

export function TrapCard({ trap, rule }: { trap: TrapView; rule: CheckView['rule'] }) {
  const { t } = useI18n()
  if (trap.kind === 'inside') {
    return (
      <section className="trap trap-in" aria-label={t('trap.inside')}>
        <h3><i className="dot" aria-hidden="true" />{t('trap.inside')}</h3>
        <p>{t(rule === 'ng' ? 'trap.insideBodyNg' : 'trap.insideBody', trap.vars)}</p>
        <p className="mono small">{t('trap.range')} {trap.vars.from} – {trap.vars.to}</p>
      </section>
    )
  }
  if (trap.kind === 'next') {
    return (
      <section className="trap" aria-label={t('trap.next')}>
        <h3>{t('trap.next')}</h3>
        <p>{t('trap.nextBody', trap.vars)}</p>
      </section>
    )
  }
  return (
    <section className="trap" aria-label={t('trap.none')}>
      <h3>{t('trap.none')}</h3>
      <p>{trap.kind === 'past' ? t('trap.past') : t('trap.noneBody')}</p>
    </section>
  )
}

const W = 600
const H = 150

export function Chart({ chart, money }: { chart: ChartView; money: (n: number) => string }) {
  const { t } = useI18n()
  const id = useId()
  const { lo, hi, you, trap, keep } = chart
  const N = 160
  const xs: number[] = []
  for (let i = 0; i <= N; i++) xs.push(Math.round(lo + ((hi - lo) * i) / N))
  // Exact points either side of the cliff so the drop is drawn straight down.
  if (trap) xs.push(trap[0], trap[0] + 1, trap[1], trap[1] + 1)
  xs.push(you)
  const pts = [...new Set(xs)].filter((x) => x >= lo && x <= hi).sort((a, b) => a - b).map((x) => [x, keep(x)] as const)
  const ys = pts.map((p) => p[1])
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const sx = (x: number) => ((x - lo) / (hi - lo || 1)) * W
  const sy = (y: number) => H - 8 - ((y - yMin) / (yMax - yMin || 1)) * (H - 24)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(' ')
  return (
    <figure className="chart">
      <div className="plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={id} preserveAspectRatio="none">
          <title id={id}>{t('chart.label')}</title>
          {trap && <rect x={sx(trap[0])} y="0" width={Math.max(2, sx(trap[1]) - sx(trap[0]))} height={H - 8} className="band" />}
          <line x1="0" x2={W} y1={H - 8} y2={H - 8} className="axis" />
          <path d={d} className="line" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="you" style={{ left: `${(sx(you) / W) * 100}%`, top: `${(sy(keep(you)) / H) * 100}%` }} aria-hidden="true" />
      </div>
      <figcaption className="mono ticks" aria-hidden="true">
        <span>{money(lo)}</span>
        <span>{money(hi)}</span>
      </figcaption>
    </figure>
  )
}

/** Says where an answer came from: the rule's circuits read from X Layer, or the page's own copy. */
export function SourceTag({ eng }: { eng: EngineState & { retry: () => void } }) {
  const { t } = useI18n()
  if (eng.status === 'chain') return <span className="tag tag-chain" title={t('src.chainHint')}><i className="dot ink" aria-hidden="true" />{t('src.chain')}</span>
  if (eng.status === 'loading') return <span className="tag tag-wait" role="status">{t('src.loading')}</span>
  return (
    <span className="tag-group">
      <span className="tag tag-preview" title={t('src.copyHint', { reason: eng.message })}>{t('src.copy')}</span>
      <button type="button" className="link-btn small" onClick={eng.retry}>{t('src.retry')}</button>
    </span>
  )
}

export function MismatchCard() {
  const { t } = useI18n()
  return (
    <section className="trap trap-in" role="alert">
      <h3><i className="dot" aria-hidden="true" />{t('src.mismatch')}</h3>
      <p>{t('src.mismatchBody')}</p>
    </section>
  )
}

// Income x a whole percent is exact in kobo; the rule rounds down once, on the year's total.
const koboExact = (kobo: number) => (kobo % 100 ? `${naira(Math.floor(kobo / 100))}.${String(kobo % 100).padStart(2, '0')}` : naira(kobo / 100))

/** Nigeria: the income in each band (from the working circuit) and its tax (income x rate, exact). */
export function BandTable({ r }: { r: NgResult }) {
  const { t } = useI18n()
  return (
    <table className="bands">
      <caption>{t('band.caption')}</caption>
      <thead><tr><th scope="col">{t('band.band')}</th><th scope="col">{t('band.income')}</th><th scope="col">{t('band.rate')}</th><th scope="col">{t('band.tax')}</th></tr></thead>
      <tbody>
        {NG_BANDS.map((b, i) => {
          const amount = r.bands[i].amount
          const label = b.width === null ? t('band.above', { amount: naira(b.from) }) : t(i === 0 ? 'band.first' : 'band.next', { amount: naira(b.width) })
          return (
            <tr key={i} className={amount ? '' : 'zero'}>
              <th scope="row">{label}</th>
              <td className="mono">{naira(amount)}</td>
              <td className="mono">{b.rate}%</td>
              <td className="mono">{koboExact(amount * b.rate)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
