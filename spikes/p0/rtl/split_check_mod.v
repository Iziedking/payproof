// P0 spike C, module split: the split-v1 check circuit cut into modules so each
// part can be proved on its own. Every wire keeps the width and the expression it has
// in split_check.v, so split_check_mod computes the same ok bit for every input.
// Synthesis keeps the module boundaries until after ABC (see synth-all.sh, group
// check-mod-*), so no gate is optimised across modules.

// a * b, full width. Used twice: payout * total and pot * shares.
module m_mul #(parameter W = 32) (
  input  [W-1:0]   a,
  input  [W-1:0]   b,
  output [2*W-1:0] y
);
  assign y = a * b;
endmodule

// pt * 10000 (lhs in split_check.v).
module m_x10000_wide #(parameter W = 32) (
  input  [2*W-1:0]  a,
  output [2*W+13:0] y
);
  assign y = a * 10000;
endmodule

// total * 10000 (t10k in split_check.v).
module m_x10000_narrow #(parameter W = 32) (
  input  [W-1:0]  a,
  output [W+13:0] y
);
  assign y = a * 10000;
endmodule

// ps * HOLDER_BPS (rhs in split_check.v).
module m_x8500 #(parameter W = 32, parameter HOLDER_BPS = 8500) (
  input  [2*W-1:0]  a,
  output [2*W+13:0] y
);
  assign y = a * HOLDER_BPS;
endmodule

// lhs + t10k (lhs1 in split_check.v).
module m_add #(parameter W = 32) (
  input  [2*W+13:0] a,
  input  [W+13:0]   b,
  output [2*W+14:0] y
);
  assign y = a + b;
endmodule

// The input checks and both comparisons.
module m_cmp #(parameter W = 32) (
  input  [W-1:0]    shares,
  input  [W-1:0]    total,
  input  [2*W+13:0] lhs,
  input  [2*W+14:0] lhs1,
  input  [2*W+13:0] rhs,
  output            ok
);
`ifdef MUTANT_VALID_OR
  // Control for the proof scripts only: accepts shares > total (payout 0, pot 0).
  wire valid = (total != 0) || (shares <= total);
`else
  wire valid = (total != 0) && (shares <= total);
`endif
  assign ok = valid && (lhs <= rhs) && ({1'b0, rhs} < lhs1);
endmodule

module split_check_mod #(
  parameter W = 32,
  parameter HOLDER_BPS = 8500
) (
  input  [W-1:0] pot,
  input  [W-1:0] shares,
  input  [W-1:0] total,
  input  [W-1:0] payout,
  output ok
);
  wire [2*W-1:0]  pt, ps;
  wire [2*W+13:0] lhs, rhs;
  wire [W+13:0]   t10k;
  wire [2*W+14:0] lhs1;
  m_mul           #(.W(W)) u_pt   (.a(payout), .b(total), .y(pt));
  m_mul           #(.W(W)) u_ps   (.a(pot), .b(shares), .y(ps));
  m_x10000_wide   #(.W(W)) u_lhs  (.a(pt), .y(lhs));
  m_x10000_narrow #(.W(W)) u_t10k (.a(total), .y(t10k));
  m_x8500 #(.W(W), .HOLDER_BPS(HOLDER_BPS)) u_rhs (.a(ps), .y(rhs));
  m_add           #(.W(W)) u_lhs1 (.a(lhs), .b(t10k), .y(lhs1));
  m_cmp           #(.W(W)) u_ok   (.shares(shares), .total(total), .lhs(lhs), .lhs1(lhs1),
                                   .rhs(rhs), .ok(ok));
endmodule
