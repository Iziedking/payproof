module q (input [31:0] x, output bad);
  wire [63:0] a, b0;
  cn_ref r (.in(x), .out(a));
  cn_eng e (.in(x), .out(b0));
  wire [63:0] b = b0;
  assign bad = a != b;
endmodule
