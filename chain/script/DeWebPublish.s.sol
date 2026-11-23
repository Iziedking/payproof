// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Publish the Payproof app to DeWEB from one circuit's container, signed by the owner.
//
// It opens the circuit's container (once, 0.08 OKB), writes every file listed in
// site/manifest.json to SiteRegistry (index.html last, so the page appears only once its assets
// exist) and binds the on-chain name <#ID>.2.425.tape for <months> months. Each file is read from
// disk and its SHA-256 checked against the manifest before anything is sent. Steps already done
// on chain are skipped, so a run that stops half way can be run again and carries on. Run it from
// chain/:
//
//   forge script script/DeWebPublish.s.sol --sig "run(uint256,uint256)" <#ID> <months> \
//     --rpc-url https://xlayerrpc.okx.com --chain 196 --sender <deployer> \
//     --account payproof-deployer --legacy --with-gas-price <wei> --slow
//
// Without --broadcast forge only simulates. Add --broadcast to send.
//
// Sources:
// - Vm cheatcodes readFile, readFileBinary, parseJsonStringArray, parseJsonBytes32Array,
//   parseJsonUintArray, startBroadcast, stopBroadcast: forge-std src/Vm.sol at
//   15b2df92a05d4d2f76a06653872fefb287e0e01c (2026-11-12, read 2026-11-23).
// - SiteRegistry putFile / appendChunk / fileInfo, DomainBinding bind / isLive / monthlyFee,
//   opener accountOf / isOpened: TapeOutProtocol/TAPs@527477ecb7cf TAP-10 Appendix A
//   (fileInfo returns size, contentType, sha256Hash, updatedAt, chunkCount; a file has at most
//   350 chunks; putFile replaces an existing file; appendChunk needs expectIndex == chunkCount).
// - opener open(address,uint256) payable and FEE(): the opener's X Layer bytecode, selectors
//   resolved 2026-11-23 (docs/evidence/p2/deweb.md "Opening a container").
// - Processor number 425: scripts/p2/deweb-read.mts, X Layer block 76,655,585.
// No forge-std import, so nothing is downloaded.

interface Vm {
    function readFile(string calldata path) external view returns (string memory data);
    function readFileBinary(string calldata path) external view returns (bytes memory data);
    function parseJsonStringArray(string calldata json, string calldata key) external pure returns (string[] memory);
    function parseJsonBytes32Array(string calldata json, string calldata key) external pure returns (bytes32[] memory);
    function parseJsonUintArray(string calldata json, string calldata key) external pure returns (uint256[] memory);
    function startBroadcast() external;
    function stopBroadcast() external;
}

interface Opener {
    function FEE() external view returns (uint256);
    function open(address circuits, uint256 tokenId) external payable;
    function accountOf(address circuits, uint256 tokenId) external view returns (address);
    function isOpened(address circuits, uint256 tokenId) external view returns (bool);
}

interface SiteRegistry {
    function fileInfo(address container, string calldata path)
        external
        view
        returns (uint32 size, string memory contentType, bytes32 sha256Hash, uint40 updatedAt, uint256 chunkCount);
    function putFile(address container, string calldata path, string calldata contentType, bytes32 sha256Hash, bytes calldata data) external;
    function appendChunk(address container, string calldata path, uint256 expectIndex, bytes calldata data) external;
}

interface DomainBinding {
    function monthlyFee() external view returns (uint256);
    function isLive(string calldata name, address container) external view returns (bool);
    function bind(string calldata name, address container, uint256 months) external payable;
}

