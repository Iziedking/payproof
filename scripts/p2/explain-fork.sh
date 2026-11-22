#!/usr/bin/env bash
# P2: rehearse the explanation and validity tape-outs on an anvil fork of X Layer and test them.
# SIMULATION. Runs from the workdir root on node-services through the resource hook, as
# scripts/p2/fork-tapeout.sh (same pinned images). The anvil container needs network to reach
# the X Layer RPC; the node container shares its network namespace.
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
OUT=${1:-out/explain-fork.json}
mkdir -p out logs
NAME=payproof-p2-explain-anvil
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker run -d --name "$NAME" --cpus 2 --memory 4g "$FOUNDRY" \
  "anvil --fork-url $LIVE --host 127.0.0.1 --port 8545 --timeout 120000" >/dev/null
for i in $(seq 1 90); do
  if docker exec "$NAME" sh -c 'cast block-number --rpc-url http://127.0.0.1:8545' >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$NAME" sh -c 'anvil --version | head -1'
set +e
docker run --rm --name payproof-p2-explain-node --network "container:$NAME" --cpus 1 --memory 3g \
  --user 1000:1000 -e HOME=/w -v "$PWD:/w" -w /w "$NODE" \
  node scripts/p2/explain-tapeout.mts fork http://127.0.0.1:8545 json chain/netlists "$OUT"
rc=$?
docker logs "$NAME" > "logs/anvil-p2-explain-fork.log" 2>&1 || true
exit $rc
