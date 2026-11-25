#!/usr/bin/env bash
# P4: synthesise the split-v1 fee circuit (rules/split-v1/fee.v) to NAND with the same flow as
# every Payproof circuit (scripts/p0/synth-all.sh), then compile and prove it
# (scripts/p4/fee-prepare.mts). Runs from the workdir root on the test host, through the
# resource hook, with OSS_CAD_SUITE set.
set -euo pipefail
Y="$OSS_CAD_SUITE/bin/yosys"
mkdir -p out/fee logs
"$Y" -V
"$Y" -q -l logs/synth-split_fee.log -p "
  read_verilog rules/split-v1/fee.v;
  synth -flatten -top split_fee -noabc;
  abc -g NAND; opt_clean -purge;
  tee -o out/fee/split_fee.stat.txt stat;
  write_json out/fee/split_fee.json"
echo "split_fee: $(awk '/\$_NAND_/ {n=$1} /\$_NOT_/ {t=$1} END {print n+0 " NAND + " t+0 " NOT"}' out/fee/split_fee.stat.txt)"
node scripts/p4/fee-prepare.mts out/fee/split_fee.json chain/netlists/fee "${1:-900}"
