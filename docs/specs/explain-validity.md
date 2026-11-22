# Explanation and validity circuits: specification

Status: draft for the owner's approval, 2026-11-22. Nothing here is built or taped out yet.

Each rule has three circuits (PLAN section 8, item 2):

- the **decision** circuit, which a contract runs and which gives the answer. All three are
  live on X Layer: split-v1 is circuit 8, cn-bonus is 9 and ng-paye is 10.
- the **explanation** circuit, which shows how the answer was reached. A contract never has
  to run it (L17).
- the **validity** circuit, which says whether an input is one the rule is defined for. Proofs
  and challenges only count inputs where validity is 1 (PLAN section 11.2, prover rule 2).

## 1. Rules common to both kinds

1. **Same input bytes.** A rule's explanation and validity circuits take exactly the decision
   circuit's input layout: the same fields, at the same offsets and widths. A contract, the
   app and the prover pass one input vector to all three circuits. No wallet address is an
   input (L21).
2. **Same expressions.** Every value the explanation shares with the decision is written
   with the same Verilog expression and width as the decision RTL
   (`spikes/p0/rtl/cn_bonus.v`, `ng_paye.v`, `split_check_mod.v`). The P3 fact
   `breakdown-adds-up` then proves on the circuits read from chain that the two agree. Until
   that proof runs, the agreement is tested, not proved, and pages say so.
3. **Pin limit.** At most 255 input bits and 255 output bits per circuit, so either circuit
   can be referenced by REF later (L17).
4. **Reuse by REF.** Where a module is already on chain, the new circuit references it rather
   than taping out a copy.
5. **Stateless.** `nState == 0` (L9).
6. **Files.** RTL goes in `rules/<rule>/explain.v` and `rules/<rule>/validity.v`, with the
   output layouts added to `rules/<rule>/layout.json` under `explain` and `validity`.

## 2. Validity

### split-v1: a validity circuit

```
inputs : the decision layout: pot, shares, total, payout (32 bits each, 128 bits)
output : valid (1 bit) = (total != 0) && (shares <= total)
```

`payout` is in the layout but unused, by rule 1. The expression is the `valid` wire of
`m_cmp` in `split_check_mod.v`, unchanged. The size is one 32-bit comparison and one 32-bit
zero test; the gate count will be measured by synthesis, not estimated here.

Facts it enables (P3): `validity-matches-check`: whenever `valid` is 0, the decision's
`ok` is 0. The equality miter for engines uses `valid` as its domain.

### cn-bonus and ng-paye: no validity circuit (owner decision A)

On our reading every input the layout can hold is valid:

- **cn-bonus.** Any 32-bit bonus in fen (0 to 42,949,672.95 yuan) has a defined tax. The
  product `bonus x rate` is held in 39 bits, and the largest value, (2^32 - 1) x 45, is below
  2^39.
- **ng-paye.** Any input has a defined tax. The deductions sum is held in 32 bits, and its
  largest value, 5 x (2^27 - 1) + 500,000, is below 2^32. A deductions total above gross pay
  gives chargeable income 0. The rule does not make that input invalid.

The bounds above are arithmetic, not solver results. P3 adds a `no-overflow` fact for each
rule to check them on the circuit from chain.

**Recommendation:** tape out no validity circuit for these two rules. `RuleRegistry` records
`validity = CircuitRef(address(0), 0)`, which means "every input is valid". The prover
already accepts `validity: null` (PLAN section 11.2), and each proof record's `domain` then
reads "all inputs". This saves two tape-out fees (2 x 0.0013 OKB), and an input never pays
for a circuit that always returns 1.

**Alternative:** tape out a circuit that always returns 1 for each rule, so every rule has the
same shape on chain. It costs 0.0026 OKB in fees plus gas, and proves nothing more.

## 3. Explanation

### cn-bonus: bracket, rate and the two halves of the tax

```
inputs : bonus (32, fen)                                        same as decision
outputs: bracket               3 bits   1 to 7, the row of the rate table used
         rate                  7 bits   percent: 3, 10, 20, 25, 30, 35 or 45
         quick_deduction      21 bits   fen; largest 1,516,000
         tax_before_deduction 32 bits   floor(bonus x rate / 100), fen
total  : 63 output bits
```

The bracket is picked by the same comparisons with twelve times each monthly limit as the
decision (no division by 12). `tax_before_deduction` is `gross[31:0]` of `cn_bonus.v`.

Fact (P3) `breakdown-adds-up`: `tax == tax_before_deduction - quick_deduction` and
`net == bonus - tax`, against decision circuit 9.

The page can then say "your bonus fell in row 4, taxed at 25%, less the quick deduction of
2,660 yuan", and every number comes from the chain.

### ng-paye: reliefs, chargeable income and the income in each band

