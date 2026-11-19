// Saved checks live in this browser only (PLAN: no pay data on any server).
const KEY = 'payproof.saved.v1'

export interface Saved { at: string; rule: string; query: string; keep: string }

export function listSaved(): Saved[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

export function isSaved(query: string): boolean {
  return listSaved().some((s) => s.query === query)
}

// Returns false when storage is blocked, so the page can say it was not saved.
export function save(entry: Saved): boolean {
  try {
    const all = listSaved().filter((s) => s.query !== entry.query)
    all.unshift(entry)
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, 50)))
    return true
  } catch { return false }
}
