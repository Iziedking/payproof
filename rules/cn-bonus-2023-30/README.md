# China: annual one-time bonus, taxed separately (Announcement 2023 No. 30)

Our reading of the official text, with sources. Nothing here is tax advice.

## Source

Ministry of Finance and State Taxation Administration, Announcement 2023 No. 30 (财政部
税务总局公告2023年第30号), "on continuing the individual income tax policy for the annual
one-time bonus", dated 2023-08-18. Read on 2026-11-21 from the State Council's policy library,
which publishes the ministries' documents:

- Text: https://www.gov.cn/zhengce/zhengceku/202308/content_6900595.htm
  (sha256 of the page `b88046fadcb57201dcd49fd614841db15b37f1cd94ebff6ca65fa5a2c941360e`).
- Its attachment, the monthly rate table:
  https://www.gov.cn/zhengce/zhengceku/202308/P020230828633757032068.pdf
  (sha256 `06b8b1370546a2810de467590298a54ab498834df02d895686f7f78d616e2d46`).

The extracted text of both is in `docs/evidence/p1/sources/`. The copy on chinatax.gov.cn
itself was not fetched (decision D11 asked for it); the gov.cn page carries the same document
number and date.

What it says, in plain words:

1. A resident who receives an annual one-time bonus that meets the 2005 notice (国税发〔2005〕9号)
   may keep it out of the year's comprehensive income. The bonus is divided by 12; that monthly
   figure picks the rate and quick deduction from the attached table; then
   tax = bonus x rate - quick deduction.
2. The person may instead add the bonus to comprehensive income. This rule models only the
   separate option in point 1.
3. The policy runs to 2027-12-31.

The attached table (monthly figure, rate, quick deduction in yuan):

| Monthly figure | Rate | Quick deduction |
| --- | --- | --- |
| up to 3,000 | 3% | 0 |
| over 3,000 to 12,000 | 10% | 210 |
| over 12,000 to 25,000 | 20% | 1,410 |
| over 25,000 to 35,000 | 25% | 2,660 |
| over 35,000 to 55,000 | 30% | 4,410 |
| over 55,000 to 80,000 | 35% | 7,160 |
| over 80,000 | 45% | 15,160 |

## The rule as the circuit computes it

The input is the bonus in fen (0.01 yuan). "Bonus / 12 up to L" is the same as "bonus up to
12 x L", so the circuit compares the bonus with 36,000; 144,000; 300,000; 420,000; 660,000 and
960,000 yuan and never divides by 12.

```
rate, qd = first row where bonus <= 12 x limit (quick deduction in fen)
tax      = floor(bonus x rate / 100) - qd
net      = bonus - tax
```

## Open points

- **Rounding (D12).** The announcement gives no rounding rule. We floor bonus x rate to the fen.
- **Known traps.** Because the whole bonus moves to the higher rate when it crosses a limit,
  just above each of the six limits a bigger bonus gives a smaller take-home amount. The prover
  must find these ranges from the circuit alone (PLAN section 11.1).
- **Newer notices.** We have not found a later notice that changes this one before 2027-12-31;
  the search is not exhaustive.

## Files

- `layout.json`: one 32-bit input (`bonus`, fen) and two 32-bit outputs (`tax`, `net`).
- `vectors.json`: examples, each with its source.
