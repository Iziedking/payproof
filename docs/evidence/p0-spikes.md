# P0 spikes: X Layer and solver measurements

Status: **in progress**. Started 2026-11-17. Rows marked "not yet measured" have no
result yet; nothing in them is an estimate presented as a result.

P0 answers four questions before any rule is built for real:

1. What does it cost, in gas and fees, to put circuits on X Layer and to run them?
2. How large are the three rules as NAND circuits?
3. How long do the solvers take on the facts we want to prove?
4. For the pool split, which circuit does the contract run (compute or check), and at what width?

## 1. Where things ran

| Work | Where | Notes |
| --- | --- | --- |
| Chain reads (read-only RPC) | The owner's PC, `node scripts/p0/chain/xlayer-probe.mjs` | `eth_call`, `eth_estimateGas`, `eth_getStorageAt`, block reads. Nothing sent, no key held |
| Synthesis | `host-service` (2 CPU, 7.7 GB, Ubuntu 26.04), throwaway `/tmp/izie-build-test.*` workdir | Yosys 0.70 from the YoWASP wheel, installed by `scripts/p0/setup-yosys.sh` |
| Solver runs and netlist checks | `node-services` (4 CPU, 30 GB, Ubuntu 24.04), throwaway workdir, container `--cpus 2 --memory 8g --network none --user 1000:1000` | OSS CAD Suite build 2026-10-29 (Yosys `0.70+277`, git `77dddbd66`, with native ABC) in `python:3.12-slim@sha256:5e2bdb1b0d542d5039cffb8181c65930093949194a65c365dfb1b0fe13a4fa5b` |

Two Yosys builds are in use: exact 0.70 for synthesis (fits the RAM-backed /tmp on
host-service) and the 2026-10-29 suite for solving (native ABC, which the YoWASP wheel
does not ship as a separate binary). P1 must settle on one binary for both; see section 8.

## 2. Sources read

| Source | Version or date | What was taken from it |
| --- | --- | --- |
| TAP-02, https://github.com/TapeOutProtocol/TAPs/blob/075dd834a72c/TAPs/TAP-02.md | `075dd834a72c`; identical at `527477ecb7cf` (2026-11-10) | Netlist encoding, well-formedness, `tapeout` checks in order (fee, structure, transistor burn), selectors |
| TAP-02 reference implementation and vectors, `assets/tap-02/` | `075dd834a72c`; `vectors.json` SHA-256 `1a02f5cf…203b` matches the TAP | Vendored in `vendor/taps/tap-02/` |
| TapeKit `kernel/src/config.js`, `selectors.js`, `keccak.js` | `37c617e7e332` (2026-10-22) | X Layer addresses, RPC list; L2 contracts share BNB source except four fee constants |
| tapeout.net app bundle `index-DizVcbig.js` | SHA-256 `0c532120c91d15367da384da0dad3692f03acaee321c874aad3963c8c5aebf0c`, read 2026-11-17 | Human-readable ABI (`createCPU`, `mint`, `mintPrice`, `protocolFee`, `TAPEOUT_FEE`, `bem`); X Layer tape-out fee constant 0.0013 OKB; mint cost formula `mintPrice * n + protocolFee` per mint call, paid in BEM when the processor uses BEM |
| Yosys 0.70 help pages (`help abc`, `sat`, `miter`, `synth`, `stat`, `flatten`) | read on host-service from the pinned binary | `abc -g NAND` adds NOT automatically; `sat -prove <sig> 0 -timeout N`; `miter -equiv` |
| ABC help (`iprove`, `dprove`, `dsat`, `cec`, `&cec`, `&sat`) | from the OSS CAD Suite 2026-10-29 `yosys-abc` | `iprove` used as the second engine on combinational miters |
| PyPI JSON for `yowasp-yosys` 0.70.0.0.post1259 and its dependencies | read 2026-11-17 | Exact wheel URLs and SHA-256 in `scripts/p0/setup-yosys.sh` |

## 3. X Layer: what the chain says on 2026-11-17

Command: `node scripts/p0/chain/xlayer-probe.mjs state` (output: `docs/evidence/p0/chain-state.json`).

