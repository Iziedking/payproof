module q (input [194:0] x, output bad);
  wire [56:0] o_c; ng_dec c (.in(x), .out(o_c));
  wire [29:0] t_c = o_c[29:0];
  wire [29:0] t = (x[29:0] == 30'd5000000) ? t_c + 30'd1 : t_c;
  wire [226:0] e; ng_exp ce (.in(x), .out(e));
  wire [39:0] b1 = e[101:82], b2 = e[123:102], b3 = e[147:124], b4 = e[171:148], b5 = e[196:172], b6 = e[226:197];
  wire [39:0] ch = e[80:51];
  wire [39:0] bandTax = (40'd15 * b2 + 40'd18 * b3 + 40'd21 * b4 + 40'd23 * b5 + 40'd25 * b6) / 40'd100;
  wire [39:0] want = e[81] ? 40'd0 : bandTax;
  assign bad = (b1 + b2 + b3 + b4 + b5 + b6 != ch) || ({10'd0, t} != want);
endmodule
