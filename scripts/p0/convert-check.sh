#!/usr/bin/env bash
# P0: convert Yosys JSON netlists to TapeOut bytes and check them with the TAP-02 reference.
set -euo pipefail
for m in "$@"; do python3 yosys2tap.py "json/$m.json" "$m" "tap/$m.tap.json"; done
python3 check_tap.py vendor/taps/tap-02 $(for m in "$@"; do echo "tap/$m.tap.json"; done)
