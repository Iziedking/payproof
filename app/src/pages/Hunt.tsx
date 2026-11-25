// Hunt (PLAN section 12): find an input where a listed engine and its rule disagree, then submit
// it. The rule's circuit and the engine's circuit are read from X Layer, checked against their
// hashes and run here (chain/engine.ts runner), so a search costs nothing and sends nothing.
// Submitting is two transactions from the hunter's own wallet: a commitment that binds the input
// to the hunter's address, then, in a later block, the reveal, which Listings checks by running
// both circuits on chain. The salt stays on this device until the reveal.
import { useEffect, useRef, useState } from 'react'
import { bytesToHex, type Hex } from 'viem'
import { useI18n } from '../i18n/i18n'
import { href } from '../router'
import { Addr, ReadState, SimTag, StepLine, WalletBar, useRead, useSteps, useWallet } from '../live-ui'
import { CN_ANSWER } from '../chain/circuits'
import { readNetlist } from '../chain/read'
import { runner } from '../chain/engine'
import { pack } from '../../../compiler/src/layout'
import { parseAmount, fen } from '../rules/money'
import { CN_MAX_FEN } from '../rules/cnBonus'
import { ENGINE_REFS, RULE_NAMES, client, commitmentOf, readListing, tx, units } from '../chain/live'

type Out = { tax: bigint; net: bigint }
const inputHex = (bonus: number): Hex => bytesToHex(pack(CN_ANSWER.inputs, { bonus: BigInt(bonus) }, CN_ANSWER.nIn))
const SEARCH_TO = 10_000_000 // fen: the first ¥100,000.00 of bonuses, in steps of one fen

