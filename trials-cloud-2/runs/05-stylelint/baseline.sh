#!/usr/bin/env bash
# Baseline: NEXUS has no CSS linting today. Theme CSS is written and shipped unchecked.
# This script reproduces that: it looks at the fixtures and reports nothing.
cd "$(dirname "$0")/../../fixtures/05-stylelint" || exit 2
n=$(ls *.css | wc -l)
echo "{\"baseline\":\"none\",\"files\":$n,\"findings\":[],\"recall\":\"0/8\",\"false_positives\":0}"
exit 0
