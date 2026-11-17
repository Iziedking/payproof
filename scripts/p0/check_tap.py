#!/usr/bin/env python3
"""P0 spike: run converted netlists through the TAP-02 reference evaluator
(vendor/taps reference.py, TAPs commit 075dd834a72c) and compare with a plain
Python version of each draft formula on random and boundary inputs.

Usage: check_tap.py <reference_dir> <tap json>... ; exits 1 on any mismatch.
"""
import json
import random
import sys

sys.path.insert(0, sys.argv[1])
import reference  # noqa: E402  TAP-02 reference implementation


def split_compute(W, pot, shares, total, H=8500, FB=1000):
    valid = total != 0 and shares <= total
    payout = (pot * shares * H) // (10000 * total) if valid else 0
    return {"payout": payout & ((1 << W) - 1), "fee": ((pot * FB) // 10000) & ((1 << W) - 1)}


def split_check(W, pot, shares, total, payout, H=8500):
    valid = total != 0 and shares <= total
    lhs = payout * total * 10000
    rhs = pot * shares * H
    return {"ok": int(valid and lhs <= rhs < lhs + total * 10000)}


def cn_bonus(bonus):
    lims = [(3600000, 3, 0), (14400000, 10, 21000), (30000000, 20, 141000),
            (42000000, 25, 266000), (66000000, 30, 441000), (96000000, 35, 716000)]
    rate, qd = 45, 1516000
    for lim, r, q in lims:
        if bonus <= lim:
            rate, qd = r, q
            break
    tax = ((bonus * rate) // 100 - qd) & 0xFFFFFFFF
    return {"tax": tax, "net": (bonus - tax) & 0xFFFFFFFF}


def ng_paye(gross, pension, nhf, nhis, life, mortgage, rent, r3=18):
    relief = min(rent // 5, 500000)
    ded = pension + nhf + nhis + life + mortgage + relief
    ch = gross - ded if gross > ded else 0

    def sl(lo, w):
        return 0 if ch <= lo else min(ch - lo, w)
    t100 = (sl(800000, 2200000) * 15 + sl(3000000, 9000000) * r3 + sl(12000000, 13000000) * 21
            + sl(25000000, 25000000) * 23 + (ch - 50000000 if ch > 50000000 else 0) * 25)
    at = 0 if gross <= 840000 else (t100 // 100) & ((1 << 30) - 1)
    return {"annual_tax": at, "monthly_tax": (at // 12) & ((1 << 27) - 1)}


def oracle_for(name):
    if name == "adder8":
        return lambda a, b: {"s": a + b}
    if name == "cn_bonus":
        return cn_bonus
    if name == "ng_paye":
        return ng_paye
    if name == "ng_paye_mutant19":
        return lambda *a: ng_paye(*a, r3=19)
    if name.startswith("split_compute_"):
        W = int(name.rsplit("_", 1)[1])
        return lambda *a: split_compute(W, *a)
    if name.startswith("split_check_"):
        W = int(name.rsplit("_", 1)[1])
        return lambda *a: split_check(W, *a)
    raise SystemExit(f"no oracle for {name}")


def pack_inputs(layout, values, n_in):
    bits = [0] * n_in
    for p in layout:
        v = values[p["name"]]
        for i in range(p["width"]):
            bits[p["offset"] + i] = (v >> i) & 1
    return bits


def unpack_outputs(layout, bits):
    return {p["name"]: sum(bits[p["offset"] + i] << i for i in range(p["width"])) for p in layout}


def cases(name, layout, rng, n):
    widths = [p["width"] for p in layout]
    names = [p["name"] for p in layout]
    out = []
    edge = lambda w: [0, 1, 2, (1 << w) - 1, (1 << w) - 2, 1 << (w - 1)]
    for i, w in enumerate(widths):
        for e in edge(w):
            vals = [rng.getrandbits(x) for x in widths]
            vals[i] = e
            out.append(vals)
    if name.startswith("split"):  # valid region: shares <= total, total > 0
        for _ in range(n):
            vals = [rng.getrandbits(x) for x in widths]
            t = max(1, vals[2])
            vals[2], vals[1] = t, rng.randint(0, t)
            if name.startswith("split_check"):
                vals[3] = split_compute(widths[0], vals[0], vals[1], vals[2])["payout"] + rng.choice([0, 0, -1, 1])
                vals[3] %= 1 << widths[0]
            out.append(vals)
    if name == "cn_bonus":  # every bracket edge in fen, and one fen either side
        for lim in [3600000, 14400000, 30000000, 42000000, 66000000, 96000000]:
            out += [[lim - 1], [lim], [lim + 1]]
    if name.startswith("ng_paye"):
        for g in [840000, 840001, 800000, 3000000, 12000000, 25000000, 50000000, 50000001]:
            out.append([g, 0, 0, 0, 0, 0, 0])
    for _ in range(n):
        out.append([rng.getrandbits(x) for x in widths])
    return [dict(zip(names, v)) for v in out]


def main():
    ref_dir, files = sys.argv[1], sys.argv[2:]
    bad = 0
    for f in files:
        d = json.load(open(f))
        name = d["module"]
        nl = bytes.fromhex(d["netlistHex"][2:])
        reference.decode(nl, d["nIn"])  # raises on ill-formed
        circ = reference.load(nl, d["nIn"], d["nOut"])
        oracle = oracle_for(name)
        rng = random.Random(20261117)
        n = 1000 if d["gates"] < 20000 else 200
        mism = 0
        tested = 0
        for vals in cases(name, d["inputs"], rng, n):
            bits = pack_inputs(d["inputs"], vals, d["nIn"])
            _, outs = reference.beat(circ, [], bits)
            got = unpack_outputs(d["outputs"], outs)
            want = oracle(*[vals[p["name"]] for p in d["inputs"]])
            tested += 1
            if got != want:
                mism += 1
                if mism <= 3:
                    print(f"  MISMATCH {name} in={vals} got={got} want={want}")
        print(f"{name}: gates={d['gates']} bytes={d['bytes']} cases={tested} mismatches={mism}")
        bad += mism
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
