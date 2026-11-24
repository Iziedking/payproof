// Shared parts of the P3 runs: pin a block, read circuits, replay with eval on chain, ask a
// fact with its mutant, and write records in the ProofRecord shape of PLAN 11.2.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { evaluate } from '../../compiler/src/netlist.ts';
import { pack, unpack, type Field } from '../../compiler/src/layout.ts';
import { toolsFromEnv, type Tools } from '../../prover/src/run.ts';
import { ask, toolsFromList, verdict, type Question, type ToolName } from '../../prover/src/fact.ts';
import { CIRCUITS, latestBlock, readCircuit, rpcAt, type ChainCircuit, type Rpc } from '../../prover/src/chain.ts';

export type Piece = { name: string; keccak256: string; nIn: number; nOut: number; inputs: Field[]; outputs: Field[] };
export type Statement = { en: string; zh: string };

export function pieceOf(name: string): { piece: Piece; id: string } {
  for (const dir of ['chain/netlists', 'chain/netlists/explain']) {
    const m = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));
    const ids = JSON.parse(readFileSync(`${dir}/ids.json`, 'utf8'));
    const p = m.pieces.find((x: Piece) => x.name === name);
    if (p && ids[name]) return { piece: p, id: ids[name] };
  }
  throw new Error(`no tape-out record for ${name}`);
}

