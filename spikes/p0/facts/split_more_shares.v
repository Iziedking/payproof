// P0 spike fact. W is set with -DW=<width>. Module C is the synthesised NAND netlist
// of split_compute at that width, renamed to C by the prover script; K is split_check.
// bad = 1 exactly when the input is valid and the fact is broken.
// Fact more-shares-never-less: same pot and total, s1 < s2 gives payout(s2) >= payout(s1).
module fact (input [`W-1:0] pot, input [`W-1:0] s1, input [`W-1:0] s2, input [`W-1:0] total, output bad);
  wire [`W-1:0] q1, q2, f1, f2;
  C c1 (.pot(pot), .shares(s1), .total(total), .payout(q1), .fee(f1));
  C c2 (.pot(pot), .shares(s2), .total(total), .payout(q2), .fee(f2));
  wire valid = (total != 0) && (s2 <= total) && (s1 < s2);
  assign bad = valid && (q2 < q1);
endmodule
