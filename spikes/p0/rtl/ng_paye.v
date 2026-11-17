// P0 spike: Nigeria PAYE under the Nigeria Tax Act 2025. First draft for size and
// solver timing, not the rule pack. Input layout and formula as in the ng-paye-nta2025 rule notes.
// All amounts annual, whole naira. Open points: minimum wage test taken
// as gross <= 840,000; tax floored to the naira once on the annual total.
//
// `ifdef MUTANT_RATE19 changes the third band from 18% to 19%. It exists only to
// time the solver on a known-different pair.
module ng_paye (
  input  [29:0] gross,
  input  [26:0] pension,
  input  [26:0] nhf,
  input  [26:0] nhis,
  input  [26:0] life,
  input  [26:0] mortgage,
  input  [29:0] rent,
  output [29:0] annual_tax,
  output [26:0] monthly_tax
);
`ifdef MUTANT_RATE19
  localparam [4:0] R3 = 5'd19;
`else
  localparam [4:0] R3 = 5'd18;
`endif
  wire [29:0] rent_fifth = rent / 5;
  wire [29:0] relief = (rent_fifth > 30'd500000) ? 30'd500000 : rent_fifth;
  wire [31:0] deductions = pension + nhf + nhis + life + mortgage + relief;
  wire [29:0] chargeable = ({2'b00, gross} > deductions) ? (gross - deductions[29:0]) : 30'd0;
  wire exempt = gross <= 30'd840000;

  // Portion of chargeable income in each band.
  function [29:0] slice(input [29:0] c, input [29:0] lo, input [29:0] width);
    if (c <= lo) slice = 30'd0;
    else if (c - lo >= width) slice = width;
    else slice = c - lo;
  endfunction
  wire [29:0] b2 = slice(chargeable, 30'd800000,   30'd2200000);
  wire [29:0] b3 = slice(chargeable, 30'd3000000,  30'd9000000);
  wire [29:0] b4 = slice(chargeable, 30'd12000000, 30'd13000000);
  wire [29:0] b5 = slice(chargeable, 30'd25000000, 30'd25000000);
  wire [29:0] b6 = (chargeable > 30'd50000000) ? (chargeable - 30'd50000000) : 30'd0;

  // Tax in hundredths of a naira, exact, then floored once.
  wire [36:0] t100 = b2 * 5'd15 + b3 * R3 + b4 * 5'd21 + b5 * 5'd23 + b6 * 5'd25;
  wire [36:0] t = t100 / 100;
  assign annual_tax = exempt ? 30'd0 : t[29:0];
  wire [29:0] m = annual_tax / 12;
  assign monthly_tax = m[26:0];
endmodule
