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
#   part comp: module split steps 1 and 3 (joined RTL against original RTL; flat
#              netlist against the hierarchical one); third argument selects pairs.
#   part amul: module split step 2 for m_mul: AMulet verify and certify, Pacheck check.
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
    # &cec prints "UNDECIDED after the new CEC engine" and then runs the old engine,
    # so the final verdict is the last matching line, not the first (fixed 2026-11-20
    # after the first miter run recorded the intermediate line for mul8 and check8).
    v=$(grep -iE 'equivalent|undecided|proved|disproved|SATISFIABLE' "$log" | tail -n 1 | tr -s ' ' | cut -c1-110)
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

if [ "$PART" = comp ]; then
  # Module split, steps 1 and 3 (2026-11-20). Each pair is joined with Yosys
  # `miter -equiv -flatten` (ports by name) and checked with ABC `&cec -m`, as in part
  # miter. Step 1: the joined RTL (rtl/split_check_mod.v) against the original RTL.
  # Step 3: the flat netlist that would be taped out against the hierarchical netlist
  # it was flattened from. Both sides of every gold pair should hash to the same
  # gates, so these are expected to be quick; each has a control that must fail.
  # Fields: name | side 1 files | top 1 | chparam 1 | side 2 files | top 2 | chparam 2 | read flags 2
  pairs="s1-8|rtl/split_check.v|split_check|-set W 8|rtl/split_check_mod.v|split_check_mod|-set W 8|
s1-8mut|rtl/split_check.v|split_check|-set W 8|rtl/split_check_mod.v|split_check_mod|-set W 8 -set HOLDER_BPS 8499|
s1-32|rtl/split_check.v|split_check|-set W 32|rtl/split_check_mod.v|split_check_mod|-set W 32|
s1-32mut|rtl/split_check.v|split_check|-set W 32|rtl/split_check_mod.v|split_check_mod|-set W 32|-DMUTANT_VALID_OR
s3-8|nets/split_check_mod_8.mods.nand.v|split_check_mod|-|nets/split_check_mod_8.nand.v|split_check_mod_8|-|
s3-8mut|nets/split_check_mod_8.mods.nand.v|split_check_mod|-|MUT:nets/split_check_mod_8.nand.v|split_check_mod_8|-|
s3-32|nets/split_check_mod_32.mods.nand.v|split_check_mod|-|nets/split_check_mod_32.nand.v|split_check_mod_32|-|
s3-32mut|nets/split_check_mod_32.mods.nand.v|split_check_mod|-|MUT:nets/split_check_mod_32.nand.v|split_check_mod_32|-|"
  SEL="${1:-.}"
  d="$R/comp"; mkdir -p "$d"
  while IFS='|' read -r name s1 t1 p1 s2 t2 p2 f2; do
    echo "$name" | grep -qE "^($SEL)$" || continue
    if [ "${s2#MUT:}" != "$s2" ]; then
      # one-gate control: the 40th NAND of the flat netlist becomes an AND.
      src="${s2#MUT:}"; s2="$d/$name.nand.v"
      awk 'BEGIN{n=0} /= ~\(/ {n++; if (n==40) {sub(/= ~\(/, "= ("); print "// MUTATED: " $0 > "/dev/stderr"}} {print}' \
        "$src" > "$s2" 2> "$d/$name-mutant-line.txt"
    fi
    c1=""; [ "$p1" != "-" ] && c1="chparam $p1 $t1;"
    c2=""; [ "$p2" != "-" ] && c2="chparam $p2 $t2;"
    $O/yosys -q -l "$d/$name-build.log" -p "read_verilog $s1; $c1 read_verilog $f2 $s2; $c2
      hierarchy; proc; miter -equiv -flatten $t1 $t2 miter; hierarchy -top miter; techmap; opt -fast; aigmap;
      write_aiger -symbols $d/$name.aig" > /dev/null 2>&1
    log="$d/$name-ncec.log"; t0=$(date +%s.%N)
    timeout --kill-after=10 $((T + 60)) $O/yosys-abc -c "&r $d/$name.aig; &cec -m -v -T $T" > "$log" 2>&1
    rc=$?; t1=$(date +%s.%N)
    v=$(grep -iE 'equivalent|undecided|proved|disproved|SATISFIABLE' "$log" | tail -n 1 | tr -s ' ' | cut -c1-110)
    echo "comp $name &cec [${v:-no verdict line}] $(secs "$t0" "$t1") rc=$rc" | tee -a "$R/summary.txt"
  done <<< "$pairs"
  exit 0
