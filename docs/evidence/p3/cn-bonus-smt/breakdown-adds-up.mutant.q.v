module q (input [31:0] x, output bad);
  wire [63:0] o_c;
  cn_dec c (.in(x), .out(o_c));
  wire [31:0] tax0 = o_c[31:0];
  wire [31:0] net = o_c[63:32];
  wire [31:0] tax = (x == 32'd5000000) ? tax0 + 32'd1 : tax0;
  wire [62:0] e;
  cn_exp ce (.in(x), .out(e));
  wire [20:0] qd = e[30:10];
  wire [31:0] tbd = e[62:31];
  assign bad = ({1'b0, tax} != ({1'b0, tbd} - {12'd0, qd}));
endmodule
