; split-v1, P3 fact more-shares-never-less, over unbounded integers (every width).
; ok(pot, s, total, p) is the predicate circuit 8 computes (rules/split-v1/README.md): the
; claimant's payout p is accepted exactly when the input is valid and
;   p*total*10000 <= pot*8500*s < (p+1)*total*10000.
; That circuit 8 computes this predicate with no overflow is the rest of the chain
; (scripts/p3/split-chain.sh). Claim: with the same pot and total, more shares never gives a smaller accepted payout.
; unsat means the fact holds.
; MUTANT: a broken ok; this file must come back sat. ok accepts any payout up to the share.
(set-logic QF_NIA)
(define-fun ok ((pot Int) (s Int) (total Int) (p Int)) Bool
  (and (> total 0) (<= s total)
       (<= (* p total 10000) (* pot 8500 s))))
(declare-const pot Int) (declare-const s1 Int) (declare-const s2 Int) (declare-const total Int)
(declare-const a Int) (declare-const b Int)
(assert (and (>= pot 0) (>= s1 0) (>= s2 0) (>= total 0) (>= a 0) (>= b 0)))
(assert (ok pot s1 total a)) (assert (ok pot s2 total b)) (assert (< s1 s2)) (assert (< b a))
(check-sat)
