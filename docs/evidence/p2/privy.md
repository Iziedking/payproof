# Privy sign-in: first build (2026-11-24)

The owner created the Privy app and gave its ID, `cmwuj4hbm00ts0hk17hepnkzx`, on
2026-11-24. The ID is public configuration. The app holds no Privy secret.

## What was built

- `app/src/auth/SignIn.tsx` is the page at `/sign-in`. It is our own email-and-code form,
  using Privy's headless email flow (`useLoginWithEmail`). Privy's own modal is not used.
- At sign-in, Privy creates a wallet on X Layer (chain 196) for anyone who does not have
  one. Its address sits behind "Details" (L26). There is a sign-out button.
- `App.tsx` loads that page with `lazy()`. The check pages never download Privy and never
  contact it (L4, L25).
- Packages: `@privy-io/react-auth` 3.52.1 and viem 2.57.17. Sources and facts are in
  `VERSIONS.md`, read on 2026-11-24.

## Build and tests

Task `p2-app-build-k` ran on karwan-test on 2026-11-24, because host-service is down (owner's
choice). It used Node 24.22.1 and npm 11.19.1, with install scripts off.

| Step | Result |
| --- | --- |
| `npm install` | `@privy-io/react-auth@3.52.1`, `viem@2.57.17`, `react@19.3.1`; lockfile updated |
| `tsc` 7.0.2 | no errors |
| `vitest` | 2 files, 26 tests passed |
| `vite build` | 6,079 modules, built in 2.26 s |

## Size

| | Before Privy (on DeWEB now) | With Privy |
| --- | --- | --- |
| Files | 6 | 312 (308 under `assets/`) |
| Bytes | 318,651 | 5,271,864 |
| What `index.html` loads | `index-BchCgAus.js` (301,291), CSS (14,320) | `index-DxXWYlxh.js` (297,755), two small shared chunks, CSS (14,320) |

What `index.html` loads contains no Privy code: the string "privy" occurs 0 times in
`index-DxXWYlxh.js`. The other 300-odd files are Privy and its dependencies, split by Vite.
They include WalletConnect, a fiat on-ramp screen, MFA enrolment and Solana helpers. Privy
loads them on demand, and some are never used by email login. The largest is 401,423 bytes.

## What this means for DeWEB

Every file must be published to SiteRegistry to be served. That means at least one
transaction per file, so over 300 transactions.

Before measuring, a rough figure came from the first publish (deweb.md): about 227 gas a
byte, so roughly 1.2 billion gas, about 0.024 OKB.

### Measured on a fork (SIMULATION, 2026-11-24)

`scripts/p2/deweb-privy-dryrun.sh` (task `p2-deweb-privy-dryrun`, on `karwan-test`) published
this build to circuit 9's site with the owner's script, on an anvil fork of X Layer at block
76,754,611. The deployer was impersonated and nothing was sent to the live chain. Its live
balance is not enough, so on the fork only it was raised to 1 OKB.

| | Measured |
| --- | --- |
| Transactions | 470, one per 24,000-byte chunk of the 308 new or changed files, 5,255,756 bytes (470 expected) |
| Gas used | 1,264,274,867 |
| Largest single transaction | 5,537,104 gas |
| OKB spent at 20,000,001 wei | 0.025285 |
| Forge's own estimate in the simulation step | 1,774,227,041 gas, 0.035485 OKB |
| Time | simulation 739 s, publish 1,113 s |

All checks passed:

- the simulation did not move the nonce (39);
- the publish moved it from 39 to 509, exactly 470 transactions;
- all 312 files read back byte for byte, and the name is still live;
- a second run sent nothing.

The first attempt failed in simulation with `DeployFailed()`: forge runs the whole script as one
call while simulating, and this publish passes forge's default gas limit for that call. The
script and the command printed by `scripts/p2/deweb-plan.mts` now add
`--gas-limit 100000000000`. That flag does not change the gas of any transaction sent.

What this means for the live publish:

- The deployer holds 0.014963 OKB. The measured spend is 0.025285 OKB, so it is short by
  about 0.0103 OKB before any margin.
- Forge's simulation estimate is higher, 0.035485 OKB. If the live run needs that much in
  the account to start, the shortfall is about 0.0205 OKB.
- The P4 estimate (`docs/evidence/p4/cost-estimate.md`) needs its own OKB on top of this.

Evidence is in `docs/evidence/p2/deweb-privy/`: `run.log`, the forge and anvil logs, the
read-backs before and after, the gas summary and the run summary. Forge's broadcast record
(`run-latest.json`, 33.6 MB) is not copied; its SHA-256 is in `deweb-privy-run-latest.sha256`.

## Not done

- Sign-in has not been tried in a browser on any host. The DeWEB gateway test (R21) is the
  real check: allowed origins and the Privy iframe at `auth.privy.io` under the gateway's
  Service Worker.
- The 16 new strings in each language need the native review like the rest.
