// ng-paye-nta2025 explanation circuit (docs/specs/explain-validity.md, section 3).
// Not run by any contract. Shows how decision circuit 10 (spikes/p0/rtl/ng_paye.v)
// reaches its tax: rent relief, deductions, chargeable income, the minimum wage
// exemption and the income in each band of the Fourth Schedule. Every shared value
// uses the same expression and width as ng_paye.v. A band's tax is its income times a
// whole percent, exact in kobo, so it is not an output here. P3 fact
// breakdown-adds-up: chargeable == band1 + ... + band6 and
// annual_tax == exempt ? 0 : floor((15 band2 + 18 band3 + 21 band4 + 23 band5 + 25 band6) / 100).
//
// Inputs: the decision layout, annual, whole naira. No validity circuit: every input
// is valid (owner decision A, 2026-11-22). Minimum wage test: our reading (D3).
module ng_paye_explain (
  input  [29:0] gross,
  input  [26:0] pension,
  input  [26:0] nhf,
  input  [26:0] nhis,
  input  [26:0] life,
  input  [26:0] mortgage,
  input  [29:0] rent,
  output [18:0] rent_relief,   // largest 500,000
  output [31:0] deductions,
  output [29:0] chargeable,
  output        exempt,
  output [19:0] band1,         // (0 .. 800,000]             at 0%
  output [21:0] band2,         // (800,000 .. 3,000,000]     at 15%
  output [23:0] band3,         // (3,000,000 .. 12,000,000]  at 18%
  output [23:0] band4,         // (12,000,000 .. 25,000,000] at 21%
  output [24:0] band5,         // (25,000,000 .. 50,000,000] at 23%
  output [29:0] band6          // above 50,000,000           at 25%
);
  wire [29:0] rent_fifth = rent / 5;
  wire [29:0] relief = (rent_fifth > 30'd500000) ? 30'd500000 : rent_fifth;
  wire [31:0] ded = pension + nhf + nhis + life + mortgage + relief;
  wire [29:0] ch = ({2'b00, gross} > ded) ? (gross - ded[29:0]) : 30'd0;

  // Portion of chargeable income in each band (as ng_paye.v).
  function [29:0] slice(input [29:0] c, input [29:0] lo, input [29:0] width);
    if (c <= lo) slice = 30'd0;
    else if (c - lo >= width) slice = width;
    else slice = c - lo;
  endfunction
  wire [29:0] b1 = (ch > 30'd800000) ? 30'd800000 : ch;
  wire [29:0] b2 = slice(ch, 30'd800000,   30'd2200000);
  wire [29:0] b3 = slice(ch, 30'd3000000,  30'd9000000);
  wire [29:0] b4 = slice(ch, 30'd12000000, 30'd13000000);
  wire [29:0] b5 = slice(ch, 30'd25000000, 30'd25000000);
  wire [29:0] b6 = (ch > 30'd50000000) ? (ch - 30'd50000000) : 30'd0;

  assign rent_relief = relief[18:0];
  assign deductions  = ded;
  assign chargeable  = ch;
  assign exempt      = gross <= 30'd840000;
  assign band1 = b1[19:0];
  assign band2 = b2[21:0];
  assign band3 = b3[23:0];
  assign band4 = b4[23:0];
  assign band5 = b5[24:0];
  assign band6 = b6;
endmodule
