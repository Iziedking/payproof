; Spike A, fact check_unique, over unbounded integers (every width).
; ok(p) is the integer predicate the split_check RTL computes when nothing
; overflows (no-overflow is shown separately in no_overflow.smt2):
;   valid  = total > 0 and shares <= total
;   ok(p)  = valid and p*total*10000 <= pot*8500*shares < (p+1)*total*10000
; Claim: two different payouts are never both accepted. unsat means it holds.
(set-logic QF_NIA)
(declare-const pot Int) (declare-const shares Int) (declare-const total Int)
(declare-const a Int) (declare-const b Int)
(assert (and (>= pot 0) (>= shares 0) (>= total 0) (>= a 0) (>= b 0)))
(define-fun ok ((p Int)) Bool
  (and (> total 0) (<= shares total)
       (<= (* p total 10000) (* pot 8500 shares))
       (< (* pot 8500 shares) (* (+ p 1) total 10000))))
(assert (ok a)) (assert (ok b)) (assert (distinct a b))
(check-sat)
