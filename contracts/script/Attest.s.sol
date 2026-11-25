// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {RuleRegistry} from "../src/RuleRegistry.sol";
import {CircuitRef} from "../src/Circuits.sol";

/// The owner attests every published proof result on RuleRegistry, signed with their own keystore
/// (`--account`); this script holds no key. The list is script/attestations.json, made by
/// scripts/p4/attest-plan.mts from app/src/proofs/records.json. Rehearsed first on an anvil fork.
///
/// First registers ng-paye-nta2025 (circuit 10, no validity circuit, 57 decision bits) as rule 3
/// if the registry has only the two rules the deploy made, so its results can be attested too.
/// Env: REGISTRY.
contract Attest is Script {
    address constant CIRCUITS = 0x1900801e311184063b9d9C119C9D98AA4950E12c;

    function run() external {
        RuleRegistry reg = RuleRegistry(vm.envAddress("REGISTRY"));
        string memory json = vm.readFile("script/attestations.json");
        uint256 n = vm.parseJsonUint(json, ".count");
        require(reg.ruleCount() >= 2, "registry has not got the deploy's two rules");

        vm.startBroadcast();
        if (reg.ruleCount() == 2) {
            uint256 ng = reg.registerRule(CircuitRef(CIRCUITS, 10), CircuitRef(address(0), 0), 57, "ng-paye-nta2025");
            require(ng == 3, "ng-paye-nta2025 is not rule 3");
            console.log("registered ng-paye-nta2025 as rule", ng);
        }
        for (uint256 i = 0; i < n; i++) {
            string memory k = string.concat(".items[", vm.toString(i), "]");
            reg.attestProof(
                vm.parseJsonUint(json, string.concat(k, ".rule")),
                CircuitRef(vm.parseJsonAddress(json, string.concat(k, ".cpu")), uint64(vm.parseJsonUint(json, string.concat(k, ".id")))),
                vm.parseJsonBytes32(json, string.concat(k, ".fact")),
                uint8(vm.parseJsonUint(json, string.concat(k, ".status"))),
                vm.parseJsonBytes32(json, string.concat(k, ".recordHash")),
                vm.parseJsonString(json, string.concat(k, ".uri"))
            );
        }
        vm.stopBroadcast();
        console.log("attestations sent", n);
    }
}
