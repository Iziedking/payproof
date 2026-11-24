// SIMULATED ENGINE. Not a real vendor's code. Written by the Payproof team to show engine
// equality on chain (PLAN L13, section 13 P3). Candidate label: "Simulated engine A (China bonus)".
//
// A second candidate for engine A. The first (cn_vendor_a.v) moves the quick deduction inside
// the division by 100; ABC, Yosys sat and Z3 could not decide its equality with circuit 9 in
// 900 s. This one keeps the reference's arithmetic (bonus x rate, floor divide by 100, minus the
// quick deduction) and computes the rest a different way, as an engine built on a rate table
// might:
// - the bracket is a count of how many of the six limits the bonus is above, not a chain of
//   comparisons from the bottom;
// - rate and quick deduction are looked up by that count;
// - take-home is bonus plus the two's complement of the tax, not a subtraction.
// It is expected to be EQUAL to the reference for every 32-bit bonus. The prover decides; this
// comment is not proof.
//
// Same layout as circuit 9: input bonus[31:0] in fen; outputs tax[31:0], net[31:0].
module cn_vendor_a2 (
  input  [31:0] bonus,
  output [31:0] tax,
  output [31:0] net
);
  // How many of the six limits (12 x the monthly limit, in fen) the bonus is above: 0 to 6.
  wire [2:0] k = (bonus > 32'd3600000)  + (bonus > 32'd14400000) + (bonus > 32'd30000000)
               + (bonus > 32'd42000000) + (bonus > 32'd66000000) + (bonus > 32'd96000000);

  reg [6:0]  rate;
  reg [31:0] qd;
  always @* begin
    case (k)
      3'd0:    begin rate = 7'd3;  qd = 32'd0;       end
      3'd1:    begin rate = 7'd10; qd = 32'd21000;   end
      3'd2:    begin rate = 7'd20; qd = 32'd141000;  end
      3'd3:    begin rate = 7'd25; qd = 32'd266000;  end
      3'd4:    begin rate = 7'd30; qd = 32'd441000;  end
      3'd5:    begin rate = 7'd35; qd = 32'd716000;  end
      default: begin rate = 7'd45; qd = 32'd1516000; end
    endcase
  end

  wire [38:0] prod  = bonus * rate;
  wire [38:0] gross = prod / 100;
  assign tax = gross[31:0] - qd;
  assign net = bonus + ~tax + 32'd1;
endmodule
