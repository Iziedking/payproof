// P0 spike fact. W is set with -DW=<width>. Module C is the synthesised NAND netlist
// of split_compute at that width, renamed to C by the prover script; K is split_check.
// bad = 1 exactly when the input is valid and the fact is broken.
// Fact splitting-never-pays-more: payout(s1) + payout(s2) <= payout(s1 + s2).
module fact (input [`W-1:0] pot, input [`W-1:0] s1, input [`W-1:0] s2, input [`W-1:0] total, output bad);
  wire [`W:0] sum = {1'b0, s1} + {1'b0, s2};
  wire [`W-1:0] q1, q2, q3, f1, f2, f3;
  C c1 (.pot(pot), .shares(s1), .total(total), .payout(q1), .fee(f1));
  C c2 (.pot(pot), .shares(s2), .total(total), .payout(q2), .fee(f2));
  C c3 (.pot(pot), .shares(sum[`W-1:0]), .total(total), .payout(q3), .fee(f3));
  wire valid = (total != 0) && (sum <= {1'b0, total});
  assign bad = valid && (({1'b0, q1} + {1'b0, q2}) > {1'b0, q3});
endmodule
