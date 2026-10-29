#!/usr/bin/env bash
# Trial 10-visual: every command run, in order. T = tools dir, F = fixtures, R = runs.
set -x
T=/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/10-visual
F=/home/user/CLaude/trials-cloud-2/fixtures/10-visual
R=/home/user/CLaude/trials-cloud-2/runs/10-visual
mkdir -p "$T" "$F" "$R"
# --- install (timed with date +%s.%N before/after; sizes with du -sh)
cd "$T" && printf '{"name":"t10","private":true,"type":"module"}\n' > package.json
npm i playwright-core@1.64.1 pixelmatch@8.0.0 pngjs@7.0.0      # 3.9 s, node_modules 15 MB
npm i odiff-bin@4.5.0                                          # 2.9 s, +3.2 MB (@odiff/linux-x64), total 18 MB
./node_modules/.bin/odiff --version; ./node_modules/.bin/odiff --help
grep -n -i 'includeAA\|threshold' node_modules/pixelmatch/README.md   # docs: includeAA=false default => AA pixels detected and IGNORED
fc-list; fc-match Inter; fc-match Arial; fc-match "Segoe UI"; fc-match sans-serif
# --- fixtures
cd "$F" && node generate.mjs      # shared/site.css, before/*.html, after/*.html (U1..U4, C1, C2); KEY.json written by hand
# --- runs (node_modules symlinked next to the scripts for ESM resolution)
cd "$R" && ln -sfn "$T/node_modules" node_modules && printf '{"name":"run10","private":true,"type":"module"}\n' > package.json
node fontcheck.mjs                # proves "Segoe UI" resolves to Inter here -> U4 switched to Arial (Liberation Sans)
node baseline.mjs                 # BASELINE: screenshots + side-by-side PNGs for a human to eyeball (baseline/)
node run.mjs default 0.1          # candidate defaults: no mask, no animation/font handling, pixelmatch threshold 0.1 (includeAA default false)
node compare.mjs default          # threshold grid 0.3..0 on the default screenshots (grid-default.json)
node run.mjs tuned 0.3            # tuned capture: mask [data-dynamic], animations disabled, fonts.ready, dSF 1, threshold 0.3
node compare.mjs tuned            # grid on tuned screenshots (grid-tuned.json)
node windowcheck.mjs              # rule B exploration: fully-changed 16x16 block at threshold 0.005
# --- odiff on the same PNGs (defaults, then --aa; then -t 0.005 on U2/C2); output in odiff-results.txt
for mode in default tuned; do for id in U1 U2 U3 U4 C1 C2; do for w in 390 1280; do
  "$T/node_modules/.bin/odiff" --parsable-stdout shots/$mode/$id-$w-before.png shots/$mode/$id-$w-after.png /tmp/x.png
  "$T/node_modules/.bin/odiff" --parsable-stdout --aa shots/$mode/$id-$w-before.png shots/$mode/$id-$w-after.png
done; done; done
for id in U2 C2; do for w in 390 1280; do "$T/node_modules/.bin/odiff" --parsable-stdout -t 0.005 shots/tuned/$id-$w-before.png shots/tuned/$id-$w-after.png; done; done
# --- wrapper test (exit 0 clean / 1 change / 2 error); JSON in wrapper-out/
for id in C1 C2 U1 U2 U3 U4; do node wrapper-sketch.mjs "$F/before/$id.html" "$F/after/$id.html" --chrome /opt/pw-browsers/chromium-1194/chrome-linux/chrome --out wrapper-out/$id > wrapper-out/wrapper-out-$id.json; echo "$id exit=$?"; done
node wrapper-sketch.mjs "$F/before/nope.html" "$F/after/C1.html" --chrome /opt/pw-browsers/chromium-1194/chrome-linux/chrome --out wrapper-out/err; echo "exit=$?"   # 2
