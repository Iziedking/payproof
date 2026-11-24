module g5 (input [123:0] in, output [78:0] out);
  assign out = in[77:0] + in[123:78] + 1;
endmodule
