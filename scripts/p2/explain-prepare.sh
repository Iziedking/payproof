#!/usr/bin/env bash
# P2: write the netlist files for the owner's live tape-outs of the explanation and validity
# circuits, and print the owner's forge commands with the live gas price. Read-only on the chain;
# sends nothing. Runs from the workdir root on node-services through the resource hook.
#   bash scripts/p2/explain-prepare.sh            fresh files: validity, cn, ng (no ids yet)
#   bash scripts/p2/explain-prepare.sh <piece>... keep ids.json, write again, print these pieces
set -euo pipefail
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=https://xlayerrpc.okx.com
NET=chain/netlists/explain
node_run() { docker run --rm --name payproof-p2-explain-prepare --cpus 1 --memory 3g --user 1000:1000 \
  -e HOME=/w/.home -v "$PWD:/w" -w /w "$NODE" node "$@"; }
if [ $# -eq 0 ]; then
  rm -rf "$NET"
  set -- ng_paye_explain cn_bonus_explain split_v1_validity
fi
mkdir -p .home
node_run scripts/p2/explain-tapeout.mts prepare json chain/netlists "$NET"
sha256sum "$NET"/*.bin "$NET"/manifest.json
for p in "$@"; do
  echo "== $p"
  node_run scripts/p2/tapeout-plan.mts command "$LIVE" "$NET" "$p"
done
