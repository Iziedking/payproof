// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {ShareToken} from "../src/ShareToken.sol";
import {RuleRegistry} from "../src/RuleRegistry.sol";
import {SplitVault} from "../src/SplitVault.sol";
import {Listings} from "../src/Listings.sol";
import {CircuitRef, ICircuits} from "../src/Circuits.sol";
import {MockCircuits, MockToken} from "./MockCircuits.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// SIMULATION on a fork of X Layer: the contracts run the real circuits taped out there.
/// Runs only when XLAYER_RPC is set (the test host's fork task); FORK_BLOCK pins the block.
///   split-v1: decision circuit 8, REF targets 3 to 7 (rules/split-v1/README.md).
///   cn-bonus-2023-30: circuit 9; SIMULATED engines A = 15, B = 16 (docs/evidence/p3/engines-tapeout.md).
/// The split's fee circuit is not taped out yet, so a stand-in computes pot / 10 here.
contract ForkXLayerTest is Test {
    address constant CIRCUITS = 0x1900801e311184063b9d9C119C9D98AA4950E12c;
    address a = makeAddr("a");
    address b = makeAddr("b");
    address c = makeAddr("c");
    address funder = makeAddr("funder");
    address hunter = makeAddr("hunter");
    bool live;

    function setUp() public {
        string memory rpc = vm.envOr("XLAYER_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        uint256 blk = vm.envOr("FORK_BLOCK", uint256(0));
        if (blk == 0) vm.createSelectFork(rpc);
        else vm.createSelectFork(rpc, blk);
        live = true;
    }

    function test_fork_threeHoldersClaimThroughCircuit8() public {
        if (!live) return vm.skip(true);
        RuleRegistry reg = new RuleRegistry();
        uint256 rule = reg.registerRule(CircuitRef(CIRCUITS, 8), CircuitRef(CIRCUITS, 13), 1, "split-v1");
        SplitVault vault = new SplitVault(reg, makeAddr("treasury"));
        MockCircuits feeCpu = new MockCircuits();
        feeCpu.set(1, MockCircuits.Kind.Fee10, 32, 32, hex"00000002000003");

        address[] memory h = new address[](3);
        (h[0], h[1], h[2]) = (a, b, c);
        uint256[] memory v = new uint256[](3);
        (v[0], v[1], v[2]) = (50, 30, 20);
        ShareToken shares = new ShareToken("Payproof test shares", "PPS", h, v);
        MockToken pay = new MockToken(18, 0);
        pay.mint(funder, 1e21);
        vm.prank(funder);
        pay.approve(address(vault), type(uint256).max);

        CircuitRef[] memory refs = new CircuitRef[](5);
        for (uint64 i = 0; i < 5; i++) refs[i] = CircuitRef(CIRCUITS, 3 + i);
        uint256 splitId = vault.createSplit(rule, CircuitRef(address(feeCpu), 1), refs, address(shares), address(pay), 1 days);
        vm.roll(block.number + 1);
        vm.prank(funder);
        uint256 r = vault.openRound(splitId, 100); // 1.00 token, the D5 round size

        uint32[3] memory want = [uint32(42), 25, 17]; // floor(100 x 8500 x s / 1,000,000)
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(h[i]);
            uint256 g = gasleft();
            vault.claim(splitId, r, want[i]);
            console.log("claim gas", g - gasleft());
            assertEq(pay.balanceOf(h[i]), uint256(want[i]) * 1e16);
        }
        // One unit more is refused by circuit 8 itself.
        vm.roll(block.number + 1);
        vm.prank(funder);
        uint256 r2 = vault.openRound(splitId, 100);
        vm.expectRevert(abi.encodeWithSelector(SplitVault.PayoutRejected.selector, 43));
        vm.prank(a);
        vault.claim(splitId, r2, 43);
    }

    function test_fork_engineBIsDisprovedAndEngineAIsNot() public {
        if (!live) return vm.skip(true);
        RuleRegistry reg = new RuleRegistry();
        uint256 rule = reg.registerRule(CircuitRef(CIRCUITS, 9), CircuitRef(address(0), 0), 64, "cn-bonus-2023-30");
        Listings lst = new Listings(reg, makeAddr("treasury"), address(this));
        MockToken usd = new MockToken(6, 0);
        usd.mint(address(this), 2e6);
        usd.approve(address(lst), 2e6);
        uint256 la = lst.list(rule, CircuitRef(CIRCUITS, 15), IERC20(address(usd)), 1e6);
        uint256 lb = lst.list(rule, CircuitRef(CIRCUITS, 16), IERC20(address(usd)), 1e6);

        bytes memory in17 = hex"11000000"; // 17 fen, little-endian
        assertEq(ICircuits(CIRCUITS).eval(9, in17), hex"0000000011000000"); // tax 0, net 17
        assertEq(ICircuits(CIRCUITS).eval(16, in17), hex"0100000010000000"); // tax 1, net 16

        bytes32 salt = keccak256("fork");
        vm.startPrank(hunter);
        lst.commit(lst.commitmentOf(la, in17, salt, hunter));
        lst.commit(lst.commitmentOf(lb, in17, salt, hunter));
        vm.roll(block.number + 1);
        vm.expectRevert(Listings.NoDifference.selector);
        lst.reveal(la, in17, salt);
        lst.reveal(lb, in17, salt);
        vm.stopPrank();
        assertEq(uint8(lst.listing(lb).status), uint8(Listings.Status.Disproved));
        assertEq(usd.balanceOf(hunter), 1e6);
    }
}