export function Hunt({ id }: { id: number }) {
  const { t } = useI18n()
  const w = useWallet()
  const { step, run } = useSteps()
  const [n, setN] = useState(0)
  const s = useRead(async () => {
    const l = await readListing(id)
    const ref = ENGINE_REFS[Number(l.engine.id)]
    if (!ref || l.ruleId !== 2n) return { l, ref: null, rule: null, eng: null }
    const [rb, eb] = await Promise.all([readNetlist(CN_ANSWER), readNetlist(ref)])
    return { l, ref, rule: runner(rb, CN_ANSWER), eng: runner(eb, ref) }
  }, [id, n])

  const [text, setText] = useState('0.17')
  const parsed = parseAmount(text, 2, CN_MAX_FEN)
  const [found, setFound] = useState<number | null>(null)
  const [scan, setScan] = useState<{ at: number; running: boolean } | null>(null)
  const stop = useRef(false)
  useEffect(() => () => { stop.current = true }, [])

  return (
    <div className="page live-page">
      <p className="crumbs"><a href={href('/engines')}>{t('nav.engines')}</a> / {t('hunt.crumb', { id })}</p>
      <ReadState s={s}>{() => {
        if (s.status !== 'ok') return null
        const { l, ref, rule, eng } = s.data
        const outs = (b: number): [Out, Out] | null => rule && eng ? [rule({ bonus: BigInt(b) }) as Out, eng({ bonus: BigInt(b) }) as Out] : null
        const bonus = parsed.kind === 'ok' ? parsed.value : null
        const pair = bonus !== null ? outs(bonus) : null
        const differs = pair && (pair[0].tax !== pair[1].tax || pair[0].net !== pair[1].net)

        const search = () => {
          if (!rule || !eng) return
          stop.current = false
          setFound(null)
          let at = 0
          const chunk = () => {
            if (stop.current) { setScan(null); return }
            const end = Math.min(at + 20_000, SEARCH_TO)
            for (; at < end; at++) {
              const [a, b] = outs(at)!
              if (a.tax !== b.tax || a.net !== b.net) { setFound(at); setText((at / 100).toFixed(2)); setScan({ at, running: false }); return }
            }
            setScan({ at, running: at < SEARCH_TO })
            if (at < SEARCH_TO) setTimeout(chunk, 0)
          }
          setScan({ at: 0, running: true })
          setTimeout(chunk, 0)
        }

        const submit = async () => {
          if (!w.address || bonus === null) return
          const input = inputHex(bonus)
          const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
          const key = `payproof.hunt.${l.id}`
          try { localStorage.setItem(key, JSON.stringify({ input, salt, hunter: w.address })) } catch { /* kept in memory only */ }
          const c = commitmentOf(l.id, input, salt, w.address)
          const ok = await run([
            { label: t('hunt.committing'), go: () => tx.commit(w.address!, c) },
            { label: t('hunt.waiting'), go: async () => {
              const committed = await client.getBlockNumber()
              while ((await client.getBlockNumber()) <= committed) await new Promise((r) => setTimeout(r, 1500))
              return tx.reveal(w.address!, l.id, input, salt)
            } },
          ])
          if (ok) { try { localStorage.removeItem(key) } catch { /* ignore */ } setN((x) => x + 1) }
        }

        return (
          <>
            <header className="head">
              <h1>{t('hunt.title', { id: l.id })} {ref && <SimTag />}</h1>
              <p className="lede wide">{t('hunt.lede')}</p>
            </header>
            <section className="card live-card">
              <dl className="rows">
                <div className="row"><dt>{t('eng.rule')}</dt><dd className="mono">{RULE_NAMES[l.ruleId.toString()]} · {t('eng.circuit', { id: 9 })}</dd></div>
                <div className="row"><dt>{t('eng.engine')}</dt><dd className="mono">{t('eng.circuit', { id: Number(l.engine.id) })}{ref ? ` · ${ref.name}` : ''}</dd></div>
                <div className="row"><dt>{t('eng.bounty')}</dt><dd className="mono">{l.status === 'disproved' ? t('eng.paidOut') : `${units(l.bounty, l.decimals)} ${l.symbol}`}</dd></div>
                <div className="row"><dt>{t('eng.lister')}</dt><dd><Addr a={l.lister} /></dd></div>
                <div className="row"><dt>{t('splits.state')}</dt><dd>{l.status === 'disproved'
                  ? <><span className="pill warn">{t('eng.disproved')}</span> {t('hunt.by')} <Addr a={l.hunter} /></>
                  : l.status === 'withdrawn' ? t('eng.withdrawn') : <span className="pill ok">{t('eng.open')}</span>}</dd></div>
              </dl>
            </section>

            {!rule || !eng ? <p className="fine">{t('hunt.unsupported')}</p> : (
              <section className="card live-card">
                <h2>{t('hunt.try')}</h2>
                <div className="fields">
                  <div className="field">
                    <div className="field-top"><label htmlFor="f-bonus">{t('check.cn.bonus')}</label></div>
                    <div className={parsed.kind === 'invalid' || parsed.kind === 'range' ? 'input bad' : 'input'}>
                      <span className="pre">¥</span>
                      <input id="f-bonus" className="mono" inputMode="decimal" value={text} onChange={(e) => { setText(e.target.value); setFound(null) }} />
                    </div>
                  </div>
                </div>
                {pair && (
                  <table className="bands">
                    <thead><tr><th scope="col"></th><th scope="col">{t('hunt.tax')}</th><th scope="col">{t('hunt.net')}</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">{t('hunt.ruleOut')}</th><td className="mono">{fen(Number(pair[0].tax))}</td><td className="mono">{fen(Number(pair[0].net))}</td></tr>
                      <tr className={differs ? '' : 'zero'}><th scope="row">{t('hunt.engOut')}</th><td className="mono">{fen(Number(pair[1].tax))}</td><td className="mono">{fen(Number(pair[1].net))}</td></tr>
                    </tbody>
                  </table>
                )}
                <p className={differs ? 'cmp cmp-more' : 'cmp cmp-match'} role="status">{differs ? t('hunt.differ') : t('hunt.same')}</p>
                <p className="acts">
                  {scan?.running
                    ? <button type="button" className="btn btn-soft" onClick={() => { stop.current = true }}>{t('hunt.stop')}</button>
                    : <button type="button" className="btn btn-soft" onClick={search}>{t('hunt.search')}</button>}
                </p>
                {scan && <p className="fine" role="status">{found !== null ? t('hunt.found', { at: fen(found) })
                  : scan.running ? t('hunt.scanning', { at: fen(scan.at) }) : t('hunt.noneFound', { to: fen(SEARCH_TO) })}</p>}
                <p className="fine">{t('hunt.local')}</p>
              </section>
            )}

            {l.status === 'open' && rule !== null && eng !== null && (
              <section className="card live-card">
                <h2>{t('hunt.submitTitle')}</h2>
                <p className="fine">{t('hunt.submitBody')}</p>
                <WalletBar w={w} />
                {w.address && <p className="acts"><button type="button" className="btn btn-ink" disabled={!differs || step.status === 'busy'} onClick={() => { void submit() }}>
                  {t('hunt.submit', { amount: units(l.bounty, l.decimals), sym: l.symbol })}</button></p>}
                <StepLine step={step} />
              </section>
            )}
          </>
        )
      }}</ReadState>
    </div>
  )
}