| Fact | Value | Change from what we recorded on 2026-10-29 and 2026-11-16 |
| --- | --- | --- |
| Block, time | 76,135,331 at 2026-11-17 08:32:47 UTC | |
| Node | `reth/v2.3.0-f60420a/.../xlayer/v0.0.7` | |
| Block gas limit, base fee | 210,000,000; 0.02 gwei | Same |
| Processors | 425 | Same as 2026-11-16 |
| Factory implementation (ERC-1967 slot) | `0x336e9f0f4c3fee7c8c803377e4dea00293f4ae2a` | **Changed.** TapeKit records `0xb41c1e76…293d` as the implementation after the 2026-10-22 freeze. The factory was upgraded again after that. Not sealed (`isSealed() = 0`) |
| Circuit beacon implementation, owner | `0x977f2178…29b2`, owner `0x0` | Same: frozen |
| Processor deploy fee | `deployFee() = 10,000,000` units of BEM (8 decimals) = **0.1 BEM**, pulled by `transferFrom` | **Changed.** Plan said about 0.0066 OKB |
| BEM token | `0x60e62efa9405d6873c5deabd4e6cc91c25363952`, 8 decimals | New to the plan |
| Tape-out fee | `TAPEOUT_FEE() = 0.0013 OKB` (sample processor `0xb57b…e1fb`) | Was "not verified" |
| Transistor mint | `mintPrice` set by the processor's creator; `protocolFee = 0.01 BEM` per mint call (sample processor) | New to the plan |

`createCPU` simulated with `eth_call` (command: `xlayer-probe.mjs create-sim`, output
`docs/evidence/p0/create-sim.json`):

- Without BEM it reverts `ERC20InsufficientAllowance(factory, 0, 10000000)`: the fee is 0.1 BEM.
- With a BEM balance and allowance written by state override it succeeds for a supply of
  1,000,000, 10,000,000 and 100,000,000, and for a mint price of 0. Gas 704,407 (price 0)
  to 724,647 (price 1,000). The supply size does not change the cost.

### Transaction gas cap

There is no 16,777,216 per-transaction cap on X Layer. Command:
`node scripts/p0/chain/xlayer-probe.mjs txcap` scans every 6th block of the last 3,000.
A scan at block 76,134,572 found transaction
`0xaf122c4412098e27085820571e1d9dc5cd1d7b280b8f6affd0854d8194e243d1` in block 76,132,448
(`0x489b060`) with a gas limit of 139,581,444; it used 88,709,982 gas and succeeded
(receipt: `docs/evidence/p0/tx-88m-receipt.json`, read with `eth_getTransactionReceipt`).
A later scan of a different window (`docs/evidence/p0/txcap.json`) found 17,312,972 as the
largest limit, also above 2^24. So a transaction can use at least 88.7 million gas.
The `eth_call` and `eth_estimateGas` endpoints also accept 30,000,000 gas without complaint,
but calls do not prove a transaction cap. Whether one can use the full 210 million block limit is
not yet measured; we will learn it from our own `eval` transaction (section 6).

### Gas per gate for `eval`, measured on X Layer

Command: `node scripts/p0/chain/xlayer-probe.mjs evalgas` (output
`docs/evidence/p0/evalgas.json`). It lists stateless circuits already taped out by other
people and runs `eth_estimateGas` on `eval(id, zero inputs)`.

| Circuit | Gates | Built with | `eval` gas | Gas per gate |
| --- | --- | --- | --- | --- |
| `0x526b…bd0f7` #4 | 1,204 | flat | 2,810,947 | 2,334.7 |
| `0xa476…a707` #3 | 2,355 | flat | 5,454,408 | 2,316.1 |
| `0xaa13…af21` #1 | 2,371 | flat | 5,526,257 | 2,330.8 |
| `0xa93e…2aa3` #3 | 3,829 | flat | 8,979,258 | 2,345.1 |
| `0x69f6…62ca` #1386 | 10,000 | flat | 23,251,463 | 2,325.1 |
| `0xb00e…2f54` #40 | 14,985 | 27 REF records, 6,021 bytes | 37,156,709 | 2,479.6 |
| `0xb00e…2f54` #41 | 141,755 | 5 REF records (nested), 1,415 bytes | reverts at 200,000,000 | above 1,411 |

