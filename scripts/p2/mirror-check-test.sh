#!/usr/bin/env bash
# P2: rehearse the mirror check of .github/workflows/pages.yml on node-services, from the workdir
# root through the resource hook. It reads the live chain (read only) and serves files from a
# local web server in a container; nothing is deployed and no transaction is sent.
#
# Checks, in order:
#   1. the workflow's assemble step puts exactly the chain/site bytes under _site/app;
#   2. `deweb-plan.mts mirror` against that folder passes (same bytes as X Layer);
#   3. with one byte of index.html changed it fails;
#   4. with the JS file missing it fails.
set -euo pipefail
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
ID=${1:-9}
NAME=payproof-p2-mirror-web
mkdir -p out .home
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
rm -rf out/mirror-site

node_run() { docker run --rm "$@"; }
NODE_OPTS=(--cpus 1 --memory 1g --user 1000:1000 -e HOME=/w/.home -v "$PWD:/w" -w /w)

echo "== 1. assemble as the workflow does"
node_run "${NODE_OPTS[@]}" "$NODE" node -e '
  const fs = require("fs"), path = require("path"), c = require("crypto");
  const m = JSON.parse(fs.readFileSync("chain/site/manifest.json", "utf8"));
  for (const p of m.paths) {
    fs.mkdirSync(path.dirname("out/mirror-site/app/" + p), { recursive: true });
    fs.copyFileSync("chain/site/" + p, "out/mirror-site/app/" + p);
  }
  m.paths.forEach((p, i) => {
    const h = "0x" + c.createHash("sha256").update(fs.readFileSync("out/mirror-site/app/" + p)).digest("hex");
    if (h !== m.sha256[i]) { console.error("FAIL: assembled " + p + " differs"); process.exit(1); }
  });
  console.log("assembled " + m.paths.length + " files, all match the manifest");'

echo "== start a web server over out/mirror-site"
docker run -d --name "$NAME" "${NODE_OPTS[@]}" "$NODE" node -e '
  const http = require("http"), fs = require("fs"), path = require("path");
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  http.createServer((q, r) => {
    const f = path.join("/w/out/mirror-site", decodeURIComponent(q.url.split("?")[0]));
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); r.end(b); });
  }).listen(8080, "127.0.0.1");' >/dev/null
sleep 2

mirror() { node_run --network "container:$NAME" "${NODE_OPTS[@]}" "$NODE" \
  node scripts/p2/deweb-plan.mts mirror "$LIVE" chain/site "$ID" http://127.0.0.1:8080/app/ "$1"; }

echo "== 2. true files must pass"
mirror out/mirror-check-pass.json

echo "== 3. one byte of index.html changed must fail"
cp out/mirror-site/app/index.html out/index.keep
printf ' ' >> out/mirror-site/app/index.html
if mirror out/mirror-check-tampered.json; then echo "FAIL: changed file accepted"; exit 1; fi
cp out/index.keep out/mirror-site/app/index.html
echo "refused as expected"

echo "== 4. a missing file must fail"
JS=$(ls out/mirror-site/app/assets/*.js)
mv "$JS" out/js.keep
if mirror out/mirror-check-missing.json; then echo "FAIL: missing file accepted"; exit 1; fi
mv out/js.keep "$JS"
echo "refused as expected"

rm -rf out/mirror-site out/index.keep
echo "ALL CHECKS PASSED"
