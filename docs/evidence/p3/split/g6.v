module g6 (input [31:0] in, output [45:0] out);
  m_x10000_narrow #(.W(32)) u (.a(in[31:0]), .y(out));
endmodule