contract DeWebPublish {
    /// Marker forge uses to identify script contracts (forge-std Script.sol).
    bool public IS_SCRIPT = true;

    Vm internal constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    address internal constant CIRCUITS = 0x1900801e311184063b9d9C119C9D98AA4950E12c;
    Opener internal constant OPENER = Opener(0x536adD8F30f03b69f6fbF29d425A816A0dC50106);
    SiteRegistry internal constant SITES = SiteRegistry(0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6);
    DomainBinding internal constant DOMAIN = DomainBinding(0x68809Fd2fb343aA57D0aeB7f33Defe477c9666f9);
    uint256 internal constant CHAIN_ID = 196;
    uint256 internal constant EXPECTED_OPEN_FEE = 80_000_000_000_000_000; // 0.08 OKB, read 2026-11-23
    uint256 internal constant EXPECTED_MONTHLY_FEE = 0; // read 2026-11-23, block 76,655,585
    uint256 internal constant CHUNK = 24_000;
    uint256 internal constant MAX_CHUNKS = 350;
    string internal constant MANIFEST = "site/manifest.json";

    struct Site {
        string[] paths;
        string[] types;
        bytes32[] shas;
        bytes[] data;
    }

    function run(uint256 id, uint256 months) external {
        require(block.chainid == CHAIN_ID, "not X Layer (chain 196)");
        require(months >= 1 && months <= 120, "months must be 1 to 120");
        uint256 openFee = OPENER.FEE();
        require(openFee == EXPECTED_OPEN_FEE, "opening fee changed: stop and check");
        uint256 monthly = DOMAIN.monthlyFee();
        require(monthly == EXPECTED_MONTHLY_FEE, "monthly fee changed: stop and check");

        Site memory site = load(); // every file read and checked before anything is sent
        address container = OPENER.accountOf(CIRCUITS, id);
        string memory name = string.concat(decimal(id), ".2.425.tape");

        vm.startBroadcast();
        if (!OPENER.isOpened(CIRCUITS, id)) OPENER.open{value: openFee}(CIRCUITS, id);
        for (uint256 i = 0; i < site.paths.length; i++) {
            writeFile(container, site.paths[i], site.types[i], site.shas[i], site.data[i]);
        }
        if (!DOMAIN.isLive(name, container)) DOMAIN.bind{value: monthly * months}(name, container, months);
        vm.stopBroadcast();
    }

    /// Reads the manifest and every file it lists, and checks sizes, SHA-256 and order.
    function load() internal view returns (Site memory site) {
        string memory json = vm.readFile(MANIFEST);
        site.paths = vm.parseJsonStringArray(json, ".paths");
        site.types = vm.parseJsonStringArray(json, ".types");
        site.shas = vm.parseJsonBytes32Array(json, ".sha256");
        uint256[] memory sizes = vm.parseJsonUintArray(json, ".sizes");
        uint256 n = site.paths.length;
        require(n > 0 && site.types.length == n && site.shas.length == n && sizes.length == n, "manifest lists differ in length");
        require(keccak256(bytes(site.paths[n - 1])) == keccak256("index.html"), "index.html must be the last file");
        site.data = new bytes[](n);
        for (uint256 i = 0; i < n; i++) {
            bytes memory d = vm.readFileBinary(string.concat("site/", site.paths[i]));
            require(d.length == sizes[i], string.concat("size differs from the manifest: ", site.paths[i]));
            require(sha256(d) == site.shas[i], string.concat("SHA-256 differs from the manifest: ", site.paths[i]));
            require(d.length > 0 && chunks(d.length) <= MAX_CHUNKS, string.concat("file size out of range: ", site.paths[i]));
            site.data[i] = d;
        }
    }

    /// Writes one file, or the chunks still missing when an earlier run stopped part way.
    function writeFile(address container, string memory path, string memory contentType, bytes32 sha, bytes memory file) internal {
        uint256 total = chunks(file.length);
        uint256 have = chunksOnChain(container, path, sha, file.length, total);
        if (have == total) return; // already complete
        if (have == 0) {
            SITES.putFile(container, path, contentType, sha, slice(file, 0));
            have = 1;
        }
        for (uint256 k = have; k < total; k++) SITES.appendChunk(container, path, k, slice(file, k));
    }

    /// How many chunks of this exact file are already on chain: 0 when the file is missing or
    /// differs (it is then written again from the start), `total` when it is complete.
    function chunksOnChain(address container, string memory path, bytes32 sha, uint256 len, uint256 total)
        internal
        view
        returns (uint256)
    {
        (uint32 size, , bytes32 onChainSha, , uint256 have) = SITES.fileInfo(container, path);
        if (have == 0 || onChainSha != sha || have > total || size > len) return 0;
        if (have == total && size != len) return 0;
        return have;
    }

    function chunks(uint256 len) internal pure returns (uint256) {
        return (len + CHUNK - 1) / CHUNK;
    }

    function slice(bytes memory file, uint256 k) internal pure returns (bytes memory out) {
        uint256 from = k * CHUNK;
        uint256 to = from + CHUNK < file.length ? from + CHUNK : file.length;
        out = new bytes(to - from);
        for (uint256 i = 0; i < out.length; i++) out[i] = file[from + i];
    }

    function decimal(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 len;
        for (uint256 t = v; t != 0; t /= 10) len++;
        bytes memory b = new bytes(len);
        for (; v != 0; v /= 10) b[--len] = bytes1(uint8(48 + (v % 10)));
        return string(b);
    }
}
