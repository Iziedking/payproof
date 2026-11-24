# SIMULATION: engine tape-outs on an anvil fork of X Layer (2026-11-24)

Task `p3-engines-forge-dryrun` (`scripts/p3/engines-forge-dryrun.sh`) on karwan-test. anvil
1.8.6 forked the public X Layer RPC; the deployer
`0x5c807eA36fC11a72192d83ecff2b3D4746767612` was impersonated on the fork only, with its real
balance. Each engine was taped out with the owner's path, `chain/script/TapeOut.s.sol` through
`forge script ... --broadcast`, at the live gas price, 20,000,001 wei (0.020000001 gwei), with
forge's own gas limits. Nothing was sent to X Layer itself.

The netlists are the ones in `chain/netlists/engines/` from task `p3-engines-build`
(`docs/evidence/p3/engines-precheck/run5-tapeout-build.txt`).

| Engine | Netlist keccak | Fork block | Gas used | Gas cost (OKB) | Tape-out fee (OKB) | Total (OKB) |
| --- | --- | --- | --- | --- | --- | --- |
| `cn_vendor_a2`, simulated engine A | `0xef19f8b6110fd22db6294adf1ea0e00f14c1498007b5ca0251b1ecf01b7ba9d1` | 76778182 | 10,671,689 | 0.000213434 | 0.0013 | 0.001513434 |
| `cn_vendor_b`, simulated engine B | `0x2b8f72f8812b54103cd373b262de69f498c99a54498025848296c015420bb9f3` | 76778183 | 11,087,019 | 0.000221740 | 0.0013 | 0.001521740 |

Both landed; the fork gave them circuit ids 15 and 16 (`fork-ids.json`). Those are fork ids
only. The real ids are whatever X Layer assigns when the owner signs.

Deployer balance on the fork: 0.014962866 OKB at the start, 0.011927692 OKB at the end, a
difference of 0.003035174 OKB, which is the two totals above. The balance before engine B minus
its total equals the end balance to the wei.

Gas figures are from `anvil.log` (the receipts) and from `tapeout-plan.mts landed` for engine B.
Cost figures are worked out from those at the stated gas price; the gas price on X Layer can
differ when the owner signs.
