#!/usr/bin/env bash
# Pack the whole round-2 deliverable: report, results, checks/, fixtures/ (with KEY files and generators), runs/ (logs, commands, result.json).
set -e; cd "$(dirname "$0")"; rm -f trials-cloud-2.zip
zip -qr trials-cloud-2.zip TRIALS-CLOUD-REPORT-2.md results-2.json checks fixtures runs \
  -x '*/node_modules/*' '*/__pycache__/*' '*.pyc' '*/__grade__/*' '*/__hidden__/*' 'runs/*/work/*/node_modules/*'
unzip -l trials-cloud-2.zip | tail -1
