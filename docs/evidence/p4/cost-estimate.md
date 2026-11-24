# P4 cost estimate (2026-11-24, before any P4 contract is written)

What it costs in OKB to deploy the P4 contracts and run the real round that PLAN P4 asks for.
Measured figures come from the live chain. The contracts do not exist yet, so their costs are
upper bounds, marked as such. Token amounts (the pot, the bounty) are decision D5 and are not
included.

## Measured

`eval` gas for every Payproof circuit, by `eth_estimateGas` on the live chain at block
76,743,905 (read only, nothing signed). Each circuit was estimated with two different inputs;
the two differ by under 0.2%. Gas price 20,000,001 wei. Evidence: `eval-gas.json`
(task `p4-eval-gas`).

| Circuit | Id | Gas | OKB at 20,000,001 wei |
| --- | --- | --- | --- |
| split_v1_top (the check a claim runs) | 8 | 97,226,124 | 0.001945 |
| split_v1_explain | 14 | 93,049,994 | 0.001861 |
| ng_paye | 10 | 19,767,840 | 0.000395 |
| ng_paye_explain | 11 | 8,607,304 | 0.000172 |
| cn_bonus | 9 | 8,322,963 | 0.000166 |
| cn_bonus_explain | 12 | 7,047,601 | 0.000141 |
| split_v1_validity | 13 | 981,251 | 0.000020 |

The one live `eval` of circuit 8 sent on 2026-11-22 used 95,673,102 gas
(`docs/evidence/p2/eval/eval-live.json`), 1.6% under the estimate. The block gas limit is
210,000,000, so one claim takes almost half a block.

Tape-out gas measured in P2 (`docs/evidence/p2/live-tapeouts.jsonl`): 1.3 M (circuit 13) to
43.5 M (circuit 3); cn_bonus 10.5 M, ng_paye 24.6 M.

## Estimate for P4

| Step | Gas | Basis |
| --- | --- | --- |
| Deploy RuleRegistry, ShareToken, SplitVault, Listings | at most 22 M | Upper bound: 4 x about 5.5 M, the cost of a contract at the 24,576-byte size limit. Not measured |
| Tape out the fee circuit (`openRound` runs it) | at most 25 M | Not designed yet; bounded by the largest rule circuit taped out (ng_paye, 24.6 M) |
| Tape out one simulated engine | at most 25 M | Same bound; an engine of the bonus rule would be about 10.5 M |
| `openRound` with the fee circuit | at most 100 M | Bounded by circuit 8; a fee circuit is one multiply and one divide by 10,000 |
| 3 claims | about 294 M | 3 x (97.2 M for circuit 8 plus at most 1 M of contract work). Each claimant pays its own gas unless D15 says otherwise |
| Disproof of the engine (commit, then reveal running the reference and the engine) | about 20 M | 2 x cn_bonus eval (8.3 M) plus contract work, if the engine is of the bonus rule |
| Other transactions (register rule, create split, mint, transfer after the snapshot, list, top up, attestations, endorse) | at most 15 M | About 50 transactions at most 300 k each. Not measured |
| **Total** | **at most about 500 M** | |

At 20,000,001 wei a gas, 500 M gas is about **0.010 OKB**. With a margin of two for retries and
a rehearsal of each step on the fork, about **0.020 OKB**.

## What this means for funding

- The deployer holds 0.014963 OKB (block 76,743,905).
- If the deployer pays for everything, including the three claims, it needs about 0.020 OKB:
  a top-up of at least about **0.005 OKB**, more to be safe against a gas price rise.
- If the three claimants are separate wallets that pay their own gas, each needs about
  0.002 OKB per claim (0.006 OKB for three), and the deployer needs about 0.008 OKB.
- Gas cost is linear in the gas price. At twice today's price, double every figure.
- Not included: the pot and the bounty in tokens (D5), and any Privy or relayer cost (D15).

## Not settled

- Every contract figure is an upper bound until the contracts exist; this file gets the
  measured fork figures in P4.
- The fee circuit is not designed. If `openRound` instead reuses an existing circuit, its row
  falls.
