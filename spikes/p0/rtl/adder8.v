// P0 spike: the small circuit taped out first on X Layer. 8-bit + 8-bit = 9-bit.
module adder8 (
  input  [7:0] a,
  input  [7:0] b,
  output [8:0] s
);
  assign s = a + b;
endmodule
