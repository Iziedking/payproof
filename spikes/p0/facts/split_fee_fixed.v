// P0 spike fact. W is set with -DW=<width>. Module C is the synthesised NAND netlist
// of split_compute at that width, renamed to C by the prover script; K is split_check.
// bad = 1 exactly when the input is valid and the fact is broken.
// Fact fee-is-fixed: the fee depends only on the pot.
module fact (input [`W-1:0] pot, input [`W-1:0] s1, input [`W-1:0] t1, input [`W-1:0] s2, input [`W-1:0] t2, output bad);
  wire [`W-1:0] q1, q2, f1, f2;
  C c1 (.pot(pot), .shares(s1), .total(t1), .payout(q1), .fee(f1));
  C c2 (.pot(pot), .shares(s2), .total(t2), .payout(q2), .fee(f2));
  assign bad = (f1 != f2);
endmodule
