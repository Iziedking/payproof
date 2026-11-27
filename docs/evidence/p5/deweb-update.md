# DeWEB: updating the live site to the current app (2026-11-26)

Until 2026-11-27 the live DeWEB site of circuit 9 (`9.2.425.tape`, https://9-2-425.tapekit.org/) served the P2
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

## Live update (2026-11-27)

The owner topped the deployer up to 0.056396 OKB and ran, from `chain/`:

```
forge script script/DeWebPublish.s.sol --sig "run(uint256,uint256)" 9 12 --rpc-url https://xlayerrpc.okx.com --chain 196 --sender 0x5c807eA36fC11a72192d83ecff2b3D4746767612 --account payproof-deployer --legacy --with-gas-price 20000001 --slow --gas-limit 100000000000 --broadcast
```

The owner signed with the `payproof-deployer` keystore. The simulation step took several minutes
on the owner's PC because forge fetched fork state from the public RPC one call at a time.

| | Rehearsal (fork) | Live |
| --- | --- | --- |
| Transactions | 474 | 474, all status 1 (311 `putFile`, 163 `appendChunk`) |
| Nonces | 74 to 547 | 74 to 547 |
| Blocks | | 76,985,337 to 76,986,402 |
| Gas used | 1,286,136,029 | 1,286,136,029 |
| OKB spent | 0.025723 | 0.025722721866136029 |
| Forge's estimate | 0.036097 OKB | 0.036096731164836468 OKB |

First transaction:
[`0x57b02983…599dc`](https://www.oklink.com/x-layer/tx/0x57b02983c00e0ed56bc3b92b6c30fd6a994c97df3ce026463af079ac302599dc).
Last transaction:
[`0xcc8d3b21…37c`](https://www.oklink.com/x-layer/tx/0xcc8d3b21a0302758d3939ce4ad6a37ed991c5dedd176579da3e0c825b6ebf37c).
After the run the deployer holds 0.030673 OKB at nonce 548.

Forge's record of the run (`chain/broadcast/DeWebPublish.s.sol/196/run-latest.json`, 34.1 MB,
ignored by Git) has SHA-256 `4530c9239d49fb5bca9dabb786f93a10205ac735cb2da384428b71d550e574eb`.

### Read back from the live chain

Task `p2-deweb-live-landed` on node-services read every file back through
`https://xlayerrpc.okx.com` at block 76,991,497:

- all 314 files (5,353,643 bytes) match `chain/site/` byte for byte;
- the declared SHA-256 and content type of each file match;
- the container is opened, and the name `9.2.425.tape` and the container are live.

Result: `docs/evidence/p5/deweb-update/live-landed.json`.

### The gateway

In Chrome, on 2026-11-27:

- https://9-2-425.tapekit.org/#/splits serves the new build. The Splits page read the vault from
  X Layer and showed split 1, round 1, pot 1, fees 0.1, paid out 0.84, open until 2026-12-02.
- `#/sign-in` loads the sign-in form. All the Privy chunks it fetched came from the gateway with
  status 200.
- The only console error came from a wallet browser extension (`Cannot redefine property:
  ethereum`), not from the app. Privy logs that Coinbase Smart Wallet does not support chain 196.

## Not done yet

- Privy sign-in end to end (PLAN R21): sending a code and signing in with a real email has not
  been tried on the gateway. It needs the owner's email and inbox, and
  `https://9-2-425.tapekit.org` must be an allowed origin in the Privy dashboard.
- The mirror. It serves `chain/site/` and checks it against SiteRegistry on every push. Now that
  the live update has landed, `chain/site/` can be committed and pushed.
- The old P2 files (`assets/index-BchCgAus.js`, `assets/index-J9SKQEqf.css`) stay on chain. The
  new `index.html` no longer loads them.
