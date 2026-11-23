import { useEffect, useState } from 'react'
import { copyEngine, loadChainEngine, type Engine } from './engine'

export type EngineState =
  | { status: 'loading'; engine: Engine }
  | { status: 'chain'; engine: Engine }
  | { status: 'error'; engine: Engine; message: string }

let ready: Engine | null = null

/** The chain engine once its circuits are read; the labelled copy until then or if X Layer cannot be reached. */
export function useEngine(): EngineState & { retry: () => void } {
  const [state, setState] = useState<EngineState>(() => (ready ? { status: 'chain', engine: ready } : { status: 'loading', engine: copyEngine }))
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (ready) return
    let live = true
    setState({ status: 'loading', engine: copyEngine })
    loadChainEngine()
      .then((e) => { ready = e; if (live) setState({ status: 'chain', engine: e }) })
      .catch((err: unknown) => { if (live) setState({ status: 'error', engine: copyEngine, message: err instanceof Error ? err.message : String(err) }) })
    return () => { live = false }
  }, [attempt])
  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
