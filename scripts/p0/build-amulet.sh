#!/usr/bin/env bash
# P0 spike C, module split step 2: build the multiplier checker AMulet 2.2 and its proof
# checker Pacheck 2.0 from pinned sources, inside a pinned Debian container on
# node-services (task p0-build-amulet). The owner approved the download and build on
# 2026-11-20.
#   sources : tools-src/amulet2  at 1b179334ba95c8e8ab50e75f2823fa8cce0bc914
#             tools-src/pacheck2 at 46001db7dc336b328b3f81f435c1ea71001f5dc3
#             (github.com/d-kfmnn, MIT; cloned on the host and checked by commit hash)
#   build   : `./configure.sh && make` as both READMEs say; -static is added to CFLAGS so
#             the binaries also run in the no-network python:3.12-slim container
#             used for the proofs. Both link -lgmp (makefile.in).
#   output  : tools/bin/amulet, tools/bin/pacheck, tools/build-amulet-versions.txt
set -euo pipefail
cd /w
apt-get update -qq
apt-get install -y -qq --no-install-recommends g++ make libgmp-dev > /dev/null
out=tools/build-amulet-versions.txt; mkdir -p tools/bin
{
  echo "image: $(cat /etc/debian_version) (debian bookworm-slim, pinned by digest in the task)"
  dpkg-query -W -f '${Package} ${Version}\n' g++ g++-12 make libgmp-dev libgmp10
  for r in amulet2 pacheck2; do echo "$r $(git -C tools-src/$r rev-parse HEAD 2>/dev/null || echo 'commit read on host')"; done
} > "$out"
build() { # dir binary
  local src="tools-src/$1" b="build-$1"
  rm -rf "$b"; cp -r "$src" "$b"; cd "$b"
  ./configure.sh
  sed -i 's/^CFLAGS=\(.*\)$/CFLAGS=\1 -static/' makefile
  mkdir -p build
  make -j2 2>&1 | tail -n 5
  cd /w; cp "$b/$2" "tools/bin/$2"; rm -rf "$b"
  echo "$2 sha256 $(sha256sum "tools/bin/$2" | cut -d' ' -f1)" | tee -a "$out"
  file_type=$(od -An -c -N4 "tools/bin/$2" | tr -d ' \n'); echo "$2 header $file_type" >> "$out"
}
build amulet2 amulet
build pacheck2 pacheck
chown -R 1000:1000 tools
cat "$out"
