module q (input [31:0] x, output bad);
  wire [31:0] f0;
  fee_c c (.in(x), .out(f0));
  wire [31:0] f = f0;
  wire [63:0] lo = {32'd0, f} * 64'd10000;
  wire [63:0] mid = {32'd0, x} * 64'd1000;
  wire [63:0] hi = ({32'd0, f} + 64'd1) * 64'd10000;
  assign bad = !(lo <= mid && mid < hi);
endmodule
