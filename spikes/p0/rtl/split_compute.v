// P0 spike: split-v1 compute circuit, first draft for size and solver timing.
// Not the rule pack.
//   payout = floor(pot * HOLDER_BPS * shares / (10000 * total))   when total > 0
//   fee    = floor(pot * FEE_BPS / 10000)
// Valid inputs: shares <= total, total > 0. Outside that range payout is 0.
// HOLDER_BPS and FEE_BPS are constants: each setting set is its own circuit.
module split_compute #(
  parameter W = 32,
  parameter HOLDER_BPS = 8500,
  parameter FEE_BPS = 1000
) (
  input  [W-1:0] pot,
  input  [W-1:0] shares,
  input  [W-1:0] total,
  output [W-1:0] payout,
  output [W-1:0] fee
);
  wire [2*W-1:0]  ps  = pot * shares;
  wire [2*W+13:0] num = ps * HOLDER_BPS;
  wire [W+13:0]   den = total * 10000;
  wire [2*W+13:0] q   = num / den;
  wire valid = (total != 0) && (shares <= total);
  assign payout = valid ? q[W-1:0] : {W{1'b0}};

  wire [W+9:0] pf = pot * FEE_BPS;
  wire [W+9:0] fq = pf / 10000;
  assign fee = fq[W-1:0];
endmodule
