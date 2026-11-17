// P0 spike fact. W is set with -DW=<width>. Module C is the synthesised NAND netlist
// of split_compute at that width, renamed to C by the prover script; K is split_check.
// bad = 1 exactly when the input is valid and the fact is broken.
// Check circuit fact: at most one payout is accepted for the same inputs.
module fact (input [`W-1:0] pot, input [`W-1:0] shares, input [`W-1:0] total, input [`W-1:0] a, input [`W-1:0] b, output bad);
  wire oka, okb;
  K ka (.pot(pot), .shares(shares), .total(total), .payout(a), .ok(oka));
  K kb (.pot(pot), .shares(shares), .total(total), .payout(b), .ok(okb));
  assign bad = oka && okb && (a != b);
endmodule
