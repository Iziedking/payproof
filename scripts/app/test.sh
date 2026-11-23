#!/usr/bin/env bash
# Payproof app typecheck and unit tests on node-services, in a capped node container with the
# workdir root mounted at /w (the app reads compiler/src, rules/, vendor/tapekit and the
# chain/netlists files next to app/). No network is needed after npm ci.
set -euo pipefail
cd /w/app
export npm_config_cache=/w/.npm-cache npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
node -v
npm ci
echo "--- typecheck"
npx tsc -p tsconfig.json
echo "--- tests"
npx vitest run --reporter=verbose
