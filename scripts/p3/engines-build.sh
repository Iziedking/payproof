#!/usr/bin/env bash
# P3: synthesise the SIMULATED engines (rules/sim-engines) to NAND, as every Payproof circuit
# is (scripts/p0/synth-all.sh, flow read from the Yosys 0.70 help on the host 2026-11-17):
#   read_verilog; synth -flatten -top -noabc; abc -g NAND; opt_clean -purge; stat; write_json
# then compile them to TAP-02 netlists and pre-check them against circuit 9's netlist file
# (scripts/p3/engines-prepare.mts). Runs from the workdir root on the test host, through the
# resource hook, with OSS_CAD_SUITE set.
set -euo pipefail
Y="$OSS_CAD_SUITE/bin/yosys"
mkdir -p out/engines logs
"$Y" -V
# PAYPROOF_SYNTH limits synthesis to the engines named (space separated); the others' JSON must
# already be in out/engines from an earlier run.
for m in ${PAYPROOF_SYNTH:-cn_vendor_a cn_vendor_b cn_vendor_a2}; do
  "$Y" -q -l "logs/synth-$m.log" -p "
    read_verilog rules/sim-engines/$m.v;
    synth -flatten -top $m -noabc;
    abc -g NAND; opt_clean -purge;
    tee -o out/engines/$m.stat.txt stat;
    write_json out/engines/$m.json"
  echo "$m: $(awk '/\$_NAND_/ {n=$1} /\$_NOT_/ {t=$1} END {print n+0 " NAND + " t+0 " NOT"}' "out/engines/$m.stat.txt")"
done
node scripts/p3/engines-prepare.mts out/engines "${2:-chain/netlists/engines}" "${1:-900}"
