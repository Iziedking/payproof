// The Payproof contracts on X Layer (P4) and the reads and writes the split, payout, engine and
// hunt pages make. Addresses and transactions are in docs/evidence/p4/mainnet-round.md; the code at
// each address was compared with the build of contracts/src. Reads go to the public RPCs; nothing
// a person types is sent anywhere except the address they ask about and, when they choose to send
// a transaction, the transaction itself from their own wallet.
//
// viem 2.57.17 (VERSIONS.md): createPublicClient, createWalletClient, custom, fallback, http,
// parseAbi, encodeAbiParameters, keccak256.
import {
  createPublicClient, createWalletClient, custom, encodeAbiParameters, fallback, http, keccak256, parseAbi,
  type Address, type Hex,
} from 'viem'
import { CN_ANSWER, RPCS, type CircuitRef } from './circuits'
import { xLayer } from './xlayer'

export const VAULT: Address = '0x19cc6ED93704f8ab4D4FdDB6A98D3D5ceff786AA'
export const LISTINGS: Address = '0x62B12CC1CE0D2495575087A1BAdE578fbC33a8C0'
export const REGISTRY: Address = '0xBc7187E1C31841396962f8498dEaa513df28cC50'
export const SHARE_TOKEN: Address = '0x7845A53c8E5E5352576FbBB821351260B56cFC2c'
export const USDT0: Address = '0x779Ded0c9e1022225f8E0630b35a9b54bE713736'
export const FEE_CIRCUIT = 17
export const SPLIT_REFS = [3, 4, 5, 6, 7]
export const EXPLORER = 'https://www.oklink.com/xlayer'

/** split-v1 (rules/split-v1): holders share 85% of the pot, rounded down for each holder. */
export const HOLDER_BPS = 8500n
export const rulePayout = (pot: bigint, shares: bigint, total: bigint): bigint =>
  total === 0n ? 0n : (pot * HOLDER_BPS * shares) / (total * 10000n)

// SIMULATED vendor engines (rules/sim-engines), taped out in P3; same layout as the rule (circuit 9).
export const ENGINE_REFS: Record<number, CircuitRef & { name: string }> = {
  15: { ...CN_ANSWER, id: 15, keccak: '0xef19f8b6110fd22db6294adf1ea0e00f14c1498007b5ca0251b1ecf01b7ba9d1', gates: 3642, name: 'cn_vendor_a2' },
  16: { ...CN_ANSWER, id: 16, keccak: '0x2b8f72f8812b54103cd373b262de69f498c99a54498025848296c015420bb9f3', gates: 3787, name: 'cn_vendor_b' },
}
export const RULE_NAMES: Record<string, string> = { '1': 'split-v1', '2': 'cn-bonus-2023-30', '3': 'ng-paye-nta2025' }

const vaultAbi = parseAbi([
  'function splitCount() view returns (uint256)',
  'function split(uint256) view returns ((uint256 ruleId, address operator, address shareToken, address payToken, uint256 unit, uint64 claimWindow, uint256 carry, uint256 roundCount))',
  'function round(uint256, uint256) view returns ((uint32 pot, uint32 fee, uint32 protocolFee, uint32 totalShares, uint64 snapshotBlock, uint64 deadline, uint256 claimed, bool rolledOver))',
  'function hasClaimed(uint256, uint256, address) view returns (bool)',
  'function createSplit(uint256 ruleId, (address cpu, uint64 id) fee, (address cpu, uint64 id)[] refTargets, address shareToken, address payToken, uint64 claimWindow) returns (uint256)',
  'function openRound(uint256 splitId, uint32 deposit) returns (uint256)',
  'function claim(uint256 splitId, uint256 roundId, uint32 payout)',
  'function claimFor(uint256 splitId, uint256 roundId, address holder, uint32 payout)',
  'function rollOver(uint256 splitId, uint256 roundId)',
])
const tokenAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function balanceOfAt(address, uint256) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
])
const listingsAbi = parseAbi([
  'function listingCount() view returns (uint256)',
  'function listing(uint256) view returns ((uint256 ruleId, (address cpu, uint64 id) engine, bytes32 engineNetlistHash, address lister, address token, uint256 bounty, uint64 withdrawAt, uint8 status, address hunter))',
  'function commitments(bytes32) view returns (uint256)',
  'function commitmentOf(uint256 listingId, bytes input, bytes32 salt, address hunter) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function reveal(uint256 listingId, bytes input, bytes32 salt)',
])

