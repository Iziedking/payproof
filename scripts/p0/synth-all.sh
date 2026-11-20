#!/usr/bin/env bash
# P0: synthesise spike circuits to NAND and NOT gates and record the counts.
# Runs in the throwaway workdir on host-service after setup-yosys.sh.
# Usage: bash synth-all.sh <yosys-binary> <group>...
#   groups: wage | check | check-narrow | check-40 | compute-24 | compute-32 | compute-40 | mul-8
#           | check-mod-8 | check-mod-32
#
# Flow per circuit (Yosys 0.70 help pages read on the host, 2026-11-17):
#   read_verilog; chparam; synth -flatten -top -noabc; abc -g NAND; opt_clean -purge; stat
# `-noabc` skips synth's own ABC run, so ABC maps the design once, straight to
# NAND. `abc -g NAND` adds NOT automatically ("The NOT gate is always added to
# this list automatically"). On TapeOut a NOT is one NAND with both inputs tied,
# so the TapeOut gate count is NAND + NOT.
set -euo pipefail
YOSYS="${1:-tools/yosys}"; shift
mkdir -p out logs
summary=out/synth-summary.tsv
[ -f "$summary" ] || printf 'circuit\twidth\tnand\tnot\ttapeout_gates\tnetlist_bytes_est\tseconds\n' > "$summary"

synth() { # name top file width defines
  local name="$1" top="$2" file="$3" width="$4" defs="$5" chp=""
  if [ "$width" != "-" ]; then chp="chparam -set W $width $top;"; fi
  local t0 t1
  t0=$(date +%s.%N)
  "$YOSYS" -q -l "logs/synth-$name.log" -p "
    read_verilog $defs $file; $chp
    synth -flatten -top $top -noabc;
    abc -g NAND; opt_clean -purge;
    tee -o out/$name.stat.txt stat;
    rename $top ${name};
    write_verilog -noattr out/$name.nand.v;
    write_json out/$name.json"
  t1=$(date +%s.%N)
  local nand not
  nand=$(awk '/\$_NAND_/ {print $1; exit}' "out/$name.stat.txt"); nand=${nand:-0}
  not=$(awk '/\$_NOT_/ {print $1; exit}' "out/$name.stat.txt"); not=${not:-0}
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$width" "$nand" "$not" "$((nand + not))" \
    "$(( (nand + not) * 7 ))" "$(awk -v a="$t0" -v b="$t1" 'BEGIN{print b-a}')" | tee -a "$summary"
}

# Module split (spike C): the same flow, but without -flatten, so synth and ABC work
# on each module alone and nothing is optimised across a module boundary (synth's
# `opt` only crosses modules with -hieropt, which is not passed; Yosys 0.70 help,
# read on host-service 2026-11-20). The hierarchical netlist is written first (for
# the per-module proofs), then the design is flattened with no further optimisation
# beyond removing unused wires (opt_clean -purge). The flat netlist is the one that
# would be taped out; out/<name>.mods.stat.txt has the gate count of each module.
synth_mod() { # name width
  local name="$1" width="$2" t0 t1
  t0=$(date +%s.%N)
  "$YOSYS" -q -l "logs/synth-$name.log" -p "
    read_verilog rtl/split_check_mod.v; chparam -set W $width split_check_mod;
    synth -top split_check_mod -noabc;
    abc -g NAND; opt_clean -purge;
    tee -o out/$name.mods.stat.txt stat -top split_check_mod;
    write_verilog -noattr out/$name.mods.nand.v;
    flatten; opt_clean -purge;
    tee -o out/$name.stat.txt stat;
    rename split_check_mod ${name};
    write_verilog -noattr out/$name.nand.v;
    write_json out/$name.json"
  t1=$(date +%s.%N)
  local nand not
  nand=$(awk '/\$_NAND_/ {print $1; exit}' "out/$name.stat.txt"); nand=${nand:-0}
  not=$(awk '/\$_NOT_/ {print $1; exit}' "out/$name.stat.txt"); not=${not:-0}
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$width" "$nand" "$not" "$((nand + not))" \
    "$(( (nand + not) * 7 ))" "$(awk -v a="$t0" -v b="$t1" 'BEGIN{print b-a}')" | tee -a "$summary"
}

for g in "$@"; do
  case "$g" in
    wage)
      synth adder8 adder8 rtl/adder8.v - ""
      synth cn_bonus cn_bonus rtl/cn_bonus.v - ""
      synth ng_paye ng_paye rtl/ng_paye.v - ""
      synth ng_paye_mutant19 ng_paye rtl/ng_paye.v - "-DMUTANT_RATE19" ;;
    check)
      for w in 24 32 40; do synth "split_check_$w" split_check rtl/split_check.v "$w" ""; done ;;
    check-narrow)
      for w in 8 12 16; do synth "split_check_$w" split_check rtl/split_check.v "$w" ""; done ;;
    check-40)
      synth split_check_40 split_check rtl/split_check.v 40 "" ;;
    compute-24|compute-32|compute-40)
      w="${g#compute-}"; synth "split_compute_$w" split_compute rtl/split_compute.v "$w" "" ;;
    mul-8)
      synth mul_8 mul rtl/mul.v 8 "" ;;
    check-mod-8|check-mod-32)
      w="${g#check-mod-}"; synth_mod "split_check_mod_$w" "$w" ;;
    *) echo "unknown group $g" >&2; exit 2 ;;
  esac
done
