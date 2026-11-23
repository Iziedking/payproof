import { useI18n } from '../i18n/i18n'
import { href } from '../router'
import { ruleById, type FactStatus } from '../ruleInfo'
import { CN_BRACKETS } from '../rules/cnBonus'
import { NG_BANDS } from '../rules/ngPaye'

const yuan = (n: number) => n.toLocaleString('en-US')

export function Rule({ id }: { id: string }) {
  const { t, lang } = useI18n()
  const r = ruleById(id)
  if (!r) {
    return (
      <div className="page narrow">
        <h1 className="h2">{t('rule.missing')}</h1>
        <p className="lede">{t('rule.missingHint')}</p>
        <p><a className="btn btn-ink" href={href('/rules')}>{t('rules.title')}</a></p>
      </div>
    )
  }
  const pill = (s: FactStatus, cases?: number) =>
    s === 'tested' ? <span className="pill">{t('fact.tested', { cases: (cases ?? 0).toLocaleString('en-US') })}</span>
      : s === 'expectFail' ? <span className="pill warn">{t('fact.expectFail')}</span>
        : <span className="pill quiet">{t('fact.notRun')}</span>

  return (
    <div className="page rule-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={href('/rules')}>{t('rules.title')}</a> <span aria-hidden="true">/</span> <span aria-current="page">{t(r.title)}</span>
      </nav>
      <header className="rule-head">
        <div>
          <p className="meta">{t(r.kind)} · <span className="mono">{r.id}</span></p>
          <h1>{t(r.title)}</h1>
          <p className="other" lang={lang === 'zh' ? 'en' : 'zh-CN'}>{lang === 'zh' ? r.other.en : r.other.zh}</p>
        </div>
        {r.check && <a className="btn btn-ink" href={href('/check/pay', { rule: r.check.rule })}>{t(r.check.label)}</a>}
      </header>
      <div className="rule-grid">
        <div className="col">
          <section className="card" aria-labelledby="plain-h">
            <h2 id="plain-h">{t('rule.plain')}</h2>
            {r.plain.map((k) => <p key={k} className="body">{t(k)}</p>)}
            <p className="fine">{t(r.source)}</p>
          </section>
          {r.table !== 'split' && (
            <section className="card" aria-labelledby="table-h">
              <h2 id="table-h">{t(r.table === 'cn' ? 'rule.cn.table' : 'rule.ng.table')}</h2>
              <p className="fine">{t(r.table === 'cn' ? 'rule.cn.tableHint' : 'rule.ng.tableHint')}</p>
              <table className="rate">
                <thead><tr><th scope="col">{t(r.table === 'cn' ? 'rule.cn.colMonthly' : 'rule.ng.colBand')}</th><th scope="col">{t('band.rate')}</th>{r.table === 'cn' && <th scope="col">{t('rule.cn.colQuick')}</th>}</tr></thead>
                <tbody>
                  {r.table === 'cn'
                    ? CN_BRACKETS.map((b, i) => {
                      const prev = CN_BRACKETS[i - 1]?.monthlyLimit
                      const label = b.monthlyLimit === null ? t('rule.over', { a: yuan(prev!) }) : prev ? t('rule.fromTo', { a: yuan(prev), b: yuan(b.monthlyLimit) }) : t('rule.upTo', { a: yuan(b.monthlyLimit) })
                      return <tr key={i}><th scope="row" className="mono">{label}</th><td className="mono">{b.rate}%</td><td className="mono">{yuan(b.quickFen / 100)}</td></tr>
                    })
                    : NG_BANDS.map((b, i) => {
                      const label = b.width === null ? t('rule.over', { a: yuan(b.from) }) : i === 0 ? t('rule.upTo', { a: yuan(b.width) }) : t('rule.fromTo', { a: yuan(b.from), b: yuan(b.from + b.width) })
                      return <tr key={i}><th scope="row" className="mono">{label}</th><td className="mono">{b.rate}%</td></tr>
                    })}
                </tbody>
              </table>
            </section>
          )}
          <section className="card" aria-labelledby="how-h">
            <h2 id="how-h">{t('rule.how')}</h2>
            <p className="body small-body">{t(r.how)}</p>
            <pre className="formula">{r.formula.join('\n')}</pre>
          </section>
        </div>
        <div className="col">
          <section className="card" aria-labelledby="facts-h">
            <h2 id="facts-h">{t('rule.proved')}</h2>
            <p className="fine">{t('rule.provedHint')}</p>
            <dl className="rows facts">
              {r.facts.map((f) => <div key={f.label} className="row"><dt>{t(f.label)}</dt><dd>{pill(f.status, f.cases)}</dd></div>)}
            </dl>
          </section>
          <section className="trap trap-in" aria-labelledby="traps-h">
            <h3 id="traps-h"><i className="dot" aria-hidden="true" />{t(r.traps.title)}</h3>
            <p>{t(r.traps.body)}</p>
            {r.traps.list && <p className="mono small pre-line">{r.traps.list}</p>}
            <p className="small">{t(r.traps.after)}</p>
          </section>
          <section className="card" aria-labelledby="open-h">
            <h2 id="open-h">{t('rule.open')}</h2>
            <dl className="rows">
              {r.open.map((o) => <div key={o.label} className="row"><dt>{t(o.label)}</dt><dd className={o.warn ? 'warn' : ''}>{t(o.value)}</dd></div>)}
            </dl>
          </section>
          <details className="card details" open>
            <summary><h2>{t('res.details')}</h2></summary>
            <dl className="rows">
              {r.details.map((d) => (
                <div key={d.label} className="row"><dt>{t(d.label)}</dt><dd className={d.mono ? 'mono' : ''}>{d.key ? t(d.key, d.vars) : d.value}</dd></div>
              ))}
            </dl>
          </details>
        </div>
      </div>
    </div>
  )
}
