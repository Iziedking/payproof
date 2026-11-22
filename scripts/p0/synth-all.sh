#!/usr/bin/env bash
# P0: synthesise spike circuits to NAND and NOT gates and record the counts.
# Runs in the throwaway workdir on host-service after setup-yosys.sh.
# Usage: bash synth-all.sh <yosys-binary> <group>...
#   groups: wage | check | check-narrow | check-40 | compute-24 | compute-32 | compute-40 | mul-8
#           | check-mod-8 | check-mod-32 | mul-tm-8 | mul-tm-32 | mul-tmc-8 | mul-tmc-32
#           | check-modc-8 | check-modc-32 | explain | explain-ref-32
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

# Structure-keeping multiplier (spike C, module split step 2, 2026-11-20): m_mul mapped
# exactly as the RTL run AMulet proved at 32 bits (techmap; opt -fast, no ABC), then
# each simple gate turned into NAND/NOT by rtl/nand_map.v with no optimisation. The
# select line stops the run if any other cell type is left.
synth_tm() { # name width
  local name="$1" width="$2" t0 t1
  t0=$(date +%s.%N)
  "$YOSYS" -q -l "logs/synth-$name.log" -p "
    read_verilog rtl/split_check_mod.v; chparam -set W $width m_mul;
    hierarchy -top m_mul; proc; flatten; techmap; opt -fast;
    tee -o out/$name.pre.stat.txt stat;
    techmap -map rtl/nand_map.v; opt_clean -purge;
    select -assert-none t:* t:\$_NAND_ t:\$_NOT_ %u %d;
    tee -o out/$name.stat.txt stat;
    rename m_mul ${name};
    write_verilog -noattr out/$name.nand.v;
    write_json out/$name.json"
  t1=$(date +%s.%N)
  local nand not
  nand=$(awk '/\$_NAND_/ {print $1; exit}' "out/$name.stat.txt"); nand=${nand:-0}
  not=$(awk '/\$_NOT_/ {print $1; exit}' "out/$name.stat.txt"); not=${not:-0}
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$width" "$nand" "$not" "$((nand + not))" \
    "$(( (nand + not) * 7 ))" "$(awk -v a="$t0" -v b="$t1" 'BEGIN{print b-a}')" | tee -a "$summary"
}

# Same multiplier with redundant NOTs removed (not_cleanup.py), from the JSON written by
# synth_tm. Needs group mul-tm-<w> to have run first in this workdir.
synth_tmc() { # name width
  local name="$1" width="$2" src="m_mul_tm_$2" t0 t1
  t0=$(date +%s.%N)
  python3 not_cleanup.py "out/$src.json" "$src" "out/$name.raw.json" | tee "logs/cleanup-$name.log"
  "$YOSYS" -q -l "logs/synth-$name.log" -p "
    read_json out/$name.raw.json; hierarchy -top $src; opt_clean -purge;
    select -assert-none t:* t:\$_NAND_ t:\$_NOT_ %u %d;
    tee -o out/$name.stat.txt stat;
    rename $src ${name};
    write_verilog -noattr out/$name.nand.v;
    write_json out/$name.json"
  t1=$(date +%s.%N)
  local nand not
  nand=$(awk '/\$_NAND_/ {print $1; exit}' "out/$name.stat.txt"); nand=${nand:-0}
  not=$(awk '/\$_NOT_/ {print $1; exit}' "out/$name.stat.txt"); not=${not:-0}
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$width" "$nand" "$not" "$((nand + not))" \
    "$(( (nand + not) * 7 ))" "$(awk -v a="$t0" -v b="$t1" 'BEGIN{print b-a}')" | tee -a "$summary"
}

