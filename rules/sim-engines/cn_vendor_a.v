// SIMULATED ENGINE. Not a real vendor's code. Written by the Payproof team to show engine
// equality on chain (PLAN L13, section 13 P3). Label: "Simulated engine A (China bonus)".
//
// It computes the China bonus tax of rule cn-bonus-2023-30 a different way from the reference
// circuit (spikes/p0/rtl/cn_bonus.v, taped out as circuit 9): it subtracts the quick deduction,
// scaled by 100, before dividing by 100, instead of after. Because the quick deduction times
// 100 is a whole multiple of 100, floor((b x r - 100 x qd) / 100) = floor(b x r / 100) - qd
// whenever b x r >= 100 x qd, which holds in every bracket. So this engine is expected to be
// EQUAL to the reference for every 32-bit bonus. The prover decides; this comment is not proof.
//
// Same layout as circuit 9: input bonus[31:0] in fen; outputs tax[31:0], net[31:0].
module cn_vendor_a (
  input  [31:0] bonus,
  output [31:0] tax,
  output [31:0] net
);
  // Bracket limits: 12 x the monthly limit, in fen, as in the reference.
  wire b1 = bonus <= 32'd3600000;
  wire b2 = bonus <= 32'd14400000;
  wire b3 = bonus <= 32'd30000000;
  wire b4 = bonus <= 32'd42000000;
  wire b5 = bonus <= 32'd66000000;
  wire b6 = bonus <= 32'd96000000;

  wire [6:0]  rate = b1 ? 7'd3 : b2 ? 7'd10 : b3 ? 7'd20 : b4 ? 7'd25 : b5 ? 7'd30 : b6 ? 7'd35 : 7'd45;
  // Quick deduction times 100, in fen x 100.
  wire [38:0] qd100 = b1 ? 39'd0 : b2 ? 39'd2100000 : b3 ? 39'd14100000 : b4 ? 39'd26600000
                    : b5 ? 39'd44100000 : b6 ? 39'd71600000 : 39'd151600000;

  wire [38:0] prod = bonus * rate;
  wire [38:0] t    = (prod - qd100) / 39'd100;
  assign tax = t[31:0];
  assign net = bonus - tax;
endmodule
