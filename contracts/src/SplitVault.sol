// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {CircuitIO, CircuitRef, ICircuits} from "./Circuits.sol";
import {RuleRegistry} from "./RuleRegistry.sol";
import {IShareHistory} from "./ShareToken.sol";

/// Pays each share holder what the split-v1 rule decides, checked by its circuit on X Layer
/// (PLAN 11.1 and 11.3).
///
/// Every path by which tokens leave this contract:
///   1. `openRound`: the operator's fee, exactly what the split's fee circuit returns for the
///      amount deposited, to the split's operator; and the protocol fee, PROTOCOL_FEE_BPS of
///      the deposit (0 by owner decision D5), to TREASURY.
///   2. `claim` and `claimFor`: to the holder, exactly the payout the claimant names, and only
///      after the split's decision circuit returns ok = 1 for (pot, the holder's shares at the
///      snapshot block, total shares at the snapshot block, payout). Never more than the round
///      has left for holders.
/// Nothing else moves tokens out. There is no owner and no admin function. What a round does
/// not pay out is moved by `rollOver` into the split's carry, which the next round adds to its
/// pot; it never goes to the operator or to the treasury.
///
/// Amounts are counted in the vault unit, 0.01 of the pay token (owner decision 2026-11-19),
/// because the circuits take 32-bit whole numbers. The pay token must have at least 2 decimals
/// and must transfer exactly the amount asked (fee-on-transfer tokens are refused).
///
/// If a processor stops answering, or a pinned circuit's netlist no longer has the hash it had
/// when the split was created, every claim and every new round of that split reverts and the
/// tokens stay here until the check passes again (PLAN 11.3 rule 6). Nobody can move them out
/// another way. The threat model (docs/threat-model.md) says what that means for recovery.
contract SplitVault is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using CircuitIO for bytes;

    /// Protocol fee taken at openRound, in basis points of the deposit. Owner decision D5
    /// (2026-11-25): 0, with a hard cap of 100.
    uint16 public constant PROTOCOL_FEE_BPS = 0;
    uint16 public constant MAX_PROTOCOL_FEE_BPS = 100;

    // split-v1 check circuit layout (rules/split-v1/layout.json): four 32-bit inputs, one bit out.
    uint32 internal constant DECISION_N_IN = 128;
    uint32 internal constant DECISION_N_OUT = 1;
    // Fee circuit layout (rules/split-v1/fee.v): pot in, fee out, 32 bits each.
    uint32 internal constant FEE_N_IN = 32;
    uint32 internal constant FEE_N_OUT = 32;

    struct Pinned {
        address cpu;
        uint64 id;
        bytes32 netlistHash;
    }

    struct Split {
        uint256 ruleId;
        address operator;
        IShareHistory shareToken;
        IERC20 payToken;
        uint256 unit; // token base units per vault unit
        uint64 claimWindow; // seconds
        uint256 carry; // vault units rolled over, waiting for the next round
        uint256 roundCount;
    }

    struct Round {
        uint32 pot; // vault units the holders' payouts are computed from (deposit + carry used)
        uint32 fee; // operator fee paid at open, vault units
        uint32 protocolFee; // vault units
        uint32 totalShares; // at the snapshot block
        uint64 snapshotBlock;
        uint64 deadline; // claims accepted while block.timestamp <= deadline
        uint256 claimed; // vault units paid to holders
        bool rolledOver;
    }

    error NoSuchSplit(uint256 splitId);
    error NoSuchRound(uint256 splitId, uint256 roundId);
    error NotShareHistory(address token);
    error PayTokenDecimals(uint8 decimals);
    error WrongCircuitShape(uint64 id, uint32 nIn, uint32 nOut);
    error RuleCircuitChanged(uint256 ruleId);
    error CircuitChanged(address cpu, uint64 id);
    error ZeroClaimWindow();
    error ZeroDeposit();
    error AmountTooLarge(uint256 amount);
    error NoShares();
    error TransferAmountMismatch(uint256 expected, uint256 received);
    error FeeExceedsDeposit(uint256 fee, uint256 deposit);
    error ClaimWindowClosed(uint64 deadline);
    error ClaimWindowOpen(uint64 deadline);
    error AlreadyClaimed(address holder);
    error AlreadyRolledOver();
    error HolderHasNoShares(address holder);
    error PayoutRejected(uint32 payout);
    error RoundExhausted(uint256 left, uint32 payout);

    event SplitCreated(
        uint256 indexed splitId,
        uint256 indexed ruleId,
        address indexed operator,
        address shareToken,
        address payToken,
        CircuitRef fee,
        uint64 claimWindow
    );
    event RoundOpened(
        uint256 indexed splitId,
        uint256 indexed roundId,
        uint32 deposit,
        uint32 pot,
        uint32 fee,
        uint32 protocolFee,
        uint64 snapshotBlock,
        uint32 totalShares,
        uint64 deadline
    );
    event Claimed(
        uint256 indexed splitId, uint256 indexed roundId, address indexed holder, uint32 shares, uint32 payout, address caller
    );
    event RolledOver(uint256 indexed splitId, uint256 indexed roundId, uint256 amount);

    RuleRegistry public immutable registry;
    address public immutable TREASURY;

    uint256 public splitCount;
    mapping(uint256 splitId => Split) private _splits;
    mapping(uint256 splitId => Pinned[]) private _pinned; // [0] decision, [1] fee, then the decision's REF targets
    mapping(uint256 splitId => mapping(uint256 roundId => Round)) private _rounds;
    mapping(uint256 splitId => mapping(uint256 roundId => mapping(address holder => bool))) public hasClaimed;

    constructor(RuleRegistry registry_, address treasury) {
        // The cap is a property of the code, not a setting.
        assert(PROTOCOL_FEE_BPS <= MAX_PROTOCOL_FEE_BPS);
        registry = registry_;
        TREASURY = treasury;
    }

    /// Creates a split. Everything stored here is fixed for the split's life (PLAN 11.3 rule 1).
    /// `refTargets` are the circuits the decision circuit calls by REF (for split-v1 on X Layer:
    /// circuits 3 to 7); their netlist hashes are pinned with the decision's and the fee's.
    function createSplit(
        uint256 ruleId,
        CircuitRef calldata fee,
        CircuitRef[] calldata refTargets,
        address shareToken,
        address payToken,
        uint64 claimWindow
    ) external returns (uint256 splitId) {
        if (claimWindow == 0) revert ZeroClaimWindow();
        if (!_isShareHistory(shareToken)) revert NotShareHistory(shareToken);
        uint8 dec = IERC20Metadata(payToken).decimals();
        if (dec < 2 || dec > 38) revert PayTokenDecimals(dec);

        splitId = ++splitCount;
        _pinCircuits(splitId, ruleId, fee, refTargets);
        Split storage s = _splits[splitId];
        s.ruleId = ruleId;
        s.operator = msg.sender;
        s.shareToken = IShareHistory(shareToken);
        s.payToken = IERC20(payToken);
        s.unit = 10 ** (dec - 2);
        s.claimWindow = claimWindow;
        emit SplitCreated(splitId, ruleId, msg.sender, shareToken, payToken, fee, claimWindow);
    }

    /// Opens a round with `deposit` vault units pulled from the caller (anyone may open a round
    /// on any split). The snapshot is the previous block, so nobody can move shares into the
    /// snapshot in the same transaction. The pot is the deposit plus as much of the split's
    /// carry as fits in 32 bits.
    function openRound(uint256 splitId, uint32 deposit) external nonReentrant returns (uint256 roundId) {
        Split storage s = _split(splitId);
        if (deposit == 0) revert ZeroDeposit();
        _checkPinned(splitId);

        roundId = ++s.roundCount;
        Round storage r = _rounds[splitId][roundId];
        r.pot = _takeCarry(s, deposit);
        r.snapshotBlock = uint64(block.number - 1);
        r.totalShares = _totalAt(s, r.snapshotBlock);
        (r.fee, r.protocolFee) = _fees(splitId, deposit);
        r.deadline = uint64(block.timestamp) + s.claimWindow;

        _pull(s, msg.sender, deposit);
        if (r.fee > 0) s.payToken.safeTransfer(s.operator, uint256(r.fee) * s.unit);
        if (r.protocolFee > 0) s.payToken.safeTransfer(TREASURY, uint256(r.protocolFee) * s.unit);
        _emitOpened(splitId, roundId, deposit, r);
    }

    function claim(uint256 splitId, uint256 roundId, uint32 payout) external nonReentrant {
        _claim(splitId, roundId, msg.sender, payout);
    }

    /// Anyone may claim for a holder; the payout always goes to the holder.
    function claimFor(uint256 splitId, uint256 roundId, address holder, uint32 payout) external nonReentrant {
        _claim(splitId, roundId, holder, payout);
    }

    /// After the claim window, moves what the round did not pay into the split's carry.
    function rollOver(uint256 splitId, uint256 roundId) external nonReentrant {
        Split storage s = _split(splitId);
        Round storage r = _round(splitId, roundId);
        if (block.timestamp <= r.deadline) revert ClaimWindowOpen(r.deadline);
        if (r.rolledOver) revert AlreadyRolledOver();
        r.rolledOver = true;
        // Everything the round set aside for holders and did not pay: unclaimed payouts, the
        // part of the pot the rule does not give holders (less the fees), and rounding. The fees were paid at open and are not in it.
        uint256 left = _leftForHolders(r);
        s.carry += left;
        emit RolledOver(splitId, roundId, left);
    }

    // ---- views ----

    function split(uint256 splitId) external view returns (Split memory) {
        return _split(splitId);
    }

    function round(uint256 splitId, uint256 roundId) external view returns (Round memory) {
        return _round(splitId, roundId);
    }

    function pinned(uint256 splitId) external view returns (Pinned[] memory) {
        _split(splitId);
        return _pinned[splitId];
    }

    /// The circuit inputs a claim would send, for apps that run the circuit themselves first.
    function claimInputs(uint32 pot, uint32 shares, uint32 total, uint32 payout) public pure returns (bytes memory b) {
        b = new bytes(DECISION_N_IN / 8);
        b.put(0, 32, pot);
        b.put(32, 32, shares);
        b.put(64, 32, total);
        b.put(96, 32, payout);
    }

    // ---- internals ----

    /// Checks the rule's decision circuit and the fee circuit have split-v1's shapes, and pins
    /// the netlist hash of each, and of each REF target, for the split's life.
    function _pinCircuits(uint256 splitId, uint256 ruleId, CircuitRef calldata fee, CircuitRef[] calldata refTargets) private {
        RuleRegistry.Rule memory r = registry.rule(ruleId);
        _requireShape(r.decision, DECISION_N_IN, DECISION_N_OUT);
        _requireShape(fee, FEE_N_IN, FEE_N_OUT);
        bytes32 decisionHash = keccak256(ICircuits(r.decision.cpu).netlist(r.decision.id));
        if (decisionHash != r.decisionNetlistHash) revert RuleCircuitChanged(ruleId);
        Pinned[] storage p = _pinned[splitId];
        p.push(Pinned(r.decision.cpu, r.decision.id, decisionHash));
        _pin(p, fee);
        for (uint256 i = 0; i < refTargets.length; i++) {
            _pin(p, refTargets[i]);
        }
    }

    function _pin(Pinned[] storage p, CircuitRef calldata c) private {
        p.push(Pinned(c.cpu, c.id, keccak256(ICircuits(c.cpu).netlist(c.id))));
    }

    /// The round's pot: the deposit plus as much of the carry as keeps it within 32 bits.
    function _takeCarry(Split storage s, uint32 deposit) private returns (uint32) {
        uint256 room = type(uint32).max - uint256(deposit);
        uint256 fromCarry = s.carry < room ? s.carry : room;
        s.carry -= fromCarry;
        return uint32(uint256(deposit) + fromCarry);
    }

    function _totalAt(Split storage s, uint64 snapshot) private view returns (uint32) {
        uint256 total = s.shareToken.totalSupplyAt(snapshot);
        if (total == 0) revert NoShares();
        if (total > type(uint32).max) revert AmountTooLarge(total);
        return uint32(total);
    }

    /// The operator's fee from the split's fee circuit, and the protocol fee, both on the
    /// deposit only (never on the carry).
    function _fees(uint256 splitId, uint32 deposit) private view returns (uint32 fee, uint32 protocolFee) {
        Pinned storage f = _pinned[splitId][1];
        bytes memory feeIn = new bytes(FEE_N_IN / 8);
        feeIn.put(0, 32, deposit);
        uint256 fee256 = ICircuits(f.cpu).eval(f.id, feeIn).get(0, 32);
        uint256 protocol256 = (uint256(deposit) * PROTOCOL_FEE_BPS) / 10_000;
        if (fee256 + protocol256 > deposit) revert FeeExceedsDeposit(fee256 + protocol256, deposit);
        return (uint32(fee256), uint32(protocol256));
    }

    function _emitOpened(uint256 splitId, uint256 roundId, uint32 deposit, Round storage r) private {
        emit RoundOpened(splitId, roundId, deposit, r.pot, r.fee, r.protocolFee, r.snapshotBlock, r.totalShares, r.deadline);
    }

    function _claim(uint256 splitId, uint256 roundId, address holder, uint32 payout) private {
        Split storage s = _split(splitId);
        Round storage r = _round(splitId, roundId);
        if (block.timestamp > r.deadline) revert ClaimWindowClosed(r.deadline);
        if (hasClaimed[splitId][roundId][holder]) revert AlreadyClaimed(holder);
        uint256 shares = s.shareToken.balanceOfAt(holder, r.snapshotBlock);
        if (shares == 0) revert HolderHasNoShares(holder);
        // shares <= totalShares < 2^32 for an honest token; the circuit also requires it.
        if (shares > type(uint32).max) revert AmountTooLarge(shares);

        _checkPinned(splitId);
        Pinned storage d = _pinned[splitId][0];
        bytes memory out = ICircuits(d.cpu).eval(d.id, claimInputs(r.pot, uint32(shares), r.totalShares, payout));
        if (!out.bit(0)) revert PayoutRejected(payout);
        // Defence in depth: whatever a circuit says, a round never pays holders more than the
        // pot left after fees.
        uint256 left = _leftForHolders(r);
        if (payout > left) revert RoundExhausted(left, payout);

        hasClaimed[splitId][roundId][holder] = true;
        r.claimed += payout;
        if (payout > 0) s.payToken.safeTransfer(holder, uint256(payout) * s.unit);
        emit Claimed(splitId, roundId, holder, uint32(shares), payout, msg.sender);
    }

    /// The most the round can pay holders: the pot less the fees taken at open.
    function _holderCap(Round storage r) private view returns (uint256) {
        return uint256(r.pot) - uint256(r.fee) - uint256(r.protocolFee);
    }

    function _leftForHolders(Round storage r) private view returns (uint256) {
        return _holderCap(r) - r.claimed;
    }

    function _pull(Split storage s, address from, uint32 amount) private {
        uint256 want = uint256(amount) * s.unit;
        uint256 before = s.payToken.balanceOf(address(this));
        s.payToken.safeTransferFrom(from, address(this), want);
        uint256 got = s.payToken.balanceOf(address(this)) - before;
        if (got != want) revert TransferAmountMismatch(want, got);
    }

    function _checkPinned(uint256 splitId) private view {
        Pinned[] storage p = _pinned[splitId];
        for (uint256 i = 0; i < p.length; i++) {
            if (keccak256(ICircuits(p[i].cpu).netlist(p[i].id)) != p[i].netlistHash) revert CircuitChanged(p[i].cpu, p[i].id);
        }
    }

    function _requireShape(CircuitRef memory c, uint32 nIn, uint32 nOut) private view {
        (uint32 gotIn, uint32 gotOut,,) = ICircuits(c.cpu).circuitInfo(c.id);
        if (gotIn != nIn || gotOut != nOut) revert WrongCircuitShape(c.id, gotIn, gotOut);
    }

    function _isShareHistory(address token) private view returns (bool) {
        if (token.code.length == 0) return false;
        try IERC165(token).supportsInterface(type(IShareHistory).interfaceId) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    function _split(uint256 splitId) private view returns (Split storage s) {
        if (splitId == 0 || splitId > splitCount) revert NoSuchSplit(splitId);
        s = _splits[splitId];
    }

    function _round(uint256 splitId, uint256 roundId) private view returns (Round storage r) {
        if (roundId == 0 || roundId > _splits[splitId].roundCount) revert NoSuchRound(splitId, roundId);
        r = _rounds[splitId][roundId];
    }
}
