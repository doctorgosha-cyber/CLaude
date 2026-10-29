// checks/subtitles.mjs - sketch: narration vs subtitle QA via fixtures/01-whisper/check_srt.py (faster-whisper).
// usage: node checks/subtitles.mjs <narration.wav> <subs.srt> [--model base.en] [--tuned]
// prints the checker's JSON; exit 0 = clean, 1 = findings, 2 = checker/ASR error.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const [wav, srt, ...rest] = process.argv.slice(2);
if (!wav || !srt) { console.error("usage: subtitles.mjs <wav> <srt> [--model base.en] [--tuned]"); process.exit(2); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const venv = process.env.WHISPER_VENV ?? path.join(root, "runs/01-whisper/venv");
const python = process.platform === "win32" ? path.join(venv, "Scripts/python.exe") : path.join(venv, "bin/python");
const script = path.join(root, "fixtures/01-whisper/check_srt.py");
if (!existsSync(python)) { console.error(`venv python not found: ${python} (pip install faster-whisper==1.2.1)`); process.exit(2); }

const tuned = rest.includes("--tuned");
const args = ["-I", script, wav, srt, ...rest.filter(a => a !== "--tuned")];
if (tuned && !rest.includes("--model")) args.push("--model", "small.en", "--beam-size", "5", "--vad-filter");

const r = spawnSync(python, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, HF_HUB_DISABLE_PROGRESS_BARS: "1" } });
let out;
try { out = JSON.parse(r.stdout); } catch { console.error(r.stderr || r.stdout); process.exit(2); }
console.log(JSON.stringify(out, null, 1));
if (out.error) { console.error(`check_srt error: ${out.error}`); process.exit(2); }
for (const f of out.findings) console.error(`cue ${f.cue} [${f.type}] ${f.detail}`);
process.exit(out.findings.length ? 1 : 0);
