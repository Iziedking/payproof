#!/usr/bin/env bash
# P2: the owner's split-v1 eval transaction, rehearsed and read back. Runs from the workdir root on
# node-services through the resource hook. Never signs: on the fork the deployer is impersonated.
#
#   bash scripts/p2/eval-dryrun.sh dryrun
#       SIMULATION. Prints the plan, runs the owner's `cast estimate` against the live RPC, then on
#       an anvil fork of X Layer at the latest block sends the owner's exact `cast send` line with
#       `--unlocked` in place of `--account`, checks it with `eval-tx.mts landed`, and reads the
#       output with eth_call on the fork.
#   bash scripts/p2/eval-dryrun.sh replay <block>
#       After the live transaction landed in <block>: forks X Layer at <block - 1> and runs the same
#       eth_call there, so the output the live transaction computed can be read (eval emits no
#       event and the public RPC does not run this eth_call).
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
NET=live/netlists
NAME=payproof-p2-eval-anvil
FORK=http://127.0.0.1:8545
DEPLOYER=0x5c807eA36fC11a72192d83ecff2b3D4746767612
MODE=${1:?dryrun or replay}
mkdir -p out logs .home
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
node_run() { docker run --rm --network "$1" --cpus 1 --memory 2g --user 1000:1000 \
  -e HOME=/w/.home -v "$PWD:/w" -w /w "$NODE" node scripts/p2/eval-tx.mts "${@:2}"; }
cast_in() { docker exec "$NAME" sh -c "$1"; }

node_run none plan "$NET" > out/eval-plan.json
cat out/eval-plan.json
field() { node_run none field "$NET" "$1"; }
DATA=$(field data); WANT=$(field expectedBytes); EST=$(field estimate); SEND=$(field send)

if [ "$MODE" = dryrun ]; then
  AT=latest
else
  AT=$(( ${2:?block} - 1 ))
fi
docker run -d --name "$NAME" --cpus 2 --memory 4g "$FOUNDRY" \
  "anvil --fork-url $LIVE $( [ "$AT" = latest ] || echo --fork-block-number $AT ) --host 127.0.0.1 --port 8545 --timeout 120000" >/dev/null
for i in $(seq 1 90); do cast_in "cast block-number --rpc-url $FORK" >/dev/null 2>&1 && break; sleep 2; done
cast_in 'anvil --version | head -1'
echo "fork block $(cast_in "cast block-number --rpc-url $FORK")"

if [ "$MODE" = dryrun ]; then
  echo "== owner step 1 against the live RPC (read-only): $EST"
  cast_in "$EST"
  echo "== owner step 2 on the fork, --unlocked instead of --account"
  cast_in "cast rpc --rpc-url $FORK anvil_impersonateAccount $DEPLOYER" >/dev/null
  n0=$(cast_in "cast nonce $DEPLOYER --rpc-url $FORK")
  FORKSEND=$(echo "$SEND" | sed "s|--account payproof-deployer|--unlocked|; s|--rpc-url https://xlayerrpc.okx.com|--rpc-url $FORK|")
  echo "$FORKSEND"
  cast_in "$FORKSEND --json" > out/eval-fork-send.json
  H=$(grep -o '"transactionHash":"0x[0-9a-f]*"' out/eval-fork-send.json | head -1 | cut -d'"' -f4)
  echo "fork tx $H, nonce before $n0 after $(cast_in "cast nonce $DEPLOYER --rpc-url $FORK")"
  node_run "container:$NAME" landed "$FORK" "$NET" "$H"
fi

echo "== output: eth_call of the same calldata on the fork"
OUT=$(cast_in "cast call --from $DEPLOYER --gas-limit 200000000 --rpc-url $FORK 0x1900801e311184063b9d9C119C9D98AA4950E12c --data $DATA")
GOT=$(cast_in "cast abi-decode 'f()(bytes)' $OUT")
echo "{\"mode\":\"$MODE\",\"at\":\"$AT\",\"outputBytes\":\"$GOT\",\"expectedBytes\":\"$WANT\",\"match\":$([ "$GOT" = "$WANT" ] && echo true || echo false)}" | tee "out/eval-$MODE.json"
docker logs "$NAME" > "logs/anvil-p2-eval-$MODE.log" 2>&1 || true
[ "$GOT" = "$WANT" ]
