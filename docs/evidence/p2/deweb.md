# DeWEB: what a test publish of the app needs (2026-11-23)

Read-only research for the P2 DeWEB test publish (PLAN R21, R22). Nothing was published and no
transaction was sent.

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

## What is not settled

- **Which circuit hosts the site.** Any circuit the deployer holds works; the name is `<#ID>.2.425.tape`.
- **Binding `payproof.kingizie.tech`.** The DNS record for an X Layer site, the CNAME target and
  who serves the certificate are HashPort's and are not in these repositories. The browser
  extension's checker knows only BNB Smart Chain records (`chain=56`).
- **A publishing tool.** There is no open-source CLI yet ("on the roadmap"). The routes are the
  HashPort console, or our own script calling `putFile` and `appendChunk`, signed by the holder
  or an operator set with `setOperator`.
- **Funds.** The deployer holds about 0.000048 OKB; the rehearsal needs 0.08144 OKB (above). Before the rehearsal the estimate was: storing a 315 KB build is roughly 63 M gas
  or more (about 0.0013 OKB at 20,000,001 wei) before the opening fee, so a top-up is needed.
  This is an estimate from the 200 gas per byte figure, not a measurement.
