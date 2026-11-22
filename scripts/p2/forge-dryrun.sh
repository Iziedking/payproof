#!/usr/bin/env bash
# P2 SIMULATION: run the owner's Foundry tape-out path (chain/script/TapeOut.s.sol) end to end on
# an anvil fork of X Layer. The deployer is impersonated on the fork only (`--unlocked`, no key).
# Runs from the workdir root on node-services through the resource hook.
#
# Checks, in order:
#   1. without --broadcast forge only simulates: the deployer's nonce does not move;
#   2. a wrong keccak is refused; a file outside chain/netlists is refused (fs_permissions);
#   3. every piece is taped out with --broadcast, in order, and `landed` checks each one
#      (status, netlist bytes sent, circuit id, circuitInfo gates);
#   4. `check` compares on-chain eval with the local simulator for the three rules.
# Images as in fork-tapeout.sh. forge downloads solc 0.8.28 on first use (needs network).
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
JSON_DIR=${1:-json}
DEPLOYER=0x5c807eA36fC11a72192d83ecff2b3D4746767612
FORK=http://127.0.0.1:8545
NET=chain/netlists
BCAST=broadcast/TapeOut.s.sol/196/run-latest.json
NAME=payproof-p2-anvil-forge
mkdir -p out logs .home
cleanup() { docker rm -f "$NAME" payproof-p2-forge >/dev/null 2>&1 || true; }
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

node_run() { docker run --rm --network "container:$NAME" --cpus 1 --memory 3g --user 1000:1000 \
  -e HOME=/w/.home -v "$PWD:/w" -w /w "$NODE" node scripts/p2/tapeout-plan.mts "$@"; }
forge_run() { docker run --rm --name payproof-p2-forge --network "container:$NAME" --cpus 2 --memory 4g \
  --user 1000:1000 -e HOME=/w/.home -v "$PWD:/w" -w /w/chain "$FOUNDRY" "$1"; }
nonce() { docker exec "$NAME" sh -c "cast nonce $DEPLOYER --rpc-url $FORK"; }
COMMON="--rpc-url $FORK --chain 196 --sender $DEPLOYER --unlocked --legacy --with-gas-price 20000001 --slow"
SIG='--sig "run(string,uint32,uint32,bytes32)"'

echo "== prepare (modules, cn_bonus, ng_paye)"
node_run prepare "$JSON_DIR" "$NET"

echo "== 1. simulation only (no --broadcast)"
n0=$(nonce)
forge_run "forge --version | head -1; forge script script/TapeOut.s.sol $SIG $(node_run args $NET m_add) $COMMON"
n1=$(nonce)
echo "nonce before $n0 after $n1"
[ "$n0" = "$n1" ] || { echo "FAIL: a simulation changed the nonce"; exit 1; }

echo "== 2a. wrong keccak must be refused"
read -r f i o k <<<"$(node_run args $NET m_add)"
if forge_run "forge script script/TapeOut.s.sol $SIG $f $i $o 0x$(printf '0%.0s' $(seq 1 64)) $COMMON --broadcast"; then
  echo "FAIL: wrong keccak accepted"; exit 1; fi
echo "refused as expected"
echo "== 2b. a file outside ./netlists must be refused"
if forge_run "forge script script/TapeOut.s.sol $SIG foundry.toml 1 1 $k $COMMON --broadcast"; then
  echo "FAIL: read outside ./netlists allowed"; exit 1; fi
echo "refused as expected"
[ "$(nonce)" = "$n0" ] || { echo "FAIL: a refused run changed the nonce"; exit 1; }

tape() {
  echo "== 3. tape out $1"
  forge_run "forge script script/TapeOut.s.sol $SIG $(node_run args $NET "$1") $COMMON --broadcast"
  node_run landed "$FORK" "$NET" "$1" "chain/$BCAST"
}
for m in m_mul_tmc_32 m_x8500 m_add m_x10000_narrow m_x10000_wide; do tape "$m"; done
echo "== prepare again with module ids (split_v1_top)"
node_run prepare "$JSON_DIR" "$NET"
tape split_v1_top
tape cn_bonus
tape ng_paye

echo "== 4. chain against local"
set +e
node_run check "$FORK" "$NET" out/forge-dryrun-check.json
rc=$?
docker logs "$NAME" > logs/anvil-p2-forge-dryrun.log 2>&1 || true
exit $rc
