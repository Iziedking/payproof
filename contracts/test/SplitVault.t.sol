// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ShareToken} from "../src/ShareToken.sol";
import {RuleRegistry} from "../src/RuleRegistry.sol";
import {SplitVault} from "../src/SplitVault.sol";
import {CircuitRef} from "../src/Circuits.sol";
import {MockCircuits, MockToken} from "./MockCircuits.sol";

/// The split-v1 payout: floor(pot x 8500 x shares / (10000 x total)) (PLAN 11.1).
function payoutOf(uint256 pot, uint256 shares, uint256 total) pure returns (uint32) {
    return uint32((pot * 8500 * shares) / (10_000 * total));
}

contract SplitBase is Test {
    address a = makeAddr("a");
    address b = makeAddr("b");
    address c = makeAddr("c");
    address op = makeAddr("operator");
    address funder = makeAddr("funder");
    address treasury = makeAddr("treasury");
    uint256 constant UNIT = 1e16; // 0.01 of an 18-decimal token

    MockCircuits cpu;
    RuleRegistry reg;
    SplitVault vault;
    ShareToken shares;
    MockToken pay;
    uint256 splitId;

    function setUp() public virtual {
        vm.roll(100);
        vm.warp(1_800_000_000);
        cpu = new MockCircuits();
        cpu.set(8, MockCircuits.Kind.SplitCheck, 128, 1, hex"0000010200000308");
        cpu.set(20, MockCircuits.Kind.Fee10, 32, 32, hex"0000010200000320");
        for (uint64 i = 3; i <= 7; i++) cpu.set(i, MockCircuits.Kind.None, 32, 32, abi.encodePacked(bytes7(0), i));
        reg = new RuleRegistry();
        reg.registerRule(CircuitRef(address(cpu), 8), CircuitRef(address(0), 0), 1, "split-v1");
        vault = new SplitVault(reg, treasury);

        address[] memory h = new address[](3);
        (h[0], h[1], h[2]) = (a, b, c);
        uint256[] memory v = new uint256[](3);
        (v[0], v[1], v[2]) = (50, 30, 20);
        shares = new ShareToken("Payproof test shares", "PPS", h, v);
        pay = new MockToken(18, 0);
        pay.mint(funder, 1_000_000 * 1e18);
        vm.prank(funder);
        pay.approve(address(vault), type(uint256).max);

        vm.prank(op);
        splitId = vault.createSplit(1, CircuitRef(address(cpu), 20), refs(), address(shares), address(pay), 1 days);
        vm.roll(101);
    }

    function refs() internal view returns (CircuitRef[] memory r) {
        r = new CircuitRef[](5);
        for (uint64 i = 0; i < 5; i++) r[i] = CircuitRef(address(cpu), 3 + i);
    }

    function open(uint32 deposit) internal returns (uint256 roundId) {
        vm.prank(funder);
        roundId = vault.openRound(splitId, deposit);
    }
}

