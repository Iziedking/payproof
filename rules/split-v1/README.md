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

## Files

- `layout.json`: four 32-bit inputs (`pot`, `shares`, `total`, `payout`), one output `ok`.
- `vectors.json`: examples; all are derived from the formula above.
