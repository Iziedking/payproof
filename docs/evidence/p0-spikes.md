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
| `p0-synth-check-narrow` | `bash synth-all.sh tools/yosys check-narrow` | Widths 8, 12 and 16 done (0.9 s, 244 s, 127 s) |
| `p0-synth-check-40` | `bash synth-all.sh tools/yosys check-40` (21,600 s limit) | Done in 5,493 s |
| `p0-synth-compute-24` | `bash synth-all.sh tools/yosys compute-24` (14,400 s limit) | No result: started 11:50 UTC, process gone at 18:32 UTC, the log still ends inside ABC (`Extracting gate netlist of module split_compute`, 40,671 cells). No netlist and no summary line were written. The local SSH session had dropped, so the exact end cause was not captured |
| `p0-synth-compute-32` | `bash synth-all.sh tools/yosys compute-32` (14,400 s limit) | No result: started 2026-11-17 18:33 UTC inside a remote `timeout 14400s`; no process left when checked 2026-11-19 09:51 UTC; the log was last written 18:34 UTC and ends inside ABC (`Extracting gate netlist of module split_compute`). No netlist and no summary line. Consistent with the 4-hour limit; the exit status was not captured |
| `p0-synth-compute-40` | `bash synth-all.sh tools/yosys compute-40` (14,400 s limit) | No result: started 2026-11-19 09:51 UTC (two earlier attempts never started: one refused at SSH connect, then the local watcher stopped without output). Still running at 13:42 UTC; no Yosys process left when checked 15:50 UTC. The log was last written 09:52 UTC and ends inside ABC (`Extracting gate netlist of module split_compute`, 97,376 cells). No netlist and no summary line. Consistent with the 4-hour limit (due about 13:51 UTC); the local SSH session dropped at 13:40 UTC, so the exit status was not captured |

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
| split_check | 40 | 34,875 | 16,331 | 51,206 | 358,442 | 5,493 s |
| split_check | 8 | 2,720 | 1,259 | 3,979 | 27,853 | 0.9 s |
| split_check | 12 | 4,845 | 2,292 | 7,137 | 49,959 | 244 s |
| split_check | 16 | 7,584 | 3,584 | 11,168 | 78,176 | 127 s |
| split_compute | 24 | no result: ABC did not finish in 6 h 42 min (see above) | | | | |
| split_compute | 32 | no result: ABC did not finish within the 4-hour limit | | | | |
| split_compute | 40 | no result: ABC did not finish within the 4-hour limit | | | | |

The widths 8, 12 and 16 exist to find the widest width at which the split facts finish
(section 5). The 12-bit run took longer than the 16-bit run; ABC run time does not follow size.

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
multipliers, which is the known hard case for SAT solvers. The netlists at widths 8, 12 and 16
are synthesised (section 4) and were copied to node-services (sha256 checked against
host-service). They find the width at which these facts finish, as decision rule 2 needs.

### split-v1, check circuit, widths 8, 12 and 16

Run `p0-prove-check-narrow` (started 2026-11-19 10:04 UTC, container `payproof-p0-chk-narrow`,
`--cpus 2 --memory 8g`): `bash prove-all.sh 900 2 'check_unique-(8|12|16)|check_more_shares-(8|12|16)'`.
`prove-all.sh` now lists jobs for widths 8, 12, 16, 24, 32 and 40. The run ended
2026-11-19 11:36 UTC. Limit 900 s per engine per fact.

| Fact | Width | Yosys sat | Time (s) | ABC iprove | Time (s) |
| --- | --- | --- | --- | --- | --- |
| check_unique | 8 | undecided | 960.0 (killed) | holds | 278.6 |
| check_more_shares | 8 | undecided | 960.0 (killed) | undecided | 900.0 |
| check_unique | 12 | undecided | 960.0 (killed) | undecided | 900.0 |
| check_more_shares | 12 | undecided | 960.0 (killed) | undecided | 900.0 |
| check_unique | 16 | undecided | 905.9 | undecided | 900.0 |
| check_more_shares | 16 | undecided | 906.9 | undecided | 900.0 |

- "holds" for check_unique at 8 bits: the ABC log ends `UNSATISFIABLE  Time =   278.49 sec`
  (1,537,254 conflicts).
- At 8 and 12 bits Yosys sat did not stop at its own 900 s limit. The outer
  `timeout` (limit + 60 s) killed it while the log still read
  `Solving problem with 48316 variables and 123394 clauses..` (8 bits, check_unique).
  At 16 bits it stopped itself after 900 s.
- Only one of the six width-and-fact pairs proved. check_more_shares did not prove at any
  width from 8 to 24 within 900 s. Decision rule 2 (the widest width the solver proves) has
  no width where both check facts hold at this limit.

### split-v1, check circuit, widths 8, 12 and 16, longer limit

Run `p0-prove-check-long` (started 2026-11-19 11:43 UTC, container `payproof-p0-chk-long`,
`--cpus 3 --memory 8g`): `bash prove-all.sh 3600 3 'check_unique-(12|16)|check_more_shares-(8|12|16)'`.
It reruns the five pairs left undecided at 900 s, with 3600 s per engine. check_unique at 8
bits is not rerun. The 900 s logs were copied to `proofs-900s/` on the host before the run.
The container was gone at 2026-11-19 15:48 UTC.

| Fact | Width | Yosys sat | Time (s) | ABC iprove | Time (s) |
| --- | --- | --- | --- | --- | --- |
| check_more_shares | 8 | undecided | 3660.2 (killed) | undecided | 3600.1 (rc 124) |
| check_unique | 12 | undecided | 3660.1 (killed) | undecided | 3600.1 (rc 124) |
| check_more_shares | 12 | undecided | 3660.1 (killed) | undecided | 3600.0 (rc 124) |
| check_unique | 16 | undecided | 3660.1 (killed) | undecided | 3600.0 (rc 124) |
| check_more_shares | 16 | undecided | 3660.1 (killed) | undecided | 3600.1 (rc 124) |

- All ten engine runs ran to the limit with no answer. Yosys sat was killed by the outer
  `timeout` (limit + 60 s) in every case; ABC iprove was stopped by `timeout` (rc 124).
- With four times the limit, nothing new proved. The only proved check fact is still
  check_unique at 8 bits. check_more_shares has no result at any width from 8 to 24.
- So decision rule 2 still has no width where both check facts hold, now at 3600 s as well
  as 900 s.

### split-v1, check circuit, width 32

Queued 2026-11-19 after the owner chose the 32-bit check circuit (section 9). Run
`p0-prove-check-32`, container `payproof-p0-chk-32`, `--cpus 2 --memory 8g`:
`bash prove-all.sh 3600 2 'check_unique-32|check_more_shares-32'`. It starts when
`payproof-p0-chk-long` ends. Netlist `split_check_32.nand.v` copied from host-service to
node-services; sha256 `81254c0a…7ae5f0` on both. Container up at 2026-11-19 15:49 UTC, after
`payproof-p0-chk-long` ended. Both jobs ran in parallel; the result files were written at 16:48
UTC (Yosys) and 17:49 UTC (ABC), and the container was gone afterwards. The local SSH session
dropped at 16:25 UTC; the remote run was not affected.