fi
if [ "$PART" = lin ]; then
  # Module split, step 2 for the five modules other than m_mul (2026-11-20). For each
  # module and width: the module is cut out of the per-module netlist that is joined and
  # taped out (split_check_mod_<w>.mods.nand.v) and renamed <module>_g; the RTL of the
  # same module comes from rtl/split_check_mod.v with chparam W; the two are joined with
  # miter -equiv -flatten and checked with &cec -m, as in part comp. Control per module:
  # the cut netlist with its 40th NAND turned into an AND, which must be not equivalent.
  # Usage: prove-split.sh lin <timeout> <width> [module regex]
  w="${1:?width}"; SEL="${2:-.}"
  d="$R/lin-$w"; mkdir -p "$d"
  for m in m_x10000_narrow m_add m_cmp m_x10000_wide m_x8500; do
    echo "$m" | grep -qE "^($SEL)$" || continue
    awk -v m="$m" -v n="${m}_g" '
      $1 == "module" && (index($0, "\\" m "\\") || index($0, "\\" m " ")) {on=1; sub(/^module [^(]*\(/, "module " n " ("); print; next}
      on {print} on && /^endmodule/ {on=0}' "nets/split_check_mod_$w.mods.nand.v" > "$d/${m}_g.nand.v"
    awk 'BEGIN{n=0} /= ~\(/ {n++; if (n==40) {sub(/= ~\(/, "= ("); print "// MUTATED: " $0 > "/dev/stderr"}} {print}' \
      "$d/${m}_g.nand.v" 2> "$d/$m-mutant-line.txt" | sed "s/^module ${m}_g /module ${m}_gm /" > "$d/${m}_gm.nand.v"
    for v in g gm; do
      name="$m"; [ "$v" = gm ] && name="$m-mut"
      $O/yosys -q -l "$d/$name-build.log" -p "read_verilog rtl/split_check_mod.v; chparam -set W $w $m;
        read_verilog $d/${m}_$v.nand.v; hierarchy; proc; miter -equiv -flatten $m ${m}_$v miter;
        hierarchy -top miter; techmap; opt -fast; aigmap; write_aiger -symbols $d/$name.aig" > /dev/null 2>&1
      log="$d/$name-ncec.log"; t0=$(date +%s.%N)
      timeout --kill-after=10 $((T + 60)) $O/yosys-abc -c "&r $d/$name.aig; &cec -m -v -T $T" > "$log" 2>&1
      rc=$?; t1=$(date +%s.%N)
      v2=$(grep -iE 'equivalent|undecided|proved|disproved|SATISFIABLE' "$log" | tail -n 1 | tr -s ' ' | cut -c1-110)
      echo "lin $w $name &cec [${v2:-no verdict line}] $(secs "$t0" "$t1") rc=$rc" | tee -a "$R/summary.txt"
    done
  done
  exit 0
fi
if [ "$PART" = amul ]; then
  # Module split, step 2 for m_mul (2026-11-20): AMulet 2.2 (tools/bin/amulet, built by
  # build-amulet.sh) checks that an AIG computes the unsigned product of its inputs,
  # first half a, second half b, outputs y[0..2W-1] (parser.cpp at the pinned commit).
  # `-verify` prints "CORRECT MULTIPLIER" or "INCORRECT MULTIPLIER"; `-certify` writes
  # polynomials, proof and spec, which Pacheck 2.0 (tools/bin/pacheck) checks
  # independently: exit 0 and "TARGET CHECKED". Three AIGs per width:
  #   gate   : the m_mul module cut out of the per-module netlist that is joined and
  #            taped out (split_check_mod_<w>.mods.nand.v)
  #   rtl    : the m_mul RTL mapped by Yosys alone
  #   mutant : gate with its 40th NAND turned into an AND; must be INCORRECT
  B=tools/bin
  for w in "$@"; do
    d="$R/amul-$w"; mkdir -p "$d"
    awk -v w="$w" '/^module .*\\m_mul\\/ {on=1; print "module m_mul_" w " (a, b, y);"; next}
      on {print} on && /^endmodule/ {on=0}' "nets/split_check_mod_$w.mods.nand.v" > "$d/m_mul_$w.nand.v"
    awk 'BEGIN{n=0} /= ~\(/ {n++; if (n==40) {sub(/= ~\(/, "= ("); print "// MUTATED: " $0 > "/dev/stderr"}} {print}' \
      "$d/m_mul_$w.nand.v" 2> "$d/mutant-line.txt" | sed "s/^module m_mul_$w /module m_mul_${w}_mut /" > "$d/m_mul_${w}_mut.nand.v"
    $O/yosys -q -l "$d/gate.log" -p "read_verilog $d/m_mul_$w.nand.v; hierarchy -top m_mul_$w;
      proc; flatten; techmap; aigmap; write_aiger -map $d/gate.map $d/gate.aig" > /dev/null 2>&1
    $O/yosys -q -l "$d/mutant.log" -p "read_verilog $d/m_mul_${w}_mut.nand.v; hierarchy -top m_mul_${w}_mut;
      proc; flatten; techmap; aigmap; write_aiger -map $d/mutant.map $d/mutant.aig" > /dev/null 2>&1
    $O/yosys -q -l "$d/rtl.log" -p "read_verilog rtl/split_check_mod.v; chparam -set W $w m_mul;
      hierarchy -top m_mul; proc; flatten; techmap; opt -fast; aigmap; write_aiger -map $d/rtl.map $d/rtl.aig" > /dev/null 2>&1
    for g in gate rtl mutant; do
      log="$d/verify-$g.log"; t0=$(date +%s.%N)
      timeout --kill-after=10 $((T + 60)) $B/amulet -verify "$d/$g.aig" -v2 > "$log" 2>&1
      rc=$?; t1=$(date +%s.%N)
      v=$(grep -oE '(IN)?CORRECT MULTIPLIER' "$log" | tail -n 1)
      echo "amul $w verify $g [${v:-no verdict}] $(secs "$t0" "$t1") rc=$rc" | tee -a "$R/summary.txt"
    done
    for g in gate rtl; do
      log="$d/certify-$g.log"; t0=$(date +%s.%N)
      timeout --kill-after=10 $((T + 60)) $B/amulet -certify "$d/$g.aig" "$d/$g.polys" "$d/$g.proof" "$d/$g.spec" > "$log" 2>&1
      rc=$?; t1=$(date +%s.%N)
      v=$(grep -oE '(IN)?CORRECT MULTIPLIER' "$log" | tail -n 1)
      echo "amul $w certify $g [${v:-no verdict}] $(secs "$t0" "$t1") rc=$rc" | tee -a "$R/summary.txt"
      log="$d/pacheck-$g.log"; t0=$(date +%s.%N)
      timeout --kill-after=10 $((T + 60)) $B/pacheck "$d/$g.polys" "$d/$g.proof" "$d/$g.spec" > "$log" 2>&1
      rc=$?; t1=$(date +%s.%N)
      v=$(grep -oE 'TARGET CHECKED|[A-Z ]*FAIL[A-Z ]*' "$log" | tail -n 1)
      echo "amul $w pacheck $g [${v:-no verdict}] $(secs "$t0" "$t1") rc=$rc" | tee -a "$R/summary.txt"
    done
  done
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
