# DeWEB: publishing the app (2026-11-23)

The P2 DeWEB test publish (PLAN R21, R22): the research, the fork rehearsals, and the live
publish, which put the app at `https://9-2-425.tapekit.org/` from circuit 9's container.

## Sources

- TapeOutProtocol/TAPs at `527477ecb7cf68ee9e86d8292669d57fe1680572` (2026-11-10): `TAPs/TAP-10.md`.
- TapeOutProtocol/TapeKit at `37c617e7e332787c8a32a81e4d7d05a28a06c156` (2026-10-22): `README.md`,
  `SPEC.md`, `kernel/src/path.js`, `kernel/src/selectors.js`, `kernel/src/purity.js`,
  `sw-gateway/serve.js`, `sw-gateway/sw.js`.
- The live gateway https://tapekit.org/sw.js, read 2026-11-23: version `0.3.0`, the same code as
  the repository.
- On chain, X Layer block 76,655,585, task `p2-deweb-read` (`scripts/p2/deweb-read.mts`).

## What is settled

| Question | Answer | Source |
| --- | --- | --- |
| How a site is stored | Whole files in `SiteRegistry` `0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6`, keyed by (container, path), each with a declared SHA-256 and content type. `putFile` writes the first chunk of at most 24,000 bytes, `appendChunk` the rest; at most 350 chunks per file | TAP-10 Appendix A; TapeKit README section 3 |
| Who owns a site | The holder of a circuit NFT, through its ERC-6551 container. The container must be opened first | TAP-10 section 1; TapeKit README section 1 |
| Cost of storing | Each chunk is deployed as a small contract: about 200 gas per byte plus overhead. The app build is about 315 KB | TapeKit README section 3 |
| Cost of activating | `DomainBinding.monthlyFee()` on X Layer is **0 wei**. `bind` must still be called by the holder | On chain, block 76,655,585 |
| Our processor | Number **425** in the X Layer factory, so our sites are named `<#ID>.2.425.tape` and served at `https://<#ID>-2-425.tapekit.org/` | On chain; TAP-10 section 2 |
| Our containers | Circuits 3 to 14: all held by the deployer, **none opened**, no files, none live | On chain |
| Hash routes | The gateway drops everything after `?` and `#` when it looks up a file, and keeps `location.hash` across its own reloads. `#/rules` and `#/result?...` work | `kernel/src/path.js`; `sw-gateway/boot.js` |
| Path routes | An optional fallback file (`setFallback(container, "index.html")`) serves paths without an extension. Not needed while the app uses hash routes | `kernel/src/path.js` `resolvePath` |
| Calls to the X Layer RPC | Allowed. The site CSP has `connect-src 'self' blob: data: https: wss:`; off-chain requests are let through and logged. The two X Layer RPC hosts are the chain's own nodes and are not counted as off-chain | `sw-gateway/serve.js` `SITE_CSP`; `sw.js` |
| Google Fonts | Allowed (`style-src` and `font-src` include `https:`). It costs the "100% on-chain" badge, which a Service Worker gateway never shows anyway | `serve.js`; `purity.js`; TAP-10 section 8 |
| Scripts | Must come from the chain (`script-src 'self' ... blob:`). The app has no outside scripts | `serve.js` |
| Content types | Served as declared, plus `charset=utf-8` for text. Declare `text/html`, `text/javascript`, `text/css`. No compression is applied | `kernel/src/path.js`; `serve.js`; TapeKit README |

## Opening a container (found 2026-11-23)

Neither repository documents it. The opener `0x536adD8F30f03b69f6fbF29d425A816A0dC50106` is not
verified on Sourcify for X Layer or BNB Smart Chain. Its X Layer bytecode (2,604 bytes, not an
EIP-1967 proxy) holds these selectors, resolved through the openchain signature database:
`open(address,uint256)` (`0x0a0e5c9d`), `FEE()`, `treasury()`, `payments()`, `registry()`,
`implementation()`, `factory()`, `paid(address)`, `isDeployed(address,uint256)`,
`accountOf(address,uint256)`, `isOpened(address,uint256)`.

