#!/usr/bin/env python3
"""P1: install OSS CAD Suite 2026-10-29 into ./oss-cad-suite on node-services.

The same build P0 used (Yosys 0.70+277 with native ABC). Asset name, size and SHA-256 read from
the GitHub release API on 2026-11-21:
  repos/YosysHQ/oss-cad-suite-build/releases/tags/2026-10-29, published 2026-10-29T07:00:36Z
Standard library only, so it runs in the pinned python image. The archive is checked before
it is unpacked, and it is unpacked only inside the current directory.
"""
import hashlib
import os
import sys
import tarfile
import urllib.request

URL = ("https://github.com/YosysHQ/oss-cad-suite-build/releases/download/2026-10-29/"
       "oss-cad-suite-linux-x64-20261029.tgz")
SIZE = 747_289_273
SHA256 = "ae6f7f11eeaf7c504762f1b812d28654a61cbb965f76ecda7aeb8306b1d015eb"
FILE = "oss-cad-suite-linux-x64-20261029.tgz"

if not os.path.exists(FILE) or os.path.getsize(FILE) != SIZE:
    with urllib.request.urlopen(URL, timeout=600) as r, open(FILE, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
h = hashlib.sha256()
with open(FILE, "rb") as f:
    for chunk in iter(lambda: f.read(1 << 20), b""):
        h.update(chunk)
got = h.hexdigest()
print(f"{FILE} {os.path.getsize(FILE)} bytes sha256 {got}")
if got != SHA256:
    sys.exit("SHA-256 does not match the release; not unpacking")
with tarfile.open(FILE) as t:
    t.extractall(".", filter="data")
os.remove(FILE)
print("unpacked to ./oss-cad-suite")