contract SplitVaultTest is SplitBase {
    function test_createStoresAndPins() public view {
        SplitVault.Split memory s = vault.split(splitId);
        assertEq(s.operator, op);
        assertEq(s.unit, UNIT);
        assertEq(vault.pinned(splitId).length, 7); // decision, fee, five REF targets
    }

    function test_openRoundPaysFeeAndSnapshotsPreviousBlock() public {
        uint256 r = open(10_000); // 100 tokens
        SplitVault.Round memory rd = vault.round(splitId, r);
        assertEq(rd.pot, 10_000);
        assertEq(rd.fee, 1_000);
        assertEq(rd.protocolFee, 0);
        assertEq(rd.snapshotBlock, 100);
        assertEq(rd.totalShares, 100);
        assertEq(pay.balanceOf(op), 1_000 * UNIT);
        assertEq(pay.balanceOf(treasury), 0);
        assertEq(pay.balanceOf(address(vault)), 9_000 * UNIT);
    }

    function test_threeHoldersClaimWhatTheRuleDecides() public {
        uint256 r = open(10_000);
        address[3] memory hs = [a, b, c];
        uint256[3] memory sh = [uint256(50), 30, 20];
        for (uint256 i = 0; i < 3; i++) {
            uint32 p = payoutOf(10_000, sh[i], 100);
            vm.prank(hs[i]);
            vault.claim(splitId, r, p);
            assertEq(pay.balanceOf(hs[i]), uint256(p) * UNIT);
        }
        assertEq(pay.balanceOf(a), 4_250 * UNIT);
        assertEq(vault.round(splitId, r).claimed, 8_500);
    }

    function test_wrongPayoutIsRejected() public {
        uint256 r = open(10_000);
        vm.startPrank(a);
        vm.expectRevert(abi.encodeWithSelector(SplitVault.PayoutRejected.selector, 4_251));
        vault.claim(splitId, r, 4_251);
        vm.expectRevert(abi.encodeWithSelector(SplitVault.PayoutRejected.selector, 4_249));
        vault.claim(splitId, r, 4_249);
        vm.stopPrank();
    }

    function test_oneClaimPerHolderPerRound() public {
        uint256 r = open(10_000);
        vm.startPrank(a);
        vault.claim(splitId, r, 4_250);
        vm.expectRevert(abi.encodeWithSelector(SplitVault.AlreadyClaimed.selector, a));
        vault.claim(splitId, r, 4_250);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(SplitVault.AlreadyClaimed.selector, a));
        vault.claimFor(splitId, r, a, 4_250);
    }

    function test_claimForPaysTheHolder() public {
        uint256 r = open(10_000);
        address relayer = makeAddr("relayer");
        vm.prank(relayer);
        vault.claimFor(splitId, r, b, 2_550);
        assertEq(pay.balanceOf(b), 2_550 * UNIT);
        assertEq(pay.balanceOf(relayer), 0);
    }

    /// P4 "Done when": a transfer of shares after the snapshot does not change that round.
    function test_transferAfterSnapshotDoesNotChangeTheRound() public {
        uint256 r = open(10_000); // snapshot at block 100
        vm.prank(a);
        shares.transfer(c, 50); // block 101, after the snapshot
        vm.roll(102);
        vm.prank(a);
        vault.claim(splitId, r, 4_250); // still a's 50 shares at block 100
        // c now holds 70, but the round counts the 20 c held at the snapshot.
        vm.expectRevert(abi.encodeWithSelector(SplitVault.PayoutRejected.selector, 5_950));
        vm.prank(c);
        vault.claim(splitId, r, 5_950);
        vm.prank(c);
        vault.claim(splitId, r, 1_700);
        // The next round sees the new balances.
        uint256 r2 = open(10_000);
        vm.expectRevert(abi.encodeWithSelector(SplitVault.HolderHasNoShares.selector, a));
        vm.prank(a);
        vault.claim(splitId, r2, 0);
    }

    function test_noSharesNoClaim() public {
        uint256 r = open(10_000);
        address d = makeAddr("d");
        vm.expectRevert(abi.encodeWithSelector(SplitVault.HolderHasNoShares.selector, d));
        vm.prank(d);
        vault.claim(splitId, r, 0);
    }

    function test_windowAndRollOver() public {
        uint256 r = open(10_000);
        vm.prank(a);
        vault.claim(splitId, r, 4_250);
        vm.expectRevert();
        vault.rollOver(splitId, r);
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert();
        vm.prank(b);
        vault.claim(splitId, r, 2_550);
        vault.rollOver(splitId, r);
        // pot 10,000 - fee 1,000 - claimed 4,250 = 4,750 rolled over; never to the operator.
        assertEq(vault.split(splitId).carry, 4_750);
        assertEq(pay.balanceOf(op), 1_000 * UNIT);
        vm.expectRevert(SplitVault.AlreadyRolledOver.selector);
        vault.rollOver(splitId, r);

        uint256 r2 = open(10_000);
        SplitVault.Round memory rd = vault.round(splitId, r2);
        assertEq(rd.pot, 14_750);
        assertEq(rd.fee, 1_000); // the fee is on the deposit only
        assertEq(vault.split(splitId).carry, 0);
        vm.prank(b);
        vault.claim(splitId, r2, payoutOf(14_750, 30, 100));
    }

    function test_changedCircuitStopsClaimsAndKeepsFunds() public {
        uint256 r = open(10_000);
        cpu.setNetlist(5, hex"deadbeef");
        vm.expectRevert(abi.encodeWithSelector(SplitVault.CircuitChanged.selector, address(cpu), 5));
        vm.prank(a);
        vault.claim(splitId, r, 4_250);
        vm.expectRevert(abi.encodeWithSelector(SplitVault.CircuitChanged.selector, address(cpu), 5));
        open(10_000);
        assertEq(pay.balanceOf(address(vault)), 9_000 * UNIT);
        // Restored bytes: claims work again.
        cpu.setNetlist(5, abi.encodePacked(bytes7(0), uint64(5)));
        vm.prank(a);
        vault.claim(splitId, r, 4_250);
    }

    function test_processorFailureStopsClaimsAndKeepsFunds() public {
        uint256 r = open(10_000);
        cpu.setBroken(8, true);
        vm.expectRevert();
        vm.prank(a);
        vault.claim(splitId, r, 4_250);
        assertEq(pay.balanceOf(address(vault)), 9_000 * UNIT);
    }

    function test_refusesTokensWithoutHistory() public {
        vm.expectRevert(abi.encodeWithSelector(SplitVault.NotShareHistory.selector, address(pay)));
        vault.createSplit(1, CircuitRef(address(cpu), 20), refs(), address(pay), address(pay), 1 days);
        vm.expectRevert(abi.encodeWithSelector(SplitVault.NotShareHistory.selector, a));
        vault.createSplit(1, CircuitRef(address(cpu), 20), refs(), a, address(pay), 1 days);
    }

    function test_refusesFeeOnTransferPayToken() public {
        MockToken skim = new MockToken(18, 100);
        skim.mint(funder, 1e24);
        vm.prank(funder);
        skim.approve(address(vault), type(uint256).max);
        uint256 s2 = vault.createSplit(1, CircuitRef(address(cpu), 20), refs(), address(shares), address(skim), 1 days);
        vm.expectRevert(abi.encodeWithSelector(SplitVault.TransferAmountMismatch.selector, 10_000 * UNIT, 9_900 * UNIT));
        vm.prank(funder);
        vault.openRound(s2, 10_000);
    }

    function test_refusesWrongCircuitShapes() public {
        vm.expectRevert(abi.encodeWithSelector(SplitVault.WrongCircuitShape.selector, 8, 128, 1));
        vault.createSplit(1, CircuitRef(address(cpu), 8), refs(), address(shares), address(pay), 1 days);
    }

    function testFuzz_onlyTheRulesPayoutPasses(uint32 deposit, uint8 who, int8 off) public {
        deposit = uint32(bound(deposit, 1, type(uint32).max / 2));
        pay.mint(funder, uint256(deposit) * UNIT);
        uint256 r = open(deposit);
        address h = [a, b, c][bound(who, 0, 2)];
        uint256 sh = shares.balanceOf(h);
        uint32 right = payoutOf(deposit, sh, 100);
        int256 tryP = int256(uint256(right)) + int256(bound(off, -3, 3));
        vm.assume(tryP >= 0);
        vm.prank(h);
        if (tryP == int256(uint256(right))) {
            vault.claim(splitId, r, right);
            assertEq(pay.balanceOf(h), uint256(right) * UNIT);
        } else {
            vm.expectRevert(abi.encodeWithSelector(SplitVault.PayoutRejected.selector, uint32(uint256(tryP))));
            vault.claim(splitId, r, uint32(uint256(tryP)));
        }
    }
}

