#!/usr/bin/env bash
# P0: split-fact proof in three parts, run in a capped container on node-services,
# in the throwaway workdir. Needs ./oss-cad-suite, ./rtl/split_check.v,
# ./nets/split_check_<w>.nand.v and ./split-proof/*.smt2.
# Usage: bash prove-split.sh <part> <timeout-seconds> [width...]
#   part smt : spike A. Integer proofs of check_unique, check_more_shares and the
#              no-overflow bound, each in Z3 and cvc5, plus one calibration file
#              that must come back sat.
#   part cec : spike B. Equivalence of the NAND netlist against the RTL at each
#              width with ABC `cec`, plus a mutant RTL (HOLDER_BPS 8499) that must
#              come back not equivalent.
#   part alg : spike C step 1. Calibrate &acec and &polyn on a plain multiplier
#              and run &acec on the whole check circuit (see that block).
#   part miter: Yosys miter -equiv (ports by name) of RTL and netlist, then ABC
#              &cec -m; third argument selects pairs by regex (see that block).
#   part acec: &acec of the whole check netlist against the RTL at each width,
#              plus the HOLDER_BPS 8499 mutant.
# Commands checked against the help text of the binaries in oss-cad-suite
# 20261029 on node-services, 2026-11-19: z3 4.15.5 (-smt2, -T:<s>), cvc5 1.0.1-dev
# (--tlimit=<ms>), yosys 0.70+277 (write_aiger -symbols), yosys-abc (cec -T -C -v,
# outputs matched by name by default).
set -uo pipefail
PART="${1:?part}"; T="${2:-600}"; shift 2 || true
O=oss-cad-suite/bin
R=proofs-split; mkdir -p "$R"

secs() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.1f", b-a}'; }

if [ "$PART" = smt ]; then
  for f in no_overflow unique more_shares unique_wrong; do
    for s in z3 cvc5; do
      log="$R/smt-$f-$s.log"; t0=$(date +%s.%N)
      if [ $s = z3 ]; then
        timeout --kill-after=10 $((T + 30)) $O/z3 -smt2 -T:"$T" "split-proof/$f.smt2" > "$log" 2>&1
      else
        timeout --kill-after=10 $((T + 30)) $O/cvc5 --tlimit=$((T * 1000)) "split-proof/$f.smt2" > "$log" 2>&1
      fi
      rc=$?; t1=$(date +%s.%N)
      r=$(grep -m1 -xE 'sat|unsat|unknown' "$log" || echo none)
      echo "smt $f $s $r $(secs "$t0" "$t1") rc=$rc" | tee -a "$R/summary.txt"
    done
  done
  exit 0
fi

if [ "$PART" = miter ]; then
  # Spike C, 2026-11-20: &acec is not trusted on its own. On the 8x8 multiplier it
  # reported "NOT EQUIVALENT" with a counterexample for a netlist that plain `cec`
  # proves equal to its RTL, and at 32 bits it aborted on an assertion
  # (acecXor.c:102). This part builds each pair as one Yosys `miter -equiv` circuit
  # (ports matched by name) and runs ABC's `&cec -m` (miter mode) on it, plus plain
  # `cec` by name on the multiplier pair as the reference.
  # Pairs: name|gold source|gold top|gold chparams|gate source|gate top
  pairs="mul8|rtl/mul.v|mul|-set W 8|nets/mul_8.nand.v|mul_8
mul8mut|rtl/mul.v|mul|-set W 8|$R/alg-8/mul_8_mutant.nand.v|mul_8
check8|rtl/split_check.v|split_check|-set W 8|nets/split_check_8.nand.v|split_check_8
check8mut|rtl/split_check.v|split_check|-set W 8 -set HOLDER_BPS 8499|nets/split_check_8.nand.v|split_check_8
check32|rtl/split_check.v|split_check|-set W 32|nets/split_check_32.nand.v|split_check_32
check32mut|rtl/split_check.v|split_check|-set W 32 -set HOLDER_BPS 8499|nets/split_check_32.nand.v|split_check_32"
  SEL="${1:-.}"
  d="$R/miter"; mkdir -p "$d"
  while IFS='|' read -r name gsrc gtop gpar nsrc ntop; do
    echo "$name" | grep -qE "^($SEL)$" || continue
    # gold and gate module names differ (mul / mul_8, split_check / split_check_<w>),
    # so both are read into one design and joined with miter -equiv.
    $O/yosys -q -l "$d/$name-build.log" -p "read_verilog $gsrc; chparam $gpar $gtop; read_verilog $nsrc;
      proc; miter -equiv -flatten $gtop $ntop miter; hierarchy -top miter; techmap; opt -fast; aigmap;
      write_aiger -symbols $d/$name.aig" > /dev/null 2>&1
    log="$d/$name-ncec.log"; t0=$(date +%s.%N)
    timeout --kill-after=10 $((T + 60)) $O/yosys-abc -c "&r $d/$name.aig; &cec -m -v -T $T" > "$log" 2>&1
    rc=$?; t1=$(date +%s.%N)
    v=$(grep -m1 -iE 'equivalent|undecided|proved|disproved|SATISFIABLE' "$log" | tr -s ' ' | cut -c1-110)
    echo "miter $name &cec [${v:-no verdict line}] $(secs "$t0" "$t1") rc=$rc" | tee -a "$R/summary.txt"
  done <<< "$pairs"
  # reference: plain cec by name on the multiplier pair (ran by hand once outside the
  # hook on 2026-11-20, 22.8 s, equivalent; repeated here so the record is hooked).
  if echo mul8 | grep -qE "^($SEL)$"; then
    log="$d/mul8-cec-byname.log"; t0=$(date +%s.%N)
    timeout --kill-after=10 $((T + 60)) $O/yosys-abc -c "cec -T $T -v $R/alg-8/mul-gold.aig $R/alg-8/mul-gate.aig" > "$log" 2>&1
    rc=$?; t1=$(date +%s.%N)
    echo "miter mul8 cec-byname [$(grep -m1 -i equivalent "$log" | tr -s ' ' | cut -c1-80)] $(secs "$t0" "$t1") rc=$rc" | tee -a "$R/summary.txt"
  fi
  exit 0
