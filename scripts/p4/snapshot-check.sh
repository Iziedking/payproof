#!/usr/bin/env bash
# P4: show on X Layer's own state that a share transfer after the snapshot does not change the
# real round. Forks X Layer at block 76839900, after h1 moved 10 shares to h3 (block 76839855)
# and before h3's claim (block 76839901), and asks the vault, as h3, for the payout h3's new
# balance would give (25) and for the rule's payout at the snapshot (17). Read-only: eth_call on
# the fork, nothing is sent. The public RPC refuses calls this heavy, so they run on anvil.
set -euo pipefail
FOUNDRY=ghcr.io/foundry-rs/foundry@sha256:4a16a86f41d30418fbdca47ce2868121bbb0aeaa0a34bde2dd1e2911c4be2464
LIVE=${XLAYER_RPC:-https://xlayerrpc.okx.com}
NAME=payproof-p4-snapshot-anvil
V=0x19cc6ED93704f8ab4D4FdDB6A98D3D5ceff786AA; T=0x7845A53c8E5E5352576FbBB821351260B56cFC2c
H3=0x5AB0bB350C9Dc781C404d9eb5d8C5772411b7E51; FORK=http://127.0.0.1:8545; BLOCK=76839900
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker run -d --name "$NAME" --cpus 2 --memory 4g "$FOUNDRY" \
  "anvil --fork-url $LIVE --fork-block-number $BLOCK --host 127.0.0.1 --port 8545 --timeout 120000" >/dev/null
x() { docker exec "$NAME" sh -c "$1"; }
for i in $(seq 1 90); do x "cast block-number --rpc-url $FORK" >/dev/null 2>&1 && break; sleep 2; done
echo "fork of X Layer at block $BLOCK"
echo "h3 shares now: $(x "cast call $T 'balanceOf(address)(uint256)' $H3 --rpc-url $FORK"); at the snapshot 76839844: $(x "cast call $T 'balanceOfAt(address,uint256)(uint256)' $H3 76839844 --rpc-url $FORK")"
echo "PayoutRejected(uint32) is $(x "cast sig 'PayoutRejected(uint32)'")"
echo "h3 asks 25:"; x "cast call $V 'claim(uint256,uint256,uint32)' 1 1 25 --from $H3 --rpc-url $FORK" 2>&1 | tail -2 || true
echo "h3 asks 17:"; x "cast call $V 'claim(uint256,uint256,uint32)' 1 1 17 --from $H3 --rpc-url $FORK" 2>&1 | tail -2