Read on X Layer, block 76,656,310: `FEE()` = 80,000,000,000,000,000 wei, **0.08 OKB**, paid once
per container. `payments()`, `registry()`, `implementation()` and `factory()` return the container
payments table, ERC-6551 registry, container implementation and processor factory listed in TAP-10
Deployments, so this is the contract the spec names.

## Fork rehearsal (task `p2-deweb-fork`, simulation)

Anvil fork of X Layer at block 76,656,415; the deployer impersonated, its fork balance raised with
`anvil_setBalance` because the live account cannot pay the fee. Circuit 9 used as a stand-in.

| Step | Transactions | Gas used |
| --- | --- | --- |
| `open(circuits, 9)` with 0.08 OKB | 1 | 167,244 |
| `index-BchCgAus.js`, 301,291 bytes: `putFile` + 12 `appendChunk` | 13 | 67,946,701 |
| `index-J9SKQEqf.css`, 14,320 bytes: `putFile` | 1 | 3,392,825 |
| `index.html`, 1,252 bytes: `putFile` (last, so the page appears only once its assets exist) | 1 | 560,640 |
| `bind("9.2.425.tape", container, 12)` with 0 OKB | 1 | 185,482 |
| **Total** | **17** | **71,892,818** |

- `open` from an unrelated address reverts (custom error `0xf04f3db2`); from the holder it succeeds.
- Each of the three files read back through `SiteRegistry.read` byte for byte, and `fileInfo`
  carries the declared SHA-256.
- After `bind`, `isLive("9.2.425.tape", container)` and `isContainerLive(container)` are both true.
- Cost at 20,000,001 wei: network 0.001438 OKB, opening fee 0.08 OKB, binding 0: **0.08144 OKB**.
  The deployer holds 0.000048 OKB.
- Each chunk transaction carries about 24 KB of calldata, more than a Windows command line takes
  (the limit found in P2 section 3), so signing goes through a Foundry script that reads the
  files, as for the tape-outs.

Evidence: `docs/evidence/p2/deweb/deweb-fork.json`, `docs/evidence/p2/deweb/anvil-p2-deweb-fork.log`
(test keys cut, host sha noted).

## The owner's publish path (task `p2-deweb-forge-dryrun`, simulation)

`chain/script/DeWebPublish.s.sol`, signed by the owner with `forge script` as for the tape-outs.
It reads `chain/site/manifest.json` and the files it lists (foundry.toml now allows reads of
`./site` as well as `./netlists`). Before sending anything it checks the chain id, that the opening
fee is still 0.08 OKB and the monthly fee still 0, and the size and SHA-256 of every file. Then it
opens the container if not yet opened, writes each file (index.html last), and binds
`<#ID>.2.425.tape`. Steps already on chain are skipped, and a file left part written is carried on
from its last chunk. `scripts/p2/deweb-plan.mts` writes the manifest (`prepare`), prints the
owner's command with the live gas price and balance (`command`), and reads everything back
(`landed`).

The files are the host-service build of the committed app (task `p2-app-build`, 2026-11-23). The
SHA-256 of all three is identical to the build used in the first rehearsal:

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `assets/index-BchCgAus.js` | 301,291 | `93c7096f…ba79cfb` |
| `assets/index-J9SKQEqf.css` | 14,320 | `db063f78…20b5995` |
| `index.html` | 1,252 | `33da535f…0ac1f9` |

Anvil fork of X Layer at block 76,658,740, forge 1.8.6, deployer impersonated with `--unlocked`.
The live balance (0.024048 OKB) is below the opening fee, so the fork balance was raised to 1 OKB
to rehearse the rest (`balanceRaised: true` in the summary).

| Check | Result |
| --- | --- |
| Without `--broadcast` | Simulation only; nonce 19 before and after |
| `index.html` changed by one byte | Refused ("size differs from the manifest: index.html"); nonce unchanged |
| Publish with `--broadcast` | 17 transactions, all succeeded: open, 13 + 1 + 1 file writes, bind |
| Read back (`landed`) | Every file byte for byte, declared SHA-256 and content type match; opened, `isLive` and `isContainerLive` true |
| The JS file cut back to its first chunk, then run again | 12 `appendChunk` transactions from chunk 1; read back identical |
| Run again with nothing left to do | No transactions; nonce 49 before and after |

