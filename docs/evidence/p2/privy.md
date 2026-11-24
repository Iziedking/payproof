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

The gas is not measured. A rough figure comes from the first publish (deweb.md), which spent
about 227 gas a byte, container opening included. On that basis, 5.27 MB is roughly
1.2 billion gas, about **0.024 OKB** at 20,000,001 wei. The deployer holds 0.0150 OKB. A
rehearsal on a fork would give the real figure before anything is sent.

## Not done

- Sign-in has not been tried in a browser on any host. The DeWEB gateway test (R21) is the
  real check: allowed origins and the Privy iframe at `auth.privy.io` under the gateway's
  Service Worker.
- The 16 new strings in each language need the native review like the rest.
