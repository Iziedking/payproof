#!/usr/bin/env python3
"""P0 spike: Yosys JSON (NAND and NOT cells only) to TapeOut netlist bytes.

Throwaway P0 tool so the owner can tape out real circuits this week. P1 replaces
it with compiler/src/yosys.ts and emit.ts. Encoding follows TAP-02 (TAPs commit
075dd834a72c, read 2026-11-17):
  signal 0 = constant 0, signal 1 = constant 1, inputs at 2 .. 2+nIn-1,
  then one signal per element in record order; NAND record = 0x00 a:u24 b:u24;
  outputs are the last nOut signals; inputs and outputs packed LSB first.
A NOT becomes NAND(x, x). An output that cannot simply be moved to the end gets
a two-gate buffer, or one extra NOT when its driver is itself a NOT.

Usage: yosys2tap.py <design.json> <module> <out.json>
Writes {"module", "nIn", "nOut", "gates", "netlistHex", "inputs", "outputs"}
where inputs/outputs list each port with its bit offset and width.
"""
import json
import sys
from collections import defaultdict


def main():
    src, top, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    mod = json.load(open(src))["modules"][top]

    in_ports, out_ports = [], []
    for name, p in mod["ports"].items():
        (in_ports if p["direction"] == "input" else out_ports).append((name, p["bits"]))
        if p["direction"] not in ("input", "output"):
            raise SystemExit(f"unsupported port direction {p['direction']}")

    # net id -> driver: ("in", index) | ("cell", cell name)
    sig = {}
    n_in = 0
    inputs_layout = []
    for name, bits in in_ports:
        inputs_layout.append({"name": name, "offset": n_in, "width": len(bits)})
        for b in bits:
            if not isinstance(b, int):
                raise SystemExit(f"constant bit on input port {name}")
            sig[b] = 2 + n_in
            n_in += 1

    cells = {}
    driver = {}
    for cname, c in mod["cells"].items():
        t = c["type"]
        if t == "$_NAND_":
            ins = [c["connections"]["A"][0], c["connections"]["B"][0]]
        elif t == "$_NOT_":
            ins = [c["connections"]["A"][0]]
        else:
            raise SystemExit(f"unexpected cell type {t}: run abc -g NAND and opt_clean first")
        y = c["connections"]["Y"][0]
        cells[cname] = (t, ins, y)
        driver[y] = cname

    def const(b):
        return {"0": 0, "1": 1}.get(b) if isinstance(b, str) else None

    for cname, (t, ins, y) in cells.items():
        for b in ins:
            if isinstance(b, str) and const(b) is None:
                raise SystemExit(f"undefined bit {b!r} feeding {cname}")

    # Fan-out of each cell output into other cells.
    users = defaultdict(int)
    for cname, (t, ins, y) in cells.items():
        for b in ins:
            if b in driver:
                users[driver[b]] += 1

    out_bits = [b for _, bits in out_ports for b in bits]
    out_uses = defaultdict(int)
    for b in out_bits:
        if b in driver:
            out_uses[driver[b]] += 1

    # Cells that drive exactly one output bit and nothing else can be emitted last.
    deferred = set()
    for b in out_bits:
        cn = driver.get(b)
        if cn is not None and users[cn] == 0 and out_uses[cn] == 1:
            deferred.add(cn)

    order, state = [], {}

    def visit(cn):  # iterative DFS topological order
        stack = [(cn, False)]
        while stack:
            n, done = stack.pop()
            if done:
                if state.get(n) != 2:
                    state[n] = 2
                    order.append(n)
                continue
            if state.get(n) == 2:
                continue
            if state.get(n) == 1:
                raise SystemExit("combinational loop")
            state[n] = 1
            stack.append((n, True))
            for b in cells[n][1]:
                d = driver.get(b)
                if d is not None and state.get(d) != 2:
                    stack.append((d, False))

    for cn in cells:
        if cn not in deferred:
            visit(cn)
    for cn in deferred:  # their inputs are all non-deferred
        for b in cells[cn][1]:
            if driver.get(b) in deferred:
                raise SystemExit("deferred cell feeds deferred cell")

    recs = []
    next_sig = 2 + n_in

    def ref(b):
        if isinstance(b, str):
            return const(b)
        if b in sig:
            return sig[b]
        raise SystemExit(f"bit {b} used before it is driven")

    def emit(a, bb):
        nonlocal next_sig
        recs.append((a, bb))
        s = next_sig
        next_sig += 1
        return s

    for cn in order:
        t, ins, y = cells[cn]
        a = ref(ins[0])
        sig[y] = emit(a, a if t == "$_NOT_" else ref(ins[1]))

    # Outputs, in port order, as the last nOut signals.
    outputs_layout, off = [], 0
    for name, bits in out_ports:
        outputs_layout.append({"name": name, "offset": off, "width": len(bits)})
        off += len(bits)
    tail = []  # one record per output bit, in order
    for b in out_bits:
        cn = driver.get(b)
        if cn in deferred:
            t, ins, y = cells[cn]
            a = ref(ins[0])
            tail.append((a, a if t == "$_NOT_" else ref(ins[1])))
        elif cn is not None and cells[cn][0] == "$_NOT_":
            a = ref(cells[cn][1][0])
            tail.append((a, a))  # a fresh copy of the NOT
        else:
            c = const(b)
            if c is not None:
                tail.append((1, 1) if c == 0 else (0, 0))  # NAND(1,1)=0, NAND(0,0)=1
            else:
                s = ref(b)
                inv = emit(s, s)  # buffer: NOT then NOT
                tail.append((inv, inv))
    for a, bb in tail:
        emit(a, bb)

    for a, bb in recs:
        if a >= (1 << 24) or bb >= (1 << 24):
            raise SystemExit("signal index above u24")
    data = b"".join(b"\x00" + a.to_bytes(3, "big") + bb.to_bytes(3, "big") for a, bb in recs)
    out = {"module": top, "nIn": n_in, "nOut": len(out_bits), "gates": len(recs),
           "bytes": len(data), "netlistHex": "0x" + data.hex(),
           "inputs": inputs_layout, "outputs": outputs_layout}
    json.dump(out, open(dst, "w"), indent=1)
    print(f"{top}: nIn={n_in} nOut={len(out_bits)} gates={len(recs)} bytes={len(data)}")


if __name__ == "__main__":
    main()
