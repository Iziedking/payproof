# split-v1: a pool split, checked on chain

Our own rule. It decides how much of a pot each share holder may claim.

## The rule

```
inputs : pot, shares (the holder's at the snapshot), total (all shares at the snapshot)
consts : holderBps = 8500 (85% of the pot goes to holders)
payout = floor(pot x holderBps x shares / (10000 x total))   when total > 0 and shares <= total
```

The circuit on chain does not compute `payout`; it checks one. The claimant supplies `payout`,
and the circuit returns `ok = 1` exactly when the inputs are valid and

```
payout x total x 10000  <=  pot x shares x 8500  <  (payout + 1) x total x 10000
```

which holds for exactly one `payout`: the floor above. All four inputs are 32-bit whole
numbers of the vault's unit (0.01 token, owner decision 2026-11-19).

## What is proved, and where

The P0 records (`docs/evidence/p0-spikes.md`, section 5) prove for the 32-bit netlist
`split_check_modc_32` that the circuit equals this rule: integer facts with Z3 and cvc5, and
netlist against RTL in four checked links. The facts in PLAN section 11.1 (never overpays, at
most one unit short, and the rest) are P3 work on the taped-out circuit.

Why the claims never add up to more than the holders' part: each holder's payout is at most
their exact share, `pot x 0.85 x shares / total`, and the shares add up to `total`. That step
is arithmetic, not a solver result.

## Circuits on X Layer

Contract `0x1900801e311184063b9d9C119C9D98AA4950E12c`, chain 196. All three take the same 128
input bits.

| Circuit | Id | What it does |
| --- | --- | --- |
| Decision (check) | 8 | Gives `ok`. Joined by REF from modules 3 to 7. The circuit a contract runs |
| Validity | 13 | Gives `valid = total != 0 and shares <= total`. `pot` and `payout` are not used |
| Explanation | 14 | Gives `exact_num = pot x shares x 8500`, `paid_num = payout x total x 10000` and `den = total x 10000`, plus `valid`. Joined by REF from modules 3, 4, 6, 7 and the validity circuit. No contract has to run it |

The holder's exact share is `exact_num / den`, and the check passes exactly when
`paid_num <= exact_num < paid_num + den`. On a fork, 0 failures of that relation in 123 inputs,
and 0 inputs where `valid = 0` but `ok = 1` in 423 (`docs/evidence/p2.md`, section 7). Proved
in P3 as `explain-matches-check` and `validity-matches-check`; tested, not proved, until then.

Running the explanation costs about 93 M gas, close to the check. The public RPC refuses an
`eth_call` that large, so the app runs both in the browser on the bytes read from X Layer.
Specification: `docs/specs/explain-validity.md`.

## Files

- `layout.json`: four 32-bit inputs (`pot`, `shares`, `total`, `payout`), one output `ok`;
  the explanation and validity outputs under `explain` and `validity`.
- `explain.v`, `validity.v`: the explanation and validity circuits.
- `vectors.json`: examples; all are derived from the formula above.