# Joined check circuit with the proved multiplier (module split, 2026-11-20). One Yosys
# session: the per-module synthesis of synth_mod is repeated, and its hierarchical
# netlist is written and compared with the step 0 file (identical text means the five
# other modules are the ones proved there). The NOT-cleaned multiplier is then loaded
# from its JSON (read_verilog of a written netlist would turn each NAND back into
# word-level $and/$not cells), the two instances u_pt and u_ps are retyped to it with
# chtype, `hierarchy -top` drops the unused ABC-mapped m_mul, and the design is joined
# as in synth_mod: flatten, opt_clean -purge, nothing else. Comparisons go to
# logs/same-<name>.log. Needs out/ of groups check-mod-<w> and mul-tmc-<w>.
# P2 (2026-11-21): the same session also writes out/<name>.ref.json for tape-out with REF.
# Every module except m_cmp keeps its own netlist (keep_hierarchy, so flatten leaves it);
# m_cmp is flattened into the top because it has 299 inputs and a REF allows at most 255
# (TAP-02 section 3). `design -save` / `design -load` restore the joined design afterwards,
# so the flat netlist below is built exactly as before.
block() { # file module-pattern: print the lines of that module after its header
  # pattern passed through the environment: awk -v would treat its backslashes as escapes
  P="$2" awk '$1 == "module" && index($0, ENVIRON["P"]) {on=1; next} on {print} on && /^endmodule/ {on=0}' "$1"
}
synth_modc() { # name width
  local name="$1" width="$2" t0 t1 tmc="m_mul_tmc_$2"
  t0=$(date +%s.%N)
  "$YOSYS" -q -l "logs/synth-$name.log" -p "
    read_verilog rtl/split_check_mod.v; chparam -set W $width split_check_mod;
    synth -top split_check_mod -noabc;
    abc -g NAND; opt_clean -purge;
    write_verilog -noattr out/$name.base.mods.nand.v;
    read_json out/$tmc.json;
    chtype -set $tmc split_check_mod/u_pt split_check_mod/u_ps;
    hierarchy -top split_check_mod;
    tee -o out/$name.mods.stat.txt stat -top split_check_mod;
    write_verilog -noattr out/$name.mods.nand.v;
    write_json out/$name.mods.json;
    design -save joined;
    setattr -mod -set keep_hierarchy 1 $tmc *m_x10000_wide* *m_x10000_narrow* *m_x8500* *m_add*;
    flatten; opt_clean -purge;
    tee -o out/$name.ref.stat.txt stat -top split_check_mod;
    write_json out/$name.ref.json;
    design -load joined;
    flatten; opt_clean -purge;
    select -assert-none t:* t:\$_NAND_ t:\$_NOT_ %u %d;
    tee -o out/$name.stat.txt stat;
    rename split_check_mod ${name};
    write_verilog -noattr out/$name.nand.v;
    write_json out/$name.json"
  t1=$(date +%s.%N)
  {
    if cmp -s "out/$name.base.mods.nand.v" "out/split_check_mod_$width.mods.nand.v"; then
      echo "same base: per-module synthesis identical to out/split_check_mod_$width.mods.nand.v"
    else echo "same base: DIFFERS from out/split_check_mod_$width.mods.nand.v"; fi
    for m in '\m_x10000_narrow\' '\m_add\' '\m_cmp\' '\m_x10000_wide\' '\m_x8500 '; do
      if cmp -s <(block "out/split_check_mod_$width.mods.nand.v" "$m") <(block "out/$name.mods.nand.v" "$m"); then
        echo "same $m identical"; else echo "same $m DIFFERS"; fi
    done
    if cmp -s <(block "out/$tmc.nand.v" "module $tmc") <(block "out/$name.mods.nand.v" "module $tmc"); then
      echo "same $tmc identical to out/$tmc.nand.v"
    else echo "same $tmc text differs from out/$tmc.nand.v (wire names); proved directly by prove-split.sh part ajoin"; fi
    echo "instances: $(grep -cE "^  $tmc +u_p[ts] " "out/$name.mods.nand.v") of 2 use $tmc"
    echo "m_mul modules left: $(grep -cF '\m_mul' "out/$name.mods.nand.v")"
  } | tee "logs/same-$name.log"
  local nand not
  nand=$(awk '/\$_NAND_/ {print $1; exit}' "out/$name.stat.txt"); nand=${nand:-0}
  not=$(awk '/\$_NOT_/ {print $1; exit}' "out/$name.stat.txt"); not=${not:-0}
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$width" "$nand" "$not" "$((nand + not))" \
    "$(( (nand + not) * 7 ))" "$(awk -v a="$t0" -v b="$t1" 'BEGIN{print b-a}')" | tee -a "$summary"
}

