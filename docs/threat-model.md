# Threat model: Payproof contracts (P4)

Covers `contracts/src`: `ShareToken`, `RuleRegistry`, `SplitVault`, `Listings` and the shared
`Circuits.sol`. Written 2026-11-25 against the code and tests in this repository. Not audited.

## What is at stake

| Asset | Held by | Size planned for the hackathon |
| --- | --- | --- |
| Pay tokens deposited for split rounds | `SplitVault` | about 1 USD for the real round (owner decision D5) |
| Engine bounties | `Listings` | about 1 USD for simulated engine B (D5) |
| Share balances and their history | `ShareToken` | test shares given to named test wallets (D6) |
| The record of which rule and which circuits a split uses | `RuleRegistry`, `SplitVault` | none in money; trust in the result |

## Who can do what

| Actor | Can | Cannot |
| --- | --- | --- |
| Anyone | register a rule; attest a proof or endorse (events only); create a split; open a round on any split by depositing; claim for any holder (the money goes to the holder); roll over an expired round; list an engine; top up a bounty; commit and reveal a disproof | take a holder's payout; change a split or a rule after creation; move tokens out by any path not listed below |
| Split operator | receive the fee circuit's fee at each round open | change the fee, the rule, the tokens or the window; touch the pot or the carry |
| Holder | claim once per round the payout the decision circuit accepts for their shares at the snapshot | claim twice; claim with shares bought after the snapshot |
| Lister | withdraw an undisproved bounty 7 days after asking | withdraw a bounty sooner, or after a disproof |
| `Listings` owner | pause and unpause new listings | move any token; stop reveals, top-ups or withdrawals |
| Treasury | receive the protocol fee (0 bps, capped at 100) and the listing fee (0 bps, capped at 1,000) | anything else; it has no function on these contracts |
| Us (Payproof) | nothing beyond the rows above; we hold no key with special power over `SplitVault`, `RuleRegistry` or `ShareToken` | recover funds stuck by a processor fault (see D13 below) |

## How tokens can leave each contract

Each contract's header comment lists these; tests cover each one.

- `SplitVault`: (1) at `openRound`, the fee circuit's fee to the operator and `PROTOCOL_FEE_BPS`
  of the deposit (0) to the treasury; (2) at `claim` or `claimFor`, the accepted payout to the
  holder, never more than the round has left after fees. Unclaimed amounts move only into the
  split's carry, which only a later round's pot can use.
- `Listings`: (1) at `reveal`, a disproved listing's bounty to the hunter, less `FEE_BPS` (0) to
  the treasury; (2) at `withdraw`, an undisproved bounty to its lister after the delay.
- `ShareToken`, `RuleRegistry`: hold nothing.

## Threats and what stops them