Cost of the 17-transaction publish at 20,000,001 wei: 71,892,818 gas, 0.001438 OKB, plus the 0.08
OKB opening fee: **0.081438 OKB**. Forge sets gas limits that add up to 99,592,664 (largest one
7,609,349), so the account must hold about **0.082 OKB** when the run starts.

Evidence: `docs/evidence/p2/deweb/forge-dryrun/` (receipts summary, both read-backs, summary,
anvil log with test keys and mnemonic cut, host file sha256 noted in its first line); the
published bytes and manifest are in `chain/site/`.

## Live publish (2026-11-23)

The owner signed `DeWebPublish.s.sol` with `run(9, 12)` from `chain/`: first without `--broadcast`
(simulation, 17 transactions, gas limits summing to 99,592,664), then with `--broadcast`.

| Step | Transactions | Gas used |
| --- | --- | --- |
| `open(circuits, 9)`, tx `0x2daa4bdf…435a8291`, block 76,669,759 | 1 | 167,244 |
| `index-BchCgAus.js`: `putFile` + 12 `appendChunk` | 13 | 67,946,701 |
| `index-J9SKQEqf.css`: `putFile` | 1 | 3,392,825 |
| `index.html`: `putFile` | 1 | 560,640 |
| `bind("9.2.425.tape", container, 12)`, tx `0x166c40d5…7f6afac7`, block 76,669,800 | 1 | 185,482 |
| **Total** | **17** | **71,892,818** |

All 17 succeeded, blocks 76,669,759 to 76,669,800. Gas used is the same, transaction for
transaction, as in the fork rehearsal. Cost at 20,000,001 wei: network 0.001437856 OKB, opening
fee 0.08 OKB, binding 0: **0.081437856 OKB**.

Read back from the live chain at block 76,677,049 (task `p2-deweb-live-landed`, read only): all
three files byte for byte, declared SHA-256 and content type match; container
`0x2b6cedc361719b551d1410f9fa25d90719770adf` opened; `isLive("9.2.425.tape", container)` and
`isContainerLive(container)` true.

Through the gateway, 2026-11-23 15:02 UTC, in Chrome:

- `https://9-2-425.tapekit.org/` returns 200 and the app renders, with no errors in the console.
- China year-end bonus, 36,001: the app read circuits 9 and 12 from X Layer at block 76,677,094,
  ran them in the browser and showed ¥32,610.90 kept, tax ¥3,390.10, inside the trap
  ¥36,000.01 to ¥38,566.65. These are the same figures as the local preview.
- The hash route `#/result?rule=cn&bonus=36001.00&...` opened the result page, which shows
  "Your figures sent: none".

At phone width (the live site in a 390 by 780 px frame on the same origin, in desktop Chrome,
because the Chrome window would not resize): the narrow layout is used (segmented rule picker,
Menu), nothing is wider than the page (`scrollWidth` 375 with the scroll bar), and the same check
gives ¥32,610.90 with the breakdown and trap card in one column. This is not a phone test: touch,
the on-screen keyboard and the 60-second timing still need a real phone.

Evidence: `docs/evidence/p2/deweb/live/` (`gateway-390-check.jpg`, `gateway-390-result.jpg`,
`deweb-live-receipts.json`, cut from the owner's
`chain/broadcast/DeWebPublish.s.sol/196/run-latest.json`, which Git ignores;
`deweb-live-landed.json`; `gateway-cn-36001.jpg`).

## What is not settled

- **Binding `payproof.kingizie.tech`.** The DNS record for an X Layer site, the CNAME target and
  who serves the certificate are HashPort's and are not in these repositories. The browser
  extension's checker knows only BNB Smart Chain records (`chain=56`).
- **A publishing tool.** There is no open-source CLI yet ("on the roadmap"). The routes are the
  HashPort console, or our own script calling `putFile` and `appendChunk`, signed by the holder
  or an operator set with `setOperator`.
- **Renewal.** The name `9.2.425.tape` is bound for 12 months from block 76,669,800. The monthly
  fee was 0 when it was bound; a renewal has to check it again.
- **Updating the site.** A new build means new asset names, so `putFile` for the new files and
  `index.html`. The old assets stay on chain unless removed. Not yet rehearsed.
