# Fee circuit tape-out rehearsal (SIMULATION, fork only)

Task `p4-fee-forge-dryrun` (`scripts/p4/fee-forge-dryrun.sh`) on karwan-test, 2026-11-25.
An anvil 1.8.6 fork of X Layer at block 76828540. The deployer
`0x5c807eA36fC11a72192d83ecff2b3D4746767612` was impersonated on the fork only, with no key,
and kept its real balance. Nothing was sent to X Layer.

| Item | Value |
| --- | --- |
| Piece | `split_fee`, 4025 bytes, 575 NAND records, no REF records |
| keccak256 | `0x84edbfbf5cbe2498b40dc8862674641719943c5c78ceecd135f11a1c72def20e` |
| Live gas price | 20000001 wei |
| forge estimate | 2,544,306 gas |
| Gas used on the fork | 1,842,032 |
| Fork circuit id | 17 (fork only; see `fee-forge-ids.json`) |
| `circuitInfo` gates | 575, matches the file |
| Deployer balance before | 11927691512501092 wei |
| Deployer balance after | 10590850870659060 wei |

The balance fell by 1336840641842032 wei. Gas accounts for 36840641842032 wei
(1,842,032 x 20000001); the other 1300000000000000 wei (0.0013 OKB) is the TapeOut fee, which
`chain/script/TapeOut.s.sol` reads from `TAPEOUT_FEE()` and sends with the call.

The proof that ran before this (`p4-fee-build`, log in `../p4-fee-build.log`):
`fee-is-fixed` holds in ABC iprove (111.9 s) and Bitwuzla (188.7 s); Yosys sat was undecided
at 900 s. The mutant (fee + 1 at a pot of 5,000,000) was caught by ABC (0.8 s) and Bitwuzla
(0.9 s); Yosys sat was undecided at 900 s.
