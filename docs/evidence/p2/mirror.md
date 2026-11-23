# The mirror: the same build as on DeWEB (2026-11-23)

PLAN section 3 (Uptime) asks for a mirror that serves the same build hash as DeWEB. The mirror
is GitHub Pages, published by `.github/workflows/pages.yml`.

## What changed

Before, the workflow served a fresh build of `app/` made on GitHub's runner, so nothing tied its
files to the ones on X Layer. Now:

1. **The mirror serves `chain/site/`**, the committed files that were published to DeWEB, byte
   for byte, under `app/`. The landing page stays at the root. The icons are copied next to them;
   they are not on DeWEB (see below).
2. **Before deploying**, the job runs `deweb-plan.mts landed` against `https://xlayerrpc.okx.com`.
   It reads every file of circuit 9's container back from SiteRegistry and stops the deploy if
   any byte, declared SHA-256 or content type differs from `chain/site/`.
3. **The app is still built and tested** (`tsc`, `vitest`, `vite build`). The job summary says,
   file by file, whether that build gives the published hashes. It does not stop the deploy: a
   difference means `app/` has changed since the publish, or the build does not reproduce on the
   runner, and the mirror keeps serving the published files either way.
4. **After deploying**, a `check` job runs the new `deweb-plan.mts mirror` command. It fetches
   each file from the deployed mirror and compares it byte for byte with the file read from
   SiteRegistry. If any differs, the run fails.

So a change to the app reaches the mirror only after it has been published to DeWEB and the new
`chain/site/` is committed.

## Rehearsal (task `p2-mirror-check-test`, node-services, read only)

`scripts/p2/mirror-check-test.sh`: assemble `chain/site` the way the workflow does, serve it from
a local web server in a container, and run `mirror` against X Layer.

| Check | Result |
| --- | --- |
| Assembled files against the manifest | 3 of 3 match |
| True files | pass: all three SHA-256 equal on the mirror, on chain and in the manifest (block 76,677,728) |
| One byte added to `index.html` | refused: mirror `0x260edeae…`, chain `0x33da535f…` |
| JS file missing (404) | refused |

The workflow YAML parses (PyYAML on node-services); jobs `build`, `deploy`, `check`. It has not
run on GitHub yet. The real mirror check happens on the first run after the push.

Evidence: `docs/evidence/p2/mirror/mirror-check-local-{pass,tampered,missing}.json`.

## Not settled

- **GitHub Pages is not enabled yet.** The site gave 404 when last checked. The owner turns on
  Pages (Settings, Pages, Source: GitHub Actions) and pushes, and the first run needs checking.
- **Icons on DeWEB.** `index.html` links `favicon.svg`, `favicon-32.png` and
  `apple-touch-icon-180.png`. They are on the mirror but not on chain, so the DeWEB site shows
  no icon. Publishing them adds three small files (1,788 bytes), with no opening fee.
