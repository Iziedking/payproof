# Payproof

Payproof puts pay rules on X Layer as circuits and proves what they do.

- **Check my pay.** Enter a bonus (China) or a salary (Nigeria) and see the tax the rule gives,
  worked out from the rule's circuit read from X Layer. The figures stay on your device.
- **Proofs.** For each rule, facts such as "the tax is never more than the income" are proved on
  the circuit bytes read from X Layer, with two separate tools where possible. Failures and
  undecided results are published too.
- **Splits.** A vault pays holders of a share token from a pot, round by round. Each payout is
  checked on chain by the split-v1 circuit, and shares are counted at the block before the round
  opened.
- **Engines and bounties.** Anyone can list their own version of a rule (an engine) with a bounty.
  Anyone who finds an input where the engine and the rule differ is paid the bounty, checked on
  chain. The engines listed so far are **simulated**: we built them to show how this works.

Built for the X Layer TapeOut hackathon. The contracts are **not audited**
(`docs/threat-model.md`).

## On X Layer (mainnet, chain 196)

| What | Address |
| --- | --- |
| Circuits (our TapeOut processor) | `0x1900801e311184063b9d9C119C9D98AA4950E12c` |
| RuleRegistry | `0xBc7187E1C31841396962f8498dEaa513df28cC50` |
| SplitVault | `0x19cc6ED93704f8ab4D4FdDB6A98D3D5ceff786AA` |
| Listings | `0x62B12CC1CE0D2495575087A1BAdE578fbC33a8C0` |
| ShareToken, test shares (PPS) | `0x7845A53c8E5E5352576FbBB821351260B56cFC2c` |
| Deployer | `0x5c807eA36fC11a72192d83ecff2b3D4746767612` |

| Circuit | What it is |
| --- | --- |
| 1, 2 | First tests: an 8-bit adder, and a circuit made of one REF record |
| 3 to 7 | Parts used by the split-v1 decision circuit |
| 8 | split-v1 decision: accepts a payout only if it is the rule's payout |
| 9, 12 | China one-time bonus rule (Announcement 2023 No. 30): answer, and working |
| 10, 11 | Nigeria PAYE rule (Nigeria Tax Act 2025): answer, and working |
| 13, 14 | split-v1 validity, and working |
| 15, 16 | SIMULATED vendor engines A and B for the China bonus rule |
| 17 | split-v1 fee: 10% of each deposit, rounded down |

### What happened on mainnet

The real round (details in `docs/evidence/p4/mainnet-round.md`):

- Split 1 opened round 1 with a 1.00 USDT0 pot. The fee circuit took 0.10 for the operator.
- Three test wallets claimed 0.42, 0.25 and 0.17 USDT0 for 50, 30 and 20 shares. The vault paid
  each only after circuit 8 accepted the amount on chain.
- After the snapshot, h1 moved 10 shares to h3. h3 was still paid for the 20 shares it held at the
  snapshot; asking for the 25 its new balance would give was refused (`PayoutRejected(25)`).
- For a bonus of ¥0.17 the rule gives tax ¥0.00 and SIMULATED engine B gives ¥0.01. h2 committed,
  then revealed that input; Listings ran both circuits on chain and paid h2 the 1.00 USDT0 bounty.
- Every published proof result (17) is attested on RuleRegistry, failures and undecided ones
  included, each with the keccak256 of its record in `app/src/proofs/records.json`.

### Every transaction

All sent by our wallets, read back from the chain after they landed. Links open OKLink.