| Fact | Width | Yosys sat | Time (s) | ABC iprove | Time (s) |
| --- | --- | --- | --- | --- | --- |
| check_unique | 32 | undecided | 3660.2 (killed) | undecided | 3600.0 (rc 124) |
| check_more_shares | 32 | undecided | 3660.3 (killed) | undecided | 3600.0 (rc 124) |

- Yosys built problems of 424,261 variables and 1,083,537 clauses (check_unique) and 425,611
  variables and 1,087,457 clauses (check_more_shares), about nine times the 8-bit size, and was
  killed by the outer `timeout` while still solving.
- Neither 32-bit fact proved. Across every run so far (900 s at 8 to 24 bits, 3,600 s at 8 to 16
  and 32 bits), the only proved check fact is check_unique at 8 bits.

Not yet measured: compute-circuit facts at any width (no compute netlist exists); check-circuit
facts at 24 and 40 with limits longer than 900 s.

### split-v1 check facts, proof in parts (spikes A and B)

The owner chose, 2026-11-19, to try a proof in three parts instead of one solver run on the
netlist: (A) the facts hold for the integer predicate the RTL computes, at every width; (B) the
NAND netlist equals the RTL; (C) only if B stalls, a per-module proof with arithmetic-aware
checkers. If A and B both hold at a width, the facts hold on that netlist. This is a different
method from the one decision rule 2 assumed, and the proof record will say so.

Tools, all from oss-cad-suite 20261029 on node-services, versions and options read from their
help text 2026-11-19: Z3 4.15.5, cvc5 1.0.1-dev (git 77d0bec48), Yosys 0.70+277, yosys-abc `cec`.
Scripts: `scripts/p0/prove-split.sh`, `spikes/p0/split-proof/*.smt2`.

**Spike A** (run `p0-split-smt`, 2026-11-19 19:40 to 19:50 UTC, container
`payproof-p0-split-smt`, `--cpus 2`, 600 s per solver per file). Integers are unbounded, so a
result holds at every width.

| Claim | File | Z3 | cvc5 |
| --- | --- | --- | --- |
| No wire in `split_check.v` overflows, any W (N = 2^W) | `no_overflow.smt2` | holds (unsat), 1.1 s | holds (unsat), 0.4 s |
| check_unique: two different payouts are never both accepted | `unique.smt2` | holds (unsat), 0.8 s | undecided: timed out at 600.5 s, then aborted (exit 134) |
| check_more_shares: the payout never falls when shares rise | `more_shares.smt2` | holds (unsat), 1.2 s | holds (unsat), 0.3 s |
| Calibration: a false claim (upper bound p+2) | `unique_wrong.smt2` | sat, 1.1 s (as required) | sat, 0.1 s (as required) |

- Both solvers answered `sat` on the false claim, so neither is answering unsat blindly.
- check_unique is proved by Z3 only; cvc5 gave no answer. check_more_shares and the no-overflow
  bound are proved by both.
- What spike A covers: the integer predicate
  `total > 0, shares <= total, payout*total*10000 <= pot*8500*shares < (payout+1)*total*10000`,
  and that the RTL's wire widths hold every value of it. It does not cover the netlist; that is
  spike B.

**Spike B, 8-bit calibration** (run `p0-split-cec-8`, 2026-11-19 19:50 to 20:06 UTC, container
`payproof-p0-split-cec-8`, `--cpus 2`, limit 900 s). Yosys mapped the RTL to an AIG without ABC
(`gold.aig`); the netlist `split_check_8.nand.v` was mapped the same way (`gate.aig`); ABC
`cec -T 900 -C 1000000000 -v` compared them, matching ports by name.

| Comparison | Result | Time (s) |
| --- | --- | --- |
| Mutant RTL (HOLDER_BPS 8499) against the netlist | not equivalent, as required | 3.1 |
| RTL against the netlist | undecided: no verdict, killed by the outer `timeout` | 960.1 (rc 124) |

- ABC prints `Networks are NOT EQUIVALENT` with a counterexample. For the mutant it gave
  payout 108, pot 159, shares 183, total 229. Checked by hand: 159 x 183 x 8500 / (229 x 10000)
  = 108.0019, so the netlist accepts 108; with 8499 it is 107.989, so the mutant rejects it.
  The check does catch a one-unit change, and the netlist agrees with the correct formula there.
- ABC did not stop at its own `-T 900` limit; the outer `timeout` (limit + 60 s) ended it, as
  with Yosys `sat` in the earlier runs.
- The netlist-against-RTL equivalence did not finish at 8 bits in 900 s. Spike B as built
  (one flat `cec`) therefore stalls even at the narrowest width, and the 32-bit run
  `p0-split-cec-32` was not started.

Status after spikes A and B: the facts are proved for the integer predicate (both facts by Z3,
one also by cvc5, the bound by both), and the RTL computes that predicate without overflow. That
the NAND netlist equals the RTL is not proved at any width. So nothing is yet proved about the
netlist that would be taped out. The trigger for spike C (B stalls) is met; spike C waits for the
owner.

### split-v1 check facts, spike C (arithmetic-aware checkers)

The owner started spike C on 2026-11-19. Before splitting the RTL into modules, the plan was to
try ABC's arithmetic-aware commands on the whole circuit, after first testing each command on a
plain multiplier whose answer is known. Tools as in spike B, plus `&acec`, `&polyn` and `&cec`
from the same `yosys-abc`. Source read for `&acec`: `src/proof/acec/acecCore.c`, YosysHQ/abc
branch `yosys-experimental` (adder-tree matching, then ordinary equivalence checking; its Booth
path is disabled). Source read for the `&cec` messages: `src/proof/cec/cecCec.c`, same branch,
read 2026-11-20. No source was found for the `&polyn -S` wrapper, so its output is read only
against the calibration below.

**Calibration circuit.** `spikes/p0/rtl/mul.v`, an 8x8 multiplier, synthesised on host-service
(run `p0-synth-mul-8`) to `mul_8`: 463 NAND and 226 NOT, 689 gates. The mutant changes one gate,
the 40th NAND, into an AND (`_0392_ = a[0] & b[2]`).

**Step 1** (run `p0-split-alg-8`, node-services, 600 s per command). The first run used a
missing `rtl/mul.v` on node-services, so every gold-multiplier command failed; those logs are
kept in `proofs-split/alg-8-run1/` and the run was repeated after the file was copied.

| Comparison | Result | Time (s) |
| --- | --- | --- |
| `cec` multiplier RTL against the one-gate mutant | not equivalent, as required | 0.1 |
| `cec` multiplier RTL against its netlist, by port name (run inside the hook, see below) | equivalent | 23.7 |
| `&acec` multiplier netlist | "not equivalent", with a counterexample that is false (see below) | 0.1 |
| `&acec` multiplier mutant | not equivalent | 0.0 |
| `&polyn -S` on the RTL and on the netlist | 64 input monomials each, with the product's coefficient pattern | 16.3 and 0.0 |
| `&polyn -S` on the mutant | 68 input monomials, some with negative coefficients | 0.0 |
| `&acec` whole 8-bit check circuit, RTL against netlist | equivalent | 60.2 (first run 58.9) |
| `&acec` 8-bit check, mutant (HOLDER_BPS 8499) against netlist | not equivalent, as required | 0.1 |

