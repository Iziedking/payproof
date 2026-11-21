#!/usr/bin/env bash
# P1: start an anvil fork of X Layer, run fork-gas.mjs beside it, stop the fork.
# SIMULATION. Runs from the workdir root on node-services through the resource hook.
# The anvil container needs network to reach the X Layer RPC (forking reads state from it);
# the node container shares the anvil container's network namespace and reaches it on 127.0.0.1.
# Images: Foundry v1.8.6 (VERSIONS.md), digest read with docker image inspect on 2026-11-21;
# node 24.22.1-bookworm-slim, the digest already pinned in resource-policy.json.
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
TAP=${1:-spikes/p0/tap/split_check_modc_32.tap.json}
OUT=${2:-out/fork-gas-$(basename "$TAP" .tap.json).json}
mkdir -p out logs
NAME=payproof-p1-anvil
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
docker run --rm --name payproof-p1-forkgas --network "container:$NAME" --cpus 1 --memory 1g \
  --user 1000:1000 -e HOME=/w -v "$PWD:/w" -w /w "$NODE" \
  node scripts/p1/fork-gas.mjs http://127.0.0.1:8545 "$LIVE" "$TAP" "$OUT"
rc=$?
docker logs "$NAME" > "logs/anvil-$(basename "$TAP" .tap.json).log" 2>&1 || true
exit $rc
