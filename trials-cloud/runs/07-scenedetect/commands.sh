#!/usr/bin/env bash
# Exact commands used for trial 07 (PySceneDetect 0.7.2). Run from the repo root.
# Venv (already installed, pip install scenedetect==0.7.2 opencv-python-headless==5.0.0.93 ; 22.9 s, 354 MB):
set -euo pipefail
V=/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools/scenedetect/venv/bin
F=/home/user/CLaude/trials-cloud/fixtures/07-scenedetect
R=/home/user/CLaude/trials-cloud/runs/07-scenedetect
cd "$F"
# 0. fixtures
# ./make-clip.sh            # -> seeded.mp4 (md5 b3d985e9...), control.mp4 (md5 1b223885...)
# 1. baseline (naive mean-abs-diff, fixed threshold 20, OpenCV)
$V/python baseline.py seeded.mp4  > $R/baseline-seeded.json
$V/python baseline.py control.mp4 > $R/baseline-control.json
$V/python score.py KEY.json --detected $R/baseline-seeded.json --control $R/baseline-control.json > $R/score-baseline.json
# 2./3. scenedetect variants: name|detector args
run() { # name, then detector args...
  local name=$1; shift
  for clip in seeded control; do
    local t0=$(date +%s.%N)
    $V/scenedetect -q -i $clip.mp4 -o $R "$@" list-scenes -f $name-$clip.csv
    echo "{\"name\":\"$name\",\"clip\":\"$clip\",\"runtime_s\":$(echo "$(date +%s.%N) - $t0" | bc)}" >> $R/runtimes.jsonl
  done
  $V/python score.py KEY.json --detected $R/$name-seeded.csv --control $R/$name-control.csv > $R/score-$name.json
}
: > $R/runtimes.jsonl
run default         detect-content                                   # default: threshold 27, min-scene-len 0.6 s
run content-t15     detect-content -t 15                              # lower threshold
run content-t15-m1s detect-content -t 15 -m 1s                        # + longer min scene
run adaptive        detect-adaptive                                   # default: threshold 3, min-content-val 15, window 2
run adaptive-c10    detect-adaptive -c 10                             # lower min content val (catch soft fades)
run hist            detect-hist                                       # default threshold 0.05
run threshold       detect-threshold                                  # fade-to-black detector (not expected to fire on crossfades)
run content-plus-adaptive detect-content detect-adaptive              # two detectors chained
# frame-level stats for the default detector (content_val per frame) for inspection
$V/scenedetect -q -i seeded.mp4 -s $R/stats-seeded.csv detect-content list-scenes -n
