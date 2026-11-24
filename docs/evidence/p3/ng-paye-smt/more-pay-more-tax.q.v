module q (input [224:0] x, output bad);
  wire [29:0] g2 = x[224:195];
  wire [56:0] o_c1; ng_dec c1 (.in(x[194:0]), .out(o_c1));
  wire [29:0] t_c1 = o_c1[29:0];
  wire [56:0] o_c2; ng_dec c2 (.in({x[194:30], g2}), .out(o_c2));
  wire [29:0] t_c2 = o_c2[29:0];
  assign bad = (x[29:0] < g2) && (t_c2 < t_c1);
endmodule
