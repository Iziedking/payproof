// split-v1 validity circuit (docs/specs/explain-validity.md, section 2).
// valid = 1 exactly when the rule is defined for the input: total > 0 and
// shares <= total. Same expression as the `valid` wire of m_cmp in
// spikes/p0/rtl/split_check_mod.v (decision circuit 8). Takes the whole decision
// input layout (pot, shares, total, payout; 128 bits) so one input vector serves all
// three circuits; pot and payout are not used.
module split_v1_validity #(parameter W = 32) (
  input  [W-1:0] pot,
  input  [W-1:0] shares,
  input  [W-1:0] total,
  input  [W-1:0] payout,
  output         valid
);
  assign valid = (total != 0) && (shares <= total);
endmodule
