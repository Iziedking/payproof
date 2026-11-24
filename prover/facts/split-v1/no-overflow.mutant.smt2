; MUTANT of no-overflow.smt2: t10k is given 13 bits of headroom instead of 14 (N*8192), which
; is too narrow for total*10000, so this file must come back sat.
; Spike A, no overflow in split_check.v for every width W >= 1.
; N stands for 2^W, so every W-bit input is in [0, N-1]. The RTL wires are
;   pt   [2W-1:0]   = payout*total        lhs  [2W+13:0] = pt*10000
;   t10k [W+13:0]   = total*10000         lhs1 [2W+14:0] = lhs + t10k
;   ps   [2W-1:0]   = pot*shares          rhs  [2W+13:0] = ps*8500
; 2^(2W) = N*N, 2^(W+14) = N*16384, 2^(2W+14) = N*N*16384, 2^(2W+15) = N*N*32768.
; Each wire must hold its largest possible value. sat means some value does
; not fit; unsat means every value fits, so the comparisons are exact.
(set-logic QF_NIA)
(declare-const N Int) (declare-const pot Int) (declare-const shares Int)
(declare-const total Int) (declare-const payout Int)
(assert (>= N 2))
(assert (and (<= 0 pot) (< pot N) (<= 0 shares) (< shares N)
             (<= 0 total) (< total N) (<= 0 payout) (< payout N)))
(assert (or (>= (* payout total) (* N N))
            (>= (* payout total 10000) (* N N 16384))
            (>= (* total 10000) (* N 8192))
            (>= (+ (* payout total 10000) (* total 10000)) (* N N 32768))
            (>= (* pot shares) (* N N))
            (>= (* pot shares 8500) (* N N 16384))))
(check-sat)
