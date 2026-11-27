// Who is signed in, as this browser remembers it. Privy holds the real session; this record only
// lets the app bar and profile show the account without loading Privy on every page (L4).
// The username lives here, on this device: Privy keeps only the email, and Payproof runs no
// account database (owner choice, 2026-11-27).
import { useEffect, useState } from 'react'

export interface Session { email: string; username: string; address?: string; at: string }

const KEY = 'payproof.session.v1'
const EVENT = 'payproof-session'
const NAMES = 'payproof.usernames.v1' // email -> username, so a returning user keeps the name on this device

function read(): Session | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return v && typeof v.email === 'string' ? v : null
  } catch { return null }
}

export function getSession(): Session | null { return read() }

export function setSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch { /* storage blocked: the bar falls back to the guest view */ }
  dispatchEvent(new Event(EVENT))
}

export function useSession(): Session | null {
  const [s, setS] = useState(read)
  useEffect(() => {
    const on = () => setS(read())
    addEventListener(EVENT, on)
    addEventListener('storage', on)
    return () => { removeEventListener(EVENT, on); removeEventListener('storage', on) }
  }, [])
  return s
}

export function rememberUsername(email: string, username: string) {
  try {
    const all = JSON.parse(localStorage.getItem(NAMES) ?? '{}')
    all[email.toLowerCase()] = username
    localStorage.setItem(NAMES, JSON.stringify(all))
  } catch { /* not kept */ }
}

export function usernameFor(email: string): string {
  try {
    const all = JSON.parse(localStorage.getItem(NAMES) ?? '{}')
    const u = all[email.toLowerCase()]
    if (typeof u === 'string' && u) return u
  } catch { /* fall through */ }
  return email.split('@')[0]
}

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,22})[a-z0-9]$/i

// Only same-app hash paths are allowed as a return address.
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/check/pay'
  return next
}

// A one-time note for the next page ("Signed in. Picking up where you left off.").
const TOAST = 'payproof.toast'
export function setToast(key: string) { try { sessionStorage.setItem(TOAST, key) } catch { /* ignore */ } }
export function takeToast(): string | null {
  try { const v = sessionStorage.getItem(TOAST); sessionStorage.removeItem(TOAST); return v } catch { return null }
}
