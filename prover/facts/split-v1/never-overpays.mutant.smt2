; split-v1, P3 fact never-overpays, over unbounded integers (every width).
; ok(pot, s, total, p) is the predicate circuit 8 computes (rules/split-v1/README.md): the
; claimant's payout p is accepted exactly when the input is valid and
;   p*total*10000 <= pot*8500*s < (p+1)*total*10000.
; That circuit 8 computes this predicate with no overflow is the rest of the chain
; (scripts/p3/split-chain.sh). Claim: an accepted payout is never more than the holder's exact share.
; unsat means the fact holds.
; MUTANT: a broken ok; this file must come back sat. ok accepts the share rounded up.
(set-logic QF_NIA)
(define-fun ok ((pot Int) (s Int) (total Int) (p Int)) Bool
  (and (> total 0) (<= s total)
       (< (* (- p 1) total 10000) (* pot 8500 s))
       (<= (* pot 8500 s) (* p total 10000))))
(declare-const pot Int) (declare-const s Int) (declare-const total Int) (declare-const p Int)
(assert (and (>= pot 0) (>= s 0) (>= total 0) (>= p 0)))
(assert (ok pot s total p))
(assert (> (* p total 10000) (* pot 8500 s)))
(check-sat)