```
inputs : gross, pension, nhf, nhis, life, mortgage, rent (195 bits)   same as decision
outputs: rent_relief  19 bits   min(floor(rent / 5), 500000)
         deductions   32 bits   pension + nhf + nhis + life + mortgage + rent_relief
         chargeable   30 bits   gross > deductions ? gross - deductions : 0
         exempt        1 bit    gross <= 840000 (our reading, D3)
         band1        20 bits   chargeable in (0 .. 800,000]             at 0%
         band2        22 bits   chargeable in (800,000 .. 3,000,000]     at 15%
         band3        24 bits   chargeable in (3,000,000 .. 12,000,000]  at 18%
         band4        24 bits   chargeable in (12,000,000 .. 25,000,000] at 21%
         band5        25 bits   chargeable in (25,000,000 .. 50,000,000] at 23%
         band6        30 bits   chargeable above 50,000,000              at 25%
total  : 227 output bits
```

The circuit outputs the **income** in each band, not the tax. A band's tax is that income
times a whole percent, which is exact in kobo, so the page works it out with no rounding and
labels it as worked out from the chain's figures. This keeps the constant multiplies out of
the explanation circuit. Recommended over outputting tax per band, which needs 198 output
bits and five more multipliers.

Fact (P3) `breakdown-adds-up`, against decision circuit 10:

- `chargeable == band1 + band2 + band3 + band4 + band5 + band6`
- `annual_tax == exempt ? 0 : floor((15 band2 + 18 band3 + 21 band4 + 23 band5 + 25 band6) / 100)`

The second line is the decision's own formula, so a pass means the breakdown on the page adds
up to the tax the rule charges. That is the fact already listed in PLAN section 11.1.

### split-v1: the exact share and the payout, as the check compares them

```
inputs : pot, shares, total, payout (128 bits)                  same as decision
outputs: exact_num  78 bits   pot x shares x 8500          (rhs in split_check_mod.v)
         paid_num   78 bits   payout x total x 10000       (lhs)
         den        46 bits   total x 10000                (t10k)
         valid       1 bit    from the split-v1 validity circuit, by REF
total  : 203 output bits
```

The holder's exact share is `exact_num / den`. The check passes exactly when
`paid_num <= exact_num < paid_num + den`. The page can show "your exact share is 1,234.5678
units, and you are paid 1,234.56", with the remainder that stays in the vault.

The circuit is a top made of REFs to modules already on chain: `m_mul_tmc_32` (circuit 3,
used twice), `m_x8500` (4), `m_x10000_narrow` (6) and `m_x10000_wide` (7), plus the new
validity circuit. It needs no new arithmetic. Its tape-out should therefore be close to the
split-v1 top (circuit 8, 6,045,409 gas), but that is measured on the fork, not assumed.

Fact (P3) `explain-matches-check`: `ok == valid && paid_num <= exact_num && exact_num < paid_num + den`,
against decision circuit 8.

**Known limit.** Running this circuit costs about as much gas as the check: about 90 M or
more, to be measured. The public RPC refuses an `eth_call` that large; see
`docs/evidence/p2.md`, section 4. The app will therefore run it in the browser with the
simulator, on the netlist bytes read from X Layer, and say so on the page. The decision's
check is the same and will be handled the same way.

## 4. Cost and funds (owner decision B)

New tape-outs if decision A is approved, in order:

1. split-v1 validity
2. split-v1 explanation, which references 1
3. cn-bonus explanation
4. ng-paye explanation

Tape-out fees are fixed: 4 x 0.0013 = **0.0052 OKB**. The deployer holds 0.005705 OKB. After
the fees, 0.000505 OKB is left for gas: 25.2 M gas at 20,000,001 wei, for all four
tape-outs. The live tape-outs used about 2,905 gas per NAND gate (circuit 3:
43,491,041 / 14,969; circuit 10: 24,638,320 / 8,482). If the cn-bonus and ng-paye
explanations come out near their decision circuits (3,573 and 8,482 gates), those two
alone need about 35 M gas, and the funds will not cover all four. The exact amount comes
from synthesis and a fork rehearsal. The owner is then asked for a top-up of that amount
plus a margin, before any live tape-out. The P4 contract deployments will need more funds
on top of this.

## 5. Order of work once approved

1. Write `explain.v` and `validity.v` for the three rules, and add their layouts.
2. Run synthesis on host-service through the resource hook, then convert to TAP-02 bytes.
   Record the gate counts.
3. On node-services: run the simulator against the formulas above on every rule vector and
   on random inputs, and test the `breakdown-adds-up` relations. These are tests, not
   proofs.
4. Rehearse the tape-outs on an anvil fork of X Layer, and measure gas and cost.
5. Ask the owner to fund the exact amount, then send the tape-out commands for the owner to
   sign. Then check chain against local, as for circuits 3 to 10.
