import { useI18n } from '../i18n/i18n'
import { href } from '../router'
import { RULES } from '../ruleInfo'

export function Rules() {
  const { t, lang } = useI18n()
  return (
    <div className="page rules-page">
      <header className="head">
        <h1>{t('rules.title')}</h1>
        <p className="lede wide">{t('rules.lede')}</p>
      </header>
      <div className="rule-list">
        {RULES.map((r) => (
          <article key={r.id} className="card rule-card" aria-labelledby={`r-${r.id}`}>
            <div className="about">
              <p className="kind">{t(r.kind)}</p>
              <h2 id={`r-${r.id}`} className="rule-title">{t(r.title)}</h2>
              <p className="other" lang={lang === 'zh' ? 'en' : 'zh-CN'}>{lang === 'zh' ? r.other.en : r.other.zh}</p>
              <p className="desc">{t(r.lede)}</p>
              <p className="mono fine">{r.id}</p>
              <div className="acts">
                {r.check ? (
                  <>
                    <a className="btn btn-ink" href={href('/check/pay', { rule: r.check.rule })}>{t(r.check.label)}</a>
                    <a className="btn btn-soft" href={href(`/rules/${r.id}`)}>{t('rules.read')}</a>
                  </>
                ) : (
                  <>
                    <a className="btn btn-ink" href={href(`/rules/${r.id}`)}>{t('rules.read')}</a>
                    <a className="btn btn-soft" href={href('/check/payout')}>{t('payout.title')}</a>
                  </>
                )}
              </div>
            </div>
            <dl className="rows status">
              {r.status.map((s) => (
                <div key={s.label} className="row"><dt>{t(s.label)}</dt><dd className={s.warn ? 'warn' : ''}>{t(s.value, s.vars)}</dd></div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      <p className="fine disclaimer">{t('rules.note')}</p>
    </div>
  )
}
