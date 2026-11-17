// P0 spike: split-v1 check circuit, first draft for size and solver timing.
// The claimant supplies payout; ok is 1 exactly when
//   payout * 10000 * total <= pot * HOLDER_BPS * shares < (payout + 1) * 10000 * total
// and the inputs are valid (total > 0, shares <= total).
module split_check #(
  parameter W = 32,
  parameter HOLDER_BPS = 8500
) (
  input  [W-1:0] pot,
  input  [W-1:0] shares,
  input  [W-1:0] total,
  input  [W-1:0] payout,
  output ok
);
  wire [2*W-1:0]  pt   = payout * total;
  wire [2*W+13:0] lhs  = pt * 10000;
  wire [W+13:0]   t10k = total * 10000;
  wire [2*W+14:0] lhs1 = lhs + t10k;
  wire [2*W-1:0]  ps   = pot * shares;
  wire [2*W+13:0] rhs  = ps * HOLDER_BPS;
  wire valid = (total != 0) && (shares <= total);
  assign ok = valid && (lhs <= rhs) && ({1'b0, rhs} < lhs1);
endmodule
