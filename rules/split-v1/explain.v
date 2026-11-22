// split-v1 explanation circuit (docs/specs/explain-validity.md, section 3).
// Not run by any contract. Gives the three numbers decision circuit 8 compares, so a
// page can show the holder's exact share (exact_num / den) next to the payout:
//   ok == valid && paid_num <= exact_num && exact_num < paid_num + den
// (P3 fact explain-matches-check). Built only from modules already on chain, joined by
// REF: m_mul_tmc_32 (circuit 3, twice), m_x8500 (4), m_x10000_narrow (6),
// m_x10000_wide (7), and the new split_v1_validity circuit. The module definitions
// are read from spikes/p0/rtl/split_check_mod.v and rules/split-v1/validity.v; each
// instance has the same connections and widths as in split_check_mod.
module split_v1_explain #(
  parameter W = 32,
  parameter HOLDER_BPS = 8500
) (
  input  [W-1:0]    pot,
  input  [W-1:0]    shares,
  input  [W-1:0]    total,
  input  [W-1:0]    payout,
  output [2*W+13:0] exact_num,  // pot x shares x HOLDER_BPS  (rhs in split_check_mod)
  output [2*W+13:0] paid_num,   // payout x total x 10000     (lhs)
  output [W+13:0]   den,        // total x 10000              (t10k)
  output            valid
);
  wire [2*W-1:0] pt, ps;
  m_mul           #(.W(W)) u_pt   (.a(payout), .b(total), .y(pt));
  m_mul           #(.W(W)) u_ps   (.a(pot), .b(shares), .y(ps));
  m_x10000_wide   #(.W(W)) u_lhs  (.a(pt), .y(paid_num));
  m_x10000_narrow #(.W(W)) u_t10k (.a(total), .y(den));
  m_x8500 #(.W(W), .HOLDER_BPS(HOLDER_BPS)) u_rhs (.a(ps), .y(exact_num));
  split_v1_validity #(.W(W)) u_valid (.pot(pot), .shares(shares), .total(total),
                                      .payout(payout), .valid(valid));
endmodule
