// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// One tape-out of one TAP-02 netlist to the Payproof circuits contract, signed by the owner.
//
// The netlist is read from a file, so its size is not limited by the command line (cast send
// takes calldata only on the command line, and Windows stops at 32,767 characters). The script
// holds no key. Run it from chain/:
//
//   forge script script/TapeOut.s.sol --sig "run(string,uint32,uint32,bytes32)" \
//     netlists/<piece>.bin <nIn> <nOut> <keccak256 from netlists/manifest.json> \
//     --rpc-url https://xlayerrpc.okx.com --chain 196 --sender <deployer> \
//     --account payproof-deployer --slow
//
// Without --broadcast forge only simulates. Add --broadcast to send.
//
// Sources: cheatcode address and readFileBinary from forge-std src/Base.sol and src/Vm.sol
// (read 2026-11-22); IS_SCRIPT from forge-std src/Script.sol; startBroadcast/stopBroadcast from
// getfoundry.sh/cheatcodes; tapeout(bytes,uint32,uint32) and TAPEOUT_FEE() as used for the P0
// tape-outs (scripts/p0/tx/print-tx.mjs). No forge-std import, so nothing is downloaded.

interface Vm {
    function readFileBinary(string calldata path) external view returns (bytes memory data);
    function startBroadcast() external;
    function stopBroadcast() external;
}

interface Circuits {
    function TAPEOUT_FEE() external view returns (uint256);
    function tapeout(bytes calldata netlist, uint32 nIn, uint32 nOut) external payable;
}

contract TapeOut {
    /// Marker forge uses to identify script contracts (forge-std Script.sol).
    bool public IS_SCRIPT = true;

    Vm internal constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    Circuits internal constant CIRCUITS = Circuits(0x1900801e311184063b9d9C119C9D98AA4950E12c);
    uint256 internal constant CHAIN_ID = 196;
    uint256 internal constant EXPECTED_FEE = 1_300_000_000_000_000; // 0.0013 OKB, read 2026-11-17
    uint256 internal constant MAX_NETLIST = 131_072; // refuse anything larger than planned

    function run(string calldata path, uint32 nIn, uint32 nOut, bytes32 expectedKeccak) external {
        require(block.chainid == CHAIN_ID, "not X Layer (chain 196)");
        bytes memory netlist = vm.readFileBinary(path);
        require(netlist.length > 0 && netlist.length <= MAX_NETLIST, "netlist size out of range");
        require(keccak256(netlist) == expectedKeccak, "netlist hash differs from the manifest");
        uint256 fee = CIRCUITS.TAPEOUT_FEE();
        require(fee == EXPECTED_FEE, "tape-out fee changed: stop and check");

        vm.startBroadcast();
        CIRCUITS.tapeout{value: fee}(netlist, nIn, nOut);
        vm.stopBroadcast();
    }
}