- **`&acec` is not sound in this build.** On the correct multiplier netlist it reported
  "Matching of adder trees succeeded" and then "Networks are NOT EQUIVALENT" with a
  counterexample. Plain `cec` proves the same pair equivalent, so that counterexample is false.
  No `&acec` verdict is relied on by itself.
- Its 8-bit check result came from the fallback: it found no adder boxes in the check circuit and
  ran ordinary equivalence checking, which said equivalent. That needed a second check; see step 3.
- `&polyn -S` gave the expected product polynomial for the correct multiplier and a different one
  for the mutant. `-w` did not list individual terms, so only the counts and coefficient
  histogram are compared.
- Rule slip, 2026-11-19: the by-name `cec` on the multiplier (22.8 s, equivalent) was first run
  by hand over ssh on node-services, outside the resource hook. It was repeated inside the
  hooked run `p0-split-miter-8` (23.71 s, equivalent); that is the result in the table.

**Step 2** (run `p0-split-acec-32`, `--cpus 3`, limit 3,600 s). `&acec` on the 32-bit check
circuit aborted after 0.3 s on an internal assertion (`acecXor.c:102`, in
`Acec_OrderTreeRoots`), exit 134, for both the RTL and the mutant. No result at 32 bits.

**Step 3, miter** (runs `p0-split-miter-8`, 2026-11-19 23:05 UTC, limit 900 s, and
`p0-split-miter-32`, 2026-11-19 23:07 UTC to 2026-11-20 01:10 UTC, `--cpus 3`, limit 3,600 s per pair). Yosys built one
design from the RTL (with `chparam`) and the netlist, joined them with `miter -equiv -flatten`
(ports matched by name) and wrote an AIG; ABC `&cec -m -v -T <limit>` checked that the miter
output can never be 1.

| Pair | Result | Time (s) |
| --- | --- | --- |
| mul8: multiplier RTL against its netlist | equivalent | 9.01 |
| mul8mut: multiplier RTL against the mutant | not equivalent; already differs on the all-zero input | 0.00 |
| check8: 8-bit check RTL against its netlist | **equivalent** | 67.95 |
| check8mut: mutant RTL (8499) against the 8-bit netlist | not equivalent, with a counterexample | 0.01 |
| check32: 32-bit check RTL against its netlist | **undecided**: no verdict at the limit, killed by the outer `timeout` | 3,660.0 (rc 124) |
| check32mut: mutant RTL (8499) against the 32-bit netlist | **undecided**: no verdict at the limit, killed by the outer `timeout` (should be not equivalent) | 3,660.0 (rc 124) |

- `&cec` first runs a newer engine. When that one gives up it prints "UNDECIDED after the new CEC
  engine" and runs the older engine, whose verdict is final. For mul8 and check8 the newer engine
  gave up after 9.00 s and 67.94 s, and the older one then proved them in about 0.01 s more.
  The run's `summary.txt` recorded the first, intermediate line for these two. That is a script
  error, fixed in `prove-split.sh` (it now takes the last verdict line); the logs, copied
  unchanged, show the final verdicts.
- "Output 0 trivially differs (different phase)" means the two sides already disagree on the
  all-zero input (`cecCec.c`). That fits the mutant: at all-zero inputs the original NAND outputs
  1 and the AND outputs 0.
- check32: the newer engine gave up at 2,228.5 s, having reduced the miter by only 2% (46,696 to
  45,747 nodes). The older engine was still running when the limit ended the run. ABC's own
  total line printed a negative time (-2,066.45 s); that is ABC's clock display, not a result.
- check32mut went the same way: the newer engine gave up at 2,093.1 s (46,996 to 46,070 nodes,
  2%), and the older engine was still running at the limit. The mutant differs from the netlist
  (the 8-bit mutant was caught in 0.01 s), so at 32 bits this method did not find even a known
  difference within 3,600 s. The 32-bit gold result is therefore no evidence either way.
- The miter method passes its calibration at 8 bits: it proves the two known-equal pairs and
  catches both mutants. At 32 bits it gives no verdict on either side.

Status after spike C on the whole circuit: at 8 bits, the NAND netlist equals the RTL. Two ABC
routes agree (`&acec` fallback, 58.9 and 60.2 s; miter and `&cec`, 67.95 s). Both are ABC
equivalence checking, so this is one tool family, not two independent tools. With spike A, the
check facts therefore hold on the 8-bit netlist. At 32 bits, the width the owner chose, netlist
equals RTL is undecided: `&acec` crashes, and `&cec` gives no verdict in 3,600 s on the correct
circuit or on the mutant. Nothing about the
split facts is proved on the 32-bit netlist. The next step in the plan is the module split, which
waits for the owner.

### split-v1 check circuit, module split, step 0: size

The owner approved the module split on 2026-11-20 and asked for step 0 first: measure what the
split costs in gates before any proof work. `spikes/p0/rtl/split_check_mod.v` cuts the check
circuit into six modules, each computing one wire of `split_check.v` with the same expression and
width: `m_mul` (used twice: payout x total, pot x shares), `m_x10000_wide` (pt x 10000),
`m_x10000_narrow` (total x 10000), `m_x8500` (ps x HOLDER_BPS), `m_add` (lhs + t10k) and `m_cmp`
(the input checks and both comparisons). The top module only wires them together.

Synthesis (run `p0-synth-check-mod`, host-service, 2026-11-20 01:31 UTC, group `check-mod-8`
then `check-mod-32` in `scripts/p0/synth-all.sh`): the same flow as the flat circuits but
without `-flatten`, so `synth` and `abc -g NAND` work on each module alone. Yosys 0.70 help, read
on host-service the same day: `synth` keeps the hierarchy without `-flatten`, and its `opt` steps
cross modules only with `-hieropt`, which is not passed. The hierarchical netlist is written
(`*.mods.nand.v`), then `flatten; opt_clean -purge` joins the modules without further
optimisation. The flat file (`*.nand.v`) is the one that would be taped out.

| Module | Gates at 8 bits | Gates at 32 bits |
| --- | --- | --- |
| `m_mul` (x2) | 689 each | 12,322 each |
| `m_x10000_wide` | 799 | 3,306 |
| `m_x10000_narrow` | 354 | 1,623 |
| `m_x8500` | 870 | 3,624 |
| `m_add` | 314 | 804 |
| `m_cmp` | 616 | 1,833 |
| **Joined** | **4,331** (2,834 NAND, 1,497 NOT) | **35,834** (24,033 NAND, 11,801 NOT) |
| Flat `split_check`, for comparison | 3,979 | 34,876 |
| Difference | +352 (+8.8%) | +958 (+2.7%) |

- Synthesis took 1.0 s at 8 bits and 4.4 s at 32 bits, against 3,118 s for the flat 32-bit
  circuit. ABC on the flat circuit spends its time optimising across the whole design.
