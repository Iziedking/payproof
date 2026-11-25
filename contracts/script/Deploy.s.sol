// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ShareToken} from "../src/ShareToken.sol";
import {RuleRegistry} from "../src/RuleRegistry.sol";
import {SplitVault} from "../src/SplitVault.sol";
import {Listings} from "../src/Listings.sol";
import {CircuitRef} from "../src/Circuits.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// The owner's P4 deployment on X Layer, in two steps the owner signs with their own keystore
/// (`--account`); this script holds no key. Rehearsed first on an anvil fork with the deployer
/// impersonated (scripts/p4/deploy-dryrun.sh).
///
/// Step 1, `deploy()`: RuleRegistry, SplitVault, Listings, ShareToken; registers split-v1
/// (circuit 8, validity 13, 1 decision bit) and cn-bonus-2023-30 (circuit 9, no validity, 64
/// decision bits). Env: TREASURY, HOLDERS (comma list), SHARES (comma list, same order).
///
/// Step 2, `setup()`, after the fee circuit is taped out: creates the split (fee circuit
/// FEE_ID, REF targets 3 to 7, pay token PAY_TOKEN, CLAIM_WINDOW seconds) with the deployer as
/// operator, and lists SIMULATED engine B (circuit 16) against cn-bonus-2023-30 with a bounty of
/// BOUNTY base units of PAY_TOKEN. Env: REGISTRY, VAULT, LISTINGS, SHARE_TOKEN, SPLIT_RULE,
/// CN_RULE, FEE_ID, PAY_TOKEN, CLAIM_WINDOW, BOUNTY.
contract Deploy is Script {
    address constant CIRCUITS = 0x1900801e311184063b9d9C119C9D98AA4950E12c;

    function deploy() external {
        address treasury = vm.envAddress("TREASURY");
        address[] memory holders = vm.envAddress("HOLDERS", ",");
        uint256[] memory shares = vm.envUint("SHARES", ",");
        require(holders.length >= 3 && holders.length == shares.length, "HOLDERS and SHARES: at least 3, same length");

        vm.startBroadcast();
        RuleRegistry reg = new RuleRegistry();
        SplitVault vault = new SplitVault(reg, treasury);
        Listings lst = new Listings(reg, treasury, msg.sender);
        ShareToken token = new ShareToken("Payproof test shares", "PPS", holders, shares);
        uint256 splitRule = reg.registerRule(CircuitRef(CIRCUITS, 8), CircuitRef(CIRCUITS, 13), 1, "split-v1");
        uint256 cnRule = reg.registerRule(CircuitRef(CIRCUITS, 9), CircuitRef(address(0), 0), 64, "cn-bonus-2023-30");
        vm.stopBroadcast();

        console.log("REGISTRY", address(reg));
        console.log("VAULT", address(vault));
        console.log("LISTINGS", address(lst));
        console.log("SHARE_TOKEN", address(token));
        console.log("SPLIT_RULE", splitRule);
        console.log("CN_RULE", cnRule);
    }

    function setup() external {
        SplitVault vault = SplitVault(vm.envAddress("VAULT"));
        Listings lst = Listings(vm.envAddress("LISTINGS"));
        address payToken = vm.envAddress("PAY_TOKEN");
        uint256 bounty = vm.envUint("BOUNTY");
        CircuitRef[] memory refs = new CircuitRef[](5);
        for (uint64 i = 0; i < 5; i++) refs[i] = CircuitRef(CIRCUITS, 3 + i);
        require(address(vault.registry()) == vm.envAddress("REGISTRY"), "VAULT is not on REGISTRY");

        vm.startBroadcast();
        uint256 splitId = vault.createSplit(
            vm.envUint("SPLIT_RULE"),
            CircuitRef(CIRCUITS, uint64(vm.envUint("FEE_ID"))),
            refs,
            vm.envAddress("SHARE_TOKEN"),
            payToken,
            uint64(vm.envUint("CLAIM_WINDOW"))
        );
        IERC20(payToken).approve(address(lst), bounty);
        uint256 listingId = lst.list(vm.envUint("CN_RULE"), CircuitRef(CIRCUITS, 16), IERC20(payToken), bounty);
        vm.stopBroadcast();

        console.log("SPLIT_ID", splitId);
        console.log("LISTING_ID", listingId);
    }
}