fi

if [ "$PART" = acec ]; then
  # Spike C finding, 2026-11-20: at 8 bits `&acec` proved the whole check netlist
  # equal to the RTL in 59 s (it found no matching adder boxes and fell back to its
  # own CEC), where `cec` stalled at 900 s; the 8499 mutant was rejected in 0.01 s.
  # This part repeats that on each width, building the AIGs the same way as part cec.
  for w in "$@"; do
    d="$R/acec-$w"; mkdir -p "$d"
    $O/yosys -q -l "$d/gold.log" -p "read_verilog rtl/split_check.v; chparam -set W $w split_check;
      hierarchy -top split_check; proc; flatten; techmap; opt -fast; aigmap;
      write_aiger -symbols $d/gold.aig" > /dev/null 2>&1
    $O/yosys -q -l "$d/mutant.log" -p "read_verilog rtl/split_check.v; chparam -set W $w -set HOLDER_BPS 8499 split_check;
      hierarchy -top split_check; proc; flatten; techmap; opt -fast; aigmap;
      write_aiger -symbols $d/mutant.aig" > /dev/null 2>&1
    $O/yosys -q -l "$d/gate.log" -p "read_verilog nets/split_check_$w.nand.v;
      hierarchy -top split_check_$w; proc; flatten; techmap; aigmap;
      write_aiger -symbols $d/gate.aig" > /dev/null 2>&1
    for g in mutant gold; do
      log="$d/acec-$g.log"; t0=$(date +%s.%N)
      timeout --kill-after=10 $((T + 60)) $O/yosys-abc -c "&acec -T $T -v $d/$g.aig $d/gate.aig" > "$log" 2>&1
      rc=$?; t1=$(date +%s.%N)
      # Verdict lines seen at 8 bits: "Networks are equivalent." and
      # "Networks are NOT EQUIVALENT."; anything else is recorded as undecided.
      if grep -q '^Networks are equivalent' "$log"; then v=equivalent
      elif grep -q '^Networks are NOT EQUIVALENT' "$log"; then v="not equivalent"
      else v=undecided; fi
      echo "acec $w $g $v $(secs "$t0" "$t1") rc=$rc" | tee -a "$R/summary.txt"
    done
  done
  exit 0
fi
if [ "$PART" = cec ]; then
  for w in "$@"; do
    d="$R/cec-$w"; mkdir -p "$d"
    # gold: the RTL, mapped to AND/NOT gates by Yosys only (no ABC optimisation).
    $O/yosys -q -l "$d/gold.log" -p "read_verilog rtl/split_check.v; chparam -set W $w split_check;
      hierarchy -top split_check; proc; flatten; techmap; opt -fast; aigmap;
      write_aiger -symbols $d/gold.aig" > /dev/null 2>&1
    # mutant gold: same RTL with HOLDER_BPS 8499; the check must reject it.
    $O/yosys -q -l "$d/mutant.log" -p "read_verilog rtl/split_check.v; chparam -set W $w -set HOLDER_BPS 8499 split_check;
      hierarchy -top split_check; proc; flatten; techmap; opt -fast; aigmap;
      write_aiger -symbols $d/mutant.aig" > /dev/null 2>&1
    # gate: the synthesised NAND netlist that would be taped out.
    $O/yosys -q -l "$d/gate.log" -p "read_verilog nets/split_check_$w.nand.v;
      hierarchy -top split_check_$w; proc; flatten; techmap; aigmap;
      write_aiger -symbols $d/gate.aig" > /dev/null 2>&1
    for g in mutant gold; do
      log="$d/cec-$g.log"; t0=$(date +%s.%N)
      timeout --kill-after=10 $((T + 60)) $O/yosys-abc -c "cec -T $T -C 1000000000 -v $d/$g.aig $d/gate.aig" > "$log" 2>&1
      rc=$?; t1=$(date +%s.%N)
      # The verdict words are read from the log after the 8-bit calibration run;
      # the line is recorded raw here so nothing is guessed.
      v=$(grep -m1 -iE 'equivalent|undecided|timeout|time out' "$log" | tr -s ' ' | cut -c1-120)
      echo "cec $w $g [${v:-no verdict line}] $(secs "$t0" "$t1") rc=$rc" | tee -a "$R/summary.txt"
    done
  done
  exit 0
