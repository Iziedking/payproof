#!/usr/bin/env bash
# P3: fetch the AMulet 2.2 and Pacheck 2.0 sources at the commits P0 built and recorded
# (docs/evidence/p0/proofs-split/build-amulet-versions.txt), on the test host, for the build
# task p0-build-amulet. The source is GitHub's archive of each commit (the commit hash in the
# URL fixes the content); the archive's top folder name carries the commit and is checked.
# Runs in the workdir root. Writes tools-src/<repo>/ and copies the P0 build script beside it.
set -euo pipefail
mkdir -p tools-src
get() { # repo commit
  local d="tools-src/$1" a="tools-src/$1-$2.tar.gz"
  curl -fsSL --retry 3 -o "$a" "https://codeload.github.com/d-kfmnn/$1/tar.gz/$2"
  tar -tzf "$a" > "$a.list"   # listed to a file: piping into head would end tar with SIGPIPE
  top=$(cut -d/ -f1 "$a.list" | sort -u); rm -f "$a.list"
  [ "$top" = "$1-$2" ] || { echo "FAIL: archive top folder is $top, expected $1-$2"; exit 1; }
  rm -rf "$d" "tools-src/$top"; tar -xzf "$a" -C tools-src; mv "tools-src/$top" "$d"
  echo "$1 commit $2 archive sha256 $(sha256sum "$a" | cut -d' ' -f1) $(stat -c %s "$a") bytes"
  rm -f "$a"
}
get amulet2 1b179334ba95c8e8ab50e75f2823fa8cce0bc914
get pacheck2 46001db7dc336b328b3f81f435c1ea71001f5dc3
cp scripts/p0/build-amulet.sh build-amulet.sh
