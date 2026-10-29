#!/usr/bin/env bash
# Baseline = what the team does today: grep for literal forms of risky patterns.
# Usage: baseline.sh <dir>   (prints file:line:match; exit 1 if anything found)
DIR="${1:-.}"
PATTERNS=(
  'innerHTML\s*='
  '\beval\('
  'echo \$_GET'
  '\$wpdb->(query|get_results|get_var|get_row)\(.*\$'
  'new Function\('
  'document\.write\('
  'setTimeout\(\s*["'"'"']'
)
rc=0
for p in "${PATTERNS[@]}"; do
  grep -rnE --include='*.js' --include='*.php' "$p" "$DIR" && rc=1
done
exit $rc
