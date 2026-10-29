#!/bin/sh
# Baseline = what NEXUS does today for markup errors on review/figure pages: nothing.
# No validator is run; pages are shipped after a visual check. (axe-core, adopted in round 1,
# is an accessibility runtime checker, not a markup validator; it does not see duplicate ids,
# stray end tags, invalid nesting, deprecated attributes or hidden images.)
S=$(date +%s.%N)
n=0; for f in "$@"; do n=$((n+1)); done
E=$(date +%s.%N)
echo "{\"baseline\":\"no markup check\",\"files\":$n,\"findings\":0,\"runtime_s\":$(echo "$E - $S" | bc)}"
exit 0
