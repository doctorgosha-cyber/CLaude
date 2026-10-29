#!/usr/bin/env bash
# Baseline = what NEXUS does today for subtitle/site-copy typos: nothing automated (manual proofreading only).
# This script exists to make the 0/12 baseline reproducible: it lists the fixtures and reports no findings.
cd "$(dirname "$0")/../../fixtures/08-cspell" || exit 2
ls *.srt *.html
echo '{"tool":"none (manual proofreading)","findings":[],"recall":"0/12","exit":0}'
exit 0
