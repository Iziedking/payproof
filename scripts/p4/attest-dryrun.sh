#!/usr/bin/env bash
# P4 SIMULATION: the owner's attestations (contracts/script/Attest.s.sol) on an anvil fork of
# X Layer against the real RuleRegistry, the deployer impersonated (no key). Writes the list with
# scripts/p4/attest-plan.mts first, then counts the ProofAttested events the run emitted and
# checks each against the list. Runs from the workdir root on the test host through the hook.
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
NODE=node@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
DEPLOYER=0x5c807eA36fC11a72192d83ecff2b3D4746767612
REGISTRY=0xBc7187E1C31841396962f8498dEaa513df28cC50
FORK=http://127.0.0.1:8545
NAME=payproof-p4-attest-anvil
mkdir -p out logs .home
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
rm -rf contracts/broadcast
docker run --rm --user 1000:1000 -e HOME=/w/.home -v "$PWD:/w" -w /w "$NODE" node scripts/p4/attest-plan.mts contracts/script/attestations.json
docker run -d --name "$NAME" --cpus 2 --memory 4g --user 1000:1000 -e HOME=/w/.home -v "$PWD:/w" -w /w/contracts \
  "$FOUNDRY" "anvil --fork-url $LIVE --host 127.0.0.1 --port 8545 --timeout 120000" >/dev/null
x() { docker exec "$NAME" sh -c "$1"; }
for i in $(seq 1 90); do x "cast block-number --rpc-url $FORK" >/dev/null 2>&1 && break; sleep 2; done
FROM=$(x "cast block-number --rpc-url $FORK")
echo "fork block $FROM"
GASPRICE=$(x "cast gas-price --rpc-url $LIVE")
x "cast rpc --rpc-url $FORK anvil_impersonateAccount $DEPLOYER" >/dev/null
echo "deployer OKB before $(x "cast balance $DEPLOYER --rpc-url $FORK")"
x "REGISTRY=$REGISTRY forge script script/Attest.s.sol --rpc-url $FORK --chain 196 --sender $DEPLOYER --unlocked --legacy --with-gas-price $GASPRICE --slow --broadcast" \
  | grep -E 'registered|attestations sent|Estimated total gas|ONCHAIN EXECUTION' || true
echo "deployer OKB after $(x "cast balance $DEPLOYER --rpc-url $FORK")"
echo "rule count $(x "cast call $REGISTRY 'ruleCount()(uint256)' --rpc-url $FORK")"
echo "rule 3: $(x "cast call $REGISTRY 'rule(uint256)(((address,uint64),(address,uint64),uint32,uint32,address,bytes32,bytes32,string))' 3 --rpc-url $FORK")"
TOPIC=$(x "cast keccak 'ProofAttested(uint256,address,(address,uint64),bytes32,uint8,bytes32,string)'")
x "cast logs --from-block $FROM --to-block latest --address $REGISTRY $TOPIC --rpc-url $FORK --json" > out/attest-logs.json
docker run --rm --user 1000:1000 -v "$PWD:/w" -w /w "$NODE" node -e '
const logs=JSON.parse(require("fs").readFileSync("out/attest-logs.json","utf8"));
const plan=JSON.parse(require("fs").readFileSync("contracts/script/attestations.json","utf8"));
if(logs.length!==plan.count){console.error(`FAIL: ${logs.length} events, ${plan.count} planned`);process.exit(1)}
logs.forEach((l,i)=>{const p=plan.items[i];const d=l.data.slice(2);
  const rule=BigInt(l.topics[1]), fact=l.topics[3], id=Number(BigInt("0x"+d.slice(64,128))), status=Number(BigInt("0x"+d.slice(128,192))), hash="0x"+d.slice(192,256);
  if(rule!==BigInt(p.rule)||fact!==p.fact||id!==p.id||status!==p.status||hash!==p.recordHash){console.error("FAIL at",i,rule,fact,status,hash,p);process.exit(1)}});
console.log(`${logs.length} ProofAttested events match the plan`);'
docker logs "$NAME" > logs/anvil-p4-attest.log 2>&1 || true
echo "attest dry run passed on the fork"