- The 8-bit `m_mul` has 689 gates, the same count as the calibration multiplier `mul_8`
  (spike C). The two netlists have not been compared gate by gate.
- Gas for the joined 32-bit circuit, from the measured cost per gate (section 3): 83.0 M to
  84.0 M as a flat circuit (2,316 to 2,345 gas per gate), and 88.85 M at the REF-split rate
  (2,479.6). Against the largest transaction seen on X Layer, 88,709,982 gas: 5.3% to 6.5% under
  as a flat circuit, 0.16% over at the REF-split rate. Network fee at 20,000,001 wei per gas:
  0.00166 to 0.00178 OKB. Share of a 210 M block: 39.5% to 42.3%. The vault's own gas around the
  `eval` is still not counted. The largest transaction seen is a data point, not a cap (section
  3 found no transaction gas cap below the block limit).
- TAP-02 check (run `p0-convert-check-mod`, node-services, container `payproof-p0-conv-mod`,
  `--cpus 2`): `yosys2tap.py` converted both joined netlists with no gates added for output
  placement (4,331 gates, 30,317 bytes; 35,834 gates, 250,838 bytes), and the TAP-02 reference
  evaluator matched the plain Python formula on every case: 2,024 cases at 8 bits and 424 at 32
  bits, 0 mismatches. This is testing, not proof. Files: `spikes/p0/tap/split_check_mod_*.tap.json`.

Step 0 result: the module split costs 958 gates at 32 bits. As a flat tape-out it stays under the
largest transaction seen; built from REF modules at the measured REF rate it would be just over
it. Steps 1 to 4 (the proofs) have not started; the multiplier checker for step 2 needs the
owner's approval before it is downloaded.

### split-v1 check circuit, module split, steps 1 and 3: joining

The owner approved steps 1 and 3 on 2026-11-20. Run `p0-split-comp` (node-services, container
`payproof-p0-split-comp`, `--cpus 2`, 2026-11-20 02:26 UTC, limit 900 s per pair), part `comp`
of `scripts/p0/prove-split.sh`. Each pair is joined with Yosys `miter -equiv -flatten` (ports
matched by name) and checked with ABC `&cec -m`, as in spike C step 3.

- Step 1: the joined RTL (`split_check_mod.v`) against the original RTL (`split_check.v`).
- Step 3: the flat netlist that would be taped out (`split_check_mod_<w>.nand.v`) against the
  per-module netlist it was flattened from (`split_check_mod_<w>.mods.nand.v`).

Each has a control that must come back not equivalent:

- Step 1 at 8 bits uses HOLDER_BPS 8499. At 32 bits the 8499 control was not caught in 3,600 s
  in spike C, so step 1 at 32 bits uses a different one: `MUTANT_VALID_OR`, a switch in
  `split_check_mod.v`, off by default, that writes the input check with `||` instead of `&&`.
- Step 3 uses the flat netlist with its 40th NAND turned into an AND.

| Pair | Result | Time (s) |
| --- | --- | --- |
| s1-8: joined RTL against original RTL, 8 bits | equivalent | 0.00 |
| s1-8mut: control, HOLDER_BPS 8499 | not equivalent, as required | 0.01 |
| s1-32: joined RTL against original RTL, 32 bits | **equivalent** | 0.00 |
| s1-32mut: control, `MUTANT_VALID_OR` | not equivalent, as required | 102.60 |
| s3-8: flat netlist against the per-module netlist, 8 bits | equivalent | 0.00 |
| s3-8mut: control, one gate changed (`_0092_`) | not equivalent, as required | 0.00 |
| s3-32: flat netlist against the per-module netlist, 32 bits | **equivalent** | 0.00 |
| s3-32mut: control, one gate changed (`_00185_`) | not equivalent, as required | 342.55 |

- Every gold pair hashed to the same gates, so ABC decided it before any SAT call. That is what
  joining without optimisation should give, and the controls show the miters do compare the
  output: a change in either side is found.
- s1-32mut counterexample: pot 0, shares 3, total 1, payout 0. Checked by hand: the original
  rejects it (shares above total); the control accepts it (lhs 0 <= rhs 0 < lhs1 10,000).
- The build logs show no errors. Their warnings are the miter's input bits being left undriven,
  which Yosys turns into free inputs, as in spike C.
- The local SSH session dropped during s3-32mut. The container ran on and wrote its result; the
  host had been up 12 days, so the run was not interrupted.
- `split_check_mod.v` gained the `MUTANT_VALID_OR` switch after step 0's synthesis. The proof
  chain uses the current file: step 1 proves it against the original, and step 2 will prove each
  module's netlist against it.

Status: step 1 and step 3 hold at 8 and 32 bits. What is left for the 32-bit netlist is step 2:
each module's netlist against its own RTL, five kinds of module, the 32x32 multiplier being the
hard one. Not started.

### split-v1 check circuit, module split, step 2: the multiplier checker

The owner approved downloading and building a multiplier checker on 2026-11-20.

**Tools.** Primary sources read 2026-11-20 at the pinned commits:

| Tool | Source | Commit | What it does |
| --- | --- | --- | --- |
| AMulet 2.2 | github.com/d-kfmnn/amulet2, MIT (Kaufmann and Biere, TACAS 2021) | `1b179334ba95c8e8ab50e75f2823fa8cce0bc914` (2026-11-02) | Checks that an AIG computes the unsigned product of its inputs. `-verify` prints "CORRECT MULTIPLIER" or "INCORRECT MULTIPLIER" (`polynomial_solver.cpp`); `-certify` also writes the gate polynomials, a proof and the specification |
| Pacheck 2.0 | github.com/d-kfmnn/pacheck2, MIT | `46001db7dc336b328b3f81f435c1ea71001f5dc3` (2026-07-10) | Checks such a proof on its own: exit 0 and "TARGET CHECKED" only if every step is valid and the proof reaches the specification |

- **Input rules** (`parser.cpp`): no latches, as many outputs as inputs. Input order is guessed:
  interleaved if the first AND gate joins inputs 0 and 1, otherwise a is the first half and b
  the second. Yosys writes a then b, and AMulet's log states the order it assumed.
- **Exit code:** `main` returns the verdict (`amulet.cpp`, line 220), so AMulet exits 1 for a
  correct multiplier and 0 for an incorrect one. The scripts read the printed verdict, not the
  exit code.
- **What Pacheck does and does not check:** it checks the algebra of the proof against the
  polynomials and the specification. It does not read the AIG, so it trusts AMulet's translation
  of the gates into polynomials. That translation is one polynomial per AND gate, which can be
  read in the `.polys` file.

**Build** (run `p0-build-amulet`, node-services, finished 2026-11-20 06:56 UTC). Steps:

- Both repositories were cloned on the host and checked out at the commits above; both
  `git status` checks were clean.
- `scripts/p0/build-amulet.sh` built them inside `debian@sha256:734a72b3…b179bc` (bookworm-slim
  12.15, pulled the same day), with network on for `apt-get`.
- Packages: g++ 12.2.0-14+deb12u1, make 4.3-4.1, libgmp-dev 2:6.2.1+dfsg1-1.1.
- Build commands: `./configure.sh && make`, as both READMEs say, with `-static` added so the
  binaries run in the no-network `python:3.12-slim` proof container.
