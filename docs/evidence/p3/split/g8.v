module g8 (input [127:0] in, output [0:0] out);
  split_check_mod #(.W(32), .HOLDER_BPS(8500)) u (.pot(in[31:0]), .shares(in[63:32]), .total(in[95:64]), .payout(in[127:96]), .ok(out[0]));
endmodule
