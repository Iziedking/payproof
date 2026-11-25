// split-v1 fee circuit (PLAN 11.1; owner decision D17, 2026-11-25: feeBps = 1000).
//
//   fee = floor(pot x feeBps / 10000) = floor(pot x 1000 / 10000) = floor(pot / 10)
//
// The two forms are equal for every whole pot: pot x 1000 / 10000 reduces to pot / 10 exactly,
// so their floors agree. The only input is the pot, so the fee cannot depend on anything else
// (fact fee-is-fixed). SplitVault sends the deposit, not the carried-over amount, so a carry is
// never charged.
//
// Same units as circuit 8: whole vault units (0.01 token), 32 bits. Bit offsets as in
// rules/split-v1/layout.json: input pot at bit 0, output fee at bit 0.
module split_fee (
  input  [31:0] pot,
  output [31:0] fee
);
  assign fee = pot / 32'd10;
endmodule