Reading: a flat circuit costs about **2,316 to 2,345 gas per gate** on X Layer. A circuit
built from REF modules costs about 6% more here, roughly 85,000 gas per REF call.

### REF works on X Layer

Circuits #40 and #41 above are made only of REF records pointing at other circuits on the
same processor, and #41 references circuits that are themselves REF-built. So tape-out
with REF, including nested REF, works on X Layer mainnet today. The TapeOut canvas refuses
REF on L2 ("sub-circuits are currently read from BNB only"); that is a limit of the canvas,
not of the contracts. Our own REF tape-out (section 6) will still confirm it with our circuits.

## 4. Circuit sizes

Command on host-service (inside the workdir after `bash setup-yosys.sh`), one task at a time:

| Run (policy task) | Command | Result |
| --- | --- | --- |
| `p0-synth-all` (first try, stopped by hand) | `bash synth-all.sh tools/yosys` (old version: `synth` ran its own ABC, then `abc -g NAND`) | Wage circuits done; stopped after 13 min inside the first ABC pass of `split_compute_24`. Outputs kept in `out/run1/` |
| `p0-synth-wage-check` | `bash synth-all.sh tools/yosys wage check` (5,400 s limit) | Wage circuits, `split_check_24` (34 s) and `split_check_32` (3,118 s) done. `split_check_40` was still in ABC when the limit was reached |
| `p0-synth-check-narrow` | `bash synth-all.sh tools/yosys check-narrow` | queued |
| `p0-synth-check-40` | `bash synth-all.sh tools/yosys check-40` (21,600 s limit) | queued |
| `p0-synth-compute-24`, `-32`, `-40` | `bash synth-all.sh tools/yosys compute-<w>` (14,400 s limit each) | queued |

Sources: `spikes/p0/rtl/*.v`. Flow per circuit:
`read_verilog; chparam -set W <w>; synth -flatten -top <top> -noabc; abc -g NAND; opt_clean -purge; stat`.
TapeOut gates = NAND + NOT (a NOT is one NAND with both inputs tied). Bytes = 7 per gate,
flat, before splitting into REF modules.

| Circuit | Width | NAND | NOT | TapeOut gates | Flat bytes | Synthesis time |
| --- | --- | --- | --- | --- | --- | --- |
| adder8 (tape-out spike) | 8 | 52 | 38 | 90 | 630 | 0.2 s |
| cn_bonus draft | 32-bit fen | 2,388 | 1,132 | 3,520 | 24,640 | 6.3 s |
| ng_paye draft | 195 input bits | 5,571 | 2,866 | 8,437 | 59,059 | 12.4 s |
| ng_paye mutant (19%) | | 5,697 | 2,900 | 8,597 | 60,179 | 12.0 s |
| split_check | 24 | 14,607 | 6,834 | 21,441 | 150,087 | 34 s |
| split_check | 32 | 23,733 | 11,143 | 34,876 | 244,132 | 3,118 s |
| split_check | 40 | not yet measured | | | | |
| split_compute | 24, 32, 40 | not yet measured | | | | |

Synthesis time grows far faster than size: ABC inside the WebAssembly build spent 52 minutes
on the width-32 check circuit. The width-24 compute circuit had 40,671 internal cells before
mapping, about twice the check circuit, because of the divider.

These are first drafts with no gate optimisation. The NOT share is about a third; a cost-aware
mapping (both gates cost 1) is a P1 task and can only lower the counts.

### Netlist bytes checked against the TAP-02 reference

Run `p0-convert-check-1` on node-services:
`bash convert-check.sh adder8 cn_bonus ng_paye ng_paye_mutant19 split_check_24`, which runs
`scripts/p0/yosys2tap.py` (Yosys JSON to TAP-02 bytes) and `scripts/p0/check_tap.py` (the
vendored TAP-02 `reference.py` evaluator against a plain Python version of each formula).
Cases: boundaries of every field, every bonus bracket edge and one fen either side, PAYE gross
at each band edge and at 840,000 and 840,001, then random inputs (seed 20261117).

