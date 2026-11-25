// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// The TapeOut processor's circuits contract (TAP-02 section 6). Selectors checked against the
/// processor on X Layer (PLAN section 6): circuitInfo 0x084d60f1, netlist 0x3fc4be56,
/// eval 0x934d06ea.
interface ICircuits {
    function circuitInfo(uint256 id) external view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount);
    function netlist(uint256 id) external view returns (bytes memory);
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory);
}

/// A circuit on a processor: its circuits contract and its id.
struct CircuitRef {
    address cpu;
    uint64 id;
}

/// Circuit inputs and outputs are bit vectors packed least significant bit first (TAP-02); a
/// field is a little-endian number starting at a bit offset. Every field this code uses starts
/// on a byte boundary, so packing is by whole bytes.
library CircuitIO {
    error FieldOutOfRange(uint256 offsetBits, uint256 widthBits, uint256 length);

    /// Writes `value` as `widthBits / 8` little-endian bytes at `offsetBits / 8`.
    function put(bytes memory buf, uint256 offsetBits, uint256 widthBits, uint256 value) internal pure {
        if (offsetBits % 8 != 0 || widthBits % 8 != 0 || (offsetBits + widthBits) / 8 > buf.length) {
            revert FieldOutOfRange(offsetBits, widthBits, buf.length);
        }
        uint256 at = offsetBits / 8;
        for (uint256 i = 0; i < widthBits / 8; i++) {
            buf[at + i] = bytes1(uint8(value >> (8 * i)));
        }
    }

    /// Reads a little-endian field of `widthBits` (a multiple of 8) at `offsetBits`.
    function get(bytes memory buf, uint256 offsetBits, uint256 widthBits) internal pure returns (uint256 value) {
        if (offsetBits % 8 != 0 || widthBits % 8 != 0 || (offsetBits + widthBits) / 8 > buf.length) {
            revert FieldOutOfRange(offsetBits, widthBits, buf.length);
        }
        uint256 at = offsetBits / 8;
        for (uint256 i = 0; i < widthBits / 8; i++) {
            value |= uint256(uint8(buf[at + i])) << (8 * i);
        }
    }

    /// Bit `i` of an output vector.
    function bit(bytes memory buf, uint256 i) internal pure returns (bool) {
        if (i / 8 >= buf.length) revert FieldOutOfRange(i, 1, buf.length);
        return (uint8(buf[i / 8]) >> (i % 8)) & 1 == 1;
    }

    /// True when the first `nBits` bits of `a` and `b` are the same.
    function sameBits(bytes memory a, bytes memory b, uint256 nBits) internal pure returns (bool) {
        uint256 full = nBits / 8;
        if (a.length * 8 < nBits || b.length * 8 < nBits) revert FieldOutOfRange(0, nBits, a.length < b.length ? a.length : b.length);
        for (uint256 i = 0; i < full; i++) {
            if (a[i] != b[i]) return false;
        }
        uint256 rest = nBits % 8;
        if (rest == 0) return true;
        uint8 mask = uint8((1 << rest) - 1);
        return uint8(a[full]) & mask == uint8(b[full]) & mask;
    }
}
