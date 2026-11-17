// P0 spike fact. W is set with -DW=<width>. Module C is the synthesised NAND netlist
// of split_compute at that width, renamed to C by the prover script; K is split_check.
// bad = 1 exactly when the input is valid and the fact is broken.
// Check circuit fact: accepted payouts never fall when shares rise (same pot and total).
module fact (input [`W-1:0] pot, input [`W-1:0] s1, input [`W-1:0] s2, input [`W-1:0] total, input [`W-1:0] a, input [`W-1:0] b, output bad);
  wire oka, okb;
  K ka (.pot(pot), .shares(s1), .total(total), .payout(a), .ok(oka));
  K kb (.pot(pot), .shares(s2), .total(total), .payout(b), .ok(okb));
  assign bad = oka && okb && (s1 < s2) && (b < a);
endmodule
