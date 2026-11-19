import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from './en.json'
import zh from './zh.json'

export type Lang = 'en' | 'zh'
export type Key = keyof typeof en
const messages: Record<Lang, Record<Key, string>> = { en, zh }

const STORE = 'payproof.lang'

function initial(): Lang {
  try {
    const saved = localStorage.getItem(STORE)
    if (saved === 'en' || saved === 'zh') return saved
  } catch { /* storage blocked: fall through */ }
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

type T = (key: Key, vars?: Record<string, string | number>) => string
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: T } | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(STORE, l) } catch { /* not saved; fine */ }
  }, [])
  useEffect(() => { document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en' }, [lang])
  const t = useCallback<T>((key, vars) => {
    let s = messages[lang][key] ?? messages.en[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
    return s
  }, [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside I18nProvider')
  return v
}
