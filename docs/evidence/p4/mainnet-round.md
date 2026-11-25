# The real round on X Layer (mainnet, chain 196)

Signed by the owner on 2026-11-25 with Foundry keystores (`payproof-deployer`, `payproof-h1` to
`payproof-h3`); every step was rehearsed first on a fork (`round-dryrun/summary.md`). Read back
from `https://xlayerrpc.okx.com` the same day: every transaction below has status 1 and the
sender shown.

## Addresses

| Role | Address |
| --- | --- |
| Deployer and split operator | `0x5c807eA36fC11a72192d83ecff2b3D4746767612` |
| Treasury (fees set to 0) | `0xDcDa62b9044911474Bd2A7d00b12A3cb985dF84A` |
| RuleRegistry | `0xBc7187E1C31841396962f8498dEaa513df28cC50` |
| SplitVault | `0x19cc6ED93704f8ab4D4FdDB6A98D3D5ceff786AA` |
| Listings | `0x62B12CC1CE0D2495575087A1BAdE578fbC33a8C0` |
| ShareToken "Payproof test shares" (PPS, 0 decimals, 100 shares) | `0x7845A53c8E5E5352576FbBB821351260B56cFC2c` |
| Test holder h1 (50 shares) | `0x6E0A5DD087e451620601C5c03cc0c6AB94b709F5` |
| Test holder h2 (30 shares) | `0xdbf10E16E30D681f2926546401e7E85869898008` |
| Test holder h3 (20 shares) | `0x5AB0bB350C9Dc781C404d9eb5d8C5772411b7E51` |
| Pay token USDT0 (6 decimals) | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| Circuits (TapeOut) | `0x1900801e311184063b9d9C119C9D98AA4950E12c` |

The code at the four contract addresses equals the build of `contracts/src` at this commit
(runtime bytecode compared byte for byte, constructor-set immutables excluded). Rule 1 is
split-v1 (decision circuit 8, validity circuit 13, 1 decision bit); rule 2 is cn-bonus-2023-30
(circuit 9, no validity circuit, 64 decision bits). The split uses fee circuit 17 and REF targets
3 to 7, all pinned by netlist hash.

## Transactions

