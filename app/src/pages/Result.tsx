import { useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { href } from '../router'
import { BandTable, Breakdown, CompareLine, MismatchCard, SourceTag, TrapCard } from '../components'
import { RULE_ID, formFromQuery, viewCn, viewNg } from '../check'
import { isSaved, save } from '../saved'
import { useEngine } from '../chain/useEngine'
import { CN_ANSWER, CN_WORKING, NG_ANSWER, NG_WORKING } from '../chain/circuits'
import { naira } from '../rules/money'

export function Result({ query }: { query: URLSearchParams }) {
  const { t, lang } = useI18n()
  const eng = useEngine()
  const form = formFromQuery(query)
  const view = form ? (form.rule === 'cn' ? viewCn(form.cn, eng.engine) : viewNg(form.ng, eng.engine)) : null
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
  const onChain = view.source === 'chain'
  const [answer, working] = view.rule === 'cn' ? [CN_ANSWER, CN_WORKING] : [NG_ANSWER, NG_WORKING]
  const r = view.ng

  const copy = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ }
  }

  return (
    <div className="page result">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={href('/check/pay', view.link)}>{t('check.title')}</a> <span aria-hidden="true">/</span> <span aria-current="page">{t('res.crumb')}</span>
      </nav>
      <header className="res-head stacked">
        <div>
          <p className="meta">{t('res.checked', { rule: ruleName, when })}</p>
          {r ? (
            <>
              <h1>{t('res.ngYear')} <span className="mono-num">{naira(r.annualTax)}</span></h1>
              <p className="s">{t('res.ngMonth', { amount: naira(r.monthlyTax) })}</p>
            </>
          ) : (
            <>
              <h1>{t('ans.youKeep')} <span className="mono-num">{view.keep}</span></h1>
              <p className="s">{t(view.ofKey, { amount: view.ofAmount })}</p>
            </>
          )}
          <p className="src-line"><SourceTag eng={eng} /> {onChain && <a className="quiet small" href={href(`/rules/${RULE_ID[view.rule]}`)}>{t('src.how')}</a>}</p>
        </div>
        <div className="acts">
          <button type="button" className="btn btn-soft" onClick={copy}>{copied ? t('act.copied') : t('act.copy')}</button>
          <button type="button" className="btn btn-ink" disabled={done}
            onClick={() => setSavedNow(save({ at: new Date().toISOString(), rule: view.rule, query: q, keep: view.keep }))}>
            {done ? t('act.saved') : t('act.saveLong')}
          </button>
        </div>
      </header>
      {view.mismatch && <MismatchCard />}
      <div className="res-grid">
        <section className="card" aria-labelledby="how-h">
          <h2 id="how-h">{t('res.how')}</h2>
          {r ? (
            <>
              <dl className="rows">
                <div className="row"><dt>{t('ng.grossYear')}</dt><dd className="mono">{naira(r.input.gross)}</dd></div>
                {r.input.rent > 0 && <div className="row"><dt>{t('ng.rentPaid')}</dt><dd className="mono">{naira(r.input.rent)}</dd></div>}
                <div className="row"><dt>{t('ng.reliefRule')}</dt><dd className="mono">{naira(r.relief)}</dd></div>
                <div className="row"><dt>{t('ng.others')}</dt><dd className="mono">{naira(r.deductions - r.relief)}</dd></div>
                <div className="row strong"><dt>{t('ng.chargeable')}</dt><dd className="mono">{naira(r.chargeable)}</dd></div>
                {r.exempt && <div className="row"><dt>{t('ng.exempt')}</dt><dd>{t('ng.exemptYes')}</dd></div>}
              </dl>
              <BandTable r={r} />
              <dl className="rows">
                <div className="row strong"><dt>{t('ng.annual')}</dt><dd className="mono">{naira(r.annualTax)}</dd></div>
                <div className="row strong"><dt>{t('ng.monthly')}</dt><dd className="mono">{naira(r.monthlyTax)}</dd></div>
              </dl>
            </>
          ) : <Breakdown view={view} />}
          <p className="fine">{t(onChain ? (r ? 'res.workNgChain' : 'res.workCnChain') : eng.status === 'loading' ? 'res.workLoading' : 'res.workCopy')}</p>
        </section>
        <div className="res-side">
          <CompareLine view={view} />
          <TrapCard trap={view.trap} rule={view.rule} />
          <section className="card" aria-labelledby="det-h">
            <h2 id="det-h">{t('res.details')}</h2>
            <dl className="rows">
              <div className="row"><dt>{t('res.ruleId')}</dt><dd className="mono">{RULE_ID[view.rule]}</dd></div>
              <div className="row"><dt>{t('res.source')}</dt><dd>{t(view.rule === 'cn' ? 'res.cnSource' : 'res.ngSource')}</dd></div>
              <div className="row"><dt>{t('res.answer')}</dt><dd className="mono">{t('rule.circuitN', { id: answer.id })}</dd></div>
              <div className="row"><dt>{t('res.working')}</dt><dd className="mono">{t('rule.circuitN', { id: working.id })}</dd></div>
              <div className="row"><dt>{t('res.run')}</dt><dd>{t(onChain ? 'res.runBrowser' : 'res.runCopy')}</dd></div>
              {onChain && eng.engine.block !== undefined && <div className="row"><dt>{t('res.block')}</dt><dd className="mono">{eng.engine.block.toLocaleString('en-US')}</dd></div>}
              <div className="row"><dt>{t('res.sent')}</dt><dd>{t('res.sentNone')}</dd></div>
            </dl>
          </section>
          {r && (
            <section className="card" aria-labelledby="read-h">
              <h2 id="read-h">{t('res.reading')}</h2>
              <p className="fine">{t('res.ngReading')}</p>
            </section>
          )}
        </div>
      </div>
      <p className="fine disclaimer">{t('res.disclaimer')}</p>
    </div>
  )
}
