// Query 2: a one-fen raise that lowers take-home pay, excluding points already found.
module fact (input [31:0] b, output bad);
  wire [31:0] t1, t2, n1, n2;
  wire [31:0] b2 = b + 32'd1;
  C c1 (.bonus(b),  .tax(t1), .net(n1));
  C c2 (.bonus(b2), .tax(t2), .net(n2));
  wire excluded = 1'b0 || (b == 32'd96000000);
  assign bad = (b != 32'hFFFFFFFF) && !excluded && (n2 < n1);
endmodule
