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

Command on host-service (inside the workdir after `bash setup-yosys.sh`):
`bash synth-all.sh tools/yosys wage check`, then `bash synth-all.sh tools/yosys compute-24`
(and `-32`, `-40`). Sources: `spikes/p0/rtl/*.v`. Flow per circuit:
`read_verilog; chparam -set W <w>; synth -flatten -top <top> -noabc; abc -g NAND; opt_clean -purge; stat`.
TapeOut gates = NAND + NOT (a NOT is one NAND with both inputs tied). Bytes = 7 per gate,
flat, before splitting into REF modules.

| Circuit | Width | NAND | NOT | TapeOut gates | Flat bytes | `eval` gas at 2,330/gate |
| --- | --- | --- | --- | --- | --- | --- |
| adder8 (tape-out spike) | 8 | 52 | 38 | 90 | 630 | 0.2 M |
| cn_bonus draft | 32-bit fen | 2,388 | 1,132 | 3,520 | 24,640 | 8.2 M |
| ng_paye draft | 195 input bits | 5,571 | 2,866 | 8,437 | 59,059 | 19.7 M |
| ng_paye mutant (19%) | | 5,697 | 2,900 | 8,597 | 60,179 | |
| split_check | 24 | 14,607 | 6,834 | 21,441 | 150,087 | 50.0 M |
| split_check | 32 | not yet measured | | | | |
| split_check | 40 | not yet measured | | | | |
| split_compute | 24 | not yet measured | | | | |
| split_compute | 32 | not yet measured | | | | |
| split_compute | 40 | not yet measured | | | | |

An earlier run that let `synth` call ABC before `abc -g NAND` gave 3,475 (cn_bonus) and
8,431 (ng_paye) gates; that run was stopped because it mapped every design twice and was too
slow on the divider. The width-24 compute circuit had 40,671 internal cells before mapping.

These are first drafts with no gate optimisation. The NOT share is about a third; a cost-aware
mapping (both gates cost 1) is a P1 task and can only lower the counts.

## 5. Solver timing

Command on node-services (inside the container):
`bash prove-all.sh <timeout-seconds> 2 [job regex]`. Facts: `spikes/p0/facts/*.v`. Each fact
is a module with output `bad`, 1 exactly when the input is valid and the fact is broken. Both
engines run on the synthesised NAND netlists, flattened with the fact:

- Yosys: `sat -prove bad 0 -timeout T -show-inputs`. "holds" = `SUCCESS!`, "fails" = `FAIL!` with the input printed.
- ABC: `write_aiger`, then `yosys-abc -c "read_aiger m.aig; print_stats; strash; iprove -v"`. "holds" = final line `UNSATISFIABLE`, "fails" = `SATISFIABLE`.

Calibration (run `p0-prove-calibrate`, timeout 300 s). The first ABC parser reported "holds"
for all three; it matched a verbose line, not the result. It was fixed to read only the final
line and re-run. Both engines now agree:

| Check | Expected | Yosys `sat` | ABC `iprove` |
| --- | --- | --- | --- |
| cn_bonus: a raise never lowers take-home | fails | fails, 1.1 s | fails, 0.7 s |
| ng_paye draft equals the 19% mutant | fails | fails, 2.5 s | fails, 0.5 s |
| ng_paye: tax never exceeds gross | holds | holds, 1.1 s | holds, 0.1 s |

The bonus counterexample from Yosys: b1 = 95,156,355 fen (951,563.55 yuan) and b2 =
97,585,091 fen (975,850.91 yuan), either side of the 960,000 yuan bracket edge. This is one
of the six expected traps; finding all six is the P3 trap finder's job.

`split-v1` facts at 24, 32 and 40 bits: not yet measured.

## 6. On-chain spikes with the owner's wallet

Not yet run. They need a funded wallet and the owner's signatures (section 7 of the session
report lists each transaction). To record per transaction: hash, gas used, fee paid, result.

| Spike | Result |
| --- | --- |
| Create the Payproof processor | not yet run |
| Tape out adder8 | not yet run |
| Tape-out size: largest flat netlist accepted | not yet run |
| Tape out a circuit that uses REF | not yet run |
| `eval` of our own circuits by `eth_estimateGas`, and one real `eval` transaction above 88.7 M gas | not yet run |

## 7. Decisions

Not yet taken. Rules applied once sections 4 to 6 are complete: (1) if a claim fits under the gas cap with the compute circuit, use it, otherwise the check circuit, and if neither fits, narrow the widths and state the supported range; (2) publish split facts at the widest width the solver proves, state any narrower width in the proof record, and label random or exhaustive checking above it as testing, not proof; (3) wage rules are proven whole if the solver finishes, otherwise per module, and the record says which.

## 8. Open items found during P0

- The factory implementation changed after the 2026-10-22 freeze (section 3). The plan's
  R7 (factory not sealed) is live: our contracts must keep checking the netlist hash.
- Processor creation and transistors are now paid in BEM, not OKB. The owner needs a small
  BEM balance on X Layer.
- Two Yosys builds (section 1). P1 picks one and records it in VERSIONS.md.
- Standalone ABC is not in the YoWASP wheel; ABC proofs need the native suite.
