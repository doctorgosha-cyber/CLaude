#!/usr/bin/env bash
# Deterministic synthetic fixtures for trial 07 (shot-cut QA). Needs only ffmpeg (tested 6.1.1).
# All sources are ffmpeg lavfi generators (no real footage, no downloads).
#
# seeded.mp4 : 1080x1920 (9:16), 30 fps, 30.0 s, 9 shots -> 8 transitions
#              (6 hard cuts + 2 x 0.5 s crossfades via xfade). Ground truth in KEY.json.
#              NOTE: the brief said "8 shots, 6 hard + 2 soft"; 8 cuts need 9 shots, so 9 shots are used.
# control.mp4: 1080x1920, 30 fps, 10.0 s (CRF 30 to stay well under 5 MB), ONE shot with continuous motion (panning mandelbrot
#              overlay on testsrc2), no cuts. Any detection on it is a false positive.
set -euo pipefail
cd "$(dirname "$0")"
S="s=1080x1920:r=30"
F="format=yuv420p,setsar=1,fps=30,settb=1/30"

# Shot list (duration s): 1 navy 3 | 2 testsrc 4 | 3 red 3 | 4 mandelbrot 4 | 5 smptebars 3
#                         6 testsrc2 4 | 7 yellow 3 | 8 purple + panning rgbtestsrc overlay 4 | 9 teal 3
# (ffmpeg "gradients" was tried for shot 8 but is NOT deterministic even with seed=, so it was replaced)
# Timeline: hard 3.0 | hard 7.0 | hard 10.0 | xfade 13.5-14.0 | hard 16.5 | hard 20.5 | xfade 23.0-23.5 | hard 27.0 | end 30.0
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=0x1f3a93:$S:d=3" \
  -f lavfi -i "testsrc=$S:d=4" \
  -f lavfi -i "color=c=0xc0392b:$S:d=3" \
  -f lavfi -t 4 -i "mandelbrot=$S" \
  -f lavfi -i "smptebars=$S:d=3" \
  -f lavfi -i "testsrc2=$S:d=4" \
  -f lavfi -i "color=c=0xf1c40f:$S:d=3" \
  -f lavfi -i "color=c=0x8e44ad:$S:d=4" \
  -f lavfi -i "color=c=0x16a085:$S:d=3" \
  -f lavfi -i "rgbtestsrc=s=480x480:r=30:d=4" \
  -filter_complex "
    [0:v]$F[s1];[1:v]$F[s2];[2:v]$F[s3];[3:v]$F[s4];[4:v]$F[s5];
    [5:v]$F[s6];[6:v]$F[s7];[8:v]$F[s9];
    [7:v]$F[bg8];[9:v]$F[fg8];[bg8][fg8]overlay=x='60+t*135':y='200+t*330':shortest=1,settb=1/30[s8];
    [s1][s2][s3][s4]concat=n=4:v=1:a=0,settb=1/30[a];
    [a][s5]xfade=transition=fade:duration=0.5:offset=13.5[b];
    [b][s6][s7]concat=n=3:v=1:a=0,settb=1/30[c];
    [c][s8]xfade=transition=fade:duration=0.5:offset=23.0[d];
    [d][s9]concat=n=2:v=1:a=0,fps=30[v]" \
  -map "[v]" -c:v libx264 -preset medium -crf 28 -pix_fmt yuv420p -g 60 -movflags +faststart -an seeded.mp4

ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "testsrc2=$S:d=10" \
  -f lavfi -t 10 -i "mandelbrot=s=540x540:r=30" \
  -filter_complex "[0:v]$F[bg];[1:v]$F[fg];[bg][fg]overlay=x='60+t*48':y='400+t*90':shortest=1,fps=30[v]" \
  -map "[v]" -c:v libx264 -preset medium -crf 30 -pix_fmt yuv420p -g 60 -movflags +faststart -an control.mp4

ls -l seeded.mp4 control.mp4
for f in seeded.mp4 control.mp4; do ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames,duration -of csv=p=0 "$f"; done
