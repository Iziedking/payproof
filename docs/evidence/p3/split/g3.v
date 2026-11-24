module g3 (input [63:0] in, output [63:0] out);
  m_mul #(.W(32)) u (.a(in[31:0]), .b(in[63:32]), .y(out));
endmodule
