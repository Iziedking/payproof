// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CircuitRef, ICircuits} from "./Circuits.sol";

/// Rules and what has been said about them (PLAN 11.3).
///
/// A rule is a decision circuit, an optional validity circuit (cpu = address(0) when the rule
/// has none) and the number of decision bits two engines must agree on. Each rule also records
/// the keccak-256 of its circuits' netlists at registration, so anyone can see if a processor
/// later serves different bytes. Nothing about a rule can change after it is registered.
///
/// Proof attestations and endorsements are events only (PLAN L16): the contract stores nothing
/// for them and judges nothing. A reader decides whose attestations to trust by the sender.
///
/// Funds: this contract holds no tokens and no native currency, and has no payable function.
contract RuleRegistry {
    struct Rule {
        CircuitRef decision;
        CircuitRef validity;
        uint32 decisionBits;
        uint32 nIn;
        address author;
        bytes32 decisionNetlistHash;
        bytes32 validityNetlistHash;
        string uri;
    }

    error NoSuchRule(uint256 ruleId);
    error BadDecisionBits(uint32 decisionBits, uint32 nOut);
    error ValidityShapeMismatch(uint32 validityNIn, uint32 decisionNIn);
    error BadStatus(uint8 status);
    error EmptyCircuit(address cpu, uint64 id);

    event RuleRegistered(
        uint256 indexed ruleId,
        address indexed author,
        CircuitRef decision,
        CircuitRef validity,
        uint32 decisionBits,
        bytes32 decisionNetlistHash,
        string uri
    );
    /// status: 0 holds, 1 fails, 2 undecided (the prover's three results).
    event ProofAttested(
        uint256 indexed ruleId,
        address indexed attester,
        CircuitRef subject,
        bytes32 indexed factId,
        uint8 status,
        bytes32 recordHash,
        string uri
    );
    event Endorsed(uint256 indexed ruleId, address indexed endorser, string note);

    uint256 public ruleCount;
    mapping(uint256 ruleId => Rule) private _rules;

    function registerRule(
        CircuitRef calldata decision,
        CircuitRef calldata validity,
        uint32 decisionBits,
        string calldata uri
    ) external returns (uint256 ruleId) {
        (uint32 nIn, uint32 nOut,,) = ICircuits(decision.cpu).circuitInfo(decision.id);
        if (nIn == 0 || nOut == 0) revert EmptyCircuit(decision.cpu, decision.id);
        if (decisionBits == 0 || decisionBits > nOut) revert BadDecisionBits(decisionBits, nOut);
        bytes32 validityHash;
        if (validity.cpu != address(0)) {
            (uint32 vIn, uint32 vOut,,) = ICircuits(validity.cpu).circuitInfo(validity.id);
            if (vIn != nIn || vOut == 0) revert ValidityShapeMismatch(vIn, nIn);
            validityHash = keccak256(ICircuits(validity.cpu).netlist(validity.id));
        }
        bytes32 decisionHash = keccak256(ICircuits(decision.cpu).netlist(decision.id));
        ruleId = ++ruleCount;
        _rules[ruleId] = Rule(decision, validity, decisionBits, nIn, msg.sender, decisionHash, validityHash, uri);
        emit RuleRegistered(ruleId, msg.sender, decision, validity, decisionBits, decisionHash, uri);
    }

    function attestProof(
        uint256 ruleId,
        CircuitRef calldata subject,
        bytes32 factId,
        uint8 status,
        bytes32 recordHash,
        string calldata uri
    ) external {
        _exists(ruleId);
        if (status > 2) revert BadStatus(status);
        emit ProofAttested(ruleId, msg.sender, subject, factId, status, recordHash, uri);
    }

    function endorse(uint256 ruleId, string calldata note) external {
        _exists(ruleId);
        emit Endorsed(ruleId, msg.sender, note);
    }

    function rule(uint256 ruleId) external view returns (Rule memory) {
        _exists(ruleId);
        return _rules[ruleId];
    }

    function _exists(uint256 ruleId) private view {
        if (ruleId == 0 || ruleId > ruleCount) revert NoSuchRule(ruleId);
    }
}
