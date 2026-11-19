#!/usr/bin/env bash
# P0: time the solvers on first-draft facts. Runs inside a capped container on
# node-services, in the throwaway workdir, after the NAND netlists from
# synth-all.sh have been copied to ./nets.
# Usage: bash prove-all.sh <timeout-seconds> <parallel-jobs> [job-name regex]
#
# Two engines per fact, on the same flattened miter:
#   1. Yosys `sat -prove bad 0 -timeout T` (MiniSat inside Yosys)
#   2. ABC `iprove` on the miter written as AIGER (combinational check that the
#      single output is constant 0), wall-clock limited with `timeout`.
# Both read the synthesised NAND netlists, not the RTL, as the proofs will at P3.
# Commands checked against the help text of the binaries used, 2026-11-17.
set -uo pipefail
T="${1:-900}"; J="${2:-2}"; SEL="${3:-.}"
O=oss-cad-suite/bin
mkdir -p proofs
jobs=proofs/jobs.txt; : > "$jobs"
# name|fact file|width|compute netlist|check netlist
# 8, 12 and 16 exist for the check circuit only (decision rule 2: the widest width the
# solver proves); jobs that name a missing netlist are never selected.
for w in 8 12 16 24 32 40; do
  for f in split_zero split_fee_fixed split_more_shares split_bigger_pot split_never_overpays split_one_unit_short split_splitting; do
    echo "$f-$w|facts/$f.v|$w|nets/split_compute_$w.nand.v|-" >> "$jobs"
  done
  for f in check_unique check_more_shares; do
    echo "$f-$w|facts/$f.v|$w|-|nets/split_check_$w.nand.v" >> "$jobs"
  done
  echo "check_matches_compute-$w|facts/check_matches_compute.v|$w|nets/split_compute_$w.nand.v|nets/split_check_$w.nand.v" >> "$jobs"
done
echo "cn_raise|facts/cn_raise.v|-|nets/cn_bonus.nand.v|-" >> "$jobs"
echo "ng_tax_within_income|facts/ng_tax_within_income.v|-|nets/ng_paye.nand.v|-" >> "$jobs"
echo "ng_mutant_equal|facts/ng_mutant_equal.v|-|nets/ng_paye.nand.v|nets/ng_paye_mutant19.nand.v" >> "$jobs"
grep -E "^($SEL)\|" "$jobs" > "$jobs.sel" || true

one() {
  IFS='|' read -r name fact w cnet knet <<< "$1"
  local d="proofs/$name"; mkdir -p "$d"
  local cmod kmod defs=""
  [ "$w" != "-" ] && defs="-DW=$w"
  local script="read_verilog $defs $fact;"
  if [ "$cnet" != "-" ]; then cmod=$(basename "$cnet" .nand.v); script="$script read_verilog $cnet; rename $cmod C;"; fi
  if [ "$knet" != "-" ]; then kmod=$(basename "$knet" .nand.v); script="$script read_verilog $knet; rename $kmod K;"; fi
  script="$script hierarchy -top fact; proc; flatten; opt_clean"
  printf '%s\n' "$script" > "$d/script.ys"

  local t0 t1 s
  t0=$(date +%s.%N)
  timeout --kill-after=10 $((T + 60)) $O/yosys -q -l "$d/sat.log" -p "$script; sat -prove bad 0 -timeout $T -show-inputs" > /dev/null 2>&1
  t1=$(date +%s.%N)
  if grep -q 'SUCCESS!' "$d/sat.log"; then s=holds
  elif grep -q 'FAIL!' "$d/sat.log"; then s=fails
  else s=undecided; fi
  echo "$name sat $s $(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.1f", b-a}')" > "$d/sat.result"

  $O/yosys -q -p "$script; techmap; opt -fast; aigmap; write_aiger -zinit $d/miter.aig" > "$d/aig.log" 2>&1
  t0=$(date +%s.%N)
  timeout --kill-after=10 "$T" $O/yosys-abc -c "read_aiger $d/miter.aig; print_stats; strash; iprove -v" > "$d/abc.log" 2>&1
  local rc=$?
  t1=$(date +%s.%N)
  # iprove ends with "UNSATISFIABLE" (output is always 0: holds) or
  # "SATISFIABLE (output = 0)" (an input sets it: fails). Calibrated 2026-11-17 on
  # cn_raise (fails), ng_mutant_equal (fails) and ng_tax_within_income (holds).
  if grep -q '^UNSATISFIABLE' "$d/abc.log"; then s=holds
  elif grep -q '^SATISFIABLE' "$d/abc.log"; then s=fails
  else s=undecided; fi
  [ $rc -eq 124 ] && s=undecided
  echo "$name abc $s $(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.1f", b-a}') rc=$rc" > "$d/abc.result"
  cat "$d/sat.result" "$d/abc.result"
}
export -f one; export T O
xargs -a "$jobs.sel" -P "$J" -I{} bash -c 'one "$@"' _ {}
cat proofs/*/sat.result proofs/*/abc.result | sort > proofs/summary.txt
cat proofs/summary.txt
