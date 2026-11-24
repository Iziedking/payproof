# Simulated engines (China bonus)

These two circuits are SIMULATED ENGINES. They are not any vendor's code. The Payproof team
wrote them to show engine equality on chain: a payroll engine is taped out on X Layer next to
the reference rule, and the prover asks whether the two can ever give a different answer.
Every page, record and post that mentions them labels them as simulated.

Both have the same pins as the reference, rule `cn-bonus-2023-30` (circuit 9 on X Layer):
input `bonus[31:0]` in fen, outputs `tax[31:0]` and `net[31:0]`.

| File | Label | What it changes | Written to show |
| --- | --- | --- | --- |
| `cn_vendor_a2.v` | Simulated engine A (China bonus) | Picks the bracket by counting the limits the bonus is above, looks up rate and quick deduction by that count, and works out take-home as bonus plus the two's complement of the tax | equal to the reference for every bonus |
| `cn_vendor_b.v` | Simulated engine B (China bonus) | Rounds bonus x rate to the nearest fen, halves up, where the reference rounds down | different from the reference, for example at a bonus of 0.17 yuan |

`cn_vendor_a.v` is the first candidate for engine A and is not taped out. It subtracts the
quick deduction, times 100, before dividing by 100 instead of after. Its pre-check was decided
by Bitwuzla alone (equal, 623.1 s); ABC iprove, Yosys sat, Z3 and ABC &cec gave no answer, so it
could not meet the two-tool rule. The second candidate keeps the reference's multiply and
divide and was decided equal by ABC iprove, Bitwuzla and ABC &cec. The owner chose it on
2026-11-24. Both pre-checks are in `docs/evidence/p3/engines-precheck/`.

"Written to show" is what we expect, not a result. The prover decides, and the result is
published either way, including undecided and timed out.

Engine B is a plausible engine, not a broken one: rounding is an open point in our reading of
the rule (decision D12). A disproof says only that the two circuits differ for a valid input. It
does not say which reading of the rule is right.

## How they are built and checked

1. `scripts/p3/engines-build.sh` synthesises engines A and B to NAND with Yosys, the same flow as every
   Payproof circuit, then runs `scripts/p3/engines-prepare.mts`.
2. `engines-prepare.mts` writes the TAP-02 netlists to `chain/netlists/engines/` with a
   manifest (each piece carries `simulated: true`), and pre-checks each engine against
   `chain/netlists/cn_bonus.bin`, the file taped out as circuit 9. The pre-check is on our own
   files and is not the proof. It exists so no OKB is spent on an engine that does not do what
   it was written to do.
3. The owner tapes out both with `chain/script/TapeOut.s.sol`. `scripts/p2/tapeout-plan.mts
   command <rpc> chain/netlists/engines <name>` prints the command; the agent never signs.
4. `scripts/p3/engines.mts` reads circuit 9 and both engines from X Layer at one pinned block,
   checks every keccak, and asks ABC, Yosys sat and Bitwuzla whether the outputs can differ. A
   "holds" needs a second tool. Any difference found is replayed in the simulator and with
   eval on chain. A mutant (the engine's tax raised by one fen at a bonus of 50,000.00 yuan)
   must come back "differs".

Results and evidence go in `docs/evidence/p3/` and on the Proofs page.