export const client = createPublicClient({ chain: xLayer, transport: fallback(RPCS.map((u) => http(u, { timeout: 20_000 }))) })

export interface SplitView {
  id: number; ruleId: bigint; operator: Address; shareToken: Address; payToken: Address
  unit: bigint; claimWindow: bigint; carry: bigint; roundCount: bigint; symbol: string; decimals: number
}
export interface RoundView {
  split: number; id: number; pot: number; fee: number; protocolFee: number; totalShares: number
  snapshotBlock: bigint; deadline: bigint; claimed: bigint; rolledOver: boolean
}

export async function readSplits(): Promise<SplitView[]> {
  const n = Number(await client.readContract({ address: VAULT, abi: vaultAbi, functionName: 'splitCount' }))
  const out: SplitView[] = []
  for (let id = 1; id <= n; id++) {
    const s = await client.readContract({ address: VAULT, abi: vaultAbi, functionName: 'split', args: [BigInt(id)] })
    const [symbol, decimals] = await Promise.all([
      client.readContract({ address: s.payToken, abi: tokenAbi, functionName: 'symbol' }),
      client.readContract({ address: s.payToken, abi: tokenAbi, functionName: 'decimals' }),
    ])
    out.push({ id, ...s, symbol, decimals })
  }
  return out
}

export async function readRounds(s: SplitView): Promise<RoundView[]> {
  const ids = Array.from({ length: Number(s.roundCount) }, (_, i) => i + 1)
  const rs = await Promise.all(ids.map((r) => client.readContract({ address: VAULT, abi: vaultAbi, functionName: 'round', args: [BigInt(s.id), BigInt(r)] })))
  return rs.map((r, i) => ({ split: s.id, id: ids[i], ...r }))
}

export interface HolderRound {
  round: RoundView; shares: bigint; rulePayout: bigint; claimed: boolean
  /** What the vault paid: a claim is only accepted for the rule's payout (circuit 8 on chain). */
  received: bigint | null
}

export async function readHolder(s: SplitView, rounds: RoundView[], holder: Address): Promise<HolderRound[]> {
  return Promise.all(rounds.map(async (r) => {
    const [shares, claimed] = await Promise.all([
      client.readContract({ address: s.shareToken, abi: tokenAbi, functionName: 'balanceOfAt', args: [holder, r.snapshotBlock] }),
      client.readContract({ address: VAULT, abi: vaultAbi, functionName: 'hasClaimed', args: [BigInt(s.id), BigInt(r.id), holder] }),
    ])
    const pay = rulePayout(BigInt(r.pot), shares, BigInt(r.totalShares))
    return { round: r, shares, rulePayout: pay, claimed, received: claimed ? pay : null }
  }))
}

export const shareBalance = (token: Address, who: Address) => client.readContract({ address: token, abi: tokenAbi, functionName: 'balanceOf', args: [who] })

export type ListingStatus = 'open' | 'disproved' | 'withdrawn'
export interface ListingView {
  id: number; ruleId: bigint; engine: { cpu: Address; id: bigint }; lister: Address; token: Address
  bounty: bigint; withdrawAt: bigint; status: ListingStatus; hunter: Address; symbol: string; decimals: number
}
const STATUS: ListingStatus[] = ['open', 'disproved', 'withdrawn']

export async function readListing(id: number): Promise<ListingView> {
  const l = await client.readContract({ address: LISTINGS, abi: listingsAbi, functionName: 'listing', args: [BigInt(id)] })
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: l.token, abi: tokenAbi, functionName: 'symbol' }),
    client.readContract({ address: l.token, abi: tokenAbi, functionName: 'decimals' }),
  ])
  return { id, ruleId: l.ruleId, engine: l.engine, lister: l.lister, token: l.token, bounty: l.bounty, withdrawAt: l.withdrawAt,
    status: STATUS[l.status] ?? 'open', hunter: l.hunter, symbol, decimals }
}

export async function readListings(): Promise<ListingView[]> {
  const n = Number(await client.readContract({ address: LISTINGS, abi: listingsAbi, functionName: 'listingCount' }))
  return Promise.all(Array.from({ length: n }, (_, i) => readListing(i + 1)))
}

/** The commitment Listings.commitmentOf computes: keccak256(abi.encode(listingId, input, salt, hunter)). */
export const commitmentOf = (listingId: number, input: Hex, salt: Hex, hunter: Address): Hex =>
  keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'bytes' }, { type: 'bytes32' }, { type: 'address' }], [BigInt(listingId), input, salt, hunter]))

