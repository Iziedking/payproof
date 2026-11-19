// Parsing and formatting of money typed by people. Integers only inside.

export type Parsed =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'range' }
  | { kind: 'ok'; value: number }

// Accepts "36001", "36,001.5", "36 001.00". `decimals` is 2 for yuan (value
// in fen) and 0 for naira (value in whole naira). Returns the minor-unit integer.
export function parseAmount(text: string, decimals: 0 | 2, max: number): Parsed {
  const s = text.replace(/[\s,，_]/g, '')
  if (s === '') return { kind: 'empty' }
  const re = decimals === 2 ? /^(\d{1,12})(?:\.(\d{0,2}))?$/ : /^(\d{1,12})$/
  const m = re.exec(s)
  if (!m) return { kind: 'invalid' }
  const whole = Number(m[1])
  const frac = decimals === 2 ? Number((m[2] ?? '').padEnd(2, '0')) : 0
  const value = decimals === 2 ? whole * 100 + frac : whole
  if (!Number.isSafeInteger(value) || value > max) return { kind: 'range' }
  return { kind: 'ok', value }
}

const group = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export function fen(f: number): string {
  const sign = f < 0 ? '-' : ''
  const a = Math.abs(f)
  return `${sign}¥${group(Math.floor(a / 100))}.${String(a % 100).padStart(2, '0')}`
}

export function naira(n: number): string {
  return `${n < 0 ? '-' : ''}₦${group(Math.abs(n))}`
}

// Plain number for an input box or a link: 3600100 -> "36001.00"
export function fenPlain(f: number): string {
  return `${Math.floor(f / 100)}.${String(f % 100).padStart(2, '0')}`
}
