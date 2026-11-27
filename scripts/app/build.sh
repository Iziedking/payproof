#!/usr/bin/env bash
# Payproof app build on host-service, from the workdir root through the resource hook.
# The app imports the shared simulator (compiler/src), the rule layouts (rules/) and keccak
# (vendor/tapekit), so those folders sit next to app/ in the workdir.
# Node v24.22.1 is downloaded once and checked against nodejs.org SHASUMS256.txt.
set -euo pipefail
ROOT="$PWD"
NODE_V=v24.22.1
NODE_DIR="$ROOT/tools/node-$NODE_V"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  mkdir -p "$ROOT/tools/dl"
  curl -fsSL -o "$ROOT/tools/dl/SHASUMS256.txt" "https://nodejs.org/dist/$NODE_V/SHASUMS256.txt"
  curl -fsSL -o "$ROOT/tools/dl/node-$NODE_V-linux-x64.tar.xz" "https://nodejs.org/dist/$NODE_V/node-$NODE_V-linux-x64.tar.xz"
  (cd "$ROOT/tools/dl" && grep " node-$NODE_V-linux-x64.tar.xz\$" SHASUMS256.txt | sha256sum -c -)
  mkdir -p "$NODE_DIR" && tar -xJf "$ROOT/tools/dl/node-$NODE_V-linux-x64.tar.xz" -C "$NODE_DIR" --strip-components=1
  rm -f "$ROOT/tools/dl/node-$NODE_V-linux-x64.tar.xz"
fi
export PATH="$NODE_DIR/bin:$PATH"
export npm_config_cache="$ROOT/.npm-cache" npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
cd "$ROOT/app"
echo "node $(node -v) npm $(npm -v)"
# Install scripts off, as in the container build (scripts/app/build-container.sh): the lockfile
# now carries Privy and its dependencies, and none of them needs a script to build the app.
npm ci --ignore-scripts
echo "--- typecheck"
npx tsc -v
npx tsc -p tsconfig.json
echo "--- build"
rm -rf dist
npx vite build
echo "--- dist"
find dist -type f -printf '%s %p\n' | sort -k2
sha256sum dist/assets/* dist/index.html
