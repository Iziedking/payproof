// cn-bonus-2023-30 explanation circuit (docs/specs/explain-validity.md, section 3).
// Not run by any contract. Shows how decision circuit 9 (spikes/p0/rtl/cn_bonus.v)
// reaches its tax: the row of the rate table, the rate, the quick deduction and the
// tax before the deduction. Every shared value uses the same expression and width as
// cn_bonus.v, so tax == tax_before_deduction - quick_deduction (P3 fact
// breakdown-adds-up). Rounding: floor to the fen (owner decision D12, 2026-11-19).
//
// Input: bonus in fen, the decision layout. No validity circuit: every input is
// valid (owner decision A, 2026-11-22).
module cn_bonus_explain (
  input  [31:0] bonus,
  output [2:0]  bracket,               // 1 to 7, row of the rate table
  output [6:0]  rate,                  // percent
  output [20:0] quick_deduction,       // fen; largest 1,516,000
  output [31:0] tax_before_deduction   // floor(bonus x rate / 100), fen
);
  // 12 x monthly limit, in fen (as cn_bonus.v)
  localparam [31:0] L1 = 32'd3600000;    //  3,000 x 12 yuan
  localparam [31:0] L2 = 32'd14400000;   // 12,000 x 12
  localparam [31:0] L3 = 32'd30000000;   // 25,000 x 12
  localparam [31:0] L4 = 32'd42000000;   // 35,000 x 12
  localparam [31:0] L5 = 32'd66000000;   // 55,000 x 12
  localparam [31:0] L6 = 32'd96000000;   // 80,000 x 12

  reg [2:0]  row;
  reg [6:0]  r;
  reg [31:0] qd;
  always @* begin
    if      (bonus <= L1) begin row = 3'd1; r = 7'd3;  qd = 32'd0;       end
    else if (bonus <= L2) begin row = 3'd2; r = 7'd10; qd = 32'd21000;   end
    else if (bonus <= L3) begin row = 3'd3; r = 7'd20; qd = 32'd141000;  end
    else if (bonus <= L4) begin row = 3'd4; r = 7'd25; qd = 32'd266000;  end
    else if (bonus <= L5) begin row = 3'd5; r = 7'd30; qd = 32'd441000;  end
    else if (bonus <= L6) begin row = 3'd6; r = 7'd35; qd = 32'd716000;  end
    else                  begin row = 3'd7; r = 7'd45; qd = 32'd1516000; end
  end

  wire [38:0] prod  = bonus * r;
  wire [38:0] gross = prod / 100;
  assign bracket              = row;
  assign rate                 = r;
  assign quick_deduction      = qd[20:0];
  assign tax_before_deduction = gross[31:0];
endmodule