export const commitmentBlock = (c: Hex) => client.readContract({ address: LISTINGS, abi: listingsAbi, functionName: 'commitments', args: [c] })

/** Base units to a decimal string, trimmed (6 decimals: 420000 -> "0.42"). */
export function units(v: bigint, decimals: number): string {
  const neg = v < 0n
  const a = neg ? -v : v
  const base = 10n ** BigInt(decimals)
  const whole = a / base
  const frac = (a % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${neg ? '-' : ''}${whole.toLocaleString('en-US')}${frac ? '.' + frac : ''}`
}
/** Vault units (1 unit = 10^(decimals-2) base units) to a token amount string. */
export const vaultUnits = (v: bigint | number, s: SplitView) => units(BigInt(v) * s.unit, s.decimals)

export const isAddress = (s: string): s is Address => /^0x[0-9a-fA-F]{40}$/.test(s.trim())
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

// ---- Writes, from the person's own browser wallet (EIP-1193). The page never holds a key. ----

interface Eip1193 { request(args: { method: string; params?: unknown[] }): Promise<unknown> }
declare global { interface Window { ethereum?: Eip1193 } }

export const hasBrowserWallet = () => typeof window !== 'undefined' && !!window.ethereum

export async function connectWallet(): Promise<Address> {
  const eth = window.ethereum
  if (!eth) throw new Error('no browser wallet')
  const [addr] = (await eth.request({ method: 'eth_requestAccounts' })) as Address[]
  const chain = Number(await eth.request({ method: 'eth_chainId' }))
  if (chain !== xLayer.id) {
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + xLayer.id.toString(16) }] })
    } catch {
      await eth.request({ method: 'wallet_addEthereumChain', params: [{
        chainId: '0x' + xLayer.id.toString(16), chainName: xLayer.name, nativeCurrency: xLayer.nativeCurrency,
        rpcUrls: xLayer.rpcUrls.default.http, blockExplorerUrls: [EXPLORER],
      }] })
    }
  }
  return addr
}

function wallet(account: Address) {
  if (!window.ethereum) throw new Error('no browser wallet')
  return createWalletClient({ account, chain: xLayer, transport: custom(window.ethereum) })
}

/** Sends one transaction and waits for it. Returns the hash; throws if it reverted. */
async function send(account: Address, req: Parameters<ReturnType<typeof wallet>['writeContract']>[0]): Promise<Hex> {
  const { request } = await client.simulateContract({ ...req, account } as Parameters<typeof client.simulateContract>[0])
  const hash = await wallet(account).writeContract(request as Parameters<ReturnType<typeof wallet>['writeContract']>[0])
  const r = await client.waitForTransactionReceipt({ hash })
  if (r.status !== 'success') throw new Error(`transaction ${hash} reverted`)
  return hash
}

export const tx = {
  approve: (from: Address, token: Address, spender: Address, amount: bigint) =>
    send(from, { address: token, abi: tokenAbi, functionName: 'approve', args: [spender, amount] } as never),
  allowance: (token: Address, owner: Address, spender: Address) =>
    client.readContract({ address: token, abi: tokenAbi, functionName: 'allowance', args: [owner, spender] }),
  createSplit: (from: Address, ruleId: bigint, feeId: number, shareToken: Address, payToken: Address, window: bigint) =>
    send(from, { address: VAULT, abi: vaultAbi, functionName: 'createSplit', args: [ruleId, { cpu: CPU, id: BigInt(feeId) },
      SPLIT_REFS.map((id) => ({ cpu: CPU, id: BigInt(id) })), shareToken, payToken, window] } as never),
  openRound: (from: Address, splitId: number, deposit: number) =>
    send(from, { address: VAULT, abi: vaultAbi, functionName: 'openRound', args: [BigInt(splitId), deposit] } as never),
  claim: (from: Address, splitId: number, roundId: number, payout: bigint) =>
    send(from, { address: VAULT, abi: vaultAbi, functionName: 'claim', args: [BigInt(splitId), BigInt(roundId), Number(payout)] } as never),
  commit: (from: Address, c: Hex) =>
    send(from, { address: LISTINGS, abi: listingsAbi, functionName: 'commit', args: [c] } as never),
  reveal: (from: Address, listingId: number, input: Hex, salt: Hex) =>
    send(from, { address: LISTINGS, abi: listingsAbi, functionName: 'reveal', args: [BigInt(listingId), input, salt] } as never),
}
const CPU: Address = '0x1900801e311184063b9d9C119C9D98AA4950E12c'
