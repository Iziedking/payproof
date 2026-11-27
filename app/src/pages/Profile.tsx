import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n/i18n'
import { href } from '../router'
import type { Session } from '../auth/session'
import { listSaved } from '../saved'

export function Profile({ session, showSaved }: { session: Session; showSaved: boolean }) {
  const { t, lang } = useI18n()
  const saved = listSaved()
  const savedRef = useRef<HTMLElement>(null)
  useEffect(() => { if (showSaved) savedRef.current?.scrollIntoView({ block: 'start' }) }, [showSaved])
  const when = (iso: string) => new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  const ruleName = (r: string) => t(r === 'cn' ? 'check.cn.name' : 'check.ng.name')
  return (
    <div className="page profile">
      <header className="prof-head">
        <span className="avatar big" aria-hidden="true">{session.username.slice(0, 1).toUpperCase()}</span>
        <div>
          <h1>{session.username}</h1>
          <p className="lede">{session.email}</p>
        </div>
      </header>
      <section className="card" ref={savedRef} aria-labelledby="saved-h">
        <h2 id="saved-h">{t('acct.saved')}</h2>
        {saved.length === 0 ? (
          <p className="fine">{t('acct.noSaved')} <a href={href('/check/pay')}>{t('check.title')}</a></p>
        ) : (
          <ul className="saved-list">
            {saved.map((s) => (
              <li key={s.query}>
                <a href={href('/result', Object.fromEntries(new URLSearchParams(s.query)))}>
                  <span>{ruleName(s.rule)}<span className="fine"> · {when(s.at)}</span></span>
                  <span className="mono">{s.keep}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="fine">{t('acct.savedNote')}</p>
      </section>
      {session.address && (
        <section className="card" aria-labelledby="addr-h">
          <h2 id="addr-h">{t('acct.address')}</h2>
          <p className="mono small addr">{session.address}</p>
        </section>
      )}
      <p><a className="btn btn-soft" href={href('/sign-out')}>{t('acct.signOut')}</a></p>
    </div>
  )
}