- Results: `amulet` sha256 `c33d850f…bd31dc3`, `pacheck` sha256 `7e2eecc6…bed96df`. Record in
  `proofs-split/build-amulet-versions.txt`.

**8-bit calibration** (run `p0-split-amul-8`, 600 s each, part `amul` of `prove-split.sh`).
Three AIGs:

- **gate:** the `m_mul` module cut from `split_check_mod_8.mods.nand.v`, the netlist that is
  joined and taped out.
- **rtl:** the `m_mul` RTL mapped by Yosys alone.
- **mutant:** gate with its 40th NAND turned into an AND (`_0392_ = a[0] & b[2]`, the same line
  as the spike C multiplier mutant).

| Check | Result | Time (s) |
| --- | --- | --- |
| AMulet `-verify` gate | CORRECT MULTIPLIER | 0.1 |
| AMulet `-verify` rtl | CORRECT MULTIPLIER | 6.4 |
| AMulet `-verify` mutant | INCORRECT MULTIPLIER, counterexample written | 0.0 |
| AMulet `-certify` gate, then Pacheck | CORRECT; TARGET CHECKED (480 gate polynomials, 369 proof steps) | 0.0 and 0.1 |
| AMulet `-certify` rtl, then Pacheck | CORRECT; TARGET CHECKED (586 gate polynomials, 491 proof steps) | 7.9 and 1.4 |

- The specification Pacheck checked (`gate.spec`) is exactly the 8x8 product:
  sum 2^i s_i = (sum 2^i a_i)(sum 2^j b_j).
- The mutant's counterexample is the all-zero input, the same input `&cec` gave for this change
  in spike C.
- AMulet assumed a = inputs 0 to 7 and b = inputs 8 to 15, matching the Yosys map files.
- Not copied: the AIGs, the cut netlists and the proof files (1.1 MB and 23.7 MB at 8 bits). All
  can be rebuilt with the scripts.

So the checker and its proof checker give the right answer on a correct multiplier and on a
one-gate mutant at 8 bits. The 32-bit run (`p0-split-amul-32`, 3,600 s each) was started on
2026-11-20.

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

The input each query returned, exactly as ABC wrote it (`proofs/bonus-traps/q<k>.cex`,
32 input bits, least significant first), the time to solve, and the take-home pay either side
of it. Take-home is computed from the same draft formula (`scripts/p0/check_tap.py`, whose
netlist matches it on every bracket edge). The order is the solver's own.

| Query | Input b returned (fen) | Hex | Yuan | Solve time | Take-home at b | Take-home at b + 1 fen | Loss from one fen more | Replay (Yosys `sat -set b`) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 66,000,000 | `0x03ef1480` | 660,000.00 | 0.3 s | 466,410.00 | 436,160.01 | 30,249.99 | FAIL at b: confirmed |
| 2 | 30,000,000 | `0x01c9c380` | 300,000.00 | 0.4 s | 241,410.00 | 227,660.01 | 13,749.99 | confirmed |
| 3 | 96,000,000 | `0x05b8d800` | 960,000.00 | 0.3 s | 631,160.00 | 543,160.01 | 87,999.99 | confirmed |
| 4 | 42,000,000 | `0x0280de80` | 420,000.00 | 0.3 s | 317,660.00 | 298,410.01 | 19,249.99 | confirmed |
| 5 | 3,600,000 | `0x0036ee80` | 36,000.00 | 0.5 s | 34,920.00 | 32,610.01 | 2,309.99 | confirmed |
| 6 | 14,400,000 | `0x00dbba00` | 144,000.00 | 0.5 s | 129,810.00 | 116,610.01 | 13,199.99 | confirmed |
| 7 | "is there any other?" | | | undecided at 600 s | | | | |

