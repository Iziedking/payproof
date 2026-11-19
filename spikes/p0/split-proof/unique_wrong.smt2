; Calibration for spike A: a claim that is false, so the solvers must answer sat.
; With the upper bound relaxed to (p+2), two payouts can both be accepted.
(set-logic QF_NIA)
(declare-const pot Int) (declare-const shares Int) (declare-const total Int)
(declare-const a Int) (declare-const b Int)
(assert (and (>= pot 0) (>= shares 0) (>= total 0) (>= a 0) (>= b 0)))
(define-fun ok ((p Int)) Bool
  (and (> total 0) (<= shares total)
       (<= (* p total 10000) (* pot 8500 shares))
       (< (* pot 8500 shares) (* (+ p 2) total 10000))))
(assert (ok a)) (assert (ok b)) (assert (distinct a b))
(check-sat)
