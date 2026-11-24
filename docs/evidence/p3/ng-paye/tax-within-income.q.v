module q (input [194:0] x, output bad);
  wire [56:0] o_c; ng_dec c (.in(x), .out(o_c));
  wire [29:0] t_c = o_c[29:0];
  assign bad = t_c > x[29:0];
endmodule
