; split-v1, P3 fact a-payout-accepted, over unbounded integers (every width).
; ok(pot, s, total, p) is the predicate circuit 8 computes (rules/split-v1/README.md): the
; claimant's payout p is accepted exactly when the input is valid and
;   p*total*10000 <= pot*8500*s < (p+1)*total*10000.
; That circuit 8 computes this predicate with no overflow is the rest of the chain
; (scripts/p3/split-chain.sh). Support fact: for every valid input some payout is accepted.
; unsat means the fact holds.
; MUTANT: a broken ok; this file must come back sat. ok uses a strict lower bound, so nothing is accepted when the share is a whole number.
(set-logic QF_NIA)
(define-fun ok ((pot Int) (s Int) (total Int) (p Int)) Bool
  (and (> total 0) (<= s total)
       (< (* p total 10000) (* pot 8500 s))
       (< (* pot 8500 s) (* (+ p 1) total 10000))))
(declare-const pot Int) (declare-const s Int) (declare-const total Int)
(assert (and (>= pot 0) (>= s 0) (> total 0) (<= s total)))
(assert (not (ok pot s total (div (* pot 8500 s) (* total 10000)))))
(check-sat)
