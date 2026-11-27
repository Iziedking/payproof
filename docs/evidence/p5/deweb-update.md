# DeWEB: updating the live site to the current app (2026-11-26)

The live DeWEB site of circuit 9 (`9.2.425.tape`, https://9-2-425.tapekit.org/) serves the P2
build: 6 files, without the Splits, Check payout, Run, Engines and Hunt pages added in P3 and P4.
This records the rehearsal of updating it to the current app with the owner's script
(`chain/script/DeWebPublish.s.sol`), before the owner signs the live update.

## The build

Built on host-service (task `p2-app-build`, `scripts/app/build.sh`, Node v24.22.1, `npm ci
--ignore-scripts`) from commit `477ee1f`. The same tree built on karwan-test (task
`p3-app-check`, which also ran `tsc`, the 31 unit tests and the proof-record check) gave the same
files.

| | |
| --- | --- |
| Files | 314 (310 under `assets/`) |
| Bytes | 5,353,643 |
| `index.html` SHA-256 | `46c2dddce3d80fa4a88068ce8b2e8bc6315f784f4deda1b182d6336ee27ffe87` |

Most of the files are the sign-in library (Privy) and the code it loads only when someone signs
in. DeWEB serves only files that are on chain, so all of them are published. What `index.html`
loads first is 725,596 bytes.

`chain/site/` now holds these files and `manifest.json` (index.html last). The three icons are
unchanged and already on chain.

## Rehearsal (task `p5-deweb-update-dryrun`, SIMULATION)

`scripts/p5/deweb-update-dryrun.sh` on node-services: an anvil 1.8.6 fork of X Layer at block
76,888,879, forge 1.8.6, the deployer impersonated with `--unlocked` (no key). The deployer's live
balance, 0.009060 OKB, is not enough, so on the fork only it was raised to 1 OKB. Nothing was
sent to the live chain.

| Check | Result |
| --- | --- |
| The committed `chain/site` against the live site, before | read back byte for byte |
| New or changed files | 311 of 314, 5,351,855 bytes, 474 chunks of up to 24,000 bytes |
| Without `--broadcast` | simulation only; nonce 74 before and after (810 s) |
| With `--broadcast` | 474 transactions, as expected; the container is already opened and the name already live, so neither was sent again (1,144 s) |
| Read back after | all 314 files byte for byte, declared SHA-256 and content type match; container opened, name live |
| A second run with `--broadcast` | no transactions; nonce 548 before and after |

| Cost | |
| --- | --- |
| Gas used | 1,286,136,029 |
| Largest single transaction | 5,537,116 gas |
| OKB spent at 20,000,001 wei | **0.025723** |
| Forge's own estimate in the simulation step | 1,804,836,468 gas, **0.036097 OKB** |

Forge's estimate is what the simulation reports as "amount required", so the account should hold
at least that when the live run starts. With the live balance of 0.009060 OKB, a top-up of
0.03 OKB leaves about 0.039 OKB, above both figures.

Evidence: `docs/evidence/p5/deweb-update/` (summary, gas, read-backs before and after, the
manifest before, simulate and rerun logs, the tail of the broadcast log, and the anvil log with the
test keys and mnemonic cut; the host file's SHA-256 is in its first line). Forge's broadcast
record (`run-latest.json`, 34.2 MB) is not copied; its SHA-256 is in
`deweb-update-run-latest.sha256`.

## Not done yet

- The live update. The owner signs it after the top-up.
- Privy sign-in on the gateway has never been tried (PLAN R21). The live update is the first
  chance; the result is recorded either way.
- The mirror. It serves `chain/site/` and checks it against SiteRegistry on every push, so
  `chain/site/` must be pushed only after the live update has landed, or the mirror check fails.
- The old P2 files (`assets/index-BchCgAus.js`, `assets/index-J9SKQEqf.css`) stay on chain. The
  new `index.html` no longer loads them.
