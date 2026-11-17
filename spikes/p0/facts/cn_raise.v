// P0 spike fact for cn_bonus (module C is the synthesised NAND netlist).
// Fact raise-never-lowers-take-home: b1 < b2 gives net(b2) >= net(b1). Expected to FAIL.
module fact (input [31:0] b1, input [31:0] b2, output bad);
  wire [31:0] t1, t2, n1, n2;
  C c1 (.bonus(b1), .tax(t1), .net(n1));
  C c2 (.bonus(b2), .tax(t2), .net(n2));
  assign bad = (b1 < b2) && (n2 < n1);
endmodule
