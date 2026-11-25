#!/usr/bin/env bash
# P4 SIMULATION: the whole real round, end to end, on an anvil fork of X Layer, with the same
# forge and cast commands the owner will sign on mainnet. Nothing is sent to X Layer and no key is
# used: every sender (the deployer and the test holders) is impersonated on the fork only.
#
#   1. Deploy.s.sol deploy(): RuleRegistry, SplitVault, Listings, ShareToken; rules split-v1, cn-bonus.
#   2. Deploy.s.sol setup(): split on the fee circuit (FEE_ID), listing of SIMULATED engine B.
#   3. openRound with DEPOSIT vault units (1 unit = 0.01 of the pay token).
#   4. Holder 1 moves MOVE shares to holder 3 after the snapshot.
#   5. Each holder claims the payout the decision circuit accepts for its snapshot shares; holder 3
#      first tries the payout its new balance would give, which must be refused.
#   6. Holder 2 commits and reveals a bonus of 17 fen against engine B and is paid the bounty.
#
# On the fork only, the deployer is given 2 USDT0 with anvil_dealERC20 and each holder
# 0.01 OKB with anvil_setBalance; on mainnet the owner funds them. Env: HOLDERS, SHARES (comma
# lists, 3 entries), TREASURY, FEE_ID. Runs from the workdir root on the test host through the
# resource hook.
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
DEPLOYER=0x5c807eA36fC11a72192d83ecff2b3D4746767612
USDT0=0x779Ded0c9e1022225f8E0630b35a9b54bE713736
HOLDERS=${HOLDERS:-0x00000000000000000000000000000000000a1001,0x00000000000000000000000000000000000a1002,0x00000000000000000000000000000000000a1003}
SHARES=${SHARES:-50,30,20}
TREASURY=${TREASURY:-$DEPLOYER}
FEE_ID=${FEE_ID:-17}
DEPOSIT=100        # vault units: 1.00 USDT0
BOUNTY=1000000     # base units: 1.00 USDT0
WINDOW=604800      # 7 days
MOVE=10
FORK=http://127.0.0.1:8545
NAME=payproof-p4-round-anvil
IFS=, read -r H1 H2 H3 <<< "$HOLDERS"
IFS=, read -r S1 S2 S3 <<< "$SHARES"
mkdir -p out logs .home
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
rm -rf contracts/broadcast

docker run -d --name "$NAME" --cpus 3 --memory 6g --user 1000:1000 -e HOME=/w/.home -v "$PWD:/w" -w /w/contracts \
  "$FOUNDRY" "anvil --fork-url $LIVE --host 127.0.0.1 --port 8545 --timeout 120000" >/dev/null
x() { docker exec "$NAME" sh -c "$1"; }
for i in $(seq 1 90); do x "cast block-number --rpc-url $FORK" >/dev/null 2>&1 && break; sleep 2; done
x 'anvil --version | head -1'
echo "fork block $(x "cast block-number --rpc-url $FORK")"
GASPRICE=$(x "cast gas-price --rpc-url $LIVE")
echo "live gas price $GASPRICE wei"
for a in $DEPLOYER $H1 $H2 $H3; do x "cast rpc --rpc-url $FORK anvil_impersonateAccount $a" >/dev/null; done
for a in $H1 $H2 $H3; do x "cast rpc --rpc-url $FORK anvil_setBalance $a 0x2386f26fc10000" >/dev/null; done
x "cast rpc --rpc-url $FORK anvil_dealERC20 $DEPLOYER $USDT0 0x1e8480" >/dev/null
echo "SIMULATED funding on the fork: deployer USDT0 $(x "cast call $USDT0 'balanceOf(address)(uint256)' $DEPLOYER --rpc-url $FORK")"

COMMON="--rpc-url $FORK --chain 196 --legacy --gas-price $GASPRICE"
send() { # send <from> <to> <sig> [args...]: one transaction, prints its hash, status and gas
  local from=$1; shift
  local out; out=$(x "cast send --unlocked --from $from $COMMON $*")
  echo "$out" | grep -E '^(transactionHash|status|gasUsed|blockNumber) ' | tr -s ' ' | tr '\n' ' '; echo
}
call() { x "cast call --rpc-url $FORK $*"; }

echo "== 1. deploy"
DEP=$(x "TREASURY=$TREASURY HOLDERS=$HOLDERS SHARES=$SHARES forge script script/Deploy.s.sol --sig 'deploy()' \
  --rpc-url $FORK --chain 196 --sender $DEPLOYER --unlocked --legacy --with-gas-price $GASPRICE --slow --broadcast")
echo "$DEP" | grep -E '^ +(REGISTRY|VAULT|LISTINGS|SHARE_TOKEN|SPLIT_RULE|CN_RULE) ' || { echo "$DEP" | tail -30; exit 1; }
v() { echo "$DEP" | awk -v k="$1" '$1==k {print $2}'; }
REGISTRY=$(v REGISTRY); VAULT=$(v VAULT); LISTINGS=$(v LISTINGS); TOKEN=$(v SHARE_TOKEN); SPLIT_RULE=$(v SPLIT_RULE); CN_RULE=$(v CN_RULE)
echo "$DEP" | grep -E 'Total Paid|Estimated total gas' || true

