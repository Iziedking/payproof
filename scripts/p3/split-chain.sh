#!/usr/bin/env bash
# P3, split-v1: the proof chain of P0 section 5 ("the chain closed at 32 bits"), run again on the
# circuits read from X Layer (L14) instead of on our netlists. Input: the files written by
# scripts/p3/split-export.mts into $E. No network. Usage: bash scripts/p3/split-chain.sh <E> <T>
#
#   A  the split facts hold for the integer predicate, with no overflow, every width:
#      prover/facts/split-v1/*.smt2 in Z3 and in cvc5; each fact's mutant must be sat
#   1  the joined RTL (split_check_mod) equals the original RTL (split_check), W = 32;
#      control: MUTANT_VALID_OR must not be equal
#   2  each REF target read from chain equals its RTL module:
#        circuits 4 to 7: Yosys miter -equiv, ABC &cec -m; control: one constant changed
#        circuit 3 (32x32 multiplier): AMulet 2.2 -substitute, the adder miter by yices-sat,
#        -verify, -certify, then Pacheck 2.0 on the certificate; control: one NAND turned into AND
#   3  circuit 8 read from chain, with each REF target replaced by its RTL module, equals
#      split_check_mod; control: the MUTANT_VALID_OR RTL must not be equal
# If every link holds, circuit 8 on chain accepts exactly the payouts of the integer predicate,
# so the facts of A hold for it. Commands are the ones P0 used (scripts/p0/prove-split.sh,
# parts smt, comp and ajoin), checked against the tools' help text on 2026-11-19 and 2026-11-20.
set -uo pipefail
E="${1:?export dir}"; T="${2:-900}"
O=oss-cad-suite/bin; B=tools/bin; R=spikes/p0/rtl; F=prover/facts/split-v1
S="$E/summary.txt"; : > "$S"
secs() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.1f", b-a}'; }
say() { echo "$*" | tee -a "$S"; }
fail=0

