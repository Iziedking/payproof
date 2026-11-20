// P0 spike C, module split step 2: map Yosys simple gates to NAND and NOT one by one,
// with no logic optimisation, so the multiplier keeps the structure AMulet proved on the
// RTL mapping (half and full adders with XOR outputs). Used by synth-all.sh group mul-tm-*.
// Each module name is the cell type it replaces (Yosys techmap: with no techmap_celltype
// attribute, the module name is used to match the cell; help read on host-service
// 2026-11-20). XOR is written as NAND(NAND(a, ~b), NAND(~a, b)), which an AIG reads as
// the usual three-AND XOR; the four-NAND form would not.

module \$_AND_ (input A, input B, output Y);
  wire t;
  \$_NAND_ g0 (.A(A), .B(B), .Y(t));
  \$_NOT_  g1 (.A(t), .Y(Y));
endmodule

module \$_OR_ (input A, input B, output Y);
  wire na, nb;
  \$_NOT_  g0 (.A(A), .Y(na));
  \$_NOT_  g1 (.A(B), .Y(nb));
  \$_NAND_ g2 (.A(na), .B(nb), .Y(Y));
endmodule

module \$_NOR_ (input A, input B, output Y);
  wire t;
  \$_OR_  g0 (.A(A), .B(B), .Y(t));
  \$_NOT_ g1 (.A(t), .Y(Y));
endmodule

module \$_XOR_ (input A, input B, output Y);
  wire na, nb, l, r;
  \$_NOT_  g0 (.A(A), .Y(na));
  \$_NOT_  g1 (.A(B), .Y(nb));
  \$_NAND_ g2 (.A(A), .B(nb), .Y(l));
  \$_NAND_ g3 (.A(na), .B(B), .Y(r));
  \$_NAND_ g4 (.A(l), .B(r), .Y(Y));
endmodule

module \$_XNOR_ (input A, input B, output Y);
  wire t;
  \$_XOR_ g0 (.A(A), .B(B), .Y(t));
  \$_NOT_ g1 (.A(t), .Y(Y));
endmodule

// ANDNOT: A & ~B.  ORNOT: A | ~B (Yosys simcells).
module \$_ANDNOT_ (input A, input B, output Y);
  wire nb, t;
  \$_NOT_  g0 (.A(B), .Y(nb));
  \$_NAND_ g1 (.A(A), .B(nb), .Y(t));
  \$_NOT_  g2 (.A(t), .Y(Y));
endmodule

module \$_ORNOT_ (input A, input B, output Y);
  wire na;
  \$_NOT_  g0 (.A(A), .Y(na));
  \$_NAND_ g1 (.A(na), .B(B), .Y(Y));
endmodule

// MUX: S ? B : A.
module \$_MUX_ (input A, input B, input S, output Y);
  wire ns, l, r;
  \$_NOT_  g0 (.A(S), .Y(ns));
  \$_NAND_ g1 (.A(A), .B(ns), .Y(l));
  \$_NAND_ g2 (.A(B), .B(S), .Y(r));
  \$_NAND_ g3 (.A(l), .B(r), .Y(Y));
endmodule
