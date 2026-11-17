// P0 spike fact. W is set with -DW=<width>. Module C is the synthesised NAND netlist
// of split_compute at that width, renamed to C by the prover script; K is split_check.
// bad = 1 exactly when the input is valid and the fact is broken.
// Fact never-overpays: payout * 10000 * total <= pot * 8500 * shares.
module fact (input [`W-1:0] pot, input [`W-1:0] shares, input [`W-1:0] total, output bad);
  wire [`W-1:0] payout, fee;
  C c (.pot(pot), .shares(shares), .total(total), .payout(payout), .fee(fee));
  wire [2*`W+13:0] lhs = {14'd0, payout} * {14'd0, total} * 10000;
  wire [2*`W+13:0] rhs = {14'd0, pot} * {14'd0, shares} * 8500;
  wire valid = (total != 0) && (shares <= total);
  assign bad = valid && (lhs > rhs);
endmodule
