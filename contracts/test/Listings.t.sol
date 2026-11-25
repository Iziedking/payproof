// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Listings} from "../src/Listings.sol";
import {RuleRegistry} from "../src/RuleRegistry.sol";
import {CircuitRef} from "../src/Circuits.sol";
import {MockCircuits, MockToken} from "./MockCircuits.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract ListingsTest is Test {
    address lister = makeAddr("lister");
    address hunter = makeAddr("hunter");
    address thief = makeAddr("thief");
    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");

    MockCircuits cpu;
    RuleRegistry reg;
    Listings lst;
    MockToken usd;
    uint256 cnRule;

    function setUp() public {
        vm.roll(1000);
        cpu = new MockCircuits();
        cpu.set(9, MockCircuits.Kind.CnRule, 32, 64, hex"0000000200000309");
        cpu.set(15, MockCircuits.Kind.CnRule, 32, 64, hex"000000020000030f"); // engine A: same outputs
        cpu.set(16, MockCircuits.Kind.CnEngineB, 32, 64, hex"0000000200000310"); // engine B
        reg = new RuleRegistry();
        cnRule = reg.registerRule(CircuitRef(address(cpu), 9), CircuitRef(address(0), 0), 64, "cn-bonus-2023-30");
        lst = new Listings(reg, treasury, owner);
        usd = new MockToken(6, 0);
        usd.mint(lister, 100e6);
        vm.prank(lister);
        usd.approve(address(lst), type(uint256).max);
    }

    function bonus(uint32 fen) internal pure returns (bytes memory b) {
        b = new bytes(4);
        for (uint256 i = 0; i < 4; i++) b[i] = bytes1(uint8(fen >> (8 * i)));
    }

    function listEngine(uint64 id) internal returns (uint256) {
        vm.prank(lister);
        return lst.list(cnRule, CircuitRef(address(cpu), id), IERC20(address(usd)), 1e6);
    }

    function commitReveal(address who, uint256 id, bytes memory input) internal {
        bytes32 salt = keccak256("salt");
        vm.prank(who);
        lst.commit(lst.commitmentOf(id, input, salt, who));
        vm.roll(block.number + 1);
        vm.prank(who);
        lst.reveal(id, input, salt);
    }

    function test_engineBIsDisprovedAtSeventeenFenAndTheHunterIsPaid() public {
        uint256 id = listEngine(16);
        commitReveal(hunter, id, bonus(17));
        Listings.Listing memory l = lst.listing(id);
        assertEq(uint8(l.status), uint8(Listings.Status.Disproved));
        assertEq(l.hunter, hunter);
        assertEq(usd.balanceOf(hunter), 1e6);
        assertEq(usd.balanceOf(address(lst)), 0);
    }

    function test_engineAHasNoDifferenceToFind() public {
        uint256 id = listEngine(15);
        bytes32 salt = keccak256("s");
        vm.prank(hunter);
        lst.commit(lst.commitmentOf(id, bonus(17), salt, hunter));
        vm.roll(block.number + 1);
        vm.expectRevert(Listings.NoDifference.selector);
        vm.prank(hunter);
        lst.reveal(id, bonus(17), salt);
    }

    function test_engineBAgreesWhereRoundingDoesNotMatter() public {
        uint256 id = listEngine(16);
        bytes32 salt = keccak256("s");
        vm.prank(hunter);
        lst.commit(lst.commitmentOf(id, bonus(100), salt, hunter)); // 100 x 3 = 300, no rounding
        vm.roll(block.number + 1);
        vm.expectRevert(Listings.NoDifference.selector);
        vm.prank(hunter);
        lst.reveal(id, bonus(100), salt);
    }

    function test_revealNeedsOwnCommitmentInAnEarlierBlock() public {
        uint256 id = listEngine(16);
        bytes32 salt = keccak256("s");
        vm.prank(hunter);
        lst.commit(lst.commitmentOf(id, bonus(17), salt, hunter));
        vm.expectRevert(Listings.RevealTooEarly.selector);
        vm.prank(hunter);
        lst.reveal(id, bonus(17), salt);
        vm.roll(block.number + 1);
        // Someone who saw the input cannot use the hunter's commitment.
        vm.expectRevert(Listings.NoCommitment.selector);
        vm.prank(thief);
        lst.reveal(id, bonus(17), salt);
        vm.prank(hunter);
        lst.reveal(id, bonus(17), salt);
        assertEq(usd.balanceOf(hunter), 1e6);
    }

    function test_inputLengthIsChecked() public {
        uint256 id = listEngine(16);
        bytes32 salt = keccak256("s");
        vm.prank(hunter);
        lst.commit(lst.commitmentOf(id, hex"1100", salt, hunter));
        vm.roll(block.number + 1);
        vm.expectRevert(abi.encodeWithSelector(Listings.InputLength.selector, 2, 4));
        vm.prank(hunter);
        lst.reveal(id, hex"1100", salt);
    }

    function test_withdrawWaitsSevenDaysAndCanStillBeDisproved() public {
        uint256 id = listEngine(16);
        vm.expectRevert(Listings.WithdrawNotRequested.selector);
        vm.prank(lister);
        lst.withdraw(id);
        vm.expectRevert(Listings.NotLister.selector);
        vm.prank(hunter);
        lst.requestWithdraw(id);
        vm.prank(lister);
        lst.requestWithdraw(id);
        vm.warp(block.timestamp + 6 days);
        vm.expectRevert();
        vm.prank(lister);
        lst.withdraw(id);
        // A disproof inside the delay wins.
        commitReveal(hunter, id, bonus(17));
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(abi.encodeWithSelector(Listings.NotOpen.selector, Listings.Status.Disproved));
        vm.prank(lister);
        lst.withdraw(id);
    }

    function test_withdrawAfterTheDelay() public {
        uint256 id = listEngine(15);
        vm.prank(lister);
        lst.requestWithdraw(id);
        vm.warp(block.timestamp + 7 days);
        vm.prank(lister);
        lst.withdraw(id);
        assertEq(usd.balanceOf(lister), 100e6);
    }

    function test_topUpAddsToTheBounty() public {
        uint256 id = listEngine(16);
        usd.mint(hunter, 5e6);
        vm.startPrank(hunter);
        usd.approve(address(lst), 5e6);
        lst.topUp(id, 5e6);
        vm.stopPrank();
        assertEq(lst.listing(id).bounty, 6e6);
    }

    function test_pauseStopsNewListingsOnly() public {
        uint256 id = listEngine(16);
        vm.expectRevert();
        lst.pause();
        vm.prank(owner);
        lst.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        listEngine(15);
        commitReveal(hunter, id, bonus(17)); // still works while paused
        assertEq(usd.balanceOf(hunter), 1e6);
    }

    function test_refusesAnEngineOfTheWrongShape() public {
        cpu.set(30, MockCircuits.Kind.CnRule, 64, 64, hex"00000002000003ff");
        vm.expectRevert(abi.encodeWithSelector(Listings.ShapeMismatch.selector, 64, 64, 32, 64));
        vm.prank(lister);
        lst.list(cnRule, CircuitRef(address(cpu), 30), IERC20(address(usd)), 1e6);
    }

    function test_changedEngineCannotBeDisproved() public {
        uint256 id = listEngine(16);
        cpu.setNetlist(16, hex"01");
        bytes32 salt = keccak256("s");
        vm.prank(hunter);
        lst.commit(lst.commitmentOf(id, bonus(17), salt, hunter));
        vm.roll(block.number + 1);
        vm.expectRevert(Listings.EngineChanged.selector);
        vm.prank(hunter);
        lst.reveal(id, bonus(17), salt);
    }

    /// Engine B differs from the rule exactly where bonus x rate mod 100 >= 50.
    function testFuzz_engineBDiffersOnlyWhereItRoundsUp(uint32 fen) public {
        fen = uint32(bound(fen, 0, 200_000_000));
        uint256 id = listEngine(16);
        (uint256 rate,) = cpu.cnBracket(fen);
        bool differs = (uint256(fen) * rate) % 100 >= 50;
        bytes32 salt = keccak256(abi.encode(fen));
        vm.prank(hunter);
        lst.commit(lst.commitmentOf(id, bonus(fen), salt, hunter));
        vm.roll(block.number + 1);
        if (!differs) vm.expectRevert(Listings.NoDifference.selector);
        vm.prank(hunter);
        lst.reveal(id, bonus(fen), salt);
    }
}
