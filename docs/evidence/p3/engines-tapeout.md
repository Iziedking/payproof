# Simulated engine tape-outs on X Layer (2026-11-24)

The owner signed both tape-outs with `chain/script/TapeOut.s.sol` from the netlists in
`chain/netlists/engines/`. Each was checked afterwards with
`node scripts/p2/tapeout-plan.mts landed` (tasks `p3-landed-cn_vendor_a2` and
`p3-landed-cn_vendor_b` on karwan-test, read-only): receipt status, the circuit id from the
Transfer log, and `circuitInfo` against the file.

| Engine | Circuit id | Transaction | Block | Gas used | Gates on chain | Netlist keccak |
| --- | --- | --- | --- | --- | --- | --- |
| Simulated engine A (`cn_vendor_a2`) | 15 | `0xc228357efbdb3e163ad1c6f413af28ec9e16624b090944f3427572fb8f74aa7f` | 76786961 | 10,671,689 | 3,642 | `0xef19f8b6110fd22db6294adf1ea0e00f14c1498007b5ca0251b1ecf01b7ba9d1` |
| Simulated engine B (`cn_vendor_b`) | 16 | `0xd4e76463bb21d721587c988535a90fd33f174e927812aecaa9824f7d95e89cb9` | 76787063 | 11,087,019 | 3,787 | `0x2b8f72f8812b54103cd373b262de69f498c99a54498025848296c015420bb9f3` |

Both at a gas price of 20,000,001 wei, each with the 0.0013 OKB tape-out fee. Gas used on X
Layer equals the fork rehearsal (`engines-forge-dryrun/summary.md`) to the unit. The ids are in
`chain/netlists/engines/ids.json`. Circuits contract
`0x1900801e311184063b9d9c119c9d98aa4950e12c`.
