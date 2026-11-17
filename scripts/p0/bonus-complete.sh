#!/usr/bin/env bash
# P0: prove that no one-fen drop in take-home pay exists other than the points the
# trap search found (proofs/bonus-traps). The whole question timed out at 600 s, so
# the 32-bit bonus range is split into 64 equal slices by its top 6 bits and each
# slice is proved on its own. The split uses no knowledge of the brackets.
# The list is complete only if every slice reports UNSATISFIABLE.
# Usage: bash bonus-complete.sh <timeout-per-slice> <parallel>
set -uo pipefail
T="${1:-600}"; J="${2:-2}"
O=oss-cad-suite/bin
d=proofs/bonus-complete; mkdir -p "$d"
found=$(sed -n 's/^found: //p' proofs/bonus-traps/summary.txt)
excl="1'b0"; for b in $found; do excl="$excl || (b == 32'd$b)"; done
slice() {
  local k="$1" f="$d/slice-$1"
  cat > "$f.v" <<EOF
module fact (input [31:0] b, output bad);
  wire [31:0] t1, t2, n1, n2;
  wire [31:0] b2 = b + 32'd1;
  C c1 (.bonus(b),  .tax(t1), .net(n1));
  C c2 (.bonus(b2), .tax(t2), .net(n2));
  wire excluded = $excl;
  assign bad = (b[31:26] == 6'd$k) && (b != 32'hFFFFFFFF) && !excluded && (n2 < n1);
endmodule
EOF
  $O/yosys -q -p "read_verilog $f.v; read_verilog nets/cn_bonus.nand.v; rename cn_bonus C; hierarchy -top fact; proc; flatten; opt_clean; techmap; opt -fast; aigmap; write_aiger -zinit $f.aig" > /dev/null 2>&1
  local t0 t1 s
  t0=$(date +%s.%N)
  timeout --kill-after=10 "$T" $O/yosys-abc -c "read_aiger $f.aig; strash; iprove" > "$f.log" 2>&1
  t1=$(date +%s.%N)
  if grep -q '^UNSATISFIABLE' "$f.log"; then s=none; elif grep -q '^SATISFIABLE' "$f.log"; then s=FOUND; else s=undecided; fi
  printf 'slice %02d %s %.1f\n' "$k" "$s" "$(awk -v a="$t0" -v b="$t1" 'BEGIN{print b-a}')"
}
export -f slice; export d O T excl
seq 0 63 | xargs -P "$J" -I{} bash -c 'slice {}' | sort > "$d/summary.txt"
awk '{c[$3]++} END {for (k in c) print k, c[k]}' "$d/summary.txt" | tee "$d/totals.txt"
