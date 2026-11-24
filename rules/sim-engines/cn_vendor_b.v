// SIMULATED ENGINE. Not a real vendor's code. Written by the Payproof team to show a disproof
// on chain (PLAN L13, section 13 P3 and P4). Label: "Simulated engine B (China bonus)".
//
// It is the reference rule cn-bonus-2023-30 (spikes/p0/rtl/cn_bonus.v, circuit 9) with one
// change: the product bonus x rate is rounded to the nearest fen, halves up, where the
// reference floors it. Rounding is an open point in our reading of the rule (PLAN D12), so this
// is a plausible engine, not a silly one. It is expected to DIFFER from the reference wherever
// bonus x rate mod 100 >= 50, for example a bonus of 0.17 yuan at 3% (17 x 3 = 51). A
// disproof says only that the two circuits differ for a valid input (PLAN L7), not which
// reading of the rule is right.
//
// Same layout as circuit 9: input bonus[31:0] in fen; outputs tax[31:0], net[31:0].
module cn_vendor_b (
  input  [31:0] bonus,
  output [31:0] tax,
  output [31:0] net
);
  localparam [31:0] L1 = 32'd3600000;
  localparam [31:0] L2 = 32'd14400000;
  localparam [31:0] L3 = 32'd30000000;
  localparam [31:0] L4 = 32'd42000000;
  localparam [31:0] L5 = 32'd66000000;
  localparam [31:0] L6 = 32'd96000000;

  reg [6:0]  rate;
  reg [31:0] qd;
  always @* begin
    if      (bonus <= L1) begin rate = 7'd3;  qd = 32'd0;       end
    else if (bonus <= L2) begin rate = 7'd10; qd = 32'd21000;   end
    else if (bonus <= L3) begin rate = 7'd20; qd = 32'd141000;  end
    else if (bonus <= L4) begin rate = 7'd25; qd = 32'd266000;  end
    else if (bonus <= L5) begin rate = 7'd30; qd = 32'd441000;  end
    else if (bonus <= L6) begin rate = 7'd35; qd = 32'd716000;  end
    else                  begin rate = 7'd45; qd = 32'd1516000; end
  end

  wire [38:0] prod  = bonus * rate;
  wire [38:0] gross = (prod + 39'd50) / 100;   // the one change: round half up
  assign tax = gross[31:0] - qd;
  assign net = bonus - tax;
endmodule
