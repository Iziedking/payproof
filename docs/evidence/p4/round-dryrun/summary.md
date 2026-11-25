# Real round rehearsal (SIMULATION, fork only)

Task `p4-round-dryrun` (`scripts/p4/round-dryrun.sh`) on karwan-test, 2026-11-25, anvil 1.8.6
fork of X Layer at block 76832156, live gas price 20000001 wei. Every sender was impersonated on
the fork; no key was used and nothing was sent to X Layer. The holders are placeholder addresses
(`0x...a1001` to `0x...a1003`). Only on the fork, the deployer was given 2 USDT0
(`anvil_dealERC20`) and each holder 0.01 OKB (`anvil_setBalance`).

| Step | Result | Gas |
| --- | --- | --- |
| deploy(): registry, vault, listings, share token, 2 rules | done | 9,438,895 (estimate) |
| setup(): split on fee circuit 17, listing of SIMULATED engine B, 1 USDT0 bounty | split 1, listing 1 | 5,210,576 (estimate) |
| approve and openRound(1, 100 units = 1.00 USDT0) | pot 100, fee 10, total shares 100, snapshot 76832166 | 53,365 + 4,126,773 |
| holder 1 moves 10 shares to holder 3 after the snapshot | balances 40, 30, 30 | 95,237 |
| holder 3 asks 25 (what its new balance would give) | refused | eth_call only |
| claims for snapshot shares 50, 30, 20 | 42, 25, 17 units paid (0.42, 0.25, 0.17 USDT0) | 98,333,419; 98,318,694; 98,314,818 |
| holder 2 commits, then reveals a bonus of 17 fen against engine B | disproved, 1.00 USDT0 paid to holder 2 | 45,998 + 17,358,568 |

After the round: the deployer, as operator, holds the 0.10 USDT0 fee. The vault holds 0.06 USDT0
(6 units: 1 left by rounding down, plus the 5% that rolls over). Payouts are
floor(pot x 85% x shares / total).

OKB used on the fork: the deployer about 0.0003 for everything it signed. Holder 1 about 0.00197
(transfer and claim), holder 3 about 0.00197 (claim), holder 2 about 0.0023 (claim, commit, reveal).
