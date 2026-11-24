module q (input [31:0] x, output bad);
  wire [63:0] o_c;
  cn_dec c (.in(x), .out(o_c));
  wire [31:0] tax = o_c[31:0];
  wire [31:0] net = o_c[63:32];
  assign bad = tax > x;
endmodule
