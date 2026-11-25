#!/usr/bin/env bash
# Fetch the Solidity libraries at the commits pinned in VERSIONS.md, into contracts/lib.
# Each archive is GitHub's tarball of one commit (codeload.github.com/<repo>/tar.gz/<commit>).
# GitHub writes that commit id into the archive's pax header (the field `git get-tar-commit-id`
# reads), and this script refuses an archive whose id is not the pinned one. It prints each
# archive's sha256 for the record. Runs on the test host only; needs python3 and tar.
set -euo pipefail
cd "$(dirname "$0")/.."
fetch() {  # name owner/repo commit
  local name=$1 repo=$2 commit=$3 tgz
  tgz=$(mktemp)
  python3 - "$repo" "$commit" "$tgz" <<'PY'
import hashlib, sys, tarfile, urllib.request
repo, want, path = sys.argv[1:4]
with urllib.request.urlopen(f"https://codeload.github.com/{repo}/tar.gz/{want}", timeout=120) as r, open(path, "wb") as f:
    f.write(r.read())
with tarfile.open(path) as t:
    got = t.pax_headers.get("comment", "")
if got != want:
    sys.exit(f"{repo}: archive commit {got!r} is not the pinned {want}")
print(f"{repo} {want} sha256 {hashlib.sha256(open(path, 'rb').read()).hexdigest()}")
PY
  rm -rf "lib/$name" && mkdir -p "lib/$name"
  tar -xzf "$tgz" -C "lib/$name" --strip-components=1
  rm -f "$tgz"
}
fetch openzeppelin-contracts OpenZeppelin/openzeppelin-contracts cab19933c33c2ad1d4c7a84864a3601dddfd16f3
fetch forge-std foundry-rs/forge-std f3dae6e6ee381f25eb6a246f7da9b85c91a68219
