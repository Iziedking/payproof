#!/usr/bin/env bash
# P2 LIVE, read-only: test the live explanation and validity circuits (11 to 14) against the local
# simulator, the spec formulas and the live decision circuits. Sends no transaction. Runs from the
# workdir root on node-services through the resource hook, as scripts/p2/live-check.sh.
#
# 11 (ng-paye explanation), 12 (cn-bonus explanation), 13 (split-v1 validity): eth_call on the
# public X Layer RPC. 14 (split-v1 explanation) needs about 93 M gas to run, more than the public
# RPC will eth_call (docs/evidence/p2.md, section 4), so it is run on an anvil fork of X Layer at
# the latest block, which reads circuits 3 to 14 from the live chain unchanged. That part is
# labelled as a fork run.
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
IDS=live/explain/ids.json
NAME=payproof-p2-explain-live-anvil
mkdir -p out logs .home
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
node_run() { docker run --rm --network "$1" --cpus 1 --memory 3g --user 1000:1000 \
  -e HOME=/w/.home -v "$PWD:/w" -w /w "$NODE" node scripts/p2/explain-tapeout.mts "${@:2}"; }
cat "$IDS"

echo "== live RPC: ng_paye_explain, cn_bonus_explain, split_v1_validity"
node_run bridge check "$LIVE" json live/netlists "$IDS" out/explain-live-rpc.json ng_paye_explain,cn_bonus_explain,split_v1_validity

echo "== anvil fork of the live chain at the latest block: split_v1_explain"
docker run -d --name "$NAME" --cpus 2 --memory 4g "$FOUNDRY" \
  "anvil --fork-url $LIVE --host 127.0.0.1 --port 8545 --timeout 120000" >/dev/null
for i in $(seq 1 90); do
  if docker exec "$NAME" sh -c "cast block-number --rpc-url http://127.0.0.1:8545" >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$NAME" sh -c 'anvil --version | head -1'
echo "fork block $(docker exec "$NAME" sh -c 'cast block-number --rpc-url http://127.0.0.1:8545')"
set +e
node_run "container:$NAME" check http://127.0.0.1:8545 json live/netlists "$IDS" out/explain-live-fork.json split_v1_explain
rc=$?
docker logs "$NAME" > logs/anvil-p2-explain-live.log 2>&1 || true
exit $rc