| # | Threat | Mitigation | Evidence |
| --- | --- | --- | --- |
| T1 | A holder claims more than the rule gives | The decision circuit (circuit 8) accepts exactly one payout per (pot, shares, total): the floor. Facts `never-overpays` and `at-most-one-unit-short` hold on the taped-out circuit (P3). The vault also refuses any payout above what the round has left | `test_wrongPayoutIsRejected`, `testFuzz_onlyTheRulesPayoutPasses`, fork test (circuit 8 refuses 43 where the rule gives 42) |
| T2 | All claims together exceed the pot | `never-overpays` summed over holders whose shares add up to the total; plus the vault's own cap per round | `invariant_solvent` (claims never above 85% of any pot), `invariant_conservation` |
| T3 | Buying or moving shares after a round opens to claim more | Shares and total are read at `block.number - 1` from the token's history; a transfer in or after the opening block does not change the round | `test_transferAfterSnapshotDoesNotChangeTheRound` |
| T4 | Flash loan or same-block trick on the snapshot | The snapshot block is strictly before the opening transaction's block, and the token refuses to read the current block | `test_currentAndFutureBlocksRevert` |
| T5 | Double claim | `hasClaimed` per split, round and holder, set before the transfer | `test_oneClaimPerHolderPerRound` |
| T6 | Re-entrancy through the pay token | `nonReentrant` on every state-changing function of `SplitVault` and on token-moving functions of `Listings`; state written before transfers | code review; no hook-bearing token is used in the real round |
| T7 | Fee-on-transfer or rebasing pay token breaks accounting | Deposits and bounties check the balance actually received and revert on a shortfall. Rebasing tokens are not supported; the real round uses a plain token | `test_refusesFeeOnTransferPayToken` |
| T8 | A share token without history, or one that lies about it | A split requires ERC-165 support for `IShareHistory`. A token that declares it falsely could misreport shares; the circuit still bounds each payout by shares/total, and the vault caps each round, so the loss is limited to that split's own pot. Only our reference `ShareToken` is used | `test_refusesTokensWithoutHistory` |
| T9 | The circuit changes under a live split (R7) | The netlist hashes of the decision circuit, its REF targets and the fee circuit are pinned at creation and checked on every round open and claim. A mismatch reverts; tokens stay | `test_changedCircuitStopsClaimsAndKeepsFunds` |
| T10 | The processor stops answering or reverts | Claims and new rounds revert; tokens stay. Rounds whose window passes can still be rolled over (no circuit call), so nothing is lost to a deadline; the money waits in the carry | `test_processorFailureStopsClaimsAndKeepsFunds` |
| T11 | Front-running a disproof | Commit binds the hunter's address and must be in an earlier block than the reveal; another address cannot reuse it | `test_revealNeedsOwnCommitmentInAnEarlierBlock` |
| T12 | A lister pulls the bounty when a disproof is coming | Withdrawal needs a request and a 7-day wait; a disproof during the wait wins | `test_withdrawWaitsSevenDaysAndCanStillBeDisproved` |
| T13 | An engine changed after listing, to dodge or fake a disproof | Engine and rule netlist hashes are pinned at listing and checked at reveal | `test_changedEngineCannotBeDisproved` |
| T14 | An invalid input used to disprove an engine | When the rule has a validity circuit, the reveal requires it to return 1. The China bonus rule has none by owner decision (2026-11-22): every 32-bit bonus is in its domain | `test_inputLengthIsChecked`; domain stated in `docs/evidence/p3.md` |
| T15 | Gas: a claim does not fit a block | A claim costs about 98.3 M gas on a fork of X Layer (three measured claims), under the 210 M block limit | `docs/evidence/p4/p4-forge-fork.log` |
| T16 | Operator overcharges | The fee comes from the fee circuit, whose only input is the deposit; `fee-is-fixed` is proved on it; the vault refuses a fee above the deposit | `scripts/p4/fee-prepare.mts`, `docs/evidence/p4` |
| T17 | Library risk | OpenZeppelin Contracts 5.7.0 is not covered by a listed audit (newest audit row: 5.6.0; Checkpoints audited at 4.8.0). Fetched at a pinned commit whose id is checked | `VERSIONS.md` |

## D13: recovery if the processor changes under a live split

There is none, by design. No one, including us, can move a split's tokens except along the two
paths above, and both run the pinned circuits. If the processor or a pinned circuit changes for
good, the split's deposits stay in `SplitVault` permanently. What makes this unlikely, not
impossible:

- The TapeOut circuit beacon on X Layer has owner 0 and was frozen on 2026-10-22 (PLAN section
  6). The processor factory is upgradeable and not sealed, which is why the hashes are checked.
- The hackathon round is about 1 USD.

The page that opens a round says this before anyone deposits.

## Not covered

- The app, the sign-in provider and the RPC: a wrong page could show a wrong payout, but the
  vault would refuse it.
- Correctness of the tax rules themselves: the proofs say what the circuits compute, not that
  our reading of a law is right (PLAN L7).
- Tokens other than plain ERC-20 with exact transfers.
