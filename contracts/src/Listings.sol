// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {CircuitIO, CircuitRef, ICircuits} from "./Circuits.sol";
import {RuleRegistry} from "./RuleRegistry.sol";

/// Engines listed against a rule, each with a bounty for anyone who finds an input where the
/// engine and the rule disagree (PLAN 11.3, Listings).
///
/// A hunter first commits to keccak256(abi.encode(listingId, input, salt, hunter)), then, in a
/// later block, reveals. The reveal checks the input against the rule's validity circuit (when
/// the rule has one), runs the rule's decision circuit and the engine on X Layer, and if their
/// first `decisionBits` output bits differ, marks the listing disproved before paying.
///
/// Every path by which tokens leave this contract:
///   1. `reveal`: a disproved listing's whole bounty, less FEE_BPS, to the hunter who revealed;
///      the FEE_BPS part to TREASURY. FEE_BPS is 0 (owner decision D5, 2026-11-25).
///   2. `withdraw`: an undisproved listing's whole bounty back to its lister, no sooner than
///      WITHDRAW_DELAY after the lister asked, so a pending disproof can still land.
/// The owner can only pause and unpause new listings. Pausing never stops a top-up, a reveal or
/// a withdrawal, and the owner has no path that moves tokens.
contract Listings is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    using CircuitIO for bytes;

    uint64 public constant WITHDRAW_DELAY = 7 days;
    uint16 public constant MAX_FEE_BPS = 1_000;
    uint16 public constant FEE_BPS = 0;

    enum Status {
        Open,
        Disproved,
        Withdrawn
    }

    struct Listing {
        uint256 ruleId;
        CircuitRef engine;
        bytes32 engineNetlistHash;
        address lister;
        IERC20 token;
        uint256 bounty;
        uint64 withdrawAt; // 0 until the lister asks
        Status status;
        address hunter;
    }

    error NoSuchListing(uint256 listingId);
    error NotOpen(Status status);
    error NotLister();
    error ZeroAmount();
    error ShapeMismatch(uint32 engineNIn, uint32 engineNOut, uint32 ruleNIn, uint32 decisionBits);
    error TransferAmountMismatch(uint256 expected, uint256 received);
    error WithdrawNotRequested();
    error WithdrawTooEarly(uint64 at);
    error AlreadyCommitted();
    error NoCommitment();
    error RevealTooEarly();
    error InputLength(uint256 got, uint256 want);
    error InputNotValid();
    error EngineChanged();
    error RuleChanged();
    error NoDifference();

    event Listed(
        uint256 indexed listingId, uint256 indexed ruleId, address indexed lister, CircuitRef engine, address token, uint256 bounty
    );
    event ToppedUp(uint256 indexed listingId, address indexed from, uint256 amount, uint256 bounty);
    event WithdrawRequested(uint256 indexed listingId, uint64 at);
    event Withdrawn(uint256 indexed listingId, uint256 amount);
    event Committed(bytes32 indexed commitment, address indexed hunter, uint256 blockNumber);
    event Disproved(
        uint256 indexed listingId, address indexed hunter, bytes input, bytes ruleOutput, bytes engineOutput, uint256 paid, uint256 fee
    );

    RuleRegistry public immutable registry;
    address public immutable TREASURY;

    uint256 public listingCount;
    mapping(uint256 listingId => Listing) private _listings;
    mapping(bytes32 commitment => uint256 blockNumber) public commitments;

    constructor(RuleRegistry registry_, address treasury, address owner_) Ownable(owner_) {
        assert(FEE_BPS <= MAX_FEE_BPS);
        registry = registry_;
        TREASURY = treasury;
    }

    function list(uint256 ruleId, CircuitRef calldata engine, IERC20 token, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 listingId)
    {
        if (amount == 0) revert ZeroAmount();
        RuleRegistry.Rule memory r = registry.rule(ruleId);
        (uint32 eIn, uint32 eOut,,) = ICircuits(engine.cpu).circuitInfo(engine.id);
        if (eIn != r.nIn || eOut < r.decisionBits) revert ShapeMismatch(eIn, eOut, r.nIn, r.decisionBits);
        uint256 got = _pull(token, msg.sender, amount);
        listingId = ++listingCount;
        _listings[listingId] = Listing({
            ruleId: ruleId,
            engine: engine,
            engineNetlistHash: keccak256(ICircuits(engine.cpu).netlist(engine.id)),
            lister: msg.sender,
            token: token,
            bounty: got,
            withdrawAt: 0,
            status: Status.Open,
            hunter: address(0)
        });
        emit Listed(listingId, ruleId, msg.sender, engine, address(token), got);
    }

    function topUp(uint256 listingId, uint256 amount) external nonReentrant {
        Listing storage l = _open(listingId);
        if (amount == 0) revert ZeroAmount();
        l.bounty += _pull(l.token, msg.sender, amount);
        emit ToppedUp(listingId, msg.sender, amount, l.bounty);
    }

    function requestWithdraw(uint256 listingId) external {
        Listing storage l = _open(listingId);
        if (msg.sender != l.lister) revert NotLister();
        l.withdrawAt = uint64(block.timestamp) + WITHDRAW_DELAY;
        emit WithdrawRequested(listingId, l.withdrawAt);
    }

    function withdraw(uint256 listingId) external nonReentrant {
        Listing storage l = _open(listingId);
        if (msg.sender != l.lister) revert NotLister();
        if (l.withdrawAt == 0) revert WithdrawNotRequested();
        if (block.timestamp < l.withdrawAt) revert WithdrawTooEarly(l.withdrawAt);
        l.status = Status.Withdrawn;
        uint256 amount = l.bounty;
        l.bounty = 0;
        l.token.safeTransfer(l.lister, amount);
        emit Withdrawn(listingId, amount);
    }

    function commit(bytes32 commitment) external {
        if (commitments[commitment] != 0) revert AlreadyCommitted();
        commitments[commitment] = block.number;
        emit Committed(commitment, msg.sender, block.number);
    }

    /// The commitment a hunter should send before revealing `input` for `listingId`.
    function commitmentOf(uint256 listingId, bytes calldata input, bytes32 salt, address hunter) public pure returns (bytes32) {
        return keccak256(abi.encode(listingId, input, salt, hunter));
    }

    function reveal(uint256 listingId, bytes calldata input, bytes32 salt) external nonReentrant {
        Listing storage l = _open(listingId);
        uint256 at = commitments[commitmentOf(listingId, input, salt, msg.sender)];
        if (at == 0) revert NoCommitment();
        if (block.number <= at) revert RevealTooEarly();

        RuleRegistry.Rule memory r = registry.rule(l.ruleId);
        uint256 want = (uint256(r.nIn) + 7) / 8;
        if (input.length != want) revert InputLength(input.length, want);
        if (r.validity.cpu != address(0)) {
            if (!ICircuits(r.validity.cpu).eval(r.validity.id, input).bit(0)) revert InputNotValid();
        }
        if (keccak256(ICircuits(l.engine.cpu).netlist(l.engine.id)) != l.engineNetlistHash) revert EngineChanged();
        if (keccak256(ICircuits(r.decision.cpu).netlist(r.decision.id)) != r.decisionNetlistHash) revert RuleChanged();
        bytes memory ruleOut = ICircuits(r.decision.cpu).eval(r.decision.id, input);
        bytes memory engineOut = ICircuits(l.engine.cpu).eval(l.engine.id, input);
        if (ruleOut.sameBits(engineOut, r.decisionBits)) revert NoDifference();

        // Status first, then pay (PLAN 11.3).
        l.status = Status.Disproved;
        l.hunter = msg.sender;
        uint256 bounty = l.bounty;
        l.bounty = 0;
        uint256 fee = (bounty * FEE_BPS) / 10_000;
        uint256 paid = bounty - fee;
        if (paid > 0) l.token.safeTransfer(msg.sender, paid);
        if (fee > 0) l.token.safeTransfer(TREASURY, fee);
        emit Disproved(listingId, msg.sender, input, ruleOut, engineOut, paid, fee);
    }

    function listing(uint256 listingId) external view returns (Listing memory) {
        if (listingId == 0 || listingId > listingCount) revert NoSuchListing(listingId);
        return _listings[listingId];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _open(uint256 listingId) private view returns (Listing storage l) {
        if (listingId == 0 || listingId > listingCount) revert NoSuchListing(listingId);
        l = _listings[listingId];
        if (l.status != Status.Open) revert NotOpen(l.status);
    }

    function _pull(IERC20 token, address from, uint256 amount) private returns (uint256) {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 got = token.balanceOf(address(this)) - before;
        if (got != amount) revert TransferAmountMismatch(amount, got);
        return got;
    }
}
