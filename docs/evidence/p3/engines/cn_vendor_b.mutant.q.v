module q (input [31:0] x, output bad);
  wire [63:0] a, b0;
  cn_ref r (.in(x), .out(a));
  cn_eng e (.in(x), .out(b0));
  wire [63:0] b = (x == 32'd5000000) ? {b0[63:32], b0[31:0] + 32'd1} : b0;
  assign bad = a != b;
endmodule
