#!/usr/bin/env python3
"""P0 spike C, module split step 2: remove redundant NOT gates from a NAND/NOT netlist.

Usage: python3 not_cleanup.py <in.json> <module> <out.json>

Works on the Yosys JSON netlist of one module that has only $_NAND_ and $_NOT_ cells
(synth-all.sh group mul-tmc-*). Three rewrites, repeated until nothing changes:
  1. NOT(NOT(x)) -> x: users of the outer NOT read x instead.
  2. NOTs with the same input -> one NOT.
  3. NANDs with the same two inputs (in either order) -> one NAND.
Then cells whose output nobody reads are dropped. A bit that is a module output is never
rewired, so every output keeps its own driver. An AIG has no separate inverter nodes, so
rewrite 1 leaves the AIG unchanged; rewrites 2 and 3 merge nodes that structural hashing
would merge anyway. The result is still checked by AMulet like any other netlist.
"""
import json
import sys


def main():
    src, top, dst = sys.argv[1:4]
    design = json.load(open(src))
    mod = design["modules"][top]
    cells = mod["cells"]
    for name, c in cells.items():
        if c["type"] not in ("$_NAND_", "$_NOT_"):
            sys.exit(f"cell {name} has type {c['type']}; only $_NAND_ and $_NOT_ allowed")
    out_bits = {b for p in mod["ports"].values() if p["direction"] == "output"
                for b in p["bits"] if isinstance(b, int)}
    start = {t: sum(1 for c in cells.values() if c["type"] == t) for t in ("$_NAND_", "$_NOT_")}

    rounds = 0
    while True:
        rounds += 1
        driver = {c["connections"]["Y"][0]: n for n, c in cells.items()}
        rep = {}
        # 1. double NOT
        for n, c in cells.items():
            if c["type"] != "$_NOT_":
                continue
            y, a = c["connections"]["Y"][0], c["connections"]["A"][0]
            inner = driver.get(a)
            if inner is not None and cells[inner]["type"] == "$_NOT_" and y not in out_bits:
                rep[y] = cells[inner]["connections"]["A"][0]
        # 2 and 3. same cell type with the same inputs
        seen = {}
        for n, c in sorted(cells.items()):
            y = c["connections"]["Y"][0]
            if y in rep or y in out_bits:
                continue
            if c["type"] == "$_NOT_":
                key = ("NOT", c["connections"]["A"][0])
            else:
                key = ("NAND",) + tuple(sorted(map(str, (c["connections"]["A"][0], c["connections"]["B"][0]))))
            if key in seen:
                rep[y] = seen[key]
            else:
                seen[key] = y

        def resolve(b):
            while b in rep:
                b = rep[b]
            return b

        changed = False
        for c in cells.values():
            for port in ("A", "B"):
                if port in c["connections"]:
                    old = c["connections"][port][0]
                    new = resolve(old)
                    if new != old:
                        c["connections"][port] = [new]
                        changed = True
        # drop cells nobody reads
        while True:
            used = set(out_bits)
            for c in cells.values():
                for port in ("A", "B"):
                    if port in c["connections"]:
                        used.add(c["connections"][port][0])
            dead = [n for n, c in cells.items() if c["connections"]["Y"][0] not in used]
            if not dead:
                break
            for n in dead:
                del cells[n]
            changed = True
        if not changed:
            break

    end = {t: sum(1 for c in cells.values() if c["type"] == t) for t in ("$_NAND_", "$_NOT_")}
    json.dump(design, open(dst, "w"))
    print(f"not_cleanup {top}: rounds={rounds} NAND {start['$_NAND_']} -> {end['$_NAND_']}, "
          f"NOT {start['$_NOT_']} -> {end['$_NOT_']}, total {sum(start.values())} -> {sum(end.values())}")


if __name__ == "__main__":
    main()
