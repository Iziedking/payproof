#!/usr/bin/env bash
# P2 SIMULATION: the owner's Foundry tape-out path (chain/script/TapeOut.s.sol) for the
# explanation and validity circuits, end to end on an anvil fork of X Layer. The deployer is
# impersonated on the fork only (`--unlocked`, no key) and keeps its real balance there, so a
# run that passes shows the current funds cover all four tape-outs in this order with forge's
# own gas limits. Runs from the workdir root on node-services through the resource hook.
# Netlists go to chain/netlists/explain (inside the ./netlists read permission); chain/netlists
# itself is not touched. Images as in fork-tapeout.sh.
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
JSON_DIR=${1:-json}
DEPLOYER=0x5c807eA36fC11a72192d83ecff2b3D4746767612
FORK=http://127.0.0.1:8545
NET=chain/netlists/explain
BCAST=broadcast/TapeOut.s.sol/196/run-latest.json
NAME=payproof-p2-explain-anvil-forge
mkdir -p out logs .home
cleanup() { docker rm -f "$NAME" payproof-p2-explain-forge >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
rm -rf "$NET" chain/broadcast chain/cache chain/out

docker run -d --name "$NAME" --cpus 2 --memory 4g "$FOUNDRY" \
  "anvil --fork-url $LIVE --host 127.0.0.1 --port 8545 --timeout 120000" >/dev/null
for i in $(seq 1 90); do
  if docker exec "$NAME" sh -c "cast block-number --rpc-url $FORK" >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$NAME" sh -c 'anvil --version | head -1'
echo "fork block $(docker exec "$NAME" sh -c "cast block-number --rpc-url $FORK")"
docker exec "$NAME" sh -c "cast rpc --rpc-url $FORK anvil_impersonateAccount $DEPLOYER" >/dev/null

node_plan() { docker run --rm --network "container:$NAME" --cpus 1 --memory 3g --user 1000:1000 \
  -e HOME=/w/.home -v "$PWD:/w" -w /w "$NODE" node scripts/p2/tapeout-plan.mts "$@"; }
node_explain() { docker run --rm --network "container:$NAME" --cpus 1 --memory 3g --user 1000:1000 \
  -e HOME=/w/.home -v "$PWD:/w" -w /w "$NODE" node scripts/p2/explain-tapeout.mts "$@"; }
forge_run() { docker run --rm --name payproof-p2-explain-forge --network "container:$NAME" --cpus 2 --memory 4g \
  --user 1000:1000 -e HOME=/w/.home -v "$PWD:/w" -w /w/chain "$FOUNDRY" "$1"; }
balance() { docker exec "$NAME" sh -c "cast balance $DEPLOYER --rpc-url $FORK"; }
COMMON="--rpc-url $FORK --chain 196 --sender $DEPLOYER --unlocked --legacy --with-gas-price 20000001 --slow"
SIG='--sig "run(string,uint32,uint32,bytes32)"'

echo "== prepare (validity, cn, ng; the explanation top waits for the validity id)"
node_explain prepare "$JSON_DIR" chain/netlists "$NET"
echo "deployer balance at start: $(balance) wei"

tape() {
  echo "== tape out $1 (balance before $(balance) wei)"
  forge_run "forge script script/TapeOut.s.sol $SIG $(node_plan args $NET "$1") $COMMON --broadcast"
  node_plan landed "$FORK" "$NET" "$1" "chain/$BCAST"
}
tape ng_paye_explain
tape cn_bonus_explain
tape split_v1_validity
echo "== prepare again with the validity id (split_v1_explain)"
node_explain prepare "$JSON_DIR" chain/netlists "$NET"
tape split_v1_explain
echo "deployer balance at end: $(balance) wei"
cp "$NET/ids.json" out/explain-forge-ids.json
cp "$NET/manifest.json" out/explain-forge-manifest.json
docker logs "$NAME" > logs/anvil-p2-explain-forge.log 2>&1 || true
echo "forge dry run: all four landed"