| Circuit | Gates after output placement | Bytes | Cases | Mismatches |
| --- | --- | --- | --- | --- |
| adder8 | 90 | 630 | 1,012 | 0 |
| cn_bonus | 3,573 | 25,011 | 1,024 | 0 |
| ng_paye | 8,482 | 59,374 | 1,050 | 0 |
| ng_paye_mutant19 | 8,643 | 60,501 | 1,050 | 0 |
| split_check_24 | 21,441 | 150,087 | 424 | 0 |

The converter adds a few gates where an output must be moved to the end of the netlist (53 on
cn_bonus, 45 on ng_paye). Files for tape-out: `spikes/p0/tap/*.tap.json`.

## 5. Solver timing

Command on node-services (inside the container):
`bash prove-all.sh <timeout-seconds> 2 [job regex]`. Facts: `spikes/p0/facts/*.v`. Each fact
is a module with output `bad`, 1 exactly when the input is valid and the fact is broken. Both
engines run on the synthesised NAND netlists, flattened with the fact:

- Yosys: `sat -prove bad 0 -timeout T -show-inputs`. "holds" = `SUCCESS!`, "fails" = `FAIL!` with the input printed.
- ABC: `write_aiger`, then `yosys-abc -c "read_aiger m.aig; print_stats; strash; iprove -v"`, wall clock limited by `timeout`. "holds" = final line `UNSATISFIABLE`, "fails" = `SATISFIABLE`.

Calibration (run `p0-prove-calibrate`, `bash prove-all.sh 300 2 'cn_raise|ng_tax_within_income|ng_mutant_equal'`).
The first ABC parser reported "holds" for all three; it matched a verbose line, not the
result. It was fixed to read only the final line and re-run. The first container ran as root
and left root-owned files; they were handed back to uid 1000 by a container limited to the
workdir, and every container now runs with `--user 1000:1000`. Both engines now agree:

| Check | Expected | Yosys `sat` | ABC `iprove` |
| --- | --- | --- | --- |
| cn_bonus: a raise never lowers take-home | fails | fails, 1.1 s | fails, 0.7 s |
| ng_paye draft equals the 19% mutant | fails | fails, 2.5 s | fails, 0.5 s |
| ng_paye: tax never exceeds gross | holds | holds, 1.1 s | holds, 0.1 s |

### split-v1, check circuit, width 24

Run `p0-prove-check-24`: `bash prove-all.sh 900 2 'check_unique-24|check_more_shares-24'`.

| Fact | Yosys `sat` | ABC `iprove` |
| --- | --- | --- |
| At most one payout is accepted (`check_unique`) | undecided at 900 s | undecided at 900 s |
| Accepted payouts never fall when shares rise (`check_more_shares`) | undecided at 900 s | undecided at 900 s |

Miter sizes: 21,896 and 28,660 AND nodes. Both facts compare products of two 24-bit
multipliers, which is the known hard case for SAT solvers. Narrower widths (8, 12, 16) are
queued to find the width at which these facts finish, as decision rule 2 needs.

Not yet measured: compute-circuit facts at any width; check-circuit facts at 32 and 40;
longer time limits.

## 5a. Bonus rule: the six traps, found by the solver alone

The first fact (`cn_raise`: b1 < b2 gives net(b2) >= net(b1)) failed at the 960,000 yuan edge
only, because a solver returns one counterexample per question. To find every trap without
telling the solver where the brackets are, the question was narrowed to a one-fen raise:
"is there a bonus b with net(b + 1) < net(b), other than the points already found?" Each answer
is excluded and the question asked again.

Run `p0-bonus-traps`, `bash bonus-traps.sh 600 12` (`scripts/p0/bonus-traps.sh`). A first
version used Yosys `sat` and found 960,000 yuan in 40.6 s, then query 2 was undecided after
600 s (kept in `proofs/bonus-traps-sat/`). The search was moved to ABC `iprove` with
`write_cex`, and every point found is replayed with Yosys `sat -set b <value> -prove bad 0`:

| Query | Bonus where one more fen lowers take-home | Solve time | Replay |
| --- | --- | --- | --- |
| 1 | 66,000,000 fen = 660,000.00 yuan | 0.3 s | Yosys FAIL at b (confirmed) |
| 2 | 30,000,000 fen = 300,000.00 yuan | 0.4 s | confirmed |
| 3 | 96,000,000 fen = 960,000.00 yuan | 0.3 s | confirmed |
| 4 | 42,000,000 fen = 420,000.00 yuan | 0.3 s | confirmed |
| 5 | 3,600,000 fen = 36,000.00 yuan | 0.5 s | confirmed |
| 6 | 14,400,000 fen = 144,000.00 yuan | 0.5 s | confirmed |
| 7 | "is there any other?" | undecided at 600 s | |

