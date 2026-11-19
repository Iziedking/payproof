; Spike A, fact check_more_shares, over unbounded integers (every width).
; Same ok(p) as unique.smt2. Claim: with the same pot and total, when shares
; rise the accepted payout never falls. unsat means it holds.
(set-logic QF_NIA)
(declare-const pot Int) (declare-const s1 Int) (declare-const s2 Int)
(declare-const total Int) (declare-const a Int) (declare-const b Int)
(assert (and (>= pot 0) (>= s1 0) (>= s2 0) (>= total 0) (>= a 0) (>= b 0)))
(define-fun ok ((s Int) (p Int)) Bool
  (and (> total 0) (<= s total)
       (<= (* p total 10000) (* pot 8500 s))
       (< (* pot 8500 s) (* (+ p 1) total 10000))))
(assert (ok s1 a)) (assert (ok s2 b)) (assert (< s1 s2)) (assert (< b a))
(check-sat)