| Step | Sender | Block | Gas | Transaction |
| --- | --- | --- | --- | --- |
| Tape out the fee circuit (circuit 17) | deployer | 76829438 | 1,842,032 | `0xcc6c253104e181945d34a69a2652551a2b8f617254d764ae542db98631809875` |
| Fund h1 with 0.0022 OKB | deployer | 76837853 | 21,000 | `0x2433d96f2b3cb735f0eb5a5182ab616c6ef4544a2c6f9c0245e66cf2dc94eac1` |
| Fund h2 with 0.0026 OKB | deployer | 76837866 | 21,000 | `0x2b303bc6eea96b98deda454eb80483f71376eeabc83a0e7762babf019e601950` |
| Fund h3 with 0.0022 OKB | deployer | 76837876 | 21,000 | `0x10eb5760692fc31f5de4322feb074491fb4be077c9315614e2424b2c36b5d75a` |
| Deploy RuleRegistry | deployer | 76838438 | 959,452 | `0x172d4d7b4af347729cb3029b51ffbff91c36bede04d8a4156d52beb21067f97f` |
| Deploy SplitVault | deployer | 76838440 | 2,400,862 | `0xd9d73eb9acee54a63b324223141b5ccba49d38b64d438c59ccb5722413234333` |
| Deploy Listings | deployer | 76838441 | 1,973,274 | `0xf4fa387335fcc35ae4875f7eb81ee0abb8a70acab0d86c9baf0e377773499af4` |
| Deploy ShareToken | deployer | 76838443 | 1,174,985 | `0x694e7f4db2b6879c3e4f339b9e788e60f31b21037ddd803c7178b2ad55121ae4` |
| Register rule 1, split-v1 | deployer | 76838446 | 322,099 | `0xda7239eff0e62134e034c1bfdbd4b1f73e0445d273293bd6b8f2d8aa04d5623e` |
| Register rule 2, cn-bonus-2023-30 | deployer | 76838448 | 367,407 | `0x7b9696148abddb04767769c302ca6eb7aa4b694bee922427568b8a095947965a` |
| Create split 1 | deployer | 76839817 | 3,177,592 | `0xf59c763dd7c9e2c9165ca51f34dcb8f4ec3df458eb770db6d9934dc808e8dfb5` |
| Approve the bounty | deployer | 76839820 | 53,365 | `0x4b8a1a1620181243e8b1bfbc696079fe506b7a563ef7a569b56211cee4a65d01` |
| List SIMULATED engine B (circuit 16), 1.00 USDT0 bounty | deployer | 76839822 | 511,329 | `0xa99e44fbfa2d9654e74b25ef6aaca5bef0d4a106ca304c02cdcb68397211228f` |
| Approve the deposit | deployer | 76839835 | 53,365 | `0x256d8158302f3e6d021130650001967bfed9190785d93f45d1cfb3c78fcee9fe` |
| Open round 1 with 1.00 USDT0 | deployer | 76839845 | 4,126,773 | `0x1057322c8ad5f896e6783ff92d0e09222f30b757e964d9b32fcd3478d1064076` |
| h1 moves 10 shares to h3 (after the snapshot) | h1 | 76839855 | 95,441 | `0x9b68818706734c7583377d90832384db18d42d81e79778f10659ef0d9a46d452` |
| h1 claims 0.42 USDT0 | h1 | 76839866 | 98,333,419 | `0x2e2335ba0eb80a280c1b07c7a2c78cd181650c8b5ac34186ff3b1d804318fee6` |
| h2 claims 0.25 USDT0 | h2 | 76839876 | 98,318,694 | `0x8a9d8af78cdea175a467b162419a3beeb41e54a868f801c86b036eeaa979d8ec` |
| h3 claims 0.17 USDT0 | h3 | 76839901 | 98,314,818 | `0xa6e4b20be7cebc2d8abdba4a8d72e98755db75e971cab2765035dd744624b10c` |
| h2 commits a disproof of engine B | h2 | 76839948 | 45,998 | `0x4aff44966735340036c8c823253240899477d82ce706e9a45e5a1472da9ea8ad` |
| h2 reveals a bonus of 17 fen; engine B disproved, 1.00 USDT0 paid | h2 | 76839962 | 17,358,568 | `0xab3ce2b53454ed510aedf17d970334679da71f3e70a99908d3c51107b30ca4da` |

## What the round shows

- **A split opened a real round.** Round 1 of split 1: pot 100 units (1.00 USDT0), operator fee
  10 units from fee circuit 17, total shares 100 at snapshot block 76839844.
- **Three wallets claimed amounts the circuit decided.** Each claim was checked by circuit 8 on
  chain: 42, 25 and 17 units for 50, 30 and 20 shares, that is floor(pot x 85% x shares / total).
  The round paid 84 units. The vault keeps 6 units (0.06 USDT0) for a later round: 1 left by
  rounding down and the 5% that rolls over.
- **A transfer after the snapshot did not change the round.** h1 moved 10 shares to h3 in block
  76839855, after the snapshot. On a fork of X Layer at block 76839900 (task `p4-snapshot-check`,
  read-only), h3 held 30 shares but 20 at the snapshot; asking the vault for 25 was refused with
  `PayoutRejected(25)` (`0xb392f2f7...19`), and asking for 17 was accepted. h3 claimed 17 one
  block later. The public RPC does not run calls this heavy, so this check ran on a fork.
- **A simulated engine was disproved and its hunter paid.** For a bonus of 17 fen, circuit 9 (the
  rule) gives tax 0 and SIMULATED engine B (circuit 16) gives tax 1. h2 committed in block
  76839948 and revealed in block 76839962; Listings compared both circuits on chain, marked
  listing 1 disproved and paid h2 the 1.00 USDT0 bounty.

Balances after the round: h1 0.42 USDT0, h2 1.25 USDT0, h3 0.17 USDT0; the deployer, as operator,
holds 0.10 USDT0 of fee plus 0.102 it already had; SplitVault holds 0.06 USDT0; Listings holds 0.
OKB left: h1 0.000231, h2 0.000286, h3 0.000234, deployer 0.009087.