All six published trap points were found from the circuit alone and match the published
tables. The proof that there is no seventh is not yet done. Run `p0-bonus-complete`
(`bash bonus-complete.sh 600 2`) splits the 32-bit range into 64 equal slices by its top 6
bits, which carries no bracket knowledge, and asks each slice separately. Status: running.

These are trap edges (the first fen where pay drops). The full trap ranges (every bonus that
takes home less than the edge) are the P3 trap finder's output.

## 6. Contracts, permissions and costs for our own processor

Commands (read-only, owner's PC): `node scripts/p0/chain/research/trace-create.mjs https://xlayer.drpc.org`
(call trace of a simulated `createCPU`, output `p0/trace-create.txt`),
`research/mint-sim.mjs` (`p0/mint-sim.txt`), `research/trace-mint-eval.mjs`
(`p0/trace-mint-eval.txt`), `research/factory-limits.mjs` (`p0/factory-limits.json`),
`xlayer-probe.mjs selectors <rpc> <address>` (`p0/selectors.txt`; unnamed selectors looked
up in the openchain.xyz signature database).

What `createCPU` does today (trace): pulls the 0.1 BEM fee from the caller with
`transferFrom`; creates the transistor contract as a beacon proxy on beacon
`0x41Cb2bfd1cccA8f505EEDad0181eef44f1B9Ce65` (implementation `0x44Ebf3345bcf9aB329e7a28E53fd8EcfAd1a5EFE`);
creates the circuits contract on beacon `0xf70d1ed4f62CF3780157B0b421b7E2F45bD0991C`
(implementation `0x977f217887E085D298Cb3819cDAD5A0ee35F29B2`); initialises both. The factory's
`transistorBeacon()` getter returns a different beacon (`0x1059ad62cabb6a6925bb65aa617300556c60a51b`),
but the trace shows `0x41Cb…Ce65` is the one used. Both beacons in use have `owner() = 0x0`:
their implementations cannot change.

| Item | Finding |
| --- | --- |
| BEM token | `0x60e62Efa9405d6873C5deaBD4E6CC91c25363952`, 8 decimals. Same address from `bem()` on the factory, from the X Layer config in the tapeout.net app bundle (`bem:"0x60e62Efa9405d6873C5deaBD4E6CC91c25363952"`, next to the factory address), and as the token `createCPU` calls `transferFrom` on |
| One `mint` call | Can take the whole remaining supply. Simulated on processor #423 (same beacon, price 0, 999,185 left): `mint(0, 999185)` succeeds, about 112,000 gas; `mint(0, 999186)` reverts `supply cap`; id 2 reverts `bad id`. A mint with any OKB value reverts on a BEM processor |
| Mint fee | `mintPrice * n + protocolFee`, in BEM. `mint` makes no call to the factory (trace): the protocol fee is fixed in our contract at creation |
| Transistor contract setters | None for name, symbol, story, creator, supply, mint price, protocol fee or BEM address (full selector list). It has `withdraw()` and `owed(address)` for the creator's mint income, and `burnFrom` used by tape-out |
| Circuits contract | No setters. Netlists have no setter; `TAPEOUT_FEE` is fixed in the frozen implementation. Circuit NFTs are ordinary ERC-721 tokens and can be transferred |
| Factory (owner `0xb3d85b42a045c1a88d800cad0f55d2566a4d3138`, UUPS, not sealed) | Owner can upgrade it, `seal()` it, and set `deployFee` (cap 100 BEM), `protocolFee` for processors created later (cap 10 BEM per mint) and `protocolWallet`. `MAX_MINT_PRICE` 10,000 BEM per transistor |
| `eval` and the factory | `eval` calls only the circuits beacon and the circuit implementation, for flat and REF circuits alike (trace of #40 and of a flat circuit). With the factory's code replaced by code that always reverts (state override), `eval` of REF-built circuit #40 still returned its result |
| Tape-out and the factory | TAP-02 section 3 rule 6: a REF target must pass `isCPU` on the factory at tape-out time. Not traced here |

## 7. On-chain spikes with the owner's wallet

Not yet run. Owner's deployer address: `0x5c807eA36fC11a72192d83ecff2b3D4746767612`. Signing:
`cast send ... --account payproof-deployer` on the owner's PC, one transaction at a time,
printed by `node scripts/p0/tx/print-tx.mjs <owner> <step> ...`. The printer refuses any
destination other than the BEM token, the factory, or a transistor or circuits contract the
factory lists whose creator is the owner; it refuses if `deployFee` is not 10,000,000; it
approves exact amounts only. Checked: pointed at another person's processor, or at the factory
as if it were a circuits contract, it refuses and prints nothing.

`cast` 1.7.1 takes calldata only on the command line (`--data <hex>` or a signature with
arguments; `cast send --help`), and Windows command lines stop at 32,767 characters. One
`cast send` therefore carries at most about 16,000 bytes of netlist, about 2,280 gates.
Larger circuits are measured with `print-tx.mjs estimate-tapeout` (simulation from the owner's
address, which has no length limit) and are taped out as REF modules at P2.

| Spike | Result |
| --- | --- |
| Create the Payproof processor | not yet run |
| Mint the transistor supply | not yet run |
| Tape out adder8 | not yet run |
| Tape out a circuit that uses REF | not yet run |
| Tape-out gas for cn_bonus, ng_paye, split_check (simulation from the owner's address) | not yet run |
| `eval` gas of our own circuits | not yet run |

## 8. Cost per claim (check circuit), from measured gas per gate

`eval` gas = gates x 2,316 to 2,345 (flat, section 3); a REF-split circuit about 6% more.
Network fee at the base fee read on 2026-11-17, 20,000,001 wei per gas. The vault's own work
around the `eval` (share lookups, transfer) is not measured yet and is not included.

| Option | Gates | `eval` gas (flat to REF-split) | Fee per claim | Share of a 210 M block |
| --- | --- | --- | --- | --- |
| Check, 24-bit | 21,441 | 49.7 M to 53.2 M | about 0.0010 to 0.0011 OKB | 24% to 25% |
| Check, 32-bit | 34,876 | 80.8 M to 86.5 M | about 0.0016 to 0.0017 OKB | 38% to 41% |
| Check, 40-bit | not yet measured | | | |
| Compute, any width | not yet measured | | | |

Range of one W-bit amount: 0 to 2^W - 1 units. The unit is a design choice for the vault
(amounts are scaled to it before they reach the circuit):

| Width | Largest value | With unit 0.000001 token | With unit 0.01 token |
| --- | --- | --- | --- |
| 24 | 16,777,215 units | 16.777215 tokens | 167,772.15 tokens |
| 32 | 4,294,967,295 units | 4,294.967295 tokens | 42,949,672.95 tokens |
| 40 | 1,099,511,627,775 units | 1,099,511.627775 tokens | 10,995,116,277.75 tokens |

## 9. Decisions

Not yet taken. Rules applied once sections 4 to 8 are complete: (1) if a claim fits under the
gas cap with the compute circuit, use it, otherwise the check circuit, and if neither fits,
narrow the widths and state the supported range; (2) publish split facts at the widest width
the solver proves, state any narrower width in the proof record, and label random or
exhaustive checking above it as testing, not proof; (3) wage rules are proven whole if the
solver finishes, otherwise per module, and the record says which. The owner has asked for the
options with cost per claim before any choice is made.

## 10. Open items found during P0

- The factory implementation changed after the 2026-10-22 freeze (section 3). It cannot change
  how existing circuits evaluate (section 6), but it can change fees and tape-out checks.
- Processor creation and transistors are paid in BEM. The owner needs a small BEM balance.
- Two Yosys builds (section 1). P1 picks one and records it in VERSIONS.md.
- Standalone ABC is not in the YoWASP wheel; ABC proofs need the native suite.
- Multiplier facts are undecided at 900 s even at 24 bits (section 5).
- Synthesis of large circuits on host-service is slow (52 min for the 32-bit check circuit).
- Tape-outs above about 2,280 gates do not fit one `cast send` on Windows (section 7).