say "== A: integer facts (Z3 $($O/z3 --version | head -n1); cvc5 $($O/cvc5 --version | head -n1))"
for f in $F/*.smt2; do
  n=$(basename "$f" .smt2)
  case "$n" in *.mutant) want=sat ;; *) want=unsat ;; esac
  for s in z3 cvc5; do
    log="$E/smt-$n-$s.log"; t0=$(date +%s.%N)
    if [ $s = z3 ]; then timeout --kill-after=10 $((T + 30)) $O/z3 -smt2 -T:"$T" "$f" > "$log" 2>&1
    else timeout --kill-after=10 $((T + 30)) $O/cvc5 --tlimit=$((T * 1000)) "$f" > "$log" 2>&1; fi
    rc=$?; t1=$(date +%s.%N)
    r=$(grep -m1 -xE 'sat|unsat|unknown' "$log" || echo none)
    say "A $n $s $r (want $want) $(secs "$t0" "$t1") rc=$rc"
    # A wrong answer stops the chain; no answer is recorded as undecided.
    if [ "$r" = sat ] || [ "$r" = unsat ]; then [ "$r" = "$want" ] || fail=1; fi
  done
done

cec() { # name, yosys read script, gold, gate, expect (equivalent|different)
  local name="$1" reads="$2" gold="$3" gate="$4" want="$5"
  $O/yosys -q -l "$E/$name-build.log" -p "$reads hierarchy; proc; miter -equiv -flatten $gold $gate miter;
    hierarchy -top miter; techmap; opt -fast; aigmap; write_aiger -symbols $E/$name.aig" > /dev/null 2>&1 \
    || { say "$name build FAILED"; fail=1; return; }
  local log="$E/$name-cec.log" t0 t1 rc v
  t0=$(date +%s.%N)
  timeout --kill-after=10 $((T + 60)) $O/yosys-abc -c "&r $E/$name.aig; &cec -m -v -T $T" > "$log" 2>&1
  rc=$?; t1=$(date +%s.%N)
  v=$(grep -iE 'equivalent|undecided|proved|disproved' "$log" | tail -n 1 | tr -s ' ' | cut -c1-110)
  say "$name [${v:-no verdict line}] (want $want) $(secs "$t0" "$t1") rc=$rc sha256 $(sha256sum "$E/$name.aig" | cut -c1-16)"
  if [ "$want" = equivalent ]; then echo "$v" | grep -q 'Networks are equivalent' || fail=1
  else echo "$v" | grep -qiE 'NOT EQUIVALENT|Disproved' || fail=1; fi
}

say "== 1: joined RTL against the original RTL, W = 32"
cec s1-32 "read_verilog $R/split_check.v; chparam -set W 32 split_check; read_verilog $R/split_check_mod.v; chparam -set W 32 split_check_mod;" split_check split_check_mod equivalent
cec s1-32mut "read_verilog $R/split_check.v; chparam -set W 32 split_check; read_verilog -DMUTANT_VALID_OR $R/split_check_mod.v; chparam -set W 32 split_check_mod;" split_check split_check_mod different

say "== 2: each REF target read from chain against its RTL module"
for k in 4 5 6 7; do
  cec m$k "read_verilog $R/split_check_mod.v; read_verilog $E/g$k.v; read_verilog $E/c$k.v;" g$k c$k equivalent
  cec m$k-mut "read_verilog $E/g$k-mut.v; read_verilog $E/c$k.v;" g$k c$k different
done
# Circuit 3, the multiplier: AIG of the chain export (a = in[31:0], b = in[63:32], y = out).
d="$E/amul"; mkdir -p "$d"
awk 'BEGIN{n=0} /= ~\(/ {n++; if (n==40) {sub(/= ~\(/, "= ("); print "// MUTATED: " $0 > "/dev/stderr"}} {print}' \
  "$E/c3.v" 2> "$d/mutant-line.txt" > "$d/c3-mut.v"
for g in gate mutant; do
  src="$E/c3.v"; [ $g = mutant ] && src="$d/c3-mut.v"
  $O/yosys -q -l "$d/$g-build.log" -p "read_verilog $src; hierarchy -top c3; proc; flatten; techmap; aigmap;
    write_aiger -map $d/$g.map $d/$g.aig" > /dev/null 2>&1 || { say "amul $g build FAILED"; fail=1; continue; }
  log="$d/substitute-$g.log"; t0=$(date +%s.%N)
  timeout --kill-after=10 $((T + 60)) $B/amulet -substitute "$d/$g.aig" "$d/$g-sub.cnf" "$d/$g-sub.aig" > "$log" 2>&1
  rc=$?; t1=$(date +%s.%N)
  say "amul $g substitute [$(grep -iE 'substitut|adder|xor|fail|error' "$log" | tail -n 1 | tr -s ' ' | cut -c1-90)] $(secs "$t0" "$t1") rc=$rc"
  if [ -s "$d/$g-sub.cnf" ]; then
    m=$($O/yices-sat "$d/$g-sub.cnf" 2>&1 | head -n 1)
    say "amul $g adder-miter yices-sat [$m] (want unsat)"
    [ "$m" = unsat ] || fail=1
  else say "amul $g no adder miter written"; fail=1; fi
  log="$d/verify-$g.log"; t0=$(date +%s.%N)
  timeout --kill-after=10 $((T + 60)) $B/amulet -verify "$d/$g-sub.aig" > "$log" 2>&1
  rc=$?; t1=$(date +%s.%N)
  v=$(grep -oE '(IN)?CORRECT MULTIPLIER' "$log" | tail -n 1)
  if [ $g = gate ]; then want="CORRECT MULTIPLIER"; else want="INCORRECT MULTIPLIER"; fi
  say "amul $g verify [${v:-no verdict}] (want $want) $(secs "$t0" "$t1") rc=$rc"
  [ "$v" = "$want" ] || fail=1
  [ $g = gate ] || continue
  log="$d/certify-$g.log"; t0=$(date +%s.%N)
  timeout --kill-after=10 $((T + 60)) $B/amulet -certify "$d/$g-sub.aig" "$d/$g.polys" "$d/$g.proof" "$d/$g.spec" > "$log" 2>&1
  rc=$?; t1=$(date +%s.%N)
  say "amul $g certify [$(grep -oE '(IN)?CORRECT MULTIPLIER' "$log" | tail -n 1)] $(secs "$t0" "$t1") rc=$rc"
  log="$d/pacheck-$g.log"; t0=$(date +%s.%N)
  timeout --kill-after=10 $((T + 60)) $B/pacheck "$d/$g.polys" "$d/$g.proof" "$d/$g.spec" > "$log" 2>&1
  rc=$?; t1=$(date +%s.%N)
  v=$(grep -oE 'TARGET CHECKED' "$log" | tail -n 1)
  say "amul $g pacheck [${v:-no verdict}] (want TARGET CHECKED) $(secs "$t0" "$t1") rc=$rc"
  [ "$v" = "TARGET CHECKED" ] || fail=1
  rm -f "$d/$g.proof"   # large; rebuilt by re-running
done
# AMulet reads the first half of the inputs as a and the second as b (P0 note); the map file
# shows which bits of `in` those are.
say "amul input order: $(grep -m2 -E '^input' "$d/gate.map" | tr '\n' ' ')"

say "== 3: circuit 8 from chain, REF targets replaced by RTL, against split_check_mod"
cec s3 "read_verilog $R/split_check_mod.v; read_verilog $E/g8.v; read_verilog $E/c8-rtlrefs.v;" g8 c8 equivalent
cec s3-mut "read_verilog -DMUTANT_VALID_OR $R/split_check_mod.v; read_verilog $E/g8.v; read_verilog $E/c8-rtlrefs.v;" g8 c8 different

if [ $fail = 0 ]; then say "CHAIN: every link holds"; else say "CHAIN: NOT closed (see lines above)"; exit 1; fi
