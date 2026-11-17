# Payproof design brief

Status: draft for the owner's decision, 2026-11-17. Nothing here is approved yet.
Samples: Figma file "Payproof design directions",
https://www.figma.com/design/qzSIhaTBTtHkewfYUaoFqI (frames A, B and C).

## Who the pages are for

| Person | Arrives with | Needs from the first screen |
| --- | --- | --- |
| An employee in China before year-end bonus season | A bonus figure and a vague fear of the "one yuan more" trap | Their number, the trap near it, in Chinese, with no sign-in |
| A salaried worker in Nigeria under the 2026 tax law | A payslip | The lawful tax and the difference from what was deducted |
| A holder in a mining pool or vault on X Layer | Shares and a payout they cannot check | What the rule gives them, round by round, and where the rule came from |
| An operator, payroll vendor or engine author | A rule they want others to trust | A way to show the rule runs as published |
| A judge, journalist or researcher | Two minutes | What the product does, that it is real, and what is not live yet |

## Tone

Calm, exact, a little plain. The product makes one promise: you can check
this yourself. So the interface shows its working like a pay statement or a
public notice does: figures you can read, the source next to them, and a
clear label on anything that is a sample or not yet checked. No excitement,
no crypto vocabulary on the surface (PLAN L26), no decoration that does not
explain a figure.

## Fixed for every direction

- One focal object on the landing page: a real-looking check of the China
  bonus rule, 36,000 against 36,001 yuan. The figures are derived from the
  published bracket table (36,000 keeps 34,920.00; 36,001 keeps 32,610.90;
  difference 2,309.10). They are labelled as sample data and as our reading
  until the official text is checked (PLAN D11).
- English and Simplified Chinese on the same screen in the samples. In the
  build, one language at a time with a switch; Chinese copy needs a native
  review before launch.
- Monospace only for figures and identifiers, normal case.
- One accent per direction, spent on one meaning. Loss or trap colour is a
  meaning, not decoration.
- No sign-in for checking; "Sign in" is a quiet text link.
- No gradients, glows, generated images, emoji icons or invented numbers.

## Three directions

**A. Statement.** A printed pay statement on warm paper. A serif display face
(Newsreader) over a plain sans (IBM Plex Sans), figures in IBM Plex Mono,
Noto Serif SC and Noto Sans SC for Chinese. Black ink does the work; one rust
tone appears only on traps and losses. The focal object is a statement card:
bonus, tax, you keep, then the difference line. Feels like a document an
accountant would hand you.

**B. Instrument.** A night-shift instrument panel in graphite. Geist and Geist
Mono, Noto Sans SC. The focal object is a measured chart of what you keep
against bonus size, with the trap as the only lit region and its exact range
written under it. One amber signal. Feels like a tool that measures the rule.
Most technical of the three; dark by default.

**C. Public notice.** White paper, black type and one deep green, like a notice
posted by a tax office or a bank. Public Sans and IBM Plex Mono, Noto Sans SC.
Square corners and hard rules. The focal object is a full-width notice panel
with three large figures: what each bonus keeps, and the loss. Green marks the
action and verified results; red appears only on a loss. Feels official.

## Reference review (Framer Marketplace, read 2026-11-17)

Reference only. Nothing is bought, remixed, exported or copied.

| Template | Link | Borrow | Avoid |
| --- | --- | --- | --- |
| Parallel, Finance (Lauri Lännenmäki) | https://www.framer.com/marketplace/templates/parallel-finance/ | Figures set like a ledger in a "fund at a glance" table; a table of contents as navigation; footnotes beside the line that cites them, which suits sourced rules | Paper grain, drop caps, italic emphasis and word-by-word ink animation; the oxblood accent and printed-quarterly costume are its identity, not ours |
| Plainrate (Manjesh Yadav) | https://www.framer.com/marketplace/templates/plainrate/ | The promise "plain numbers before you apply"; an estimate card with every line of the calculation; a rates strip with an update time | Stock photo behind the card, highlighter-marker headline, ticker motion, small trust badges |
| Tipline (Nova Studio) | https://www.framer.com/marketplace/templates/tipline/ | Data as the hero; the product doing its job on the landing page; mono counters for live figures | The halftone dot field is decoration-heavy; large live counters would invite invented numbers on our site |
| Covenant (Orion Studio) | https://www.framer.com/marketplace/templates/covenant/ | A document the visitor can inspect (its redline) as the proof of the claim; mono labels for references | Full-bleed stock interior photo, uppercase tracked labels everywhere, condensed display caps |
| Swiper (Stefan @ Pixco) | https://www.framer.com/marketplace/templates/swiper/ | A real product view rising under a short headline; one primary and one secondary action | Pill eyebrow badge, glowing button, starfield background, rainbow category bars |
| Asset (Michał Opałka) | https://www.framer.com/marketplace/templates/asset/ | Restraint: monochrome chrome with the product screenshot as the only rich element | Generic "intelligent platform" copy, dotted-grid backdrop, a hero that could belong to any product |

## Still to decide with the owner

- Which direction, or which parts of which.
- Light only, dark only, or both (B is dark-first; A and C are light-first).
- The logo (step 3), after the direction.
- Identifier style: normal-case mono is proposed.
