#!/usr/bin/env node
// checks/loudness.mjs <mix.mp4> [voice.wav music.wav]  -> JSON on stdout; exit 0 clean, 1 findings, 2 ffmpeg error.
// Runs ffmpeg (separate process: GPL build of ffmpeg puts no obligation on this code) with the ebur128 filter.
// Thresholds: YouTube delivery -14 +-1 LUFS integrated, true peak <= -1 dBTP, voice >= +6 dB over music (stems needed).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
const [mix, v, m] = process.argv.slice(2);
if (!mix) { console.error("usage: loudness.mjs mix.mp4 [voice.wav music.wav]"); process.exit(2); }
const base = mix.replace(/\.[^.]+$/, ""), voice = v ?? `${base}_voice.wav`, music = m ?? `${base}_music.wav`;
function ebur(file) {
  const r = spawnSync(process.env.FFMPEG || "ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  if (r.error || r.status !== 0) { console.error(`ffmpeg failed on ${file}: ${r.error?.message ?? r.stderr.slice(-300)}`); process.exit(2); }
  const g = re => { const x = r.stderr.match(re); return x ? Number(x[1]) : null; };
  return { integrated: g(/\n\s*I:\s+(-?[\d.]+) LUFS/), lra: g(/\n\s*LRA:\s+(-?[\d.]+) LU/), truePeak: g(/\n\s*Peak:\s+(-?[\d.]+) dBFS/) };
}
const out = { file: mix, ...ebur(mix), ratio: null, findings: [] };
if (out.integrated == null || out.truePeak == null) { console.error("could not parse ebur128 summary"); process.exit(2); }
if (Math.abs(out.integrated + 14) > 1) out.findings.push(`integrated ${out.integrated} LUFS (want -14 +-1)`);
if (out.truePeak > -1) out.findings.push(`true peak ${out.truePeak} dBTP (want <= -1)`);
if (existsSync(voice) && existsSync(music)) {
  out.voice = ebur(voice).integrated; out.music = ebur(music).integrated; out.ratio = Math.round((out.voice - out.music) * 10) / 10;
  if (out.ratio < 6) out.findings.push(`voice only ${out.ratio} dB over music (want >= +6)`);
} else out.note = "stems not found; voice/music ratio not checked";
out.pass = out.findings.length === 0;
console.log(JSON.stringify(out));
process.exit(out.pass ? 0 : 1);
