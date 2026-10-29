#!/usr/bin/env bash
# Trial 06 — svgo 4.1.0 on hand-made SVG logos/icons. Every command that was run, in order.
set -euo pipefail
TOOLS=/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools   # scratchpad; on a real checkout use ./node_modules
export SVGO_TOOLS=$TOOLS/svgo AXE_TOOLS=$TOOLS/axe CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
F=/home/user/CLaude/trials-cloud/fixtures/06-svgo; R=/home/user/CLaude/trials-cloud/runs/06-svgo; SVGO=$SVGO_TOOLS/node_modules/.bin/svgo

# install (svgo was pre-installed: `npm i svgo@4.1.0` -> 4.8 s, 12 MB, 19 packages); pixel-diff helpers:
(cd $SVGO_TOOLS && npm i --no-audit --no-fund pixelmatch@7.1.0 pngjs@7.0.0)          # 0.5 s, +1 MB
$SVGO --version                                                                        # 4.1.0

# baseline: originals as-is must satisfy KEY.json (sanity of the fixtures)
(cd $R && node check-key.mjs $F/KEY.json $F/in baseline > baseline-check.json)       # exit 0

# candidate 1: svgo defaults (preset-default, no config)
(cd $R && rm -rf out-default && mkdir out-default && $SVGO -f $F/in -o $R/out-default > svgo-default.log 2>&1)   # 0.57 s
# candidate 2: tuned config
(cd $R && rm -rf out-tuned && mkdir out-tuned && $SVGO --config $F/svgo.config.mjs -f $F/in -o $R/out-tuned > svgo-tuned.log 2>&1)   # 0.47 s

# structural KEY checks (exit 1 when any seeded requirement was dropped)
(cd $R && node check-key.mjs $F/KEY.json out-default default > check-default.json) || true   # exit 1, 12 breakages
(cd $R && node check-key.mjs $F/KEY.json out-tuned   tuned   > check-tuned.json)             # exit 0, 0 breakages

# raster parity: 512 px headless Chromium (playwright-core 1.64.1, chromium build 1194), pixelmatch threshold 0.1
(cd $R && node raster.mjs $F/in out-default out-tuned png > raster.json)              # 4.9 s, 55 PNGs

# byte + gzip(-9) sizes -> sizes.json (inline node script, see result.json per_file)

# harness controls (scratchpad only): spinner orig t=0 vs t=400 ms = 20.08 % px differ (seek works);
# icon-play with recoloured+shifted triangle vs original = 51.07 % px differ (diff detects change)

# wrapper sketch, run twice from a dir where `svgo` resolves:
#   node wrapper-sketch.mjs $F/in <out> $F/svgo.config.mjs            -> exit 0 (10/10 ok), output byte-identical to CLI tuned run
#   node wrapper-sketch.mjs $F/in <out> plain.config.mjs (preset-default) -> exit 1 (4 files fail)
