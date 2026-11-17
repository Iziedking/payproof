// P0 spike: China annual one-time bonus, separate taxation. First draft for size
// and solver timing, not the rule pack. Bracket and quick deduction figures are
// from secondary sources read 2026-11-16; the official text is still to be read.
// Rounding is still open: this draft floors each product to the fen.
//
// Input: bonus in fen. The bracket is picked by comparing the bonus with twelve
// times each monthly limit, so there is no division by 12.
module cn_bonus (
  input  [31:0] bonus,
  output [31:0] tax,
  output [31:0] net
);
  // 12 x monthly limit, in fen
  localparam [31:0] L1 = 32'd3600000;    //  3,000 x 12 yuan
  localparam [31:0] L2 = 32'd14400000;   // 12,000 x 12
  localparam [31:0] L3 = 32'd30000000;   // 25,000 x 12
  localparam [31:0] L4 = 32'd42000000;   // 35,000 x 12
  localparam [31:0] L5 = 32'd66000000;   // 55,000 x 12
  localparam [31:0] L6 = 32'd96000000;   // 80,000 x 12

  reg [6:0]  rate;    // percent
  reg [31:0] qd;      // quick deduction in fen
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
  wire [38:0] gross = prod / 100;
  assign tax = gross[31:0] - qd;
  assign net = bonus - tax;
endmodule
