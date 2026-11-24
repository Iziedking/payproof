module g7 (input [63:0] in, output [77:0] out);
  m_x10000_wide #(.W(32)) u (.a(in[63:0]), .y(out));
endmodule
