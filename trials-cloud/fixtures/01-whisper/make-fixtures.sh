#!/usr/bin/env bash
# Rebuild the 01-whisper fixtures from scratch. Needs espeak-ng (1.51), ffmpeg/ffprobe (6.1.1), python3.
# Deterministic: espeak-ng output is deterministic for a given version/voice/speed.
set -euo pipefail
cd "$(dirname "$0")"
espeak-ng --version | head -1
ffmpeg -version | head -1
# Per sentence (see gen_fixtures.py; every executed command is echoed to make-fixtures.log):
#   espeak-ng -v en-us -s 150 -w <name>-<i>-raw.wav "<sentence>"
#   ffmpeg -y -i <name>-<i>-raw.wav -ar 16000 -ac 1 -sample_fmt s16 \
#       -af "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse" <name>-<i>.wav
#   ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 <name>-<i>.wav   -> cue duration
# Then: ffmpeg -f concat -safe 0 -i <name>-concat.txt -c copy <name>.wav   (0.5 s lead, 0.4 s gaps)
python3 -I gen_fixtures.py
ls -l *.wav *.srt KEY.json