Total solve time for the six: 2.3 s. The 36,000 yuan row matches the opening line of the
demo: one fen more, about 2,310 yuan less (2,309.99 here, with the draft's floor to the fen).

All six published trap points were found from the circuit alone and match the published
tables. The proof that there is no seventh is not yet done. Run `p0-bonus-complete`
(`bash bonus-complete.sh 600 2`) splits the 32-bit range into 64 equal slices by its top 6
bits, which carries no bracket knowledge, and asks each slice separately. Result
(`proofs/bonus-complete/totals.txt` and `summary.txt`, read at 18:59 UTC): all 64 slices
undecided, each at 600.0 s (one at 600.1 s); none `UNSATISFIABLE`, none `SATISFIABLE`.
Slicing by the top bits does not make the question easier for `iprove`, so "there is no
seventh trap" is unproven at this limit. Six traps are proven to exist; that they are the
only ones is not proven.

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
| NAND and LATCH supply | One shared pool. On processor #423 with 999,185 left, `mint(1, 999185)` succeeds and `mint(1, 999186)` reverts `supply cap`, the same limit as `mint(0, 999186)` (`p0/mint-sim-owner.txt`). Minting the full supply as NAND leaves no LATCH. Every netlist we produce has NAND records only (`yosys2tap.py` emits opcode `0x00` only), and v1 rules are stateless |
| Transistors are transferable | ERC-1155 `safeTransferFrom` and `safeBatchTransferFrom` are in the contract (`p0/selectors.txt`) |
| Mint from the owner's address | Simulated on #423 from `0x5c807eA36fC11a72192d83ecff2b3D4746767612` with a BEM balance and allowance of exactly 1,000,000 units (0.01 BEM): `mint(0, 1)` 111,846 gas, `mint(0, 999185)` 111,870 gas. The amount does not change the fee and barely changes the gas |

Correction, 2026-11-17: the first BEM balance override used mapping slot 0. It only worked
because the dummy sender `0x…dEaD` really holds BEM. With the owner's empty address the real
slot is 5 (allowances at 6). `xlayer-probe.mjs create-sim` now uses slot 5 and takes a sender:
from the owner's address it succeeds at 704,407 gas (`p0/create-sim-owner.json`).

Do vendors need our processor? No. An engine is named by `(processor, circuit id)`. A REF or
an equality check can point at a circuit on any processor the factory lists (TAP-02 section 3
rule 6), so a vendor tapes out on their own processor. Only our own simulated engines live on
ours. If a vendor ever wanted ours, we could send them transistors (ERC-1155 transfer).

## 7. On-chain spikes with the owner's wallet

In progress. Owner's deployer address: `0x5c807eA36fC11a72192d83ecff2b3D4746767612`. Signing:
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

Owner decisions, 2026-11-17: name "Payproof", symbol PAYP, supply 10,000,000, mint price 0,
and all 10,000,000 minted as NAND to the deployer in the first mint.

Transaction list (one at a time, each printed only after the previous one landed):

| # | Destination | Call | Amounts |
| --- | --- | --- | --- |
| 1 | BEM `0x60e62Efa9405d6873C5deaBD4E6CC91c25363952` | `approve(factory, 10000000)` | allowance 0.1 BEM, exact |
| 2 | Factory `0x1f09DAeFA827f02CBb40967cc91b259763760761` | `createCPU("Payproof", "PAYP", story, 10000000, 0)` | pulls 0.1 BEM |
| 3 | BEM | `approve(our transistors, 1000000)` | allowance 0.01 BEM, exact |
| 4 | Our transistor contract | `mint(0, 10000000)` | pulls 0.01 BEM |
| 5 | Our circuits contract | `tapeout(adder8)` | 0.0013 OKB |
| 6 | Our circuits contract | `tapeout(one REF to adder8)` | 0.0013 OKB |

Landed transactions:

| # | Hash | Block | Gas used | Network fee | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | `0xa601e844a8f5c8dc66b1eb5e89af388eeea51c0c945d1acb2e455accb745a96e` | 76,152,888 | 46,393 (estimate 46,776) | 0.000000928 OKB at 20,000,001 wei | success; Approval event 10,000,000 to the factory; allowance read back 0x989680 |
| 2 | `0xe95c2ccfd5944f211bca5e89104bc80859290eab369f30326e65e76031046c5d` | 76,152,949 | 731,373 (estimate 750,194) | 0.0000146 OKB at 20,000,001 wei | success; 0.1 BEM transferred from the deployer to the protocol wallet `0x571d447f4f24688ec35ccf07f1d6993655f6af15`; CPUCreated: circuits `0x1900801e311184063b9d9c119c9d98aa4950e12c`, transistors `0x523161955d1963891640a111688678fe6a9523ea`, creator the deployer, supply 10,000,000, mint price 0, name Payproof; transistors proxy on beacon `0x41Cb2bfd1cccA8f505EEDad0181eef44f1B9Ce65`, circuits proxy on beacon `0xf70d1ed4f62CF3780157B0b421b7E2F45bD0991C`; both addresses match the pre-signing simulation |
| 3 | `0xb4ce2bb85c367f61a57907b05bdc1f9c4e69495531ac58421c14469abbe44bd8` | 76,153,337 | 46,393 (estimate 46,776) | 0.000000928 OKB at 20,000,001 wei | success; Approval event 1,000,000 (0.01 BEM) to our transistor contract |
| 4 | `0xc6cb5c011f37fb14f25aa0212706c4feb066003f5f89eeb2613d4dabb7e5e67e` | 76,160,277 | 171,423 (estimate 181,356) | 0.00000343 OKB at 20,000,001 wei | success; `mint(0, 10000000)`. Events: BEM Transfer 1,000,000 (0.01 BEM) from the deployer to our transistor contract; TransferSingle id 0 (NAND) 10,000,000 to the deployer; Minted(deployer, 0, 10,000,000, 1,000,000) |
| 5 | `0xfa9e1dac2b85bceed0109c0c206e9a7010ed744b7c0ae4c2e64826914945559f` | 76,226,071 | 495,622 (estimate 505,825) | 0.0013 OKB tape-out fee plus about 0.00000991 OKB network fee at 20,000,001 wei | success; `tapeout(adder8, 630 bytes, nIn 16, nOut 9)`. Events: on our transistor contract, TransferSingle id 0 (NAND) of 90 from the deployer to address 0 (the burn); on our circuits contract, ERC-721 Transfer of token 1 from address 0 to the deployer; and an event with topic `0xc11215e4…ce031` carrying circuit id 1, the deployer, and data (90, 0). The event name is not looked up here |
| 6 | `0x9018862ebdac526f8d5802939b416e689ed5d2f0bcf50812f22aa28afdbb4757` | 76,312,738 | 227,855 (estimate 233,808) | 0.0013 OKB tape-out fee plus about 0.00000456 OKB network fee at 20,000,001 wei | success; `tapeout` of one REF record (79 bytes) to circuit #1 of our own processor, nIn 16, nOut 9. Events: ERC-721 Transfer of token 2 from address 0 to the deployer; the `0xc11215e4…ce031` event with circuit id 2, the deployer, and data (90, 0). No TransferSingle: no transistors burned |

Checks after transaction 4 (read-only `cast call`, block after 76,160,277): `balanceOf(deployer, 0)` =
10,000,000; `balanceOf(deployer, 1)` = 0; `minted()` = 10,000,000; a simulated `mint(0, 1)` from the
deployer reverts `supply cap`, so no transistor of this processor is left to mint. Deployer balances
left: 0.019 BEM (1,900,000 units) and 0.02288 OKB.

The first mint on a new processor used 171,423 gas, against about 112,000 measured earlier on
processor #423, which already had minted transistors: the first mint writes storage slots that
were empty.

Checks after transaction 5 (read-only `cast call`): `ownerOf(1)` = deployer; `circuitInfo(1)` returns
16, 9, 0, 90 (inputs, outputs, third field 0, gates); `balanceOf(deployer, 0)` = 9,999,910 (90 burned);
deployer OKB 0.021570 (down 0.00131 from 0.02288: the 0.0013 fee plus gas). `eval(1, 0x0305)` returns
`0x0800` (3 + 5 = 8, carry 0) and `eval(1, 0xffff)` returns `0xfe01` (255 + 255 = 510: sum byte 0xfe,
carry 1), so the on-chain circuit adds as the local reference evaluator does for these two cases.

Checks after transaction 6 (read-only, 2026-11-19): `ownerOf(2)` = deployer; `circuitInfo(2)` returns
16, 9, 0, 90, the same gate count as circuit #1 although its netlist is one REF record;
`balanceOf(deployer, 0)` still 9,999,910; deployer OKB 0.020266. `eval` of #1 and #2 on inputs
`0x0000`, `0x0305`, `0xffff`, `0x7f81`, `0xa55a` returns the same output for each: `0x0000`,
`0x0800`, `0xfe01`, `0x0001` (127 + 129 = 256: sum 0, carry 1), `0xff00`.

`eval` gas, `cast estimate --from <deployer> <circuits> "eval(uint256,bytes)" <id> 0x0305`
(simulation; includes the 21,000 base cost of a transaction):

| Circuit | Gates | Estimated gas |
| --- | --- | --- |
| #1 adder8, flat | 90 | 262,051 |
| #2 one REF to #1 | 90 (through the REF) | 323,162 |

At 90 gates the fixed cost of a call dominates (about 2,900 gas per gate here against 2,316 to
2,345 on large flat circuits in section 3). One REF level added 61,111 gas.

Tape-out gas for the larger circuits, `print-tx.mjs <owner> estimate-tapeout <circuits> <tap.json>`
(simulation from the deployer, which holds the NAND to burn; read 2026-11-19, block gas limit
210,000,000 read from block 76,312,821). Network fee at 20,000,001 wei per gas; the 0.0013 OKB tape-out
fee is on top. None of these fits one `cast send` on Windows (section 7 above); these numbers are
for planning the P2 tape-out as REF modules.

| Circuit | Gates | Bytes | Estimated gas | Gas per gate | Network fee | Share of block gas limit |
| --- | --- | --- | --- | --- | --- | --- |
| cn_bonus | 3,573 | 25,011 | 10,641,930 | 2,978 | about 0.00021 OKB | 5% |
| ng_paye | 8,482 | 59,374 | 25,031,740 | 2,951 | about 0.00050 OKB | 12% |
| split_check_24 | 21,441 | 150,087 | 63,442,878 | 2,959 | about 0.00127 OKB | 30% |

First attempt of transaction 1 was refused by the node before broadcast (`insufficient funds for gas`, balance 0). The owner then funded the deployer: 0.0229 OKB by exchange withdrawal on X Layer, and 0.129 BEM bridged from BNB Chain on tapeout.net (LayerZero fee 0.002026 BNB quoted, protocol fee 0.5%) and transferred to the deployer.

Story text for transaction 2, approved by the owner 2026-11-17: "Rules that decide money, as circuits anyone can check." createCPU gas estimate from the owner's address after transaction 1: 750,194.

| Spike | Result |
| --- | --- |
| Create the Payproof processor | done, transaction 2: circuits `0x1900801e311184063b9d9c119c9d98aa4950e12c`, transistors `0x523161955d1963891640a111688678fe6a9523ea` |
| Mint the transistor supply | done: transaction 4, all 10,000,000 as NAND to the deployer, 171,423 gas, 0.01 BEM |
| Tape out adder8 | done: transaction 5, circuit #1, 90 gates burned, 495,622 gas, 0.0013 OKB fee; `eval` checked for 3 + 5 and 255 + 255 |
| Tape out a circuit that uses REF | done: transaction 6, circuit #2 = one REF to #1, no transistors burned, 227,855 gas; same outputs as #1 on five inputs |
| Tape-out gas for cn_bonus, ng_paye, split_check (simulation from the owner's address) | done (simulation): 10.6 M, 25.0 M and 63.4 M gas, about 2,950 to 2,980 gas per gate |
| `eval` gas of our own circuits | done (simulation): #1 262,051, #2 323,162; large-circuit eval gas still from section 3's per-gate rate |

## 8. Cost per claim (check circuit), from measured gas per gate

`eval` gas = gates x 2,316 to 2,345 (flat, section 3); a REF-split circuit about 6% more.
Network fee at the base fee read on 2026-11-17, 20,000,001 wei per gas. The vault's own work
around the `eval` (share lookups, transfer) is not measured yet and is not included.

| Option | Gates | `eval` gas (flat to REF-split) | Fee per claim | Share of a 210 M block |
| --- | --- | --- | --- | --- |
| Check, 24-bit | 21,441 | 49.7 M to 53.2 M | about 0.0010 to 0.0011 OKB | 24% to 25% |
| Check, 32-bit | 34,876 | 80.8 M to 86.5 M | about 0.0016 to 0.0017 OKB | 38% to 41% |
| Check, 32-bit, module split (section 5, step 0) | 35,834 | 83.0 M to 88.9 M | about 0.0017 to 0.0018 OKB | 40% to 42% |
| Check, 40-bit | 51,206 | 118.6 M to 127.0 M | about 0.0024 to 0.0025 OKB | 56% to 60% |
| Check, 16-bit | 11,168 | 25.9 M to 27.7 M | about 0.0005 to 0.0006 OKB | 12% to 13% |
| Check, 12-bit | 7,137 | 16.5 M to 17.7 M | about 0.0003 to 0.0004 OKB | 8% |
| Check, 8-bit | 3,979 | 9.2 M to 9.9 M | about 0.0002 OKB | 4% to 5% |
| Compute, any width | not yet measured | | | |

Range of one W-bit amount: 0 to 2^W - 1 units. The unit is a design choice for the vault
(amounts are scaled to it before they reach the circuit):

| Width | Largest value | With unit 0.000001 token | With unit 0.01 token |
| --- | --- | --- | --- |
| 24 | 16,777,215 units | 16.777215 tokens | 167,772.15 tokens |
| 32 | 4,294,967,295 units | 4,294.967295 tokens | 42,949,672.95 tokens |
| 40 | 1,099,511,627,775 units | 1,099,511.627775 tokens | 10,995,116,277.75 tokens |

## 8a. Options for split-v1, side by side

Built 2026-11-19 from the measurements above; nothing here is new data. How each column is made:

- Gates and bytes: section 4 (bytes = 7 per gate, flat).
- `eval` gas per claim: gates x 2,316 (low, flat) to gates x 2,345 x 1.06 (high, REF-split),
  from sections 3 and 7. The vault's own work around the `eval` is not included (not measured).
- Fee per claim: `eval` gas x 20,000,001 wei (base fee read 2026-11-17).
- Share of block: `eval` gas against the 210,000,000 block gas limit.
- Fits one transaction: the largest transaction seen on X Layer used 88,709,982 gas
  (section 3). Above that, a single transaction is not yet shown to work; an estimate of a
  141,755-gate REF circuit reverted at 200,000,000.
- Tape-out, once per circuit: gates x 2,951 to 2,978 gas (section 7, simulation), network fee at
  the same base fee. The 0.0013 OKB fee per tape-out transaction is on top, and circuits this
  size are taped out as several REF modules, so the fee is paid once per module.
- Largest pool: 2^W - 1 units. Shown for a smallest unit of 0.000001 token (6 decimals) and of
  0.01 token. The unit is a vault setting; amounts are scaled to it before they reach the circuit.
- Solver: `check_unique` / `check_more_shares`, best of the two engines, 900 s limit
  (section 5). The pairs undecided at 900 s at 8, 12 and 16 bits were rerun at 3,600 s and are
  still undecided.

| Option | Gates | Bytes | `eval` gas per claim | Fee per claim (OKB) | Share of block | Fits one transaction | Tape-out gas (network fee, OKB) | Largest pool, unit 0.000001 | Largest pool, unit 0.01 | Solver (900 s; 3,600 s rerun) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Check, 8-bit | 3,979 | 27,853 | 9.2 M to 9.9 M | 0.00018 to 0.00020 | 4% to 5% | yes | 11.7 M to 11.8 M (0.00023 to 0.00024) | 0.000255 | 2.55 | holds (ABC, 278.6 s) / undecided at 900 s and 3,600 s |
| Check, 12-bit | 7,137 | 49,959 | 16.5 M to 17.7 M | 0.00033 to 0.00035 | 8% | yes | 21.1 M to 21.3 M (0.00042 to 0.00043) | 0.004095 | 40.95 | undecided / undecided at 900 s and 3,600 s |
| Check, 16-bit | 11,168 | 78,176 | 25.9 M to 27.8 M | 0.00052 to 0.00056 | 12% to 13% | yes | 33.0 M to 33.3 M (0.00066 to 0.00067) | 0.065535 | 655.35 | undecided / undecided at 900 s and 3,600 s |
| Check, 24-bit | 21,441 | 150,087 | 49.7 M to 53.3 M | 0.00099 to 0.00107 | 24% to 25% | yes | 63.3 M to 63.9 M (0.00127 to 0.00128) | 16.777215 | 167,772.15 | undecided / undecided |
| Check, 32-bit | 34,876 | 244,132 | 80.8 M to 86.7 M | 0.00162 to 0.00173 | 38% to 41% | yes, 2% to 9% under the largest seen; the vault's own gas is not counted | 102.9 M to 103.9 M (0.00206 to 0.00208) | 4,294.967295 | 42,949,672.95 | undecided / undecided at 3,600 s (not run at 900 s) |
| Check, 40-bit | 51,206 | 358,442 | 118.6 M to 127.3 M | 0.00237 to 0.00255 | 56% to 61% | not shown: above the largest transaction seen | 151.1 M to 152.5 M (0.00302 to 0.00305) | 1,099,511.627775 | 10,995,116,277.75 | not run |
| Compute, 24, 32 or 40-bit | no gate count: synthesis did not finish at 24, 32 or 40 | | | | | | | | | not run |

Pool sizes are in tokens. Solver times per engine, including every timeout, are in section 5.

## 9. Decisions

2026-11-19, the owner chose from section 8a: **split-v1 uses the check circuit at 32 bits.**

2026-11-19, the owner chose the vault's smallest unit: **0.01 token.** One 32-bit amount then
covers 0 to 4,294,967,295 units, that is 0 to 42,949,672.95 tokens. The vault scales amounts to
this unit before they reach the circuit. How it handles a deposit or a remainder smaller than
0.01 token is not decided yet; it is a P4 design item and will be stated in the threat model.

- Rule 1: the compute circuit has no gate count at any width tried (section 4), so it cannot be
  shown to fit; the check circuit is used.
- What follows from the choice, still to be shown:
  - A 32-bit claim costs 80.8 M to 86.7 M gas for the `eval` alone. That is 2% to 9% under the
    largest transaction seen on X Layer (88,709,982 gas). The vault's own gas around the `eval` is
    not measured. The first real 32-bit claim transaction is the test that it fits; if it does
    not, the record will say so and the width will be revisited with the owner.
  - Rule 2: both split facts are undecided at 32 bits at 3,600 s in both engines (section 5).
    At 8 to 16 bits only check_unique at 8 proved (900 s); the other five pairs stayed undecided
    at 3,600 s. So there is no width, from 8 to 32, where both check facts are proved with the
    current fact formulation, engines and limits. Rule 2 cannot be applied as written: there is
    no "widest width the solver proves" for the pair. Until that changes, nothing about the split
    facts may be called proved at any width, and any checking of them is labelled testing, not
    proof. How to get a proof (for example a different formulation of the facts, a different
    engine or longer limits) is an open P0 question for the owner, recorded in section 10.
    The owner chose a proof in parts (section 5, spikes A, B and C): the integer facts and the
    no-overflow bound are proved; netlist equals RTL is proved at 8 bits (ABC, two routes) and
    undecided at 32 bits at 3,600 s. So the split facts hold on the 8-bit netlist only. At 32
    bits nothing is proved yet. The owner approved the module split on 2026-11-20; step 0
    measured it at 35,834 gates at 32 bits (+958 over the flat circuit, section 5). Steps 1
    and 3 (joining) hold at 8 and 32 bits; step 2 (each module) has not started.

Rules applied once sections 4 to 8 are complete: (1) if a claim fits under the
gas cap with the compute circuit, use it, otherwise the check circuit, and if neither fits,
narrow the widths and state the supported range; (2) publish split facts at the widest width
the solver proves, state any narrower width in the proof record, and label random or
exhaustive checking above it as testing, not proof; (3) wage rules are proven whole if the
solver finishes, otherwise per module, and the record says which. The owner has asked for the
options with cost per claim before any choice is made.

### Evidence copied from the hosts

2026-11-19, kept in Git under `docs/evidence/p0/` (owner's choice):

- From host-service `/tmp/izie-build-test.RK0bzkMu`: `netlists/` (every `.nand.v`, `.stat.txt`
  and `synth-summary.tsv`) and `synth-logs/run1/`, `synth-logs/run2/`. 39 files, checksums in
  `SHA256SUMS-host-service.txt`, all matched after the copy.
- From node-services `/tmp/izie-build-test.XkZQkbd5`: `proofs/` and `proofs-900s/` (every
  `sat.log`, `abc.log`, `aig.log`, `*.result`, `script.ys` and `summary.txt`, including the
  bonus-rule runs). 492 files, checksums in `SHA256SUMS-node-services.txt`, all matched.
- From node-services `proofs-split/` (spikes A, B and C): the logs of runs `p0-split-smt`,
  `p0-split-cec-8`, `p0-split-alg-8` (both runs), `p0-split-acec-32`, `p0-split-miter-8` and
  `p0-split-miter-32` and `p0-split-comp`, the mutant multiplier netlist, and `summary.txt`.
  82 files, checksums in `SHA256SUMS-split.txt`, all matched after the copy on 2026-11-20. The
  mutant flat netlists of `p0-split-comp` are not copied; each is the flat netlist with the one
  line in its `*-mutant-line.txt` changed. `summary.txt` keeps the two
  intermediate "UNDECIDED" lines for mul8 and check8 as the run wrote them (see spike C).
- From host-service, 2026-11-20, added to `netlists/` and `synth-logs/run3/`: the module-split
  netlists (`split_check_mod_8` and `_32`, flat and hierarchical, with `stat` files), the
  calibration multiplier `mul_8`, their synthesis logs, and the updated `synth-summary.tsv`.
  `SHA256SUMS-host-service.txt` now lists 52 files, all matched after the copy.
- Not copied, because they can be rebuilt from the files above and the scripts: the Yosys JSON
  netlists and the `miter.aig` and other `.aig` files.

Both workdirs are kept for now: decision rule 2 is open (above), and further proof attempts would
run there. The `payproof-p0-chk-*` containers have all exited and been removed by their runs.

## 10. Open items found during P0

- The factory implementation changed after the 2026-10-22 freeze (section 3). It cannot change
  how existing circuits evaluate (section 6), but it can change fees and tape-out checks.
- Processor creation and transistors are paid in BEM. The owner needs a small BEM balance.
- Two Yosys builds (section 1). P1 picks one and records it in VERSIONS.md.
- Standalone ABC is not in the YoWASP wheel; ABC proofs need the native suite.
- Multiplier facts are undecided at 900 s even at 24 bits. At 8, 12 and 16 bits every pair
  except check_unique at 8 is also undecided at 3,600 s, and both are undecided at 32 bits at
  3,600 s (section 5). No width from 8 to 32 has both check facts proved; decision rule 2 has no
  width to publish (section 9). Proof in parts: integer facts proved (spike A); netlist against
  RTL undecided at 8 bits in 900 s with plain `cec` (spike B); proved at 8 bits with `&acec`
  fallback and with a miter and `&cec` (spike C); undecided at 32 bits at 3,600 s, where even the
  mutant is not caught, and `&acec` crashes at 32 bits. Module split approved; step 0 done
  (35,834 gates at 32 bits, 0.16% over the largest transaction seen if built from REF
  modules); steps 1 and 3 hold at 8 and 32 bits; step 2, per module, has not started.
- ABC `&acec` in this build gave a false "not equivalent" on a correct multiplier and crashes at
  32 bits (section 5, spike C). Not used as evidence on its own.
- Synthesis of large circuits on host-service is slow (52 min for the 32-bit check circuit).
- Tape-outs above about 2,280 gates do not fit one `cast send` on Windows (section 7).
