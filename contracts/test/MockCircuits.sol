// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ICircuits} from "../src/Circuits.sol";

/// Stand-in for a TapeOut circuits contract in unit tests. Each id computes one of Payproof's
/// formulas in Solidity, with the same bit layout as the real circuit. The fork test runs the
/// real circuits on X Layer instead.
contract MockCircuits is ICircuits {
    enum Kind {
        None,
        SplitCheck, // rules/split-v1: in pot, shares, total, payout (32 bits each); out ok
        SplitValidity, // out valid = total != 0 && shares <= total
        Fee10, // rules/split-v1/fee.v: in pot (32); out pot / 10 (32)
        CnRule, // circuit 9: in bonus (32); out tax, net (32 each), floor to the fen
        CnEngineB // rules/sim-engines/cn_vendor_b.v: rounds half up
    }

    struct C {
        Kind kind;
        uint32 nIn;
        uint32 nOut;
        bytes netlist;
        bool broken; // eval reverts
    }

    mapping(uint256 => C) public circuits;

    function set(uint256 id, Kind kind, uint32 nIn, uint32 nOut, bytes memory nl) public {
        circuits[id] = C(kind, nIn, nOut, nl, false);
    }

    function setNetlist(uint256 id, bytes memory nl) external {
        circuits[id].netlist = nl;
    }

    function setBroken(uint256 id, bool b) external {
        circuits[id].broken = b;
    }

    function circuitInfo(uint256 id) external view returns (uint32, uint32, uint32, uint32) {
        C storage c = circuits[id];
        return (c.nIn, c.nOut, 0, uint32(c.netlist.length / 7));
    }

    function netlist(uint256 id) external view returns (bytes memory) {
        return circuits[id].netlist;
    }

    function eval(uint256 id, bytes calldata input) external view returns (bytes memory out) {
        C storage c = circuits[id];
        require(!c.broken, "mock: broken");
        require(input.length == (c.nIn + 7) / 8, "mock: input length");
        out = new bytes((c.nOut + 7) / 8);
        if (c.kind == Kind.SplitCheck) {
            (uint256 pot, uint256 shares, uint256 total, uint256 payout) = (rd(input, 0), rd(input, 4), rd(input, 8), rd(input, 12));
            bool ok = total != 0 && shares <= total && payout * total * 10_000 <= pot * shares * 8500
                && pot * shares * 8500 < (payout + 1) * total * 10_000;
            out[0] = ok ? bytes1(0x01) : bytes1(0x00);
        } else if (c.kind == Kind.SplitValidity) {
            (uint256 shares, uint256 total) = (rd(input, 4), rd(input, 8));
            out[0] = (total != 0 && shares <= total) ? bytes1(0x01) : bytes1(0x00);
        } else if (c.kind == Kind.Fee10) {
            wr(out, 0, rd(input, 0) / 10);
        } else if (c.kind == Kind.CnRule || c.kind == Kind.CnEngineB) {
            uint256 b = rd(input, 0);
            (uint256 rate, uint256 qd) = cnBracket(b);
            uint256 prod = b * rate;
            uint256 gross = c.kind == Kind.CnRule ? prod / 100 : (prod + 50) / 100;
            uint32 tax;
            uint32 net;
            unchecked {
                tax = uint32(gross) - uint32(qd);
                net = uint32(b) - tax;
            }
            wr(out, 0, tax);
            wr(out, 4, net);
        }
    }

    function cnBracket(uint256 b) public pure returns (uint256 rate, uint256 qd) {
        if (b <= 3_600_000) return (3, 0);
        if (b <= 14_400_000) return (10, 21_000);
        if (b <= 30_000_000) return (20, 141_000);
        if (b <= 42_000_000) return (25, 266_000);
        if (b <= 66_000_000) return (30, 441_000);
        if (b <= 96_000_000) return (35, 716_000);
        return (45, 1_516_000);
    }

    function rd(bytes calldata b, uint256 at) private pure returns (uint256 v) {
        for (uint256 i = 0; i < 4; i++) v |= uint256(uint8(b[at + i])) << (8 * i);
    }

    function wr(bytes memory b, uint256 at, uint256 v) private pure {
        for (uint256 i = 0; i < 4; i++) b[at + i] = bytes1(uint8(v >> (8 * i)));
    }
}

/// A plain ERC-20 with 18 decimals, and one that keeps 1% of each transfer.
contract MockToken {
    string public name = "Mock";
    string public symbol = "MOCK";
    uint8 public decimals;
    uint256 public totalSupply;
    uint256 public skimBps;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(uint8 decimals_, uint256 skimBps_) {
        decimals = decimals_;
        skimBps = skimBps_;
    }

    function mint(address to, uint256 v) external {
        balanceOf[to] += v;
        totalSupply += v;
    }

    function approve(address s, uint256 v) external returns (bool) {
        allowance[msg.sender][s] = v;
        return true;
    }

    function transfer(address to, uint256 v) external returns (bool) {
        _move(msg.sender, to, v);
        return true;
    }

    function transferFrom(address f, address to, uint256 v) external returns (bool) {
        allowance[f][msg.sender] -= v;
        _move(f, to, v);
        return true;
    }

    function _move(address f, address to, uint256 v) private {
        balanceOf[f] -= v;
        uint256 skim = (v * skimBps) / 10_000;
        balanceOf[to] += v - skim;
        totalSupply -= skim;
    }
}
