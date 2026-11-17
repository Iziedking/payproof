// P0 spike fact. W is set with -DW=<width>. Module C is the synthesised NAND netlist
// of split_compute at that width, renamed to C by the prover script; K is split_check.
// bad = 1 exactly when the input is valid and the fact is broken.
// Fact at-most-one-unit-short: pot * 8500 * shares < (payout + 1) * 10000 * total.
module fact (input [`W-1:0] pot, input [`W-1:0] shares, input [`W-1:0] total, output bad);
  wire [`W-1:0] payout, fee;
  C c (.pot(pot), .shares(shares), .total(total), .payout(payout), .fee(fee));
  wire [2*`W+14:0] lhs1 = ({15'd0, payout} + 1) * {15'd0, total} * 10000;
  wire [2*`W+14:0] rhs = {15'd0, pot} * {15'd0, shares} * 8500;
  wire valid = (total != 0) && (shares <= total);
  assign bad = valid && (rhs >= lhs1);
endmodule
