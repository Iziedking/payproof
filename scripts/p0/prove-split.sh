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
echo "unknown part: $PART" >&2; exit 2
