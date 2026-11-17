// P0 spike fact for ng_paye (module C is the synthesised NAND netlist).
// Fact tax-within-income: annual tax never exceeds gross income.
module fact (input [29:0] gross, input [26:0] pension, input [26:0] nhf, input [26:0] nhis,
             input [26:0] life, input [26:0] mortgage, input [29:0] rent, output bad);
  wire [29:0] at; wire [26:0] mt;
  C c (.gross(gross), .pension(pension), .nhf(nhf), .nhis(nhis), .life(life),
       .mortgage(mortgage), .rent(rent), .annual_tax(at), .monthly_tax(mt));
  assign bad = at > gross;
endmodule
