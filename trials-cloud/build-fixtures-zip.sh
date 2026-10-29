#!/usr/bin/env bash
# Pack every fixture folder (with KEY.json files) into fixtures.zip for local re-runs.
set -e; cd "$(dirname "$0")"; rm -f fixtures.zip
zip -qr fixtures.zip fixtures -x 'fixtures/09-gitleaks/seeded/*' '*/node_modules/*' '*/__pycache__/*' '*.pyc'
unzip -l fixtures.zip | tail -1
