#!/usr/bin/env bash
# Trial 06-images: every command run, in order. T = tool dir, F = fixtures, R = runs.
T=/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/06-images
F=/home/user/CLaude/trials-cloud-2/fixtures/06-images
R=/home/user/CLaude/trials-cloud-2/runs/06-images
mkdir -p $F/src $R $T
# --- installs (timed with date +%s.%N before/after; sizes with du -sh)
cd $T && echo '{"name":"t06","private":true,"type":"module"}' > package.json && npm i sharp@0.35.5          # 4.25 s, node_modules 30 MB
mkdir -p $T/squoosh && cd $T/squoosh && echo '{"name":"t06sq","private":true,"type":"module"}' > package.json && npm i @squoosh/lib@0.5.3   # 1.04 s, 21 MB, EBADENGINE warning (engines node ^12.5||^14||^16)
cd $T && python3 -m venv venv && venv/bin/pip install scikit-image==0.26.0   # 35.1 s, venv 298 MB (measurement only)
venv/bin/pip install dssim==1.3.0 && venv/bin/pip uninstall -y dssim         # WRONG PACKAGE: PyPI "dssim" 1.3.0 is a discrete-event simulation framework (majvan), not the image metric
CARGO_HOME=$T/cargo timeout 300 cargo install dssim --root $T/cargo         # 56.6 s, dssim v3.5.1 (AGPL-3.0), cargo dir 25 MB, binary 2.1 MB
apt-get install -y webp libavif-bin                                           # 7.05 s, 2.9 MB; cwebp 1.3.2, avifenc 1.0.4 (aom 3.8.2)
# --- fixtures
ln -sfn $T/node_modules $F/node_modules; ln -sfn $T/node_modules $R/node_modules; mkdir -p $R/squoosh; ln -sfn $T/squoosh/node_modules $R/squoosh/node_modules
cd $T && venv/bin/python -I $F/gen_photos.py $F/src        # 4 bundled skimage photos -> PNG
node $F/gen_synthetic.mjs $F/src                             # 3 text banners + 1 flat render
node $F/gen_seeded.mjs                                       # seeded/noise_fine.png + control copies
# --- squoosh smoke tests (exact errors recorded in result.json)
cd $T/squoosh && node -e "import('@squoosh/lib')..."                                   # FAILS: TypeError: Cannot set property navigator of #<Object> which has only a getter
node --no-experimental-global-navigator -e "import('@squoosh/lib')..."                  # FAILS: TypeError: Failed to parse URL from .../imagequant_node-a4aafbae.wasm (global fetch)
node --no-experimental-global-navigator --no-experimental-fetch -e "import('@squoosh/lib')..."   # works
# --- benchmark: encode (sharp webp/avif default+tuned, cwebp, avifenc, JPEG-80 baseline), decode via sharp, score
cd $R && node bench.mjs                                                                  # 179 s wall, 336 rows -> bench.json, out/
cd $R/squoosh && node --no-experimental-global-navigator --no-experimental-fetch bench_squoosh.mjs   # 69 s, 160 rows -> bench_squoosh.json
cd $R && $T/venv/bin/python -I ssim.py $T/cargo/bin/dssim                                # 101 s, SSIM rgb+gray (scikit-image) + DSSIM -> scored.json
$T/venv/bin/python -I analyze.py                                                         # -> analysis.json (knees, totals)
# --- baseline (what they do today): JPEG q80 via sharp = encoder 'jpeg-sharp' inside bench.mjs; PNG as-is = 'png-source' rows
# --- wrapper tests (exit codes recorded in result.json)
node wrapper-sketch.mjs $F/src --out $R/out/wrapper-A --avif > $R/wrapper-A.json                    # exit 1 (0.97 gate, 14/16 outputs below)
node wrapper-sketch.mjs $F/src --out $R/out/wrapper-B --avif --min-ssim 0.92 > $R/wrapper-B.json    # exit 0
node wrapper-sketch.mjs $F/control --out $R/out/wrapper-C --avif --min-ssim 0.92 > $R/wrapper-C.json  # exit 0 (controls clean)
node wrapper-sketch.mjs $F/seeded --out $R/out/wrapper-D --avif --min-ssim 0.92 > $R/wrapper-D.json   # exit 1 (only noise_fine.png listed)
node wrapper-sketch.mjs /nonexistent-dir > $R/wrapper-E.json                                        # exit 2
node wrapper-sketch.mjs $F/seeded --out $R/out/wrapper-F --avif > $R/wrapper-F.json                                   # exit 1 but 0.97 gate also flags control photo_chelsea (FP)
node wrapper-sketch.mjs $F/seeded --out $R/out/wrapper-G --avif --avif-q 70 --min-ssim 0.92 > $R/wrapper-G.json       # tuned: exit 1, only noise_fine
node wrapper-sketch.mjs $F/control --out $R/out/wrapper-H --avif --avif-q 70 --min-ssim 0.92 > $R/wrapper-H.json      # tuned: exit 0
node wrapper-sketch.mjs $F/src --out $R/out/wrapper-I --avif --avif-q 70 --min-ssim 0.92 > $R/wrapper-I.json          # tuned on all 8: exit 0
rm -rf $R/out/decoded   # ~150 MB of intermediate decoded PNGs removed after scoring (bench.mjs recreates them)
