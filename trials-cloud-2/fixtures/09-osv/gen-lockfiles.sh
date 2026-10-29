#!/bin/sh
# Generates real lockfile v3 files for the two Node fixtures (run from fixtures/09-osv/)
set -e
cd "$(dirname "$0")"
for d in node-vuln node-clean; do
  (cd "$d" && rm -f package-lock.json && npm install --package-lock-only --ignore-scripts --no-audit --no-fund)
done
