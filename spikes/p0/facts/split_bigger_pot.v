// P0 spike fact. W is set with -DW=<width>. Module C is the synthesised NAND netlist
// of split_compute at that width, renamed to C by the prover script; K is split_check.
// bad = 1 exactly when the input is valid and the fact is broken.
// Fact bigger-pot-never-less: same shares and total, p1 < p2 gives payout(p2) >= payout(p1).
module fact (input [`W-1:0] p1, input [`W-1:0] p2, input [`W-1:0] shares, input [`W-1:0] total, output bad);
  wire [`W-1:0] q1, q2, f1, f2;
  C c1 (.pot(p1), .shares(shares), .total(total), .payout(q1), .fee(f1));
  C c2 (.pot(p2), .shares(shares), .total(total), .payout(q2), .fee(f2));
  wire valid = (total != 0) && (shares <= total) && (p1 < p2);
  assign bad = valid && (q2 < q1);
endmodule
