module g4 (input [63:0] in, output [77:0] out);
  m_x8500 #(.W(32), .HOLDER_BPS(8500)) u (.a(in[63:0]), .y(out));
endmodule