| Phase | What | Block | Gas | Transaction |
| --- | --- | --- | --- | --- |
| P0 | Approve BEM for the processor factory | 76,152,888 | 46,393 | [`0xa601e844…b745a96e`](https://www.oklink.com/xlayer/tx/0xa601e844a8f5c8dc66b1eb5e89af388eeea51c0c945d1acb2e455accb745a96e) |
| P0 | Create the Payproof processor (circuits and transistors contracts) | 76,152,949 | 731,373 | [`0xe95c2ccf…31046c5d`](https://www.oklink.com/xlayer/tx/0xe95c2ccfd5944f211bca5e89104bc80859290eab369f30326e65e76031046c5d) |
| P0 | Approve BEM for our transistor contract | 76,153,337 | 46,393 | [`0xb4ce2bb8…bbe44bd8`](https://www.oklink.com/xlayer/tx/0xb4ce2bb85c367f61a57907b05bdc1f9c4e69495531ac58421c14469abbe44bd8) |
| P0 | Mint 10,000,000 NAND transistors | 76,160,277 | 171,423 | [`0xc6cb5c01…b7e5e67e`](https://www.oklink.com/xlayer/tx/0xc6cb5c011f37fb14f25aa0212706c4feb066003f5f89eeb2613d4dabb7e5e67e) |
| P0 | Tape out an 8-bit adder (circuit 1) | 76,226,071 | 495,622 | [`0xfa9e1dac…4945559f`](https://www.oklink.com/xlayer/tx/0xfa9e1dac2b85bceed0109c0c206e9a7010ed744b7c0ae4c2e64826914945559f) |
| P0 | Tape out a circuit made of one REF record (circuit 2) | 76,312,738 | 227,855 | [`0x9018862e…fdbb4757`](https://www.oklink.com/xlayer/tx/0x9018862ebdac526f8d5802939b416e689ed5d2f0bcf50812f22aa28afdbb4757) |
| P2 | Tape out circuit 3: split-v1 part: 32-bit multiplier | 76,542,394 | 43,491,041 | [`0xaafb88d3…4cd1a55c`](https://www.oklink.com/xlayer/tx/0xaafb88d3af1f8cefaf70b239525b90f434f2c23b55bd2debedf792c94cd1a55c) |
| P2 | Tape out circuit 4: split-v1 part: times 8,500 | 76,545,229 | 10,635,705 | [`0x6692d4ee…504a5ac0`](https://www.oklink.com/xlayer/tx/0x6692d4ee8d9d0ad197a9f00bedafc91ccfbb7ba68fcad55660ba4feb504a5ac0) |
| P2 | Tape out circuit 5: split-v1 part: adder | 76,545,485 | 2,495,755 | [`0x83be6f66…265a7125`](https://www.oklink.com/xlayer/tx/0x83be6f66a2a773145a25ca64ea9d9d1c079f10b3aff486507362dc97265a7125) |
| P2 | Tape out circuit 6: split-v1 part: times 10,000 (narrow) | 76,545,606 | 4,869,535 | [`0x5ef9bd41…b1ee6e34`](https://www.oklink.com/xlayer/tx/0x5ef9bd41b3e69c52e21c7eafdb04f92ecd27e54a22ec29fc55e9b4cab1ee6e34) |
| P2 | Tape out circuit 7: split-v1 part: times 10,000 (wide) | 76,545,814 | 9,685,652 | [`0x7159bf15…02d59ac9`](https://www.oklink.com/xlayer/tx/0x7159bf15f1cb7b8cc9e1247accaacf3dc12de0d6206a4d16c3d6dcc502d59ac9) |
| P2 | Tape out circuit 8: split-v1 decision circuit | 76,546,014 | 6,045,409 | [`0x55a9f321…d91f17c9`](https://www.oklink.com/xlayer/tx/0x55a9f3214e4ab8fd5fe752a2871f34ae9649181d6cd75812a7d39af9d91f17c9) |
| P2 | Tape out circuit 9: China bonus rule | 76,584,820 | 10,473,350 | [`0x33615d5f…78eb6bd5`](https://www.oklink.com/xlayer/tx/0x33615d5f2b344b5301691b3207c9bf9b42a6360e7010ad02b7a0096578eb6bd5) |
| P2 | Tape out circuit 10: Nigeria PAYE rule | 76,586,444 | 24,638,320 | [`0x06fad530…65d595ec`](https://www.oklink.com/xlayer/tx/0x06fad53021f94a9906ab6ac5907f323bdbbf03e1727477ea441a277165d595ec) |
| P2 | Tape out circuit 11: Nigeria PAYE working | 76,600,746 | 10,680,928 | [`0xb2848de0…8bb448ec`](https://www.oklink.com/xlayer/tx/0xb2848de0671a162dd66c6ae893656d6431fcb06fcd7e5b2f2f2d14908bb448ec) |
| P2 | Tape out circuit 12: China bonus working | 76,606,209 | 8,905,122 | [`0x8a9d2273…75ac91b5`](https://www.oklink.com/xlayer/tx/0x8a9d22739e27d7023ca2bc48c384f256cf2e51a0e23f0c89819e03a975ac91b5) |
| P2 | Tape out circuit 13: split-v1 validity | 76,611,205 | 1,306,885 | [`0x7a108137…b241247c`](https://www.oklink.com/xlayer/tx/0x7a1081377f2e3abac66b641f67e84bb8618d2c249ead1d113c883816b241247c) |
| P2 | Tape out circuit 14: split-v1 working | 76,649,999 | 1,972,564 | [`0xd4bacb32…7dd02d42`](https://www.oklink.com/xlayer/tx/0xd4bacb32e6b4da9947b53e8ea4252335e33e54960c086ec61e4f7ea07dd02d42) |
| P2 | Run circuit 8 with eval in a transaction (gas measured) | 76,589,451 | 95,673,102 | [`0x349b4044…8864f04f`](https://www.oklink.com/xlayer/tx/0x349b40443331dbfec3a5ecd1fb666b0dc59935b76f4b688546c4d4278864f04f) |
| P3 | Tape out circuit 15: SIMULATED engine A (cn_vendor_a2) | 76,786,961 | 10,671,689 | [`0xc228357e…8f74aa7f`](https://www.oklink.com/xlayer/tx/0xc228357efbdb3e163ad1c6f413af28ec9e16624b090944f3427572fb8f74aa7f) |
| P3 | Tape out circuit 16: SIMULATED engine B (cn_vendor_b) | 76,787,063 | 11,087,019 | [`0xd4e76463…95e89cb9`](https://www.oklink.com/xlayer/tx/0xd4e76463bb21d721587c988535a90fd33f174e927812aecaa9824f7d95e89cb9) |
| P4 | Tape out the fee circuit (circuit 17) (sent by deployer) | 76,829,438 | 1,842,032 | [`0xcc6c2531…31809875`](https://www.oklink.com/xlayer/tx/0xcc6c253104e181945d34a69a2652551a2b8f617254d764ae542db98631809875) |
| P4 | Fund h1 with 0.0022 OKB (sent by deployer) | 76,837,853 | 21,000 | [`0x2433d96f…dc94eac1`](https://www.oklink.com/xlayer/tx/0x2433d96f2b3cb735f0eb5a5182ab616c6ef4544a2c6f9c0245e66cf2dc94eac1) |
| P4 | Fund h2 with 0.0026 OKB (sent by deployer) | 76,837,866 | 21,000 | [`0x2b303bc6…9e601950`](https://www.oklink.com/xlayer/tx/0x2b303bc6eea96b98deda454eb80483f71376eeabc83a0e7762babf019e601950) |
| P4 | Fund h3 with 0.0022 OKB (sent by deployer) | 76,837,876 | 21,000 | [`0x10eb5760…36b5d75a`](https://www.oklink.com/xlayer/tx/0x10eb5760692fc31f5de4322feb074491fb4be077c9315614e2424b2c36b5d75a) |
| P4 | Deploy RuleRegistry (sent by deployer) | 76,838,438 | 959,452 | [`0x172d4d7b…1067f97f`](https://www.oklink.com/xlayer/tx/0x172d4d7b4af347729cb3029b51ffbff91c36bede04d8a4156d52beb21067f97f) |
| P4 | Deploy SplitVault (sent by deployer) | 76,838,440 | 2,400,862 | [`0xd9d73eb9…13234333`](https://www.oklink.com/xlayer/tx/0xd9d73eb9acee54a63b324223141b5ccba49d38b64d438c59ccb5722413234333) |
| P4 | Deploy Listings (sent by deployer) | 76,838,441 | 1,973,274 | [`0xf4fa3873…73499af4`](https://www.oklink.com/xlayer/tx/0xf4fa387335fcc35ae4875f7eb81ee0abb8a70acab0d86c9baf0e377773499af4) |
| P4 | Deploy ShareToken (sent by deployer) | 76,838,443 | 1,174,985 | [`0x694e7f4d…55121ae4`](https://www.oklink.com/xlayer/tx/0x694e7f4db2b6879c3e4f339b9e788e60f31b21037ddd803c7178b2ad55121ae4) |
| P4 | Register rule 1, split-v1 (sent by deployer) | 76,838,446 | 322,099 | [`0xda7239ef…04d5623e`](https://www.oklink.com/xlayer/tx/0xda7239eff0e62134e034c1bfdbd4b1f73e0445d273293bd6b8f2d8aa04d5623e) |
| P4 | Register rule 2, cn-bonus-2023-30 (sent by deployer) | 76,838,448 | 367,407 | [`0x7b969614…5947965a`](https://www.oklink.com/xlayer/tx/0x7b9696148abddb04767769c302ca6eb7aa4b694bee922427568b8a095947965a) |
| P4 | Create split 1 (sent by deployer) | 76,839,817 | 3,177,592 | [`0xf59c763d…08e8dfb5`](https://www.oklink.com/xlayer/tx/0xf59c763dd7c9e2c9165ca51f34dcb8f4ec3df458eb770db6d9934dc808e8dfb5) |
| P4 | Approve the bounty (sent by deployer) | 76,839,820 | 53,365 | [`0x4b8a1a16…e4a65d01`](https://www.oklink.com/xlayer/tx/0x4b8a1a1620181243e8b1bfbc696079fe506b7a563ef7a569b56211cee4a65d01) |
| P4 | List SIMULATED engine B (circuit 16), 1.00 USDT0 bounty (sent by deployer) | 76,839,822 | 511,329 | [`0xa99e44fb…7211228f`](https://www.oklink.com/xlayer/tx/0xa99e44fbfa2d9654e74b25ef6aaca5bef0d4a106ca304c02cdcb68397211228f) |
| P4 | Approve the deposit (sent by deployer) | 76,839,835 | 53,365 | [`0x256d8158…8fcee9fe`](https://www.oklink.com/xlayer/tx/0x256d8158302f3e6d021130650001967bfed9190785d93f45d1cfb3c78fcee9fe) |
| P4 | Open round 1 with 1.00 USDT0 (sent by deployer) | 76,839,845 | 4,126,773 | [`0x1057322c…d1064076`](https://www.oklink.com/xlayer/tx/0x1057322c8ad5f896e6783ff92d0e09222f30b757e964d9b32fcd3478d1064076) |
| P4 | h1 moves 10 shares to h3 (after the snapshot) (sent by h1) | 76,839,855 | 95,441 | [`0x9b688187…9a46d452`](https://www.oklink.com/xlayer/tx/0x9b68818706734c7583377d90832384db18d42d81e79778f10659ef0d9a46d452) |
| P4 | h1 claims 0.42 USDT0 (sent by h1) | 76,839,866 | 98,333,419 | [`0x2e2335ba…4318fee6`](https://www.oklink.com/xlayer/tx/0x2e2335ba0eb80a280c1b07c7a2c78cd181650c8b5ac34186ff3b1d804318fee6) |
| P4 | h2 claims 0.25 USDT0 (sent by h2) | 76,839,876 | 98,318,694 | [`0x8a9d8af7…a979d8ec`](https://www.oklink.com/xlayer/tx/0x8a9d8af78cdea175a467b162419a3beeb41e54a868f801c86b036eeaa979d8ec) |
| P4 | h3 claims 0.17 USDT0 (sent by h3) | 76,839,901 | 98,314,818 | [`0xa6e4b20b…4624b10c`](https://www.oklink.com/xlayer/tx/0xa6e4b20be7cebc2d8abdba4a8d72e98755db75e971cab2765035dd744624b10c) |
| P4 | h2 commits a disproof of engine B (sent by h2) | 76,839,948 | 45,998 | [`0x4aff4496…da9ea8ad`](https://www.oklink.com/xlayer/tx/0x4aff44966735340036c8c823253240899477d82ce706e9a45e5a1472da9ea8ad) |
| P4 | h2 reveals a bonus of 17 fen; engine B disproved, 1.00 USDT0 paid (sent by h2) | 76,839,962 | 17,358,568 | [`0xab3ce2b5…b30ca4da`](https://www.oklink.com/xlayer/tx/0xab3ce2b53454ed510aedf17d970334679da71f3e70a99908d3c51107b30ca4da) |
| P4 | Register ng-paye-nta2025 as rule 3 | 76,844,040 | 785,726 | [`0xca192728…b81506bf`](https://www.oklink.com/xlayer/tx/0xca192728554ff9e76437ba39af0b475753b3c4f065780d84eed1987cb81506bf) |
| P4 | Attest cn-bonus-2023-30, circuit 9, tax-within-bonus: holds | 76,844,042 | 32,706 | [`0xcb2580ce…f22e0dcf`](https://www.oklink.com/xlayer/tx/0xcb2580ceabdf7e9e14c3ebd2b9a5782afc6245cec02366809bc49405f22e0dcf) |
| P4 | Attest cn-bonus-2023-30, circuit 9, breakdown-adds-up: holds | 76,844,045 | 32,742 | [`0xc0425757…fbaf6e2a`](https://www.oklink.com/xlayer/tx/0xc04257571df6c17cf0d9fc6347dc73ceca3ccd480aa0ad2167561efcfbaf6e2a) |
| P4 | Attest cn-bonus-2023-30, circuit 9, raise-never-lowers-take-home: fails | 76,844,048 | 33,018 | [`0x8ccd41f5…092d4118`](https://www.oklink.com/xlayer/tx/0x8ccd41f5d40a4c9a5ab169532ccc9ff1965639aae776e7f739b22024092d4118) |
| P4 | Attest ng-paye-nta2025, circuit 10, tax-within-income: holds | 76,844,050 | 32,730 | [`0x66fd9459…96a7a895`](https://www.oklink.com/xlayer/tx/0x66fd9459c75809894eb0596a90bce6dbcb60882e60e75c17b7f1e18c96a7a895) |
| P4 | Attest ng-paye-nta2025, circuit 10, more-pay-more-tax: undecided | 76,844,053 | 32,742 | [`0x86840bba…ef8b2276`](https://www.oklink.com/xlayer/tx/0x86840bbabc0c76e2a5119b46a0b379c4a8749b3beddcfe4ce708a97fef8b2276) |
| P4 | Attest ng-paye-nta2025, circuit 10, raise-never-lowers-take-home: fails | 76,844,055 | 33,006 | [`0x3c672d02…4c01231a`](https://www.oklink.com/xlayer/tx/0x3c672d02abf04a8593fdb787df46ad79a8802a84c0908e56008035c04c01231a) |
| P4 | Attest ng-paye-nta2025, circuit 10, relief-never-raises-tax: undecided | 76,844,058 | 32,886 | [`0x3be5f633…33ad07c0`](https://www.oklink.com/xlayer/tx/0x3be5f6338afecb9e923837f5aaf5abf8d55b3cc10392b17ba55eb4ef33ad07c0) |
| P4 | Attest ng-paye-nta2025, circuit 10, breakdown-adds-up: holds | 76,844,061 | 32,730 | [`0x73e609ba…dc0a2748`](https://www.oklink.com/xlayer/tx/0x73e609ba777f4dae3cb50e9190324f0d21a50333b3b850fc29b52206dc0a2748) |
| P4 | Attest split-v1, circuit 8, never-overpays: holds | 76,844,064 | 32,574 | [`0xf9f37a27…e5707687`](https://www.oklink.com/xlayer/tx/0xf9f37a27764a0e9f75ac98e3e13ca325455a1503772031a148f539f5e5707687) |
| P4 | Attest split-v1, circuit 8, at-most-one-unit-short: holds | 76,844,067 | 32,766 | [`0x3a18aa3b…f2de66fd`](https://www.oklink.com/xlayer/tx/0x3a18aa3b900a84100b1b6017b25ee83635b6cc1204f080f50aad5c5ef2de66fd) |
| P4 | Attest split-v1, circuit 8, more-shares-never-less: holds | 76,844,069 | 32,766 | [`0xf3c4302f…dfbb99c7`](https://www.oklink.com/xlayer/tx/0xf3c4302f056a174a8e24cca10641a9bae50adf145370ebc7a4401babdfbb99c7) |
| P4 | Attest split-v1, circuit 8, bigger-pot-never-less: holds | 76,844,072 | 32,742 | [`0xb038b103…48d99325`](https://www.oklink.com/xlayer/tx/0xb038b1032f98fd8eed54ac62d07c48e88cbe96d74eefb67d1ad7537648d99325) |
| P4 | Attest split-v1, circuit 8, splitting-never-pays-more: holds | 76,844,075 | 32,838 | [`0xda5aa3eb…cb8b2c65`](https://www.oklink.com/xlayer/tx/0xda5aa3eb5b8ac7b33e884d527f37c20ab0abd7db66d003b9030fef6fcb8b2c65) |
| P4 | Attest split-v1, circuit 8, zero-in-zero-out: holds | 76,844,077 | 32,622 | [`0x0746e303…2823467a`](https://www.oklink.com/xlayer/tx/0x0746e3038b0d6037f15bc4df8b2625505251b033c91cb35a44c80af92823467a) |
| P4 | Attest split-v1, circuit 17, fee-is-fixed: holds | 76,844,080 | 32,526 | [`0x276b4873…06bb257a`](https://www.oklink.com/xlayer/tx/0x276b48734c794544258282d4da93428183e62c3ace09e706a7b7302906bb257a) |
| P4 | Attest cn-bonus-2023-30, circuit 15, equal-to-rule (cn_vendor_a2, SIMULATED): holds | 76,844,082 | 32,124 | [`0x47c4d776…cb733a18`](https://www.oklink.com/xlayer/tx/0x47c4d7764c41c8846c0e301bc7b8c5562fd0a94b11a0a65795c49842cb733a18) |
| P4 | Attest cn-bonus-2023-30, circuit 16, equal-to-rule (cn_vendor_b, SIMULATED): fails | 76,844,085 | 32,136 | [`0xfb610614…a3de6452`](https://www.oklink.com/xlayer/tx/0xfb610614b0ab0ae6035447163bdc9c404a770e82e9b5fca997155469a3de6452) |

## Where the evidence is

| Phase | Record |
| --- | --- |
| P0: processor, gas and size limits | `docs/evidence/p0-spikes.md` |
| P1: compiler and simulator | `docs/evidence/p1.md` |
| P2: rule circuits on X Layer | `docs/evidence/p2.md` |
| P3: proofs, traps and simulated engines | `docs/evidence/p3.md`, `docs/evidence/p3/` |
| P4: contracts, the real round, attestations | `docs/evidence/p4/`, `docs/threat-model.md` |

Every proof run names its tools, their versions, the block the circuit was read at and the time
each query took. Each result was checked against a deliberately broken copy of the fact (a
mutant), which the tools had to catch.

## Repository

| Folder | What is in it |
| --- | --- |
| `rules/` | Each rule in Verilog, with its layout, test vectors and sources |
| `compiler/` | Yosys netlist to TapeOut netlist bytes, and the simulator |
| `prover/` | Reads circuits from X Layer and asks the proof tools |
| `contracts/` | RuleRegistry, ShareToken, SplitVault, Listings, with tests and deploy scripts |
| `chain/` | The netlists as taped out, their ids, and the tape-out script |
| `app/` | The web app |
| `scripts/` | Every build, proof and rehearsal step, phase by phase |

Builds, tests and proofs ran on a separate test host, not on a laptop. Nothing
in this repository holds a key: every transaction above was signed by the owner from their own
wallet after a rehearsal on a fork of X Layer.

The rules are our reading of the official texts, with sources in each rule folder. Nothing here
is tax advice.
