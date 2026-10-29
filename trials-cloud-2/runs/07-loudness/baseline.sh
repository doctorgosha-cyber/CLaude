#!/usr/bin/env bash
# Baseline = what the team does today: no loudness check at all. The render step only confirms the mp4
# exists and has an audio stream (ffprobe); nothing measures LUFS, true peak or voice/music balance.
# Result on any fixture: 0 findings -> recall 0/3, false positives 0.
set -u
cd "$(dirname "$0")/../../fixtures/07-loudness"
rc=0
for f in C1 C2 L1 L2 L3; do
  if ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "$f.mp4" >/dev/null; then
    echo "$f.mp4: has audio stream -> OK (no loudness check in today's pipeline)"
  else echo "$f.mp4: no audio stream"; rc=1; fi
done
exit $rc
