#!/usr/bin/env bash
# P0: find every point where one more fen of bonus lowers take-home pay, using the
# solver only. Nothing about the brackets is given to it.
#   Query k: is there a bonus b (not one already found) with net(b + 1) < net(b)?
#   SAT   -> record b, exclude it, ask again.
#   UNSAT -> no such point remains: the list is complete (proved).
# Engine: ABC `iprove` on the AIGER miter, `write_cex` for the input. Each point found
# is replayed with Yosys `sat -set b <value> -prove bad 0`, which must report FAIL.
# (A first version used Yosys `sat` for the search; query 2 was undecided after
#  600 s, so the search moved to ABC. That run is kept in proofs/bonus-traps-sat/.)
# Runs in the node-services container after nets/cn_bonus.nand.v is in place.
# Usage: bash bonus-traps.sh <timeout-per-query> <max-queries>
set -uo pipefail
T="${1:-600}"; MAXQ="${2:-12}"
O=oss-cad-suite/bin
d=proofs/bonus-traps; mkdir -p "$d"
found=()
: > "$d/summary.txt"
for q in $(seq 1 "$MAXQ"); do
  excl="1'b0"
  for b in "${found[@]}"; do excl="$excl || (b == 32'd$b)"; done
  cat > "$d/fact-$q.v" <<EOF
// Query $q: a one-fen raise that lowers take-home pay, excluding points already found.
module fact (input [31:0] b, output bad);
  wire [31:0] t1, t2, n1, n2;
  wire [31:0] b2 = b + 32'd1;
  C c1 (.bonus(b),  .tax(t1), .net(n1));
  C c2 (.bonus(b2), .tax(t2), .net(n2));
  wire excluded = $excl;
  assign bad = (b != 32'hFFFFFFFF) && !excluded && (n2 < n1);
endmodule
EOF
  base="read_verilog $d/fact-$q.v; read_verilog nets/cn_bonus.nand.v; rename cn_bonus C; hierarchy -top fact; proc; flatten; opt_clean"
  $O/yosys -q -p "$base; techmap; opt -fast; aigmap; write_aiger -zinit $d/q$q.aig" > "$d/aig-$q.log" 2>&1
  rm -f "$d/q$q.cex"
  t0=$(date +%s.%N)
  timeout --kill-after=10 "$T" $O/yosys-abc -c "read_aiger $d/q$q.aig; strash; iprove; write_cex -n $d/q$q.cex" > "$d/abc-$q.log" 2>&1
  rc=$?
  t1=$(date +%s.%N); secs=$(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.1f", b-a}')
  if [ $rc -eq 0 ] && grep -q '^UNSATISFIABLE' "$d/abc-$q.log"; then
    echo "query $q: none left (proved, ABC UNSATISFIABLE) in ${secs}s" | tee -a "$d/summary.txt"; break
  elif [ $rc -eq 0 ] && grep -q '^SATISFIABLE' "$d/abc-$q.log" && [ -s "$d/q$q.cex" ]; then
    # write_cex -n lists pi<i>@0=<bit>; the AIGER inputs are b[0..31] in order.
    b=$(awk -F'[=@i]' '/^pi[0-9]+@0=/ {v += $4 * 2^$2} END {printf "%d", v}' "$d/q$q.cex")
    $O/yosys -q -l "$d/replay-$q.log" -p "$base; sat -set b $b -prove bad 0" > /dev/null 2>&1
    if grep -q 'FAIL!' "$d/replay-$q.log"; then rep="replayed: Yosys sat FAIL at b"; else rep="REPLAY DID NOT REPRODUCE"; fi
    found+=("$b")
    echo "query $q: b = $b fen ($(awk -v x="$b" 'BEGIN{printf "%.2f", x/100}') yuan) in ${secs}s; $rep" | tee -a "$d/summary.txt"
    [ "$rep" = "REPLAY DID NOT REPRODUCE" ] && break
  else
    echo "query $q: undecided after ${secs}s (rc=$rc)" | tee -a "$d/summary.txt"; break
  fi
done
echo "found: ${found[*]}" | tee -a "$d/summary.txt"
