// P0 spike fact. W is set with -DW=<width>. Module C is the synthesised NAND netlist
// of split_compute at that width, renamed to C by the prover script; K is split_check.
// bad = 1 exactly when the input is valid and the fact is broken.
// Check circuit fact: on every valid input the check accepts the compute circuit's payout.
module fact (input [`W-1:0] pot, input [`W-1:0] shares, input [`W-1:0] total, output bad);
  wire [`W-1:0] payout, fee; wire ok;
  C c (.pot(pot), .shares(shares), .total(total), .payout(payout), .fee(fee));
  K k (.pot(pot), .shares(shares), .total(total), .payout(payout), .ok(ok));
  wire valid = (total != 0) && (shares <= total);
  assign bad = valid && !ok;
endmodule
