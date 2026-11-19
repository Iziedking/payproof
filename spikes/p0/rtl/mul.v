// P0 spike C: a plain unsigned W x W multiplier, synthesised with the same flow as
// split_check, to calibrate the arithmetic-aware checkers (ABC &acec and &polyn)
// before they are used on the multipliers inside split_check.
module mul #(parameter W = 8) (input [W-1:0] a, input [W-1:0] b, output [2*W-1:0] y);
  assign y = a * b;
endmodule
