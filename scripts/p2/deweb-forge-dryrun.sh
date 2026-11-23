#!/usr/bin/env bash
# P2 SIMULATION: run the owner's DeWEB publish path (chain/script/DeWebPublish.s.sol) end to end
# on an anvil fork of X Layer. The deployer is impersonated on the fork only (`--unlocked`, no
# key). It uses the live balance; only if that is below the opening fee plus gas is the fork
# balance raised (SIMULATION ONLY, reported as balanceRaised). Runs from the workdir root on node-services through the resource hook.
# Needs app/dist from the host-service build (task p2-app-build).
#
# Checks, in order:
#   1. without --broadcast forge only simulates: the deployer's nonce does not move;
#   2. a file whose bytes differ from the manifest is refused, and nothing is sent;
#   3. the publish with --broadcast: every file read back byte for byte, name live;
#   4. a file left half written (first chunk only) is carried on from where it stopped;
#   5. a second run with --broadcast sends nothing.
# Images as in fork-tapeout.sh. forge downloads solc 0.8.28 on first use (needs network).
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
ID=${1:-9}
MONTHS=${2:-12}
DEPLOYER=0x5c807eA36fC11a72192d83ecff2b3D4746767612
SITES=0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6
OPENER=0x536adD8F30f03b69f6fbF29d425A816A0dC50106
CIRCUITS=0x1900801e311184063b9d9c119c9d98aa4950e12c
FORK=http://127.0.0.1:8545
SITE=chain/site
NAME=payproof-p2-deweb-anvil-forge
mkdir -p out logs .home
cleanup() { docker rm -f "$NAME" payproof-p2-deweb-forge >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
rm -rf chain/broadcast chain/cache chain/out

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
  -e HOME=/w/.home -v "$PWD:/w" -w /w "$NODE" node scripts/p2/deweb-plan.mts "$@"; }
forge_run() { docker run --rm --name payproof-p2-deweb-forge --network "container:$NAME" --cpus 2 --memory 4g \
  --user 1000:1000 -e HOME=/w/.home -v "$PWD:/w" -w /w/chain "$FOUNDRY" "$1"; }
nonce() { docker exec "$NAME" sh -c "cast nonce $DEPLOYER --rpc-url $FORK"; }
COMMON="--rpc-url $FORK --chain 196 --sender $DEPLOYER --unlocked --legacy --with-gas-price 20000001 --slow"
RUN="forge script script/DeWebPublish.s.sol --sig 'run(uint256,uint256)' $ID $MONTHS $COMMON"

echo "== prepare $SITE from app/dist"
node_run prepare app/dist "$SITE"
echo "== owner command and cost, as printed for the live chain (balance and gas price read live)"
node_run command "$LIVE" "$SITE" "$ID" "$MONTHS"
balance0=$(docker exec "$NAME" sh -c "cast balance $DEPLOYER --rpc-url $FORK")
echo "deployer live balance: $balance0 wei"
liveBalance=$balance0
RAISED=false
if [ "$balance0" -lt 90000000000000000 ]; then
  # SIMULATION ONLY: the live balance is below the 0.08 OKB opening fee plus gas, so the fork
  # balance is raised to 1 OKB to rehearse the rest. The report says so.
  docker exec "$NAME" sh -c "cast rpc --rpc-url $FORK anvil_setBalance $DEPLOYER 0xde0b6b3a7640000" >/dev/null
  RAISED=true
  balance0=$(docker exec "$NAME" sh -c "cast balance $DEPLOYER --rpc-url $FORK")
  echo "SIMULATION: live balance is short of about 0.0815 OKB; fork balance raised to $balance0 wei"
fi

echo "== 1. simulation only (no --broadcast)"
n0=$(nonce)
forge_run "forge --version | head -1; $RUN"
n1=$(nonce)
echo "nonce before $n0 after $n1"
[ "$n0" = "$n1" ] || { echo "FAIL: a simulation changed the nonce"; exit 1; }

echo "== 2. a file that differs from the manifest must be refused"
cp "$SITE/index.html" out/index.html.keep
printf ' ' >> "$SITE/index.html"
if forge_run "$RUN --broadcast"; then echo "FAIL: changed file accepted"; exit 1; fi
cp out/index.html.keep "$SITE/index.html"
echo "refused as expected"
[ "$(nonce)" = "$n0" ] || { echo "FAIL: a refused run changed the nonce"; exit 1; }

echo "== 3. publish with --broadcast (opens the container, writes every file, binds the name)"
forge_run "$RUN --broadcast"
n2=$(nonce)
echo "nonce before $n0 after $n2: $((n2 - n0)) transactions"
node_run landed "$FORK" "$SITE" "$ID" out/deweb-forge-landed.json
cp chain/broadcast/DeWebPublish.s.sol/196/run-latest.json out/deweb-forge-run-latest.json

echo "== 4. leave the largest file half written (putFile replaces it with its first chunk), run again"
BIG=$(docker run --rm --user 1000:1000 -v "$PWD:/w" -w /w "$NODE" node -e "const m=require('./$SITE/manifest.json');let b=0;m.sizes.forEach((s,i)=>{if(s>m.sizes[b])b=i});console.log(m.paths[b])")
CONTAINER=$(docker exec "$NAME" sh -c "cast call $OPENER 'accountOf(address,uint256)(address)' $CIRCUITS $ID --rpc-url $FORK")
echo "container $CONTAINER, half-writing $BIG"
node_run first-chunk "$SITE" "$ID" "$BIG" "$CONTAINER" > out/first-chunk.hex
docker cp out/first-chunk.hex "$NAME:/tmp/first-chunk.hex"
docker exec "$NAME" sh -c "cast send --unlocked --from $DEPLOYER --rpc-url $FORK --legacy --gas-price 20000001 $SITES \$(cat /tmp/first-chunk.hex)" >/dev/null
echo "fileInfo now: $(docker exec "$NAME" sh -c "cast call $SITES 'fileInfo(address,string)(uint32,string,bytes32,uint40,uint256)' $CONTAINER $BIG --rpc-url $FORK" | tr '\n' ' ')"
n3a=$(nonce)
forge_run "$RUN --broadcast"
n3=$(nonce)
echo "resume sent $((n3 - n3a)) transactions"
node_run landed "$FORK" "$SITE" "$ID" out/deweb-forge-landed-resume.json

echo "== 5. a second run with --broadcast must send nothing"
forge_run "$RUN --broadcast" || true
n4=$(nonce)
echo "nonce before $n3 after $n4"
[ "$n3" = "$n4" ] || { echo "FAIL: a second run sent transactions"; exit 1; }
balance1=$(docker exec "$NAME" sh -c "cast balance $DEPLOYER --rpc-url $FORK")
echo "deployer balance after: $balance1 wei, spent $((balance0 - balance1)) wei, which includes the half-write rehearsal"
echo "{\"liveBalanceWei\":\"$liveBalance\",\"balanceRaised\":$RAISED,\"forkBalanceBeforeWei\":\"$balance0\",\"forkBalanceAfterWei\":\"$balance1\",\"nonceStart\":$n0,\"nonceAfterPublish\":$n2,\"nonceBeforeResume\":$n3a,\"nonceAfterResume\":$n3,\"nonceAfterRerun\":$n4,\"halfWritten\":\"$BIG\"}" > out/deweb-forge-summary.json
docker logs "$NAME" > logs/anvil-p2-deweb-forge-dryrun.log 2>&1 || true
echo "ALL CHECKS PASSED"
