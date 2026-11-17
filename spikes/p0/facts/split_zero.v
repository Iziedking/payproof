// P0 spike fact. W is set with -DW=<width>. Module C is the synthesised NAND netlist
// of split_compute at that width, renamed to C by the prover script; K is split_check.
// bad = 1 exactly when the input is valid and the fact is broken.
// Fact zero-in-zero-out: no shares, no payout.
module fact (input [`W-1:0] pot, input [`W-1:0] total, output bad);
  wire [`W-1:0] payout, fee;
  C c (.pot(pot), .shares({`W{1'b0}}), .total(total), .payout(payout), .fee(fee));
  assign bad = (total != 0) && (payout != 0);
endmodule
