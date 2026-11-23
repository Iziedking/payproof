// The rule circuits on X Layer that the app reads and runs. Ids are from
// docs/evidence/p2/live-tapeouts.jsonl; each hash is the keccak-256 of the netlist
// bytes in chain/netlists, checked again on every read (read.ts). The layouts are
// the rule folders' own layout.json, so the app and the circuits share one source.
import type { Field } from '../../../compiler/src/layout'
import cnLayout from '../../../rules/cn-bonus-2023-30/layout.json'
import ngLayout from '../../../rules/ng-paye-nta2025/layout.json'

export const CHAIN_ID = 196
export const CIRCUITS_ADDRESS = '0x1900801e311184063b9d9C119C9D98AA4950E12c'
// Both answer eth_call from a web page (checked 2026-11-23 from https://example.com).
export const RPCS = ['https://xlayerrpc.okx.com', 'https://rpc.xlayer.tech']

export interface CircuitRef {
  id: number
  keccak: string
  gates: number
  nIn: number
  nOut: number
  inputs: Field[]
  outputs: Field[]
}

export const CN_ANSWER: CircuitRef = {
  id: 9, keccak: '0x503c5c5010b765f8e0ba96ce4530fc4cba9c108597a83752532d1d111f12e537', gates: 3573,
  nIn: cnLayout.nIn, nOut: cnLayout.nOut, inputs: cnLayout.inputs, outputs: cnLayout.outputs,
}
export const CN_WORKING: CircuitRef = {
  id: 12, keccak: '0xcb907d2a913da336a5df02bfa5b96d12577148ff3c3cf2a733ae0c855487b18b', gates: 3045,
  nIn: cnLayout.explain.nIn, nOut: cnLayout.explain.nOut, inputs: cnLayout.inputs, outputs: cnLayout.explain.outputs,
}
export const NG_ANSWER: CircuitRef = {
  id: 10, keccak: '0x905bcd5b4c641aa810f592b6745e3a424d48a2e8e60d4bb9c47f9118523f10ea', gates: 8482,
  nIn: ngLayout.nIn, nOut: ngLayout.nOut, inputs: ngLayout.inputs, outputs: ngLayout.outputs,
}
export const NG_WORKING: CircuitRef = {
  id: 11, keccak: '0xd27eaed86b4efca5864033c786ab7f181df6fc0dc8c4b41bdfaf12a6decba169', gates: 3645,
  nIn: ngLayout.explain.nIn, nOut: ngLayout.explain.nOut, inputs: ngLayout.inputs, outputs: ngLayout.explain.outputs,
}

export const WAGE_CIRCUITS = [CN_ANSWER, CN_WORKING, NG_ANSWER, NG_WORKING]

// Shown on the rule pages only (the split-v1 circuits are not run by the app yet).
export const SPLIT_INFO = {
  answer: { id: 8, keccak: '0x2e4c44e912da662903c6ebf368ca177c1eb77ebbb4d6838069fc7a14af6be5b7', gates: 41158 },
  working: { id: 14, keccak: '0xe7f25fde3b3849b8e8e784a750fb23fe077a3a7acc170938a7f2315faa9eefe6', gates: 39314 },
  validity: { id: 13, keccak: '0x9c6ecd5fbeea33418503a7cb68e5842f75f387d6f14a63c4164654f6afa6a1cb', gates: 387 },
}

export const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`