# P2 explanation of split-v1 (docs/specs/explain-validity.md, 2026-11-22). The same per-module
# flow as synth_modc, on split_v1_explain: every module is synthesised alone, the two m_mul
# instances are retyped to the proved m_mul_tmc_32, and the modules already on chain
# (m_mul_tmc_32, m_x10000_wide, m_x10000_narrow, m_x8500) and the new split_v1_validity keep
# their own netlists for REF. logs/same-<name>.log compares each module body with the one
# taped out (out/split_check_mod_32.mods.nand.v and out/m_mul_tmc_32.nand.v). Needs out/ of
# groups check-mod-32 and mul-tmc-32, and rtl/split_v1_validity.v, rtl/split_v1_explain.v.
synth_explain_ref() { # name width
  local name="$1" width="$2" t0 t1 tmc="m_mul_tmc_$2"
  t0=$(date +%s.%N)
  "$YOSYS" -q -l "logs/synth-$name.log" -p "
    read_verilog rtl/split_check_mod.v rtl/split_v1_validity.v rtl/split_v1_explain.v;
    chparam -set W $width split_v1_explain;
    synth -top split_v1_explain -noabc;
    abc -g NAND; opt_clean -purge;
    read_json out/$tmc.json;
    chtype -set $tmc split_v1_explain/u_pt split_v1_explain/u_ps;
    hierarchy -top split_v1_explain;
    tee -o out/$name.mods.stat.txt stat -top split_v1_explain;
    write_verilog -noattr out/$name.mods.nand.v;
    setattr -mod -set keep_hierarchy 1 $tmc *m_x10000_wide* *m_x10000_narrow* *m_x8500* *split_v1_validity*;
    flatten; opt_clean -purge;
    tee -o out/$name.ref.stat.txt stat -top split_v1_explain;
    write_json out/$name.ref.json"
  t1=$(date +%s.%N)
  {
    for m in '\m_x10000_narrow\' '\m_x10000_wide\' '\m_x8500 '; do
      if cmp -s <(block "out/split_check_mod_$width.mods.nand.v" "$m") <(block "out/$name.mods.nand.v" "$m"); then
        echo "same $m identical to the taped-out module"; else echo "same $m DIFFERS"; fi
    done
    if cmp -s <(block "out/$tmc.nand.v" "module $tmc") <(block "out/$name.mods.nand.v" "module $tmc"); then
      echo "same $tmc identical to out/$tmc.nand.v"
    else echo "same $tmc text differs from out/$tmc.nand.v"; fi
    echo "instances: $(grep -cE "^  $tmc +u_p[ts] " "out/$name.mods.nand.v") of 2 use $tmc"
    echo "m_mul modules left: $(grep -cF '\m_mul' "out/$name.mods.nand.v")"
  } | tee "logs/same-$name.log"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$width" "see-ref-stat" "-" "-" "-" \
    "$(awk -v a="$t0" -v b="$t1" 'BEGIN{print b-a}')" | tee -a "$summary"
}

for g in "$@"; do
  case "$g" in
    explain)
      synth cn_bonus_explain cn_bonus_explain rtl/cn_bonus_explain.v - ""
      synth ng_paye_explain ng_paye_explain rtl/ng_paye_explain.v - ""
      synth split_v1_validity_32 split_v1_validity rtl/split_v1_validity.v 32 "" ;;
    explain-ref-32)
      synth_explain_ref split_v1_explain_32 32 ;;
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
    mul-tm-8|mul-tm-32)
      w="${g#mul-tm-}"; synth_tm "m_mul_tm_$w" "$w" ;;
    mul-tmc-8|mul-tmc-32)
      w="${g#mul-tmc-}"; synth_tmc "m_mul_tmc_$w" "$w" ;;
    check-modc-8|check-modc-32)
      w="${g#check-modc-}"; synth_modc "split_check_modc_$w" "$w" ;;
    check-mod-8|check-mod-32)
      w="${g#check-mod-}"; synth_mod "split_check_mod_$w" "$w" ;;
    *) echo "unknown group $g" >&2; exit 2 ;;
  esac
done
