# Audit before the final DeWEB publish (2026-11-27)

The owner wants one audit before the landing and the app go to DeWEB together, so the site is
published once. Every byte written to DeWEB costs OKB; files already on chain with the same
bytes are skipped. This list is checked against the working tree on 2026-11-27, before the build.
Each item names who fixes it.

## Gateway facts (read from the gateway's own code)

Read from https://9-2-425.tapekit.org/sw.js, `/.tape/serve.js` and `/.tape/kernel/path.js` on
2026-11-27 (gateway version 0.3.0):

| Question | Answer |
| --- | --- |
| Is a path with `?v=3` served? | Yes. The query string is dropped before the file lookup |
| Does `app/index.html` open? | Yes. `app`, `app/` and `app/index.html` all resolve to `app/index.html` |
| Can the landing run its inline redirect script? | Yes. The site CSP allows `'unsafe-inline'` scripts |
| Is an unknown path without an extension sent to the app? | No. No fallback page is set, so it is a 404 |
| Can the site load Google Fonts? | Yes. `style-src` and `font-src` allow `https:`, but the gateway logs it as an off-chain request and the site is then not shown as fully on chain |
| Is video streamed in parts? | No. Every file is sent whole with status 200, no Range support. iPhone Safari may not play the film; the poster still shows |

## Findings

### Claims that are no longer true (must fix before publishing)

| # | Where | Now says | What the records say | Fix by |
| --- | --- | --- | --- | --- |
| A1 | Landing, Proofs view | "Sample", "not yet run" for two facts, a counterexample "from an early test on a draft circuit", "Published proofs come later" | `docs/evidence/p3/cn-bonus/records.json`: tax-within-bonus holds, breakdown-adds-up holds, raise-never-lowers-take-home fails, all at block 76,743,855; first trap 36,000.01 to 38,566.65 | Design session, figures from these records |
| A2 | Landing, Splits view | "Round 1 Planned", pot 1,000.00, holders 425/255/170, fee 100, "No split is running yet" | `docs/evidence/p4/mainnet-round.md`: round 1 of split 1 ran on mainnet. Pot 1.00 USDT0, fee 0.10, holders with 50/30/20 shares claimed 0.42/0.25/0.17, snapshot block 76,839,844 | Design session |
| A3 | Landing, Engines view | "Planned"; bonus ¥960,000.01 gives "different, bounty paid" | Simulated engine B (circuit 16) was disproved at a bonus of 17 fen (rule tax 0, engine tax 1) and the hunter was paid 1.00 USDT0 (block 76,839,962). The engine must be labelled simulated | Design session |
| A4 | App footer `foot.note`; meta descriptions of `app/index.html` and the landing | "Payproof is not live yet" | Contracts, a paid round and the site are live on X Layer mainnet. The owner chooses the wording | Owner, then design session |
| A5 | Rules page, split rule card | Disabled button "Check a payout · not built yet" | `#/check/payout` exists and works | Design session |
| A6 | Strings `rule.sp.funds`, `rule.sp.vault` | "Not yet. Vault comes after the proofs" | SplitVault `0x19cc…86AA` is live and source-verified | Design session |

### Dead ends

| # | Where | Problem | Fix by |
| --- | --- | --- | --- |
| B1 | Nav "How it works" (`#/how`) | Shows "How it works is not built yet". The landing has a `#how` section | Design session: build the page, link to the landing's section, or remove the tab |
| B2 | `#/settings` | "Not built yet" page | Design session: build or remove every link to it |
| B3 | Any unknown route | Shows "Check my pay is not built yet", which is wrong | Design session: a plain "page not found" with a link home |

### Flow

| # | Problem | Fix by |
| --- | --- | --- |
| C1 | The landing has no direct way into Check my payout for pool holders; it is reached only through Splits | Design session, if the owner agrees |

### Outside links and services

| # | Item | Status | Fix by |
| --- | --- | --- | --- |
| D1 | `https://x.com/payproofhq` on the landing | Not verified: x.com returns 200 for any path. Does the account exist and belong to the owner? | Owner |
| D2 | Google Fonts on the landing and the app | Works through the gateway, but is an off-chain request and sends visitors' IP addresses to Google. Hosting the fonts on chain costs about 0.005 OKB per MB | Owner decides |
| D3 | Privy allowed origins | Sign-in works on 9-2-425.tapekit.org. The Pages mirror and payproof.kingizie.tech need to be allowed in the Privy dashboard as well, if sign-in should work there | Owner |
| D4 | `og:image` is the relative `media/poster.jpg` | Most link previews need an absolute URL | Design session |

### Checked and fine

- English and Chinese have the same 517 keys; only two values are identical, and both are
  product names or numbers.
- Every landing link into the app (`#/sign-in`, `#/sign-up`, `#/check/pay`, `#/proofs`,
  `#/splits`) has a route in `app/src/App.tsx`.
- The app's link back to the landing is `../index.html`, which resolves to the root on DeWEB.
- The landing's bonus figures (¥36,001 keeps ¥32,610.90, tax ¥3,390.10, trap ¥36,000.01 to
  ¥38,566.65) match the circuit result read in P2 and the trap record.
- The engine table's "by the rule" values (¥120,000 keeps ¥108,210.00, ¥360,000 keeps
  ¥272,660.00, ¥960,000.01 keeps ¥543,160.01) are correct for the 2023 No. 30 table. Only the
  engine column and its label are wrong (A3).

## Owner's decisions (2026-11-27)

| Item | Decision |
| --- | --- |
| A4 | "proper page footer for a product we are almost live already" |
| C1 | No holder button on the landing: "landing page is like an Ad showing the product at a glance not the product it self" |
| D1 | The X account exists and is the owner's; the link stays |
| D2 | Keep loading Google Fonts |
| D3 | The owner adds the Pages mirror and payproof.kingizie.tech as Privy allowed origins |

## Still to do

- Build the candidate on host-service from the commit that fixes the items above.
- Walk every page of that build in a browser, guest and signed in, desktop and phone width.
- Rehearse the publish on node-services, read every file back, and give the owner the measured
  cost.
