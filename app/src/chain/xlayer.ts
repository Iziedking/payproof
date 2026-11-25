// X Layer mainnet, from PLAN section 6 (verified ground truth). Kept apart from the sign-in page
// so pages that read or write the contracts do not load Privy.
import { defineChain } from 'viem'

export const xLayer = defineChain({
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://xlayerrpc.okx.com', 'https://rpc.xlayer.tech'] } },
  blockExplorers: { default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer' } },
})
