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

## Second run: the owner's holders and the funding amounts

Task `p4-round-dryrun-real`, fork block 76834983. Holders h1 `0x6E0A5DD087e451620601C5c03cc0c6AB94b709F5`,
h2 `0xdbf10E16E30D681f2926546401e7E85869898008`, h3 `0x5AB0bB350C9Dc781C404d9eb5d8C5772411b7E51`
with 50, 30 and 20 shares; treasury `0xDcDa62b9044911474Bd2A7d00b12A3cb985dF84A`. The deployer's
real 2.102 USDT0 was used (no simulated USDT0). The deployer sent each holder its OKB with a plain
transfer, as on mainnet: h1 0.0022, h2 0.0026, h3 0.0022 OKB. Every step passed with the same
results and gas as the first run. OKB left at the end: h1 0.000231, h2 0.000286, h3 0.000234,
deployer 0.009087.
