// Hash routes. Deep links on DeWEB are not verified yet (PLAN section 7), and
// a hash keeps the figures in a result link off every server.
import { useEffect, useState } from 'react'

export interface Route {
  path: string // "/check/pay"
  query: URLSearchParams
}

function read(): Route {
  const raw = location.hash.replace(/^#/, '') || '/check/pay'
  const [path, qs = ''] = raw.split('?')
  return { path: path || '/check/pay', query: new URLSearchParams(qs) }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return route
}

export function href(path: string, query?: Record<string, string>): string {
  const qs = query ? new URLSearchParams(query).toString() : ''
  return `#${path}${qs ? `?${qs}` : ''}`
}

export function go(path: string, query?: Record<string, string>) {
  location.hash = href(path, query).slice(1)
}
