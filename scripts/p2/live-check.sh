#!/usr/bin/env bash
# P2 LIVE, read-only: compare on-chain `eval` of the three live rule circuits with the local simulator.
# Runs from the workdir root on node-services through the resource hook. Sends no transaction.
#
# cn-bonus (#9) and ng-paye (#10): eth_call on the public X Layer RPC.
# split-v1 (#8): its eval needs about 97 M gas. The public RPC answers that eth_call with
# "execution reverted" at any gas value given, while eth_estimateGas on it succeeds (97,130,345),
# and a call with too little gas also shows as "execution reverted" there (task p2-live-probe-cap).
# So split-v1 is checked by eth_call on an anvil fork of X Layer at the latest block: the fork
# reads circuits #3 to #8 from the live chain, unchanged. That part is labelled as a fork run.
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
NET=live/netlists
NAME=payproof-p2-live-anvil
mkdir -p out logs .home
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
node_run() { docker run --rm --network "$1" --cpus 1 --memory 3g --user 1000:1000 \
  -e HOME=/w/.home -v "$PWD:/w" -w /w "$NODE" node scripts/p2/tapeout-plan.mts "${@:2}"; }

echo "== live RPC: cn_bonus, ng_paye"
node_run bridge check "$LIVE" "$NET" out/live-check-rpc.json cn_bonus,ng_paye

echo "== anvil fork of the live chain at the latest block: split_v1_top"
docker run -d --name "$NAME" --cpus 2 --memory 4g "$FOUNDRY" \
  "anvil --fork-url $LIVE --host 127.0.0.1 --port 8545 --timeout 120000" >/dev/null
for i in $(seq 1 90); do
  if docker exec "$NAME" sh -c "cast block-number --rpc-url http://127.0.0.1:8545" >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$NAME" sh -c 'anvil --version | head -1'
echo "fork block $(docker exec "$NAME" sh -c 'cast block-number --rpc-url http://127.0.0.1:8545')"
set +e
node_run "container:$NAME" check http://127.0.0.1:8545 "$NET" out/live-check-fork.json split_v1_top
rc=$?
docker logs "$NAME" > logs/anvil-p2-live-check.log 2>&1 || true
exit $rc
