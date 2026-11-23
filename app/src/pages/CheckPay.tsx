import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useI18n, type Key } from '../i18n/i18n'
import { href } from '../router'
import { Breakdown, Chart, CompareLine, MismatchCard, SourceTag, TrapCard } from '../components'
import { useEngine, type EngineState } from '../chain/useEngine'
import {
  CN_LIMITS, NG_LIMITS, emptyCn, emptyNg, formFromQuery, parseCn, parseNg, viewCn, viewNg,
  type CnForm, type NgForm, type RuleKey, type CheckView,
} from '../check'
import { fen, naira, type Parsed } from '../rules/money'
import { isSaved, save } from '../saved'

const STORE = 'payproof.lastRule'
function firstRule(q: URLSearchParams): RuleKey {
  const r = q.get('rule')
  if (r === 'cn' || r === 'ng') return r
  try { const s = localStorage.getItem(STORE); if (s === 'cn' || s === 'ng') return s } catch { /* ignore */ }
  return 'cn'
}

export function CheckPay({ query }: { query: URLSearchParams }) {
  const { t, lang } = useI18n()
  const start = formFromQuery(query)
  const [rule, setRuleState] = useState<RuleKey>(() => start?.rule ?? firstRule(query))
  const [cn, setCn] = useState<CnForm>(start?.cn ?? emptyCn())
  const [ng, setNg] = useState<NgForm>(start?.ng ?? emptyNg())
  const [showMore, setShowMore] = useState(() => !!start && start.rule === 'ng' && ['pension', 'nhf', 'nhis', 'life', 'mortgage', 'rent'].some((k) => start.ng[k as keyof NgForm]))
  const answerRef = useRef<HTMLElement>(null)
  const setRule = (r: RuleKey) => { setRuleState(r); try { localStorage.setItem(STORE, r) } catch { /* ignore */ } }

  const eng = useEngine()
  const view = useMemo(() => (rule === 'cn' ? viewCn(cn, eng.engine) : viewNg(ng, eng.engine)), [rule, cn, ng, eng.engine])
  const cnErr = parseCn(cn)
  const ngErr = parseNg(ng)
  const limits = rule === 'cn' ? CN_LIMITS : NG_LIMITS

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    answerRef.current?.focus()
    answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="page check">
      <div className="form-col">
        <header className="head">
          <h1>{t('check.title')}</h1>
          <p className="lede">{t('check.lede')}</p>
        </header>

        <fieldset className="rules">
          <legend>{t('check.rule')}</legend>
          {(['cn', 'ng'] as const).map((r) => (
            <label key={r} className={rule === r ? 'rule on' : 'rule'}>
              <input type="radio" name="rule" value={r} checked={rule === r} onChange={() => setRule(r)} />
              <span className="rule-name">{t(r === 'cn' ? 'check.cn.name' : 'check.ng.name')}</span>
              <span className="rule-short">{t(r === 'cn' ? 'check.cn.short' : 'check.ng.short')}</span>
              <span className="mono rule-id">{r === 'cn' ? 'cn-bonus-2023-30' : 'ng-paye-nta2025'}</span>
            </label>
          ))}
        </fieldset>

        <form className="fields" onSubmit={onSubmit} noValidate>
          {rule === 'cn' ? (
            <>
              <Money id="bonus" label="check.cn.bonus" hint="check.required" prefix="¥" value={cn.bonus} parsed={cnErr.bonus}
                onChange={(v) => setCn({ ...cn, bonus: v })} example="36,001.00" limits={CN_LIMITS} decimals />
              <Money id="paid" label="check.cn.paid" hint="check.optional" prefix="¥" value={cn.paid} parsed={cnErr.paid}
                onChange={(v) => setCn({ ...cn, paid: v })} example="3,390.10" limits={CN_LIMITS} decimals />
            </>
          ) : (
            <>
              <Money id="gross" label="check.ng.gross" hint="check.required" prefix="₦" value={ng.gross} parsed={ngErr.gross}
                onChange={(v) => setNg({ ...ng, gross: v })} example="6,000,000" limits={NG_LIMITS} />
              <Money id="paid" label="check.ng.paid" hint="check.optional" prefix="₦" value={ng.paid} parsed={ngErr.paid}
                onChange={(v) => setNg({ ...ng, paid: v })} example="38,000" limits={NG_LIMITS} />
              <div className="more">
                <button type="button" className="link-btn" aria-expanded={showMore} aria-controls="more-fields" onClick={() => setShowMore(!showMore)}>
                  {t('check.ng.more')} <span className="fine">{t('check.ng.moreHint')}</span>
                </button>
                {showMore && (
                  <div id="more-fields" className="more-grid">
                    {(['pension', 'nhf', 'nhis', 'life', 'mortgage', 'rent'] as const).map((k) => (
                      <Money key={k} id={k} label={`check.ng.${k}` as Key} prefix="₦" value={ng[k]} parsed={ngErr[k]}
                        onChange={(v) => setNg({ ...ng, [k]: v })} example="0" limits={NG_LIMITS} small />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          <div className="go">
            <button type="submit" className="btn btn-ink">{t('check.button')}</button>
            <span className="mono fine">{t('check.range', limits)}</span>
          </div>
        </form>

        <p className="privacy">
          {t('check.privacy')}{lang === 'zh' ? '' : ' '}{t(rule === 'cn' ? 'check.cn.reading' : 'check.ng.reading')}
        </p>
      </div>

      <section className="answer" ref={answerRef} tabIndex={-1} aria-live="polite" aria-labelledby="ans-h">
        <Answer view={view} eng={eng} />
      </section>
    </div>
  )
}

function Answer({ view, eng }: { view: CheckView | null; eng: EngineState & { retry: () => void } }) {
  const { t } = useI18n()
  const [saved, setSaved] = useState<string | null>(null)
  const top = (
    <div className="ans-top">
      <h2 id="ans-h">{t('ans.title')}</h2>
      <SourceTag eng={eng} />
    </div>
  )
  if (!view) return <>{top}<p className="empty">{t('ans.empty')}</p></>
  const q = new URLSearchParams(view.link).toString()
  const money = view.rule === 'cn' ? fen : naira
  const done = saved === q || isSaved(q)
  const onSave = () => {
    const ok = save({ at: new Date().toISOString(), rule: view.rule, query: q, keep: view.keep })
    if (ok) setSaved(q)
  }
  return (
    <>
      {top}
      <div className="big">
        <span className="k">{t('ans.youKeep')}</span>
        <output className="mono v">{view.keep}</output>
        <span className="s">{t(view.ofKey, { amount: view.ofAmount })}</span>
      </div>
      {view.mismatch && <MismatchCard />}
      <Breakdown view={view} />
      <CompareLine view={view} />
      <TrapCard trap={view.trap} rule={view.rule} />
      {view.chart && <Chart chart={view.chart} money={money} />}
      <div className="acts">
        <a className="btn btn-ink" href={href('/result', { ...view.link, at: new Date().toISOString().slice(0, 16) })}>{t('act.open')}</a>
        <button type="button" className="btn btn-soft" onClick={onSave} disabled={done}>{done ? t('act.saved') : t('act.save')}</button>
      </div>
    </>
  )
}

interface MoneyProps {
  id: string; label: Key; hint?: Key; prefix: string; value: string; parsed: Parsed
  onChange: (v: string) => void; example: string; limits: { min: string; max: string }; decimals?: boolean; small?: boolean
}

function Money({ id, label, hint, prefix, value, parsed, onChange, example, limits, decimals, small }: MoneyProps) {
  const { t } = useI18n()
  const err = parsed.kind === 'invalid' ? t('err.invalid', { example }) : parsed.kind === 'range' ? t('err.range', limits) : null
  return (
    <div className={small ? 'field small' : 'field'}>
      <div className="field-top">
        <label htmlFor={`f-${id}`}>{t(label)}</label>
        {hint && <span className="fine">{t(hint)}</span>}
      </div>
      <div className={err ? 'input bad' : 'input'}>
        <span className="mono pre" aria-hidden="true">{prefix}</span>
        <input id={`f-${id}`} className="mono" inputMode={decimals ? 'decimal' : 'numeric'} autoComplete="off" spellCheck={false}
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={example}
          aria-invalid={!!err} aria-describedby={err ? `e-${id}` : undefined} />
      </div>
      {err && <p id={`e-${id}`} className="err">{err}</p>}
    </div>
  )
}

