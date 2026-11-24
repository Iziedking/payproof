module q (input [194:0] x, output bad);
  wire [56:0] o_c; ng_dec c (.in(x), .out(o_c));
  wire [29:0] t_c = o_c[29:0];
  wire [29:0] t = (x[29:0] == 30'd1000) ? 30'd1001 : t_c;
  assign bad = t > x[29:0];
endmodule
