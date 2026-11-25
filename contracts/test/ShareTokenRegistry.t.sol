// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ShareToken, IShareHistory} from "../src/ShareToken.sol";
import {RuleRegistry} from "../src/RuleRegistry.sol";
import {CircuitRef} from "../src/Circuits.sol";
import {MockCircuits} from "./MockCircuits.sol";

contract ShareTokenTest is Test {
    address a = makeAddr("a");
    address b = makeAddr("b");
    address c = makeAddr("c");
    ShareToken t;

    function setUp() public {
        address[] memory h = new address[](3);
        (h[0], h[1], h[2]) = (a, b, c);
        uint256[] memory v = new uint256[](3);
        (v[0], v[1], v[2]) = (50, 30, 20);
        vm.roll(100);
        t = new ShareToken("Payproof test shares", "PPS", h, v);
    }

    function test_mintsOnceAndHasNoDecimals() public view {
        assertEq(t.totalSupply(), 100);
        assertEq(t.decimals(), 0);
        assertEq(t.balanceOf(a), 50);
    }

    function test_historyAtPastBlocks() public {
        vm.roll(110);
        vm.prank(a);
        t.transfer(b, 10);
        vm.roll(120);
        // End of block 100: the minted balances. End of block 110: after the transfer.
        assertEq(t.balanceOfAt(a, 100), 50);
        assertEq(t.balanceOfAt(a, 109), 50);
        assertEq(t.balanceOfAt(a, 110), 40);
        assertEq(t.balanceOfAt(b, 110), 40);
        assertEq(t.balanceOfAt(a, 99), 0);
        assertEq(t.totalSupplyAt(99), 0);
        assertEq(t.totalSupplyAt(119), 100);
    }

    function test_twoChangesInOneBlockKeepTheLast() public {
        vm.roll(110);
        vm.startPrank(a);
        t.transfer(b, 10);
        t.transfer(c, 5);
        vm.stopPrank();
        vm.roll(111);
        assertEq(t.balanceOfAt(a, 110), 35);
        assertEq(t.balanceOfAt(c, 110), 25);
    }

    function test_currentAndFutureBlocksRevert() public {
        vm.roll(110);
        vm.expectRevert(abi.encodeWithSelector(ShareToken.FutureLookup.selector, 110, 110));
        t.balanceOfAt(a, 110);
        vm.expectRevert(abi.encodeWithSelector(ShareToken.FutureLookup.selector, 111, 110));
        t.totalSupplyAt(111);
    }

    function test_declaresHistoryInterface() public view {
        assertTrue(t.supportsInterface(type(IShareHistory).interfaceId));
        assertTrue(t.supportsInterface(0x01ffc9a7)); // ERC-165 itself
        assertFalse(t.supportsInterface(0xffffffff));
    }

    function testFuzz_historyMatchesBalances(uint8 x, uint8 y) public {
        uint256 ax = bound(x, 0, 50);
        uint256 by = bound(y, 0, 30 + ax);
        vm.roll(200);
        vm.prank(a);
        t.transfer(b, ax);
        vm.roll(201);
        vm.prank(b);
        t.transfer(c, by);
        vm.roll(202);
        assertEq(t.balanceOfAt(a, 200), 50 - ax);
        assertEq(t.balanceOfAt(b, 200), 30 + ax);
        assertEq(t.balanceOfAt(b, 201), 30 + ax - by);
        assertEq(t.balanceOfAt(a, 201) + t.balanceOfAt(b, 201) + t.balanceOfAt(c, 201), t.totalSupplyAt(201));
    }
}

contract RuleRegistryTest is Test {
    MockCircuits cpu;
    RuleRegistry reg;

    function setUp() public {
        cpu = new MockCircuits();
        cpu.set(8, MockCircuits.Kind.SplitCheck, 128, 1, hex"00000102000003");
        cpu.set(13, MockCircuits.Kind.SplitValidity, 128, 1, hex"00000202000003");
        cpu.set(9, MockCircuits.Kind.CnRule, 32, 64, hex"00000302000003");
        reg = new RuleRegistry();
    }

    function test_registersAndPinsHashes() public {
        uint256 id = reg.registerRule(CircuitRef(address(cpu), 8), CircuitRef(address(cpu), 13), 1, "ipfs://split-v1");
        assertEq(id, 1);
        RuleRegistry.Rule memory r = reg.rule(1);
        assertEq(r.decision.id, 8);
        assertEq(r.nIn, 128);
        assertEq(r.decisionNetlistHash, keccak256(hex"00000102000003"));
        assertEq(r.validityNetlistHash, keccak256(hex"00000202000003"));
        assertEq(r.author, address(this));
    }

    function test_ruleWithoutValidity() public {
        uint256 id = reg.registerRule(CircuitRef(address(cpu), 9), CircuitRef(address(0), 0), 64, "cn-bonus-2023-30");
        assertEq(reg.rule(id).validityNetlistHash, bytes32(0));
    }

    function test_refusesBadShapes() public {
        vm.expectRevert(abi.encodeWithSelector(RuleRegistry.BadDecisionBits.selector, 65, 64));
        reg.registerRule(CircuitRef(address(cpu), 9), CircuitRef(address(0), 0), 65, "");
        vm.expectRevert(abi.encodeWithSelector(RuleRegistry.ValidityShapeMismatch.selector, 128, 32));
        reg.registerRule(CircuitRef(address(cpu), 9), CircuitRef(address(cpu), 13), 64, "");
        vm.expectRevert(abi.encodeWithSelector(RuleRegistry.EmptyCircuit.selector, address(cpu), 77));
        reg.registerRule(CircuitRef(address(cpu), 77), CircuitRef(address(0), 0), 1, "");
    }

    function test_attestationsAreEventsOnly() public {
        reg.registerRule(CircuitRef(address(cpu), 9), CircuitRef(address(0), 0), 64, "");
        vm.expectEmit(true, true, true, true);
        emit RuleRegistry.ProofAttested(1, address(this), CircuitRef(address(cpu), 9), bytes32("tax-within-bonus"), 0, bytes32(uint256(7)), "x");
        reg.attestProof(1, CircuitRef(address(cpu), 9), bytes32("tax-within-bonus"), 0, bytes32(uint256(7)), "x");
        vm.expectRevert(abi.encodeWithSelector(RuleRegistry.BadStatus.selector, 3));
        reg.attestProof(1, CircuitRef(address(cpu), 9), bytes32("x"), 3, bytes32(0), "");
        vm.expectRevert(abi.encodeWithSelector(RuleRegistry.NoSuchRule.selector, 2));
        reg.endorse(2, "no");
    }
}