/// Drives random rounds, claims, roll-overs and share transfers.
contract SplitHandler is Test {
    SplitVault vault;
    ShareToken shares;
    MockToken pay;
    uint256 splitId;
    address funder;
    address[3] hs;
    uint256 constant UNIT = 1e16;
    uint256 public paidOut; // to holders, vault units
    uint256 public feesOut;
    uint256 public deposited;

    constructor(SplitVault v, ShareToken s, MockToken p, uint256 id, address f, address[3] memory h) {
        (vault, shares, pay, splitId, funder, hs) = (v, s, p, id, f, h);
    }

    function openRound(uint32 deposit) external {
        deposit = uint32(bound(deposit, 1, 1_000_000));
        pay.mint(funder, uint256(deposit) * UNIT);
        vm.prank(funder);
        uint256 r = vault.openRound(splitId, deposit);
        deposited += deposit;
        feesOut += vault.round(splitId, r).fee;
        vm.roll(block.number + 1);
    }

    function claim(uint256 roundSeed, uint8 who) external {
        uint256 n = vault.split(splitId).roundCount;
        if (n == 0) return;
        uint256 r = bound(roundSeed, 1, n);
        address h = hs[bound(who, 0, 2)];
        SplitVault.Round memory rd = vault.round(splitId, r);
        if (block.timestamp > rd.deadline || vault.hasClaimed(splitId, r, h)) return;
        uint256 sh = shares.balanceOfAt(h, rd.snapshotBlock);
        if (sh == 0) return;
        uint32 p = payoutOf(rd.pot, sh, rd.totalShares);
        vm.prank(h);
        vault.claim(splitId, r, p);
        paidOut += p;
    }

    function rollOver(uint256 roundSeed) external {
        uint256 n = vault.split(splitId).roundCount;
        if (n == 0) return;
        uint256 r = bound(roundSeed, 1, n);
        SplitVault.Round memory rd = vault.round(splitId, r);
        if (block.timestamp <= rd.deadline || rd.rolledOver) return;
        vault.rollOver(splitId, r);
    }

    function move(uint8 from, uint8 to, uint8 amount) external {
        address f = hs[bound(from, 0, 2)];
        uint256 v = bound(amount, 0, shares.balanceOf(f));
        vm.prank(f);
        shares.transfer(hs[bound(to, 0, 2)], v);
        vm.roll(block.number + 1);
    }

    function wait(uint32 secs) external {
        vm.warp(block.timestamp + bound(secs, 0, 2 days));
    }
}

