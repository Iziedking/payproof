#!/usr/bin/env python3
"""P1: write rules/<rule>/vectors.json from the rule readings in each rules/<rule>/README.md.

Plain integer arithmetic, written separately from scripts/p0/check_tap.py so the two can be
compared. Every vector carries a `source`: "derived" (worked from the README formula at the
named point) or an official worked example with its URL. No vector here is from an official
worked example yet; the README says so.

Usage: make_vectors.py <repo root>
"""
import json
import sys
from pathlib import Path

ROOT = Path(sys.argv[1])


def mask(w):
    return (1 << w) - 1


# ---------- Nigeria PAYE (rules/ng-paye-nta2025/README.md) ----------
NG_BANDS = [(800_000, 0), (2_200_000, 15), (9_000_000, 18), (13_000_000, 21), (25_000_000, 23)]
NG_TOP = 25
NG_MIN_WAGE_ANNUAL = 840_000


def ng_paye(gross, pension=0, nhf=0, nhis=0, life=0, mortgage=0, rent=0):
    relief = min(rent // 5, 500_000)
    ded = pension + nhf + nhis + life + mortgage + relief
    ch = gross - ded if gross > ded else 0
    if gross <= NG_MIN_WAGE_ANNUAL:
        return {"annual_tax": 0, "monthly_tax": 0}
    left, t100 = ch, 0
    for width, rate in NG_BANDS:
        part = min(left, width)
        t100 += part * rate
        left -= part
    t100 += left * NG_TOP
    annual = t100 // 100
    return {"annual_tax": annual & mask(30), "monthly_tax": (annual // 12) & mask(27)}


def ng_vectors():
    out = []
    zero = dict(pension=0, nhf=0, nhis=0, life=0, mortgage=0, rent=0)

    def add(why, **kw):
        inp = {**zero, **kw}
        out.append({"inputs": {k: str(v) for k, v in inp.items()},
                    "outputs": {k: str(v) for k, v in ng_paye(**inp).items()},
                    "source": "derived", "why": why})
    # minimum wage edge (sections 58, 162 (1) (t), our reading)
    for g in (0, 1, 839_999, 840_000):
        add(f"gross {g:,}: at or below the minimum wage, exempt", gross=g)
    add("gross 840,001: first naira above the minimum wage; 15% of 40,001 = 6,000", gross=840_001)
    # band edges on chargeable income, no deductions (Fourth Schedule)
    for edge in (800_000, 3_000_000, 12_000_000, 25_000_000, 50_000_000):
        for d in (-1, 0, 1):
            g = edge + d
            if g > NG_MIN_WAGE_ANNUAL:
                add(f"chargeable {g:,}: band edge {edge:,} {d:+d}", gross=g)
    # rent relief: 20% of rent, cap N500,000 reached at rent 2,500,000 (section 30 (2) (a) (vi))
    for rent in (0, 4, 5, 2_499_999, 2_500_000, 2_500_005, 10_000_000):
        add(f"gross 6,000,000, rent {rent:,}: relief min(rent/5, 500,000)", gross=6_000_000, rent=rent)
    # each section 30 deduction alone
    for k in ("pension", "nhf", "nhis", "life", "mortgage"):
        add(f"gross 6,000,000 with {k} 400,000", gross=6_000_000, **{k: 400_000})
    # deductions above gross: chargeable 0
    add("deductions above gross: chargeable 0, tax 0", gross=1_000_000, pension=1_200_000)
    # largest values the layout holds
    add("largest gross the 30-bit field holds", gross=mask(30))
    add("largest gross and every deduction field at its maximum", gross=mask(30), pension=mask(27),
        nhf=mask(27), nhis=mask(27), life=mask(27), mortgage=mask(27), rent=mask(30))
    return out


# ---------- China bonus (rules/cn-bonus-2023-30/README.md) ----------
CN_TABLE = [(3_000, 3, 0), (12_000, 10, 210), (25_000, 20, 1_410), (35_000, 25, 2_660),
            (55_000, 30, 4_410), (80_000, 35, 7_160)]
CN_TOP = (45, 15_160)


def cn_bonus(bonus_fen):
    rate, qd_yuan = CN_TOP
    for limit_yuan, r, q in CN_TABLE:
        if bonus_fen <= limit_yuan * 12 * 100:
            rate, qd_yuan = r, q
            break
    tax = (bonus_fen * rate) // 100 - qd_yuan * 100
    return {"tax": tax & mask(32), "net": (bonus_fen - tax) & mask(32)}


def cn_vectors():
    out = []

    def add(fen, why):
        o = cn_bonus(fen)
        out.append({"inputs": {"bonus": str(fen)}, "outputs": {k: str(v) for k, v in o.items()},
                    "source": "derived", "why": why})
    add(0, "no bonus")
    add(1, "one fen")
    for limit_yuan, _, _ in CN_TABLE:
        edge = limit_yuan * 12 * 100
        for d in (-1, 0, 1):
            add(edge + d, f"12 x {limit_yuan:,} yuan = {edge // 100:,} yuan {d:+d} fen")
    add(3_600_100, "36,001 yuan: the first trap; take-home below 36,000 yuan's")
    add(mask(32), "largest bonus the 32-bit field holds (42,949,672.95 yuan)")
    return out


# ---------- split-v1 check circuit (rules/split-v1/README.md) ----------
HOLDER_BPS = 8500


def split_payout(pot, shares, total):
    return (pot * HOLDER_BPS * shares) // (10_000 * total)


def split_ok(pot, shares, total, payout):
    if total == 0 or shares > total:
        return 0
    lhs = payout * total * 10_000
    rhs = pot * shares * HOLDER_BPS
    return int(lhs <= rhs < lhs + total * 10_000)


def split_vectors():
    out = []
    M = mask(32)

    def add(pot, shares, total, payout, why):
        out.append({"inputs": {"pot": str(pot), "shares": str(shares), "total": str(total),
                               "payout": str(payout)},
                    "outputs": {"ok": str(split_ok(pot, shares, total, payout))},
                    "source": "derived", "why": why})
    for pot, shares, total in [(1_000_000, 250, 1_000), (100, 1, 3), (7, 1, 1), (M, M, M), (M, 1, M),
                               (1, 1, M), (0, 5, 10), (10_000, 0, 10)]:
        p = split_payout(pot, shares, total)
        add(pot, shares, total, p, f"pot {pot}, shares {shares}/{total}: the correct payout {p}")
        add(pot, shares, total, (p + 1) & M, "one unit too high")
        if p > 0:
            add(pot, shares, total, p - 1, "one unit too low")
    add(5, 0, 0, 0, "total zero: not valid")
    add(1_000, 11, 10, 0, "shares above total: not valid")
    add(0, 0, 0, 0, "all zero: not valid")
    return out


def write(rule, vectors, notes):
    p = ROOT / "rules" / rule / "vectors.json"
    doc = {"rule": rule, "notes": notes, "count": len(vectors), "vectors": vectors}
    p.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{rule}: {len(vectors)} vectors -> {p.relative_to(ROOT)}")


write("ng-paye-nta2025", ng_vectors(),
      "Derived from the README formula: Nigeria Tax Act 2025 sections 30, 58, 162 (1) (t) and the "
      "Fourth Schedule, read 2026-11-21. Minimum wage N840,000 a year (our reading, D3). Tax floored "
      "once on the annual total (D4). No official worked example yet.")
write("cn-bonus-2023-30", cn_vectors(),
      "Derived from the README formula: MOF/STA Announcement 2023 No. 30 and its attached monthly "
      "rate table, read 2026-11-21. Amounts in fen; bonus x rate floored to the fen (D12 open). "
      "No official worked example yet.")
write("split-v1", split_vectors(),
      "Derived from the README rule, holderBps 8500, 32-bit fields.")

# Self-checks on figures stated in the READMEs.
assert ng_paye(840_001) == {"annual_tax": 6_000, "monthly_tax": 500}
assert ng_paye(840_000)["annual_tax"] == 0
assert cn_bonus(3_600_000)["tax"] == 108_000          # 36,000 yuan x 3% = 1,080 yuan
assert cn_bonus(3_600_100)["net"] < cn_bonus(3_600_000)["net"]
assert split_payout(1_000_000, 250, 1_000) == 212_500
print("self-checks passed")
