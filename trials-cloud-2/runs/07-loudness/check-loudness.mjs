#!/usr/bin/env node
// check-loudness.mjs [--tuned] <mix.mp4> [voice.wav music.wav]
// Runs ffmpeg ebur128 (separate process; no licence obligation on this code) on a 9:16 mix and,
// when stems are present (given, or <mix>_voice.wav / <mix>_music.wav beside it), on each stem.
// Defaults: integrated -14 +-1 LUFS, true peak <= -1.0 dBTP, voice-music ratio >= +6 dB (needs stems).
// Tuned (--tuned): also LRA <= 12 LU and "music under speech": momentary loudness (100 ms) of the music
// stem only on frames where the voice stem's momentary loudness > -30 LUFS; ratio_speech >= +6 dB.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
const args = process.argv.slice(2); const tuned = args.includes("--tuned");
const [mix, voiceArg, musicArg] = args.filter(a => !a.startsWith("--"));
if (!mix) { console.error("usage: check-loudness.mjs [--tuned] mix.mp4 [voice.wav music.wav]"); process.exit(2); }
const base = mix.replace(/\.[^.]+$/, "");
const voice = voiceArg ?? `${base}_voice.wav`, music = musicArg ?? `${base}_music.wav`;
const FF = process.env.FFMPEG || "ffmpeg";
function run(file, af, out = "stderr") {
  const r = spawnSync(FF, ["-hide_banner", "-nostats", "-i", file, "-af", af, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.error || r.status !== 0) { console.error(`ffmpeg failed on ${file}: ${r.error?.message ?? r.stderr.slice(-400)}`); process.exit(2); }
  return r[out];
}
function summary(file) {                       // parse the ebur128 "Summary:" block (peak=true -> true peak)
  const s = run(file, "ebur128=peak=true");
  const g = re => { const m = s.match(re); return m ? Number(m[1]) : null; };
  return { integrated: g(/\n\s*I:\s+(-?[\d.]+) LUFS/), lra: g(/\n\s*LRA:\s+(-?[\d.]+) LU/), truePeak: g(/\n\s*Peak:\s+(-?[\d.]+) dBFS/) };
}
function momentary(file) {                     // 100 ms momentary loudness series via ebur128 metadata
  return [...run(file, "ebur128=metadata=1,ametadata=print:file=-", "stdout").matchAll(/lavfi\.r128\.M=(-?[\d.]+)/g)].map(m => Number(m[1]));
}
const energyMean = xs => xs.length ? 10 * Math.log10(xs.reduce((a, x) => a + 10 ** (x / 10), 0) / xs.length) : null;
const r1 = v => v == null ? null : Math.round(v * 10) / 10;
const t0 = performance.now();
const out = { file: mix, mode: tuned ? "tuned" : "default", ...summary(mix), voice: null, music: null, ratio: null, findings: [] };
const F = (id, msg) => out.findings.push({ id, msg });
if (out.integrated == null || out.truePeak == null) { console.error("could not parse ebur128 summary"); process.exit(2); }
if (Math.abs(out.integrated + 14) > 1) F("integrated", `integrated ${out.integrated} LUFS, want -14 +-1`);
if (out.truePeak > -1.0) F("true_peak", `true peak ${out.truePeak} dBTP, want <= -1.0`);
if (existsSync(voice) && existsSync(music)) {
  out.voice = summary(voice).integrated; out.music = summary(music).integrated;
  out.ratio = r1(out.voice - out.music);
  if (out.ratio < 6) F("ratio", `voice-music ratio ${out.ratio} dB (voice ${out.voice}, music ${out.music}), want >= +6`);
  if (tuned) {
    const vm = momentary(voice), mm = momentary(music), n = Math.min(vm.length, mm.length);
    const speech = [...Array(n).keys()].filter(i => vm[i] > -30);
    const vS = energyMean(speech.map(i => vm[i])), mS = energyMean(speech.map(i => mm[i]));
    out.tuned = { speechFrames: speech.length, voiceDuringSpeech: r1(vS), musicDuringSpeech: r1(mS), ratioDuringSpeech: r1(vS - mS) };
    if (!speech.length) F("no_speech", "no frames with voice momentary > -30 LUFS");
    else if (vS - mS < 6) F("ratio_speech", `music under speech: ratio ${out.tuned.ratioDuringSpeech} dB, want >= +6`);
  }
} else out.note = "stems not found: voice-to-music ratio needs the voice and music stems";
if (tuned && out.lra != null && out.lra > 12) F("lra", `LRA ${out.lra} LU, want <= 12`);
out.runtime_s = Math.round((performance.now() - t0) / 10) / 100; out.pass = out.findings.length === 0;
console.log(JSON.stringify(out));
process.exit(out.pass ? 0 : 1);
