# Nigeria pay tax (PAYE) under the Nigeria Tax Act 2025

Our reading of the Act, with sources. No tax professional has reviewed it yet; the questions
we sent are listed under "Open points". Nothing here is tax advice.

## Source

Nigeria Tax Act, 2025 (Act No. 7), National Assembly copy marked "Edited 1-1-2026", pages
A387 to A596, downloaded on 2026-11-21 from https://nass.gov.ng/documents/download/11249
(sha256 `41abf6887bc58a3c97116fd9a048aa91ad49c1cab156f39065a58401c0fce94f`, 215 pages). The
text was extracted with `pdftotext -layout` on the test host; the lines used are copied, with
their line numbers, in `docs/evidence/p1/sources/ng-nta2025-extracts.txt`.

| Part of the Act | What it says, in plain words |
| --- | --- |
| Section 30 (1) and (2) (page A416) | Chargeable income is total income less eligible deductions. The deductions are the person's own contributions to the National Housing Fund, the National Health Insurance Scheme and the pension scheme under the Pension Reform Act; interest on a loan to build an owner-occupied home; life insurance or deferred annuity premiums for the person or their spouse paid in the year before; and rent relief of 20% of the annual rent paid, at most N500,000 |
| Section 58 (page A429) | The tax on an individual's chargeable income is set by the Fourth Schedule, except for an individual earning the minimum wage |
| Section 162 (1) (t) (page A481) | Income from an employment is exempt where the person earns gross income of the national minimum wage or less from that employment |
| Section 201, "National Minimum Wage" | The minimum wage in force under the National Minimum Wage Act |
| Fourth Schedule (page A540) | After the section 30 deductions: first N800,000 at 0%, next N2,200,000 at 15%, next N9,000,000 at 18%, next N13,000,000 at 21%, next N25,000,000 at 23%, above N50,000,000 at 25% |

The national minimum wage is N70,000 a month (N840,000 a year) under the National Minimum Wage
(Amendment) Act 2024. We have not yet read that Act's official text; the figure is from the
Joint Revenue Board PIT Guidelines 2026 (read 2026-11-16; the PDF at
https://www.jtb.gov.ng/assets/2026-pit-guidelines-TJG3n9-T.pdf returned HTTP 404 to the test
host on 2026-11-21) and from several 2026 secondary sources.

## The rule as the circuit computes it

All amounts are annual and in whole naira.

```
rent_relief = min(floor(rent / 5), 500000)
deductions  = pension + nhf + nhis + life + mortgage + rent_relief
chargeable  = gross > deductions ? gross - deductions : 0
exempt      = gross <= 840000                       # sections 58 and 162 (1) (t), our reading
band tax    = 15% of chargeable in (800,000 .. 3,000,000]
            + 18% in (3,000,000 .. 12,000,000]
            + 21% in (12,000,000 .. 25,000,000]
            + 23% in (25,000,000 .. 50,000,000]
            + 25% above 50,000,000
annual_tax  = exempt ? 0 : floor(band tax)          # floored to the naira once, on the total
monthly_tax = floor(annual_tax / 12)
```

## Open points (TAX_REVIEW_BRIEF questions, decisions D3 and D4)

- **Minimum wage test.** Section 162 (1) (t) reads "gross income of national minimum wage or
  less", which supports "gross pay at or below the minimum wage". We apply it to the annual
  gross against N840,000. Whether a monthly test is meant is not settled.
- **The cliff just above the minimum wage.** On this reading N840,000 pays nothing and N840,001
  with no deductions pays 15% of N40,001, that is N6,000. A raise of N1 lowers take-home pay by
  N5,999. The prover is expected to find this; it is reported as a property of our reading.
- **Rounding.** The Act does not say. We floor once, on the annual total, to the naira.
- **Monthly method.** Employers work cumulatively through the year. We show annual tax and a
  flat twelfth; the last month's adjustment is not modelled.

## Circuits on X Layer

Contract `0x1900801e311184063b9d9C119C9D98AA4950E12c`, chain 196.

| Circuit | Id | What it does |
| --- | --- | --- |
| Decision | 10 | Gives `annual_tax` and `monthly_tax`. The circuit a contract runs |
| Explanation | 11 | Gives `rent_relief`, `deductions`, `chargeable`, `exempt` and the income in each of the six bands. No contract has to run it |
| Validity | none | Every input the layout can hold is valid (owner decision, 2026-11-22). The rule registry records "every input valid" |

A band's tax is its income times a whole percent (0, 15, 18, 21, 23, 25), which is exact in
kobo, so the page works it out from the chain's figures. On a fork, 1,033 inputs gave 0
failures of the two relations: the bands add up to `chargeable`, and
`annual_tax = exempt ? 0 : floor((15 band2 + 18 band3 + 21 band4 + 23 band5 + 25 band6) / 100)`
(`docs/evidence/p2.md`, section 7). Proved as `breakdown-adds-up` in P3; tested, not proved,
until then. Specification: `docs/specs/explain-validity.md`.

## Files

- `layout.json`: input and output bit layout (195 input bits, 57 output bits); the
  explanation's 227 output bits under `explain`.
- `explain.v`: the explanation circuit.
- `vectors.json`: examples. Each says where it comes from; "derived" means worked from the
  formula above at a boundary, not copied from an official worked example.