echo "== 2. setup"
SET=$(x "REGISTRY=$REGISTRY VAULT=$VAULT LISTINGS=$LISTINGS SHARE_TOKEN=$TOKEN SPLIT_RULE=$SPLIT_RULE CN_RULE=$CN_RULE \
  FEE_ID=$FEE_ID PAY_TOKEN=$USDT0 CLAIM_WINDOW=$WINDOW BOUNTY=$BOUNTY forge script script/Deploy.s.sol --sig 'setup()' \
  --rpc-url $FORK --chain 196 --sender $DEPLOYER --unlocked --legacy --with-gas-price $GASPRICE --slow --broadcast")
echo "$SET" | grep -E '^ +(SPLIT_ID|LISTING_ID) ' || { echo "$SET" | tail -30; exit 1; }
SPLIT=$(echo "$SET" | awk '$1=="SPLIT_ID" {print $2}'); LISTING=$(echo "$SET" | awk '$1=="LISTING_ID" {print $2}')
echo "$SET" | grep -E 'Total Paid|Estimated total gas' || true

echo "== 3. open the round ($DEPOSIT units)"
send $DEPLOYER $USDT0 "'approve(address,uint256)'" $VAULT $((DEPOSIT * 10000))
send $DEPLOYER $VAULT "'openRound(uint256,uint32)'" $SPLIT $DEPOSIT
ROUND=1
echo "round: $(call $VAULT "'round(uint256,uint256)((uint32,uint32,uint32,uint32,uint64,uint64,uint256,bool))'" $SPLIT $ROUND)"

echo "== 4. holder 1 moves $MOVE shares to holder 3 after the snapshot"
send $H1 $TOKEN "'transfer(address,uint256)'" $H3 $MOVE
echo "balances now: $(call $TOKEN "'balanceOf(address)(uint256)'" $H1) $(call $TOKEN "'balanceOf(address)(uint256)'" $H2) $(call $TOKEN "'balanceOf(address)(uint256)'" $H3)"

pay() { echo $(( DEPOSIT * 8500 * $1 / (100 * 10000) )); }   # floor(pot x 85% x shares / total), total 100
P1=$(pay $S1); P2=$(pay $S2); P3=$(pay $S3); P3NEW=$(pay $((S3 + MOVE)))
echo "== 5. claims: rule gives $P1, $P2, $P3 for snapshot shares $S1, $S2, $S3"
if x "cast call --from $H3 --rpc-url $FORK $VAULT 'claim(uint256,uint256,uint32)' $SPLIT $ROUND $P3NEW" >/dev/null 2>&1; then
  echo "FAIL: holder 3 could claim $P3NEW with shares moved in after the snapshot"; exit 1
fi
echo "holder 3 asking $P3NEW (its balance after the move): refused, as it must be"
send $H1 $VAULT "'claim(uint256,uint256,uint32)'" $SPLIT $ROUND $P1
send $H2 $VAULT "'claim(uint256,uint256,uint32)'" $SPLIT $ROUND $P2
send $H3 $VAULT "'claim(uint256,uint256,uint32)'" $SPLIT $ROUND $P3
for h in $H1 $H2 $H3; do echo "USDT0 $h: $(call $USDT0 "'balanceOf(address)(uint256)'" $h)"; done

echo "== 6. holder 2 disproves SIMULATED engine B with a bonus of 17 fen"
SALT=0x7061797072000000000000000000000000000000000000000000000000000001
C=$(call $LISTINGS "'commitmentOf(uint256,bytes,bytes32,address)(bytes32)'" $LISTING 0x11000000 $SALT $H2)
send $H2 $LISTINGS "'commit(bytes32)'" $C
send $H2 $LISTINGS "'reveal(uint256,bytes,bytes32)'" $LISTING 0x11000000 $SALT
echo "USDT0 $H2 after the bounty: $(call $USDT0 "'balanceOf(address)(uint256)'" $H2)"

echo "== end: deployer USDT0 $(call $USDT0 "'balanceOf(address)(uint256)'" $DEPLOYER), vault USDT0 $(call $USDT0 "'balanceOf(address)(uint256)'" $VAULT)"
for a in $DEPLOYER $H1 $H2 $H3; do echo "OKB $a: $(x "cast balance $a --rpc-url $FORK")"; done
cat > out/round-dryrun.json <<EOF
{"registry":"$REGISTRY","vault":"$VAULT","listings":"$LISTINGS","shareToken":"$TOKEN","splitRule":$SPLIT_RULE,"cnRule":$CN_RULE,"split":$SPLIT,"listing":$LISTING,"feeId":$FEE_ID,"holders":"$HOLDERS","shares":"$SHARES","simulated":true}
EOF
docker logs "$NAME" > logs/anvil-p4-round.log 2>&1 || true
echo "round dry run: deploy, setup, round, 3 claims, snapshot check and engine B disproof passed on the fork"
