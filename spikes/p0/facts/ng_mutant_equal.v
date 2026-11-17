// P0 spike: equality of the ng_paye draft (C) with a mutant whose third band is
// 19% instead of 18% (K). Expected to FAIL: it times the solver on a known-different pair.
module fact (input [29:0] gross, input [26:0] pension, input [26:0] nhf, input [26:0] nhis,
             input [26:0] life, input [26:0] mortgage, input [29:0] rent, output bad);
  wire [29:0] a1, a2; wire [26:0] m1, m2;
  C c (.gross(gross), .pension(pension), .nhf(nhf), .nhis(nhis), .life(life),
       .mortgage(mortgage), .rent(rent), .annual_tax(a1), .monthly_tax(m1));
  K k (.gross(gross), .pension(pension), .nhf(nhf), .nhis(nhis), .life(life),
       .mortgage(mortgage), .rent(rent), .annual_tax(a2), .monthly_tax(m2));
  assign bad = (a1 != a2) || (m1 != m2);
endmodule
