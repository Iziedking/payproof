// Reads netlist bytes from the circuits contract on X Layer and checks their hash.
// Only the circuit id goes to the RPC; a person's figures never do (they are run
// in the browser, engine.ts). A netlist whose keccak-256 differs from the one the
// app expects is refused, so a wrong or altered reply cannot change an answer.
// @ts-ignore: plain JS module, vendored unchanged (vendor/tapekit)
import { keccakHex } from '../../../vendor/tapekit/keccak.js'
import { CIRCUITS_ADDRESS, RPCS, type CircuitRef } from './circuits'

const NETLIST = '0x3fc4be56' // netlist(uint256), docs/evidence/p0/selectors.txt
const TIMEOUT_MS = 20_000

export class ReadError extends Error {}

async function rpc(method: string, params: unknown[], fetchImpl: typeof fetch = fetch): Promise<string> {
  let last: unknown = null
  for (const url of RPCS) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
    try {
      const r = await fetchImpl(url, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      const j = await r.json()
      if (j.error) throw new ReadError(`${method}: ${j.error.message ?? JSON.stringify(j.error)}`)
      if (typeof j.result !== 'string') throw new ReadError(`${method}: no result`)
      return j.result
    } catch (e) {
      last = e // try the next RPC
    } finally {
      clearTimeout(timer)
    }
  }
  throw last instanceof Error ? last : new ReadError(String(last))
}

const hexToBytes = (h: string) => {
  const s = h.replace(/^0x/, '')
  const out = new Uint8Array(s.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(2 * i, 2 * i + 2), 16)
  return out
}
const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

/** ABI `bytes` return value to bytes. */
export function decodeBytes(ret: string): Uint8Array {
  const h = ret.replace(/^0x/, '')
  const off = Number(BigInt('0x' + h.slice(0, 64))) * 2
  const len = Number(BigInt('0x' + h.slice(off, off + 64)))
  return hexToBytes(h.slice(off + 64, off + 64 + len * 2))
}

export const keccak = (b: Uint8Array): string => keccakHex(b)

function cached(ref: CircuitRef): Uint8Array | null {
  try {
    const h = localStorage.getItem(`payproof.netlist.${ref.keccak}`)
    if (!h) return null
    const b = hexToBytes(h)
    return keccak(b) === ref.keccak ? b : null
  } catch {
    return null
  }
}

/** The circuit's netlist bytes, read from X Layer (or a hash-checked local copy of an earlier read). */
export async function readNetlist(ref: CircuitRef, fetchImpl?: typeof fetch): Promise<Uint8Array> {
  const c = cached(ref)
  if (c) return c
  const data = NETLIST + BigInt(ref.id).toString(16).padStart(64, '0')
  const bytes = decodeBytes(await rpc('eth_call', [{ to: CIRCUITS_ADDRESS, data }, 'latest'], fetchImpl))
  const got = keccak(bytes)
  if (got !== ref.keccak) throw new ReadError(`circuit ${ref.id}: hash ${got} is not the expected ${ref.keccak}`)
  try { localStorage.setItem(`payproof.netlist.${ref.keccak}`, bytesToHex(bytes)) } catch { /* not cached; fine */ }
  return bytes
}

export async function blockNumber(fetchImpl?: typeof fetch): Promise<number> {
  return Number(BigInt(await rpc('eth_blockNumber', [], fetchImpl)))
}
