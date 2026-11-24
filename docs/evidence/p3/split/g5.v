module g5 (input [123:0] in, output [78:0] out);
  m_add #(.W(32)) u (.a(in[77:0]), .b(in[123:78]), .y(out));
endmodule
