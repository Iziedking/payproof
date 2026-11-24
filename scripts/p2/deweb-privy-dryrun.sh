#!/usr/bin/env bash
# P2 SIMULATION: rehearse publishing the app build with Privy sign-in (312 files, about 5.3 MB)
# to the live DeWEB site of circuit <#ID> with the owner's path (chain/script/DeWebPublish.s.sol),
# on an anvil fork of X Layer. The deployer is impersonated on the fork only (--unlocked, no key).
# Its live balance is not enough for this publish, so on the fork only it is raised with
# anvil_setBalance; the run measures the OKB spent. Nothing is sent to the live chain.
# Runs from the workdir root on the test host through the resource hook. Needs app/dist from
# task p2-app-build-k.
#
# Checks, in order:
#   1. prepare chain/site from app/dist; index.html is last;
#   2. without --broadcast forge only simulates: the nonce does not move;
#   3. with --broadcast, one transaction per 24,000-byte chunk of every new or changed file;
#   4. every file reads back byte for byte and the name is still live;
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
NAME=payproof-p2-deweb-anvil-privy
mkdir -p out logs .home
cleanup() { docker rm -f "$NAME" payproof-p2-deweb-forge-privy >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
rm -rf chain/broadcast chain/cache chain/out

docker run -d --name "$NAME" --cpus 2 --memory 6g "$FOUNDRY" \
  "anvil --fork-url $LIVE --host 127.0.0.1 --port 8545 --timeout 120000 --gas-limit 210000000" >/dev/null
for i in $(seq 1 90); do
  if docker exec "$NAME" sh -c "cast block-number --rpc-url $FORK" >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$NAME" sh -c 'anvil --version | head -1'
echo "fork block $(docker exec "$NAME" sh -c "cast block-number --rpc-url $FORK")"
LIVE_BAL=$(docker exec "$NAME" sh -c "cast balance $DEPLOYER --rpc-url $FORK")
echo "deployer live balance $LIVE_BAL wei"
docker exec "$NAME" sh -c "cast rpc --rpc-url $FORK anvil_impersonateAccount $DEPLOYER" >/dev/null
# Fork only: 1 OKB, so the run is limited by the publish and not by today's balance.
docker exec "$NAME" sh -c "cast rpc --rpc-url $FORK anvil_setBalance $DEPLOYER 0xde0b6b3a7640000" >/dev/null

node_run() { docker run --rm --network "container:$NAME" --cpus 1 --memory 3g --user 1000:1000 \
  -e HOME=/w/.home -v "$PWD:/w" -w /w "$NODE" node scripts/p2/deweb-plan.mts "$@"; }
forge_run() { docker run --rm --name payproof-p2-deweb-forge-privy --network "container:$NAME" --cpus 2 --memory 6g \
  --user 1000:1000 -e HOME=/w/.home -v "$PWD:/w" -w /w/chain "$FOUNDRY" "$1"; }
nonce() { docker exec "$NAME" sh -c "cast nonce $DEPLOYER --rpc-url $FORK"; }
# --gas-limit: forge runs the whole script as one EVM call in simulation, and a publish of this size
# (about 1.2 billion gas over all its transactions) passes forge's default limit for that call
# (first rehearsal: DeployFailed from OutOfGas). It does not change any transaction's own gas.
COMMON="--rpc-url $FORK --chain 196 --sender $DEPLOYER --unlocked --legacy --with-gas-price 20000001 --slow --gas-limit 100000000000"
RUN="forge script script/DeWebPublish.s.sol --sig 'run(uint256,uint256)' $ID $MONTHS $COMMON"

echo "== 1. prepare $SITE from app/dist"
node_run landed "$FORK" "$SITE" "$ID" out/deweb-privy-before.json >/dev/null
cp "$SITE/manifest.json" out/deweb-privy-manifest-before.json
node_run prepare app/dist "$SITE"
EXPECT=$(docker run --rm --user 1000:1000 -v "$PWD:/w" -w /w "$NODE" node -e '
  const before = require("./out/deweb-privy-before.json"), old = require("./out/deweb-privy-manifest-before.json"), m = require("./chain/site/manifest.json");
  if (m.paths[m.paths.length - 1] !== "index.html") { console.error("FAIL: index.html is not last"); process.exit(1); }
  // A file is already on chain when it read back byte for byte before and has the same SHA-256 now.
  const onChain = new Map(before.checks.filter((c) => c.sameBytes).map((c) => [c.path, old.sha256[old.paths.indexOf(c.path)]]));
  let tx = 0, bytes = 0, files = 0;
  m.paths.forEach((p, i) => { if (onChain.get(p) !== m.sha256[i]) { tx += Math.ceil(m.sizes[i] / 24000); bytes += m.sizes[i]; files++; } });
  console.error(`${m.paths.length} files in the new site; ${files} new or changed (${bytes} bytes, ${tx} chunks)`);
  console.log(tx);')
echo "expected transactions: $EXPECT"
echo "== owner command and cost estimate, as printed for the live chain"
node_run command "$LIVE" "$SITE" "$ID" "$MONTHS" || true

echo "== 2. simulation only (no --broadcast)"
n0=$(nonce)
t0=$(date +%s)
forge_run "forge --version | head -1; $RUN" > logs/deweb-privy-simulate.log 2>&1 || { tail -30 logs/deweb-privy-simulate.log; exit 1; }
tail -12 logs/deweb-privy-simulate.log
[ "$(nonce)" = "$n0" ] || { echo "FAIL: a simulation changed the nonce"; exit 1; }
echo "nonce before and after $n0; simulation took $(( $(date +%s) - t0 )) s"

echo "== 3. publish with --broadcast (fork)"
b0=$(docker exec "$NAME" sh -c "cast balance $DEPLOYER --rpc-url $FORK")
blk0=$(docker exec "$NAME" sh -c "cast block-number --rpc-url $FORK")
t0=$(date +%s)
forge_run "$RUN --broadcast" > logs/deweb-privy-broadcast.log 2>&1 || { tail -30 logs/deweb-privy-broadcast.log; exit 1; }
tail -8 logs/deweb-privy-broadcast.log
n1=$(nonce)
b1=$(docker exec "$NAME" sh -c "cast balance $DEPLOYER --rpc-url $FORK")
blk1=$(docker exec "$NAME" sh -c "cast block-number --rpc-url $FORK")
SPENT=$((b0 - b1))
echo "nonce $n0 -> $n1: $((n1 - n0)) transactions (expected $EXPECT); spent $SPENT wei; blocks $blk0 -> $blk1; took $(( $(date +%s) - t0 )) s"
[ "$((n1 - n0))" = "$EXPECT" ] || { echo "FAIL: transaction count differs from the expected chunks"; exit 1; }
cp chain/broadcast/DeWebPublish.s.sol/196/run-latest.json out/deweb-privy-run-latest.json
docker run --rm --user 1000:1000 -v "$PWD:/w" -w /w "$NODE" node -e '
  const r = require("./out/deweb-privy-run-latest.json"); const g = r.receipts.map((x) => Number(BigInt(x.gasUsed)));
  const sum = g.reduce((a, b) => a + b, 0);
  console.log(JSON.stringify({ receipts: g.length, gasUsed: sum, maxGasOneTx: Math.max(...g), okbAt20000001: sum * 20000001 / 1e18 }));' \
  | tee out/deweb-privy-gas.json

echo "== 4. read every file back"
node_run landed "$FORK" "$SITE" "$ID" out/deweb-privy-landed.json

echo "== 5. a second run with --broadcast must send nothing"
forge_run "$RUN --broadcast" > logs/deweb-privy-rerun.log 2>&1 || true
[ "$(nonce)" = "$n1" ] || { echo "FAIL: a second run sent transactions"; exit 1; }
echo "nonce before and after $n1"
echo "{\"liveBalanceWei\":\"$LIVE_BAL\",\"balanceRaisedOnForkOnly\":true,\"nonceStart\":$n0,\"nonceAfterPublish\":$n1,\"transactions\":$((n1 - n0)),\"expected\":$EXPECT,\"spentWei\":\"$SPENT\"}" > out/deweb-privy-summary.json
docker logs "$NAME" > logs/anvil-p2-deweb-privy-dryrun.log 2>&1 || true
echo "ALL CHECKS PASSED"
