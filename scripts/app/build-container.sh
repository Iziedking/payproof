#!/usr/bin/env bash
# Payproof app: install, typecheck, unit tests and build, in the pinned Node 24.22.1 container
# with the workdir root mounted at /w. Used on karwan-test while host-service is down (owner,
# 2026-11-24). `npm install` (not `npm ci`) because package.json gained Privy 3.52.1 and viem
# 2.57.17 and the lockfile must be updated; install scripts are not run (--ignore-scripts).
# Prints the size of every built file, since every byte published to DeWEB costs gas.
set -euo pipefail
cd /w/app
export npm_config_cache=/w/.npm-cache npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
echo "node $(node -v) npm $(npm -v)"
npm install --ignore-scripts
echo "--- installed"
npm ls @privy-io/react-auth viem react --depth=0
echo "--- typecheck"
npx tsc -v
npx tsc -p tsconfig.json
echo "--- unit tests"
npx vitest run
echo "--- build"
rm -rf dist
npx vite build
echo "--- dist (bytes, path)"
find dist -type f -printf '%s %p\n' | sort -k2
echo "--- total bytes: $(find dist -type f -printf '%s\n' | awk '{s+=$1} END {print s}')"
sha256sum dist/index.html dist/assets/*