export async function setup(ruleId: string, rpcUrl: string, timeoutArg: string, outDir: string) {
  if (!rpcUrl || !timeoutArg || !outDir) throw new Error('usage: <rpc> <timeout-seconds> <out-dir>');
  mkdirSync(outDir, { recursive: true });
  const tools = toolsFromEnv();
  const rpc = rpcAt(rpcUrl);
  const ranOn = process.env.PAYPROOF_HOST || execFileSync('hostname', { encoding: 'utf8' }).trim();
  const toolVersion = execFileSync(tools.yosys, ['-V'], { encoding: 'utf8' }).trim();
  const block = await latestBlock(rpc);
  console.log(`pinned block ${block}; ${toolVersion}; ran on ${ranOn}`);
  return new Run(ruleId, tools, rpc, Number(timeoutArg), outDir, block, ranOn, toolVersion);
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// Launcher options. PAYPROOF_TOOLS (comma list of abc-iprove, yosys-sat, smt-bitwuzla) asks those
// tools, for each fact and its mutant; unset, a fact goes to ABC and Yosys sat and its mutant to
// ABC, as in the first P3 runs. PAYPROOF_FACTS (comma list of fact ids) runs only those facts and
// no trap search.
export const CHOSEN: ToolName[] | null = toolsFromList(process.env.PAYPROOF_TOOLS);
export const ONLY: string[] | null = process.env.PAYPROOF_FACTS ? process.env.PAYPROOF_FACTS.split(',').map((f) => f.trim()) : null;
export function toolList(yosysPath: string, toolVersion: string, bitwuzla?: string) {
  const out = [{ name: 'yosys', version: toolVersion }, { name: 'yosys-abc', version: 'bundled with the same OSS CAD Suite 2026-10-29' }];
  if (CHOSEN?.includes('smt-bitwuzla') && bitwuzla) {
    out.push({ name: 'bitwuzla', version: execFileSync(bitwuzla, ['--version'], { encoding: 'utf8' }).trim() + ' (OSS CAD Suite 2026-10-29)' });
  }
  return out;
}
const answersOut = (q: Question) => q.answers.map((a) => ({ tool: a.tool, status: a.status, seconds: +a.seconds.toFixed(2),
  x: a.x === null ? null : a.x.toString(), command: a.command, tail: a.tail }));

export class Run {
  records: unknown[] = [];
  started = new Date().toISOString();
  ruleId: string; tools: Tools; rpc: Rpc; timeout: number; outDir: string; block: number; ranOn: string; toolVersion: string;
  constructor(ruleId: string, tools: Tools, rpc: Rpc, timeout: number, outDir: string, block: number, ranOn: string, toolVersion: string) {
    this.ruleId = ruleId; this.tools = tools; this.rpc = rpc; this.timeout = timeout;
    this.outDir = outDir; this.block = block; this.ranOn = ranOn; this.toolVersion = toolVersion;
  }

  /** Read a taped-out circuit at the pinned block, check its hash, and give its simulator. */
  async circuit(name: string) {
    const { piece, id } = pieceOf(name);
    const c = await readCircuit(this.rpc, BigInt(id), this.block, piece.keccak256);
    console.log(`circuit ${c.ref.id} (${name}): keccak ${c.ref.netlistKeccak}, ${c.ref.gateCount} gates, nIn ${c.ref.nIn}, nOut ${c.ref.nOut}`);
    const sim = (v: Record<string, bigint>) =>
      unpack(piece.outputs, evaluate(c.bytes, c.ref.nIn, c.ref.nOut, pack(piece.inputs, v, c.ref.nIn), c.refs));
    return { c, piece, sim };
  }

  /** eval(uint256 id, bytes inputs), selector 0x934d06ea, at the pinned block. */
  async onChain(c: ChainCircuit, piece: Piece, v: Record<string, bigint>) {
    const input = pack(piece.inputs, v, c.ref.nIn);
    const hex = Array.from(input, (b) => b.toString(16).padStart(2, '0')).join('');
    const data = '0x934d06ea' + BigInt(c.ref.id).toString(16).padStart(64, '0') + (64n).toString(16).padStart(64, '0') +
      input.length.toString(16).padStart(64, '0') + hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
    const ret = (await this.rpc('eth_call', [{ to: CIRCUITS, data }, '0x' + this.block.toString(16)])).replace(/^0x/, '');
    const off = Number(BigInt('0x' + ret.slice(0, 64))) * 2;
    const len = Number(BigInt('0x' + ret.slice(off, off + 64)));
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = parseInt(ret.slice(off + 64 + 2 * i, off + 66 + 2 * i), 16);
    return unpack(piece.outputs, out);
  }

  record(factId: string, statement: Statement, cs: ChainCircuit[], domain: string, status: string, extra: Record<string, unknown>) {
    const r = { kind: 'fact', ruleId: this.ruleId, factId, statement, circuits: cs.flatMap((c) => c.read),
      blockNumber: this.block, domain, status, ...extra,
      tools: toolList(this.tools.yosys, this.toolVersion, this.tools.bitwuzla), ...(ONLY ? { selectedFacts: ONLY } : {}),
      timeoutSeconds: this.timeout, ranOn: this.ranOn, ranAt: new Date().toISOString() };
    this.records.push(r);
    writeFileSync(join(this.outDir, `${factId}.json`), JSON.stringify(r, null, 2) + '\n');
    return r;
  }

  /**
   * One fact: ask both tools, replay any counterexample (`replay` must return true when x really
   * breaks the fact in the simulator and with eval on chain), then ask the mutant, which must fail.
   * A fact that fails on the rule itself has no mutant (`mutant` null): the rule is its own break.
   */
  async fact(o: { id: string; statement: Statement; domain: string; circuitV: string; width: number;
    question: string; replay: (x: bigint) => Promise<Record<string, unknown> | null>;
    mutant: { note: string; question: string } | null; cs: ChainCircuit[]; extra?: Record<string, unknown> }) {
    if (ONLY && !ONLY.includes(o.id)) { console.log(`${o.id}: skipped (PAYPROOF_FACTS)`); return null; }
    writeFileSync(join(this.outDir, `${o.id}.q.v`), o.question);
    const r = ask(this.tools, o.circuitV, o.question, o.width, this.timeout, CHOSEN ?? true);
    const v = verdict(r);
    let counterexample: Record<string, unknown> | null = null;
    if (v === 'fails') {
      const x = r.answers.find((a) => a.x !== null)?.x;
      if (x === undefined || x === null) throw new Error(`${o.id}: fails without a readable input`);
      counterexample = await o.replay(x);
      if (!counterexample) throw new Error(`${o.id}: counterexample x = ${x} does not replay in the simulator and on chain`);
    }
    let mutant: Record<string, unknown> | null = null;
    if (o.mutant) {
      writeFileSync(join(this.outDir, `${o.id}.mutant.q.v`), o.mutant.question);
      const m = ask(this.tools, o.circuitV, o.mutant.question, o.width, this.timeout, CHOSEN ?? false);
      const mv = verdict(m);
      if (mv !== 'fails') throw new Error(`${o.id}: the mutant did not fail (${mv}), so the question cannot tell a broken rule`);
      mutant = { note: o.mutant.note, questionSha256: sha(o.mutant.question), aigSha256: m.aigSha256, smt2Sha256: m.smt2Sha256, status: mv, answers: answersOut(m) };
    }
    console.log(`${o.id}: ${v} (${r.answers.map((a) => `${a.tool} ${a.status} ${a.seconds.toFixed(1)}s`).join(', ')})` +
      (mutant ? '; mutant fails' : '; no mutant (fails on the rule itself)'));
    return this.record(o.id, o.statement, o.cs, o.domain, v, { questionSha256: sha(o.question), aigSha256: r.aigSha256, smt2Sha256: r.smt2Sha256,
      answers: answersOut(r), counterexample, mutant, ...(o.extra ?? {}) });
  }

  finish() {
    writeFileSync(join(this.outDir, 'records.json'), JSON.stringify({ started: this.started, finished: new Date().toISOString(),
      block: this.block, records: this.records }, null, 2) + '\n');
  }
}