contract SplitVaultInvariantTest is SplitBase {
    SplitHandler handler;

    function setUp() public override {
        super.setUp();
        handler = new SplitHandler(vault, shares, pay, splitId, funder, [a, b, c]);
        targetContract(address(handler));
    }

    /// Every vault unit deposited is in the vault, paid to a holder, or paid as a fee.
    function invariant_conservation() public view {
        assertEq(pay.balanceOf(address(vault)) / UNIT + handler.paidOut() + handler.feesOut(), handler.deposited());
        assertEq(pay.balanceOf(address(vault)) % UNIT, 0);
    }

    /// What the vault holds covers every open round's unpaid holder share plus the carry.
    function invariant_solvent() public view {
        uint256 owed = vault.split(splitId).carry;
        uint256 n = vault.split(splitId).roundCount;
        for (uint256 r = 1; r <= n; r++) {
            SplitVault.Round memory rd = vault.round(splitId, r);
            if (!rd.rolledOver) owed += uint256(rd.pot) - rd.fee - rd.protocolFee - rd.claimed;
            // Holders never get more than 85% of the pot (never-overpays, summed).
            assertLe(rd.claimed * 10_000, uint256(rd.pot) * 8_500);
        }
        assertEq(pay.balanceOf(address(vault)) / UNIT, owed);
    }
}
