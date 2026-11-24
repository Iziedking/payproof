#!/usr/bin/env bash
# P3 SIMULATION: the owner's Foundry tape-out path (chain/script/TapeOut.s.sol) for the two
# SIMULATED engines (chain/netlists/engines, made by scripts/p3/engines-build.sh), end to end on
# an anvil fork of X Layer. The deployer is impersonated on the fork only (`--unlocked`, no key)
# and keeps its real balance there, so a run that passes shows the current funds cover both
# tape-outs with forge's own gas limits, and measures the gas each one uses. Modelled on
# scripts/p2/explain-forge-dryrun.sh. Runs from the workdir root on the test host through the
# resource hook.
#
# `landed` writes the fork's circuit ids to chain/netlists/engines/ids.json; they are moved to
# out/engines-forge-ids.json at the end so the owner's real tape-out starts with no ids file.
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
DEPLOYER=0x5c807eA36fC11a72192d83ecff2b3D4746767612
FORK=http://127.0.0.1:8545
NET=chain/netlists/engines
BCAST=broadcast/TapeOut.s.sol/196/run-latest.json
NAME=payproof-p3-engines-anvil
mkdir -p out logs .home
cleanup() { docker rm -f "$NAME" payproof-p3-engines-forge >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
rm -rf chain/broadcast chain/cache chain/out "$NET/ids.json"
test -f "$NET/manifest.json" || { echo "no $NET/manifest.json: run p3-engines-build first"; exit 1; }

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
forge_run() { docker run --rm --name payproof-p3-engines-forge --network "container:$NAME" --cpus 2 --memory 4g \
  --user 1000:1000 -e HOME=/w/.home -v "$PWD:/w" -w /w/chain "$FOUNDRY" "$1"; }
balance() { docker exec "$NAME" sh -c "cast balance $DEPLOYER --rpc-url $FORK"; }
GASPRICE=$(docker exec "$NAME" sh -c "cast gas-price --rpc-url $LIVE")
echo "live gas price $GASPRICE wei"
COMMON="--rpc-url $FORK --chain 196 --sender $DEPLOYER --unlocked --legacy --with-gas-price $GASPRICE --slow"
SIG='--sig "run(string,uint32,uint32,bytes32)"'
echo "deployer balance at start: $(balance) wei"

tape() {
  echo "== tape out $1 (balance before $(balance) wei)"
  forge_run "forge script script/TapeOut.s.sol $SIG $(node_plan args $NET "$1") $COMMON --broadcast"
  node_plan landed "$FORK" "$NET" "$1" "chain/$BCAST"
}
tape cn_vendor_a2
tape cn_vendor_b
echo "deployer balance at end: $(balance) wei"
mv "$NET/ids.json" out/engines-forge-ids.json
docker logs "$NAME" > logs/anvil-p3-engines-forge.log 2>&1 || true
echo "forge dry run: both engines landed on the fork"
