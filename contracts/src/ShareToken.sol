// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// What a split needs from a share token: each holder's balance and the total supply as they
/// were at the end of a past block. A split refuses a token that does not declare this through
/// ERC-165 (PLAN 11.3 rule 5).
interface IShareHistory {
    function balanceOfAt(address account, uint256 blockNumber) external view returns (uint256);
    function totalSupplyAt(uint256 blockNumber) external view returns (uint256);
}

/// Payproof's reference share token (owner decision D6, 2026-11-25).
///
/// Every share is minted once, in the constructor, to the holders named at deploy. There is no
/// minter, no owner and no burn, so the supply never changes after deploy. Shares are whole
/// numbers (0 decimals), because the split circuit counts shares as 32-bit whole numbers.
///
/// History: after every balance change the new balance of each side, and the total supply on a
/// mint, is written to a checkpoint keyed by the block number (OpenZeppelin Checkpoints.Trace208,
/// choice recorded in VERSIONS.md: not ERC20Votes, whose per-account history needs holders to
/// delegate). A past value is the one at the end of that block, and only blocks before the
/// current one can be read, the same rule as OpenZeppelin Votes.
///
/// Funds: this contract holds no tokens other than its own and has no function that moves
/// anyone's shares except the holder's own `transfer` and an allowed `transferFrom` (ERC-20).
contract ShareToken is ERC20, ERC165, IShareHistory {
    using Checkpoints for Checkpoints.Trace208;

    error FutureLookup(uint256 blockNumber, uint256 currentBlock);
    error LengthMismatch();

    mapping(address account => Checkpoints.Trace208) private _balanceHistory;
    Checkpoints.Trace208 private _supplyHistory;

    constructor(string memory name_, string memory symbol_, address[] memory holders, uint256[] memory amounts)
        ERC20(name_, symbol_)
    {
        if (holders.length != amounts.length) revert LengthMismatch();
        for (uint256 i = 0; i < holders.length; i++) {
            _mint(holders[i], amounts[i]);
        }
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function balanceOfAt(address account, uint256 blockNumber) external view returns (uint256) {
        return _balanceHistory[account].upperLookupRecent(_past(blockNumber));
    }

    function totalSupplyAt(uint256 blockNumber) external view returns (uint256) {
        return _supplyHistory.upperLookupRecent(_past(blockNumber));
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IShareHistory).interfaceId || super.supportsInterface(interfaceId);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        uint48 key = SafeCast.toUint48(block.number);
        if (from != address(0)) _balanceHistory[from].push(key, SafeCast.toUint208(balanceOf(from)));
        if (to != address(0)) _balanceHistory[to].push(key, SafeCast.toUint208(balanceOf(to)));
        if (from == address(0) || to == address(0)) _supplyHistory.push(key, SafeCast.toUint208(totalSupply()));
    }

    function _past(uint256 blockNumber) private view returns (uint48) {
        if (blockNumber >= block.number) revert FutureLookup(blockNumber, block.number);
        return SafeCast.toUint48(blockNumber);
    }
}
