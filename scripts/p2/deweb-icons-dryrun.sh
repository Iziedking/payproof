#!/usr/bin/env bash
# P2 SIMULATION: rehearse adding the app icons to the live DeWEB site of circuit <#ID> with the
# owner's path (chain/script/DeWebPublish.s.sol), on an anvil fork of X Layer taken after the
# live publish. The deployer is impersonated on the fork only (`--unlocked`, no key) and keeps
# its live balance. Runs from the workdir root on node-services through the resource hook.
# Needs app/dist from the host-service build (task p2-app-build), which now has the icons.
#
# Checks, in order:
#   1. prepare: the JS, CSS and index.html in the new manifest are the ones already on chain;
#   2. without --broadcast forge only simulates: the nonce does not move;
#   3. with --broadcast exactly one transaction per icon is sent (the container is already
#      opened, the other files are complete and the name is live, so all of that is skipped);
#   4. every file, old and new, reads back byte for byte; the name is still live;
#   5. a second run with --broadcast sends nothing.
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
ID=${1:-9}
MONTHS=${2:-12}
DEPLOYER=0x5c807eA36fC11a72192d83ecff2b3D4746767612
FORK=http://127.0.0.1:8545
SITE=chain/site
NAME=payproof-p2-deweb-anvil-icons
mkdir -p out logs .home
cleanup() { docker rm -f "$NAME" payproof-p2-deweb-forge-icons >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
rm -rf chain/broadcast chain/cache chain/out

docker run -d --name "$NAME" --cpus 2 --memory 4g "$FOUNDRY" \
  "anvil --fork-url $LIVE --host 127.0.0.1 --port 8545 --timeout 120000" >/dev/null
for i in $(seq 1 90); do
  if docker exec "$NAME" sh -c "cast block-number --rpc-url $FORK" >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$NAME" sh -c 'anvil --version | head -1'
echo "fork block $(docker exec "$NAME" sh -c "cast block-number --rpc-url $FORK")"
docker exec "$NAME" sh -c "cast rpc --rpc-url $FORK anvil_impersonateAccount $DEPLOYER" >/dev/null

node_run() { docker run --rm --network "container:$NAME" --cpus 1 --memory 3g --user 1000:1000 \
  -e HOME=/w/.home -v "$PWD:/w" -w /w "$NODE" node scripts/p2/deweb-plan.mts "$@"; }
forge_run() { docker run --rm --name payproof-p2-deweb-forge-icons --network "container:$NAME" --cpus 2 --memory 4g \
  --user 1000:1000 -e HOME=/w/.home -v "$PWD:/w" -w /w/chain "$FOUNDRY" "$1"; }
nonce() { docker exec "$NAME" sh -c "cast nonce $DEPLOYER --rpc-url $FORK"; }
COMMON="--rpc-url $FORK --chain 196 --sender $DEPLOYER --unlocked --legacy --with-gas-price 20000001 --slow"
RUN="forge script script/DeWebPublish.s.sol --sig 'run(uint256,uint256)' $ID $MONTHS $COMMON"

echo "== 1. prepare $SITE from app/dist; the files already on chain must be unchanged"
node_run landed "$FORK" "$SITE" "$ID" out/deweb-icons-before.json >/dev/null
node_run prepare app/dist "$SITE"
docker run --rm --user 1000:1000 -v "$PWD:/w" -w /w "$NODE" node -e '
  const before = require("./out/deweb-icons-before.json"), m = require("./chain/site/manifest.json");
  if (m.paths[m.paths.length - 1] !== "index.html") { console.error("FAIL: index.html is not last"); process.exit(1); }
  for (const c of before.checks) if (!c.sameBytes || !m.paths.includes(c.path)) { console.error("FAIL: " + c.path + " changed"); process.exit(1); }
  console.log("unchanged on chain: " + before.checks.map((c) => c.path).join(", ") + "; new: " + m.paths.filter((p) => !before.checks.some((c) => c.path === p)).join(", "));'
echo "== owner command and cost, as printed for the live chain"
node_run command "$LIVE" "$SITE" "$ID" "$MONTHS"
echo "deployer balance: $(docker exec "$NAME" sh -c "cast balance $DEPLOYER --rpc-url $FORK") wei (live, not raised)"

echo "== 2. simulation only (no --broadcast)"
n0=$(nonce)
forge_run "forge --version | head -1; $RUN"
[ "$(nonce)" = "$n0" ] || { echo "FAIL: a simulation changed the nonce"; exit 1; }
echo "nonce before and after $n0"

echo "== 3. publish with --broadcast"
b0=$(docker exec "$NAME" sh -c "cast balance $DEPLOYER --rpc-url $FORK")
forge_run "$RUN --broadcast"
n1=$(nonce)
b1=$(docker exec "$NAME" sh -c "cast balance $DEPLOYER --rpc-url $FORK")
NEW=$(docker run --rm --user 1000:1000 -v "$PWD:/w" -w /w "$NODE" node -e 'const b=require("./out/deweb-icons-before.json"),m=require("./chain/site/manifest.json");console.log(m.paths.filter(p=>!b.checks.some(c=>c.path===p)).length)')
echo "nonce $n0 -> $n1: $((n1 - n0)) transactions, $NEW new files; spent $((b0 - b1)) wei"
[ "$((n1 - n0))" = "$NEW" ] || { echo "FAIL: expected one transaction per new file"; exit 1; }
cp chain/broadcast/DeWebPublish.s.sol/196/run-latest.json out/deweb-icons-run-latest.json

echo "== 4. read every file back"
node_run landed "$FORK" "$SITE" "$ID" out/deweb-icons-landed.json

echo "== 5. a second run with --broadcast must send nothing"
forge_run "$RUN --broadcast" || true
[ "$(nonce)" = "$n1" ] || { echo "FAIL: a second run sent transactions"; exit 1; }
echo "nonce before and after $n1"
echo "{\"nonceStart\":$n0,\"nonceAfterPublish\":$n1,\"transactions\":$((n1 - n0)),\"spentWei\":\"$((b0 - b1))\",\"balanceRaised\":false}" > out/deweb-icons-summary.json
docker logs "$NAME" > logs/anvil-p2-deweb-icons-dryrun.log 2>&1 || true
echo "ALL CHECKS PASSED"
