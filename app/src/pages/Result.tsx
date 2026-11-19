import { useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { href } from '../router'
import { Breakdown, CompareLine, TrapCard } from '../components'
import { RULE_ID, formFromQuery, viewCn, viewNg } from '../check'
import { isSaved, save } from '../saved'

export function Result({ query }: { query: URLSearchParams }) {
  const { t, lang } = useI18n()
  const form = formFromQuery(query)
  const view = form ? (form.rule === 'cn' ? viewCn(form.cn) : viewNg(form.ng)) : null
  const [copied, setCopied] = useState(false)
  const [savedNow, setSavedNow] = useState(false)

  if (!form || !view) {
    return (
      <div className="page narrow">
        <h1 className="h2">{t('res.bad')}</h1>
        <p className="lede">{t('res.badHint')}</p>
        <p><a className="btn btn-ink" href={href('/check/pay')}>{t('act.back')}</a></p>
      </div>
    )
  }

  const q = new URLSearchParams(view.link).toString()
  const at = query.get('at')
  const when = at && !Number.isNaN(Date.parse(`${at}Z`))
    ? new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(`${at}Z`))
    : '—'
  const ruleName = t(view.rule === 'cn' ? 'check.cn.name' : 'check.ng.name')
  const done = savedNow || isSaved(q)

  const copy = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ }
  }

  return (
    <div className="page result">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={href('/check/pay', view.link)}>{t('check.title')}</a> <span aria-hidden="true">/</span> <span aria-current="page">{t('res.crumb')}</span>
      </nav>
      <header className="res-head">
        <div>
          <p className="meta">{t('res.checked', { rule: ruleName, when })}</p>
          <h1>{t('ans.youKeep')} <span className="mono-num">{view.keep}</span></h1>
          <p className="s">{t(view.ofKey, { amount: view.ofAmount })}</p>
        </div>
        <div className="acts">
          <button type="button" className="btn btn-soft" onClick={copy}>{copied ? t('act.copied') : t('act.copy')}</button>
          <button type="button" className="btn btn-ink" disabled={done}
            onClick={() => setSavedNow(save({ at: new Date().toISOString(), rule: view.rule, query: q, keep: view.keep }))}>
            {done ? t('act.saved') : t('act.saveLong')}
          </button>
        </div>
      </header>
      <div className="res-grid">
        <section className="card" aria-labelledby="how-h">
          <h2 id="how-h">{t('res.how')}</h2>
          <Breakdown view={view} />
          <CompareLine view={view} />
        </section>
        <div className="res-side">
          <TrapCard trap={view.trap} rule={view.rule} />
          <section className="card" aria-labelledby="det-h">
            <h2 id="det-h">{t('res.details')}</h2>
            <dl className="rows">
              <div className="row"><dt>{t('res.ruleId')}</dt><dd className="mono">{RULE_ID[view.rule]}</dd></div>
              <div className="row"><dt>{t('res.source')}</dt><dd>{t(view.rule === 'cn' ? 'res.cnSource' : 'res.ngSource')}</dd></div>
              <div className="row"><dt>{t('res.circuit')}</dt><dd>{t('res.notOnChain')}</dd></div>
              <div className="row"><dt>{t('res.hash')}</dt><dd>{t('res.noneYet')}</dd></div>
              <div className="row"><dt>{t('res.computed')}</dt><dd>{t('res.inBrowser')}</dd></div>
            </dl>
          </section>
        </div>
      </div>
      <p className="fine disclaimer">{t('res.disclaimer')}</p>
    </div>
  )
}
