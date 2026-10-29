#!/usr/bin/env bash
# Exact commands run for trial 07-loudness (in order). No install was needed: ffmpeg 6.1.1 is the Ubuntu system package.
set -e
cd /home/user/CLaude/trials-cloud-2
# 0. tool identity / licence evidence
ffmpeg -version | head -3                      # 6.1.1-3ubuntu5, configuration contains --enable-gpl
ffmpeg -version | grep -o -- '--enable-gpl'
ffmpeg -hide_banner -filters | grep -E 'ebur128|loudnorm|alimiter|sidechaincompress|ametadata|aevalsrc|anoisesrc'
for p in ffmpeg libavcodec60 libavformat60 libavutil58 libavfilter9 libswresample4 libswscale7 libpostproc57 libavdevice60; do dpkg-query -W -f='${Package} ${Version} ${Installed-Size}\n' $p; done
grep -i licen /usr/share/doc/ffmpeg/copyright | head -3
# 1. fixtures (generator writes stems, per-mix gained stems, 5 mp4 mixes, and verifies every file with ebur128=peak=true)
(time bash fixtures/07-loudness/make-mixes.sh) > runs/07-loudness/make-mixes.log 2>&1
# 2. baseline = today's pipeline (no loudness check; only "has an audio stream")
bash runs/07-loudness/baseline.sh
# 3. candidate default and tuned (per file, timed with date +%s.%N)
cd fixtures/07-loudness
for f in C1 C2 L1 L2 L3; do node ../../runs/07-loudness/check-loudness.mjs $f.mp4 > ../../runs/07-loudness/default-$f.json; echo "$f exit=$?"; done
for f in C1 C2 L1 L2 L3; do node ../../runs/07-loudness/check-loudness.mjs --tuned $f.mp4 > ../../runs/07-loudness/tuned-$f.json; echo "$f exit=$?"; done
# 4. wrapper exit codes: clean control, seeded, mix without stems, missing file
node ../../runs/07-loudness/wrapper-sketch.mjs C1.mp4; echo "exit=$?"     # 0
node ../../runs/07-loudness/wrapper-sketch.mjs L2.mp4; echo "exit=$?"     # 1
cp L3.mp4 "$SCRATCH/nostems.mp4" && node ../../runs/07-loudness/wrapper-sketch.mjs "$SCRATCH/nostems.mp4"; echo "exit=$?"   # 1 (TP) + note "stems not found"
node ../../runs/07-loudness/wrapper-sketch.mjs "$SCRATCH/missing.mp4"; echo "exit=$?"   # 2
# 5. raw ebur128 timing on one 25 s mp4
ffmpeg -hide_banner -nostats -i C1.mp4 -af ebur128=peak=true -f null -    # 1.19 s wall
# 6. Windows static-build hosts (not reachable from this sandbox, recorded, not measured)
curl -sS -m 15 -o /dev/null -w 'http=%{http_code}\n' https://github.com/BtbN/FFmpeg-Builds/releases/latest   # curl: (56) CONNECT tunnel failed, response 403
curl -sS -m 15 -o /dev/null -w 'http=%{http_code}\n' https://www.gyan.dev/ffmpeg/builds/                   # http=000 (refused)