fi
if [ "$PART" = alg ]; then
  # Spike C, step 1: calibrate the arithmetic-aware checkers before trusting them.
  # (a) A plain W x W multiplier (rtl/mul.v), synthesised to NAND on host-service
  #     with the split_check flow (nets/mul_<w>.nand.v), against its RTL, with
  #     &acec (adder-tree matching, then CEC) and &polyn -S (rewrites the output
  #     signature sum 2^k*y[k] into a polynomial over the inputs; it must come out
  #     as the product, every a[i]*b[j] with weight 2^(i+j)). A one-gate mutant of
  #     the netlist must fail both.
  # (b) &acec on the whole check circuit at the same width, RTL against netlist
  #     and the HOLDER_BPS 8499 mutant against the netlist (AIGs from part cec).
  # Command forms from the yosys-abc help text (&acec, &polyn) and the strings in
  # the installed binary, 2026-11-19; the acecCore.c source shows &acec matches
  # adder trees and then runs ordinary CEC, and that its Booth path is disabled.
  for w in "$@"; do
    d="$R/alg-$w"; mkdir -p "$d"
    $O/yosys -q -l "$d/mul-gold.log" -p "read_verilog rtl/mul.v; chparam -set W $w mul; hierarchy -top mul;
      proc; flatten; techmap; opt -fast; aigmap; write_aiger -symbols -map $d/mul-gold.map $d/mul-gold.aig" > /dev/null 2>&1
    $O/yosys -q -l "$d/mul-gate.log" -p "read_verilog nets/mul_$w.nand.v; hierarchy -top mul_$w;
      proc; flatten; techmap; aigmap; write_aiger -symbols -map $d/mul-gate.map $d/mul-gate.aig" > /dev/null 2>&1
    # mutant: the 40th NAND assignment in the netlist becomes an AND.
    awk 'BEGIN{n=0} /= ~\(/ {n++; if (n==40) {sub(/= ~\(/, "= ("); print "// MUTATED: " $0 > "/dev/stderr"}} {print}' \
      "nets/mul_$w.nand.v" > "$d/mul_${w}_mutant.nand.v" 2> "$d/mutant-line.txt"
    $O/yosys -q -l "$d/mul-mutant.log" -p "read_verilog $d/mul_${w}_mutant.nand.v; hierarchy -top mul_$w;
      proc; flatten; techmap; aigmap; write_aiger -symbols -map $d/mul-mutant.map $d/mul-mutant.aig" > /dev/null 2>&1
    sig=""; for ((k=0; k<2*w; k++)); do sig="$sig${sig:++}$k*o$k"; done
    run() { # label, abc script
      local log="$d/$1.log" t0 t1 rc; t0=$(date +%s.%N)
      timeout --kill-after=10 $((T + 60)) $O/yosys-abc -c "$2" > "$log" 2>&1; rc=$?; t1=$(date +%s.%N)
      echo "alg $w $1 $(secs "$t0" "$t1") rc=$rc" | tee -a "$R/summary.txt"
    }
    run cec-mul-mutant "cec -T $T -v $d/mul-gold.aig $d/mul-mutant.aig"
    run acec-mul-gate "&acec -T $T -v $d/mul-gold.aig $d/mul-gate.aig"
    run acec-mul-mutant "&acec -T $T -v $d/mul-gold.aig $d/mul-mutant.aig"
    run polyn-mul-gold "&r $d/mul-gold.aig; &polyn -v -S $sig"
    run polyn-mul-gate "&r $d/mul-gate.aig; &polyn -v -S $sig"
    run polyn-mul-mutant "&r $d/mul-mutant.aig; &polyn -v -S $sig"
    run polyn-mul-gate-terms "&r $d/mul-gate.aig; &polyn -w -S $sig"
    if [ -f "$R/cec-$w/gold.aig" ]; then
      run acec-check-gate "&acec -T $T -v $R/cec-$w/gold.aig $R/cec-$w/gate.aig"
      run acec-check-mutant "&acec -T $T -v $R/cec-$w/mutant.aig $R/cec-$w/gate.aig"
    fi
  done
  exit 0
fi
echo "unknown part: $PART" >&2; exit 2
