#!/usr/bin/env bash
# Generates synthetic 9:16 loudness fixtures: voice stem (espeak-ng), music bed (ffmpeg synth),
# per-mix gained stems (wav) and 5 mixes as 1080x1920 mp4 (testsrc2 video + AAC audio).
# Usage: bash make-mixes.sh [outdir]   (default: this directory). Requires ffmpeg 6.x, espeak-ng.
set -euo pipefail
OUT="${1:-$(cd "$(dirname "$0")" && pwd)}"
cd "$OUT"
DUR=25
TEXT="Welcome to the explainer. Today we look at how much protein a medium sized dog really needs each day. Most adult dogs do well on about one gram of protein per pound of body weight. Puppies, working dogs and pregnant dogs need more. Always check the label, and compare the dry matter numbers, not the numbers on the front of the bag."

lufs() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk '/^ *I: /{print $2}'; }
tp()   { ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk '/^ *Peak: /{print $2}'; }
lra()  { ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk '/^ *LRA: /{print $2}'; }

# --- source stems -------------------------------------------------------------
espeak-ng -v en-us -s 150 -w voice_raw22k.wav "$TEXT"
ffmpeg -y -hide_banner -loglevel error -i voice_raw22k.wav -af "aresample=48000,apad=whole_dur=${DUR},atrim=0:${DUR}" -ac 2 -c:a pcm_s16le voice.wav
rm -f voice_raw22k.wav
# music bed: two chords alternating every 4 s, slow swell (dynamics), plus low-passed pink noise
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "aevalsrc=exprs='(0.55+0.45*sin(2*PI*t/8))*(if(lt(mod(t\,8)\,4)\, sin(2*PI*220*t)+0.7*sin(2*PI*277.18*t)+0.6*sin(2*PI*329.63*t)\, sin(2*PI*196*t)+0.7*sin(2*PI*246.94*t)+0.6*sin(2*PI*293.66*t)))*0.18|(0.55+0.45*sin(2*PI*t/8))*(if(lt(mod(t\,8)\,4)\, sin(2*PI*220.5*t)+0.7*sin(2*PI*277.5*t)+0.6*sin(2*PI*330*t)\, sin(2*PI*196.4*t)+0.7*sin(2*PI*247.3*t)+0.6*sin(2*PI*294*t)))*0.18':s=48000:d=${DUR}" \
  -f lavfi -i "anoisesrc=c=pink:r=48000:d=${DUR}:a=0.5:s=7,lowpass=f=900,volume=-6dB,aformat=channel_layouts=stereo" \
  -filter_complex "[0][1]amix=inputs=2:normalize=0,tremolo=f=0.25:d=0.5[m]" -map "[m]" -c:a pcm_s16le music.wav
V0=$(lufs voice.wav); M0=$(lufs music.wav)
echo "source stems: voice=${V0} LUFS music=${M0} LUFS"

# --- mixes --------------------------------------------------------------------
# build NAME VOICE_LUFS MUSIC_LUFS LIMIT_DBFS [burst]
build() {
  local name=$1 vt=$2 mt=$3 lim=$4 burst=${5:-no}
  local gv gm
  gv=$(awk -v a="$vt" -v b="$V0" 'BEGIN{printf "%.2f", a-b}')
  gm=$(awk -v a="$mt" -v b="$M0" 'BEGIN{printf "%.2f", a-b}')
  ffmpeg -y -hide_banner -loglevel error -i voice.wav -af "volume=${gv}dB" -c:a pcm_s16le "${name}_voice.wav"
  ffmpeg -y -hide_banner -loglevel error -i music.wav -af "volume=${gm}dB" -c:a pcm_s16le "${name}_music.wav"
  local fc="[0][1]amix=inputs=2:normalize=0,alimiter=limit=${lim}:level=false:attack=3:release=40[a]"
  if [ "$burst" = yes ]; then
    # 4 ms 1 kHz bursts at 0.98 FS every 5 s: raises true peak to about -0.1 dBTP, negligible effect on integrated loudness
    ffmpeg -y -hide_banner -loglevel error -i "${name}_voice.wav" -i "${name}_music.wav" \
      -f lavfi -i "aevalsrc=exprs='0.98*lt(mod(t\,5)\,0.004)*sin(2*PI*1000*t)|0.98*lt(mod(t\,5)\,0.004)*sin(2*PI*1000*t)':s=48000:d=${DUR}" \
      -filter_complex "${fc};[a][2]amix=inputs=2:normalize=0[b]" -map "[b]" -c:a pcm_s16le "${name}_mix.wav"
  else
    ffmpeg -y -hide_banner -loglevel error -i "${name}_voice.wav" -i "${name}_music.wav" -filter_complex "$fc" -map "[a]" -c:a pcm_s16le "${name}_mix.wav"
  fi
  ffmpeg -y -hide_banner -loglevel error -f lavfi -i "testsrc2=size=1080x1920:rate=25:duration=${DUR}" -i "${name}_mix.wav" \
    -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "${name}.mp4"
}
# iterate NAME TARGET_I VOICE_LUFS MUSIC_LUFS LIMIT [burst]: two linear correction passes on the measured mp4
iterate() {
  local name=$1 target=$2 vt=$3 mt=$4 lim=$5 burst=${6:-no} i meas d
  for i in 1 2 3 4 5; do
    build "$name" "$vt" "$mt" "$lim" "$burst"
    meas=$(lufs "${name}.mp4")
    d=$(awk -v t="$target" -v m="$meas" 'BEGIN{printf "%.2f", t-m}')
    echo "$name pass $i: measured I=${meas} (target ${target}, delta ${d})"
    if awk -v d="$d" 'BEGIN{exit !(d<0.2 && d>-0.2)}'; then break; fi
    vt=$(awk -v a="$vt" -v d="$d" 'BEGIN{printf "%.2f", a+d}'); mt=$(awk -v a="$mt" -v d="$d" 'BEGIN{printf "%.2f", a+d}')
  done
}
#            name  target  voice  music  limiter(linear)  burst
iterate C1    -14   -15.0  -25.0  0.70            # control: ratio ~ +10 dB, limiter -3 dBFS
iterate C2    -14   -15.5  -23.5  0.70            # control: ratio ~ +8 dB
iterate L1     -8    -9.0  -19.0  0.63            # too loud: ~-8 LUFS, limiter -4 dBFS (so TP stays <= -1 after AAC, only loudness is seeded)
iterate L2    -14   -25.0  -15.0  0.70            # voice buried: voice 10 dB under the music
iterate L3    -14   -15.0  -25.0  0.70  yes       # legal level but true-peak bursts > -1 dBTP

echo; echo "VERIFY (measured from the mp4, ffmpeg ebur128=peak=true):"
for f in C1 C2 L1 L2 L3; do
  printf "%s  I=%s LUFS  LRA=%s LU  TP=%s dBTP  voice=%s  music=%s\n" "$f" "$(lufs $f.mp4)" "$(lra $f.mp4)" "$(tp $f.mp4)" "$(lufs ${f}_voice.wav)" "$(lufs ${f}_music.wav)"
done
