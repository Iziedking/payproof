module fact (input [31:0] b, output bad);
  wire [31:0] t1, t2, n1, n2;
  wire [31:0] b2 = b + 32'd1;
  C c1 (.bonus(b),  .tax(t1), .net(n1));
  C c2 (.bonus(b2), .tax(t2), .net(n2));
  wire excluded = 1'b0 || (b == 32'd66000000) || (b == 32'd30000000) || (b == 32'd96000000) || (b == 32'd42000000) || (b == 32'd3600000) || (b == 32'd14400000);
  assign bad = (b[31:26] == 6'd7) && (b != 32'hFFFFFFFF) && !excluded && (n2 < n1);
endmodule
