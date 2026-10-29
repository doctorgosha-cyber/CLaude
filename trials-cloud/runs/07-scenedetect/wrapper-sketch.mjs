#!/usr/bin/env node
// Sketch for checks/scenecuts.mjs — shot-cut QA: does the edited film cut where the script beats say?
// Usage: node checks/scenecuts.mjs film.mp4 beats.json [--tol 0.25] [--bin scenedetect]
// beats.json: {"tolerance_s":0.25,"beats":[{"name":"hook","t":3.0},{"name":"problem","t":7.0,"fade":[13.5,14.0]}]}
// Exit 0 when every beat has a detected cut within tolerance (fade: inside [start-tol, end+tol]); 1 otherwise.
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [film, beatsPath, ...rest] = process.argv.slice(2);
const opt = (k, d) => (rest.includes(k) ? rest[rest.indexOf(k) + 1] : d);
const bin = opt("--bin", process.env.SCENEDETECT_BIN ?? "scenedetect");
const spec = JSON.parse(readFileSync(beatsPath, "utf8"));
const tol = Number(opt("--tol", spec.tolerance_s ?? 0.25));
const dir = mkdtempSync(join(tmpdir(), "scenecuts-"));
// detect-adaptive: 8/8 on the trial fixture incl. 0.5 s crossfades, 0 false positives (trial 07). Output is a CSV we parse.
execFileSync(bin, ["-q", "-i", film, "-o", dir, "detect-adaptive", "list-scenes", "-f", "cuts.csv"], { stdio: "inherit" });
const rows = readFileSync(join(dir, "cuts.csv"), "utf8").split(/\r?\n/).map(r => r.split(","));
const hdr = rows.findIndex(r => r[0] === "Scene Number"), col = rows[hdr].indexOf("Start Time (seconds)");
const cuts = rows.slice(hdr + 2).filter(r => /^\d+$/.test(r[0])).map(r => Number(r[col])); // scene 1 starts at 0, skip it
rmSync(dir, { recursive: true, force: true });
const used = new Set();
const beats = spec.beats.map(b => {
  const [lo, hi] = b.fade ? [b.fade[0] - tol, b.fade[1] + tol] : [b.t - tol, b.t + tol];
  const i = cuts.findIndex((c, j) => !used.has(j) && c >= lo && c <= hi);
  if (i >= 0) used.add(i);
  return { ...b, found: i >= 0 ? cuts[i] : null, ok: i >= 0 };
});
const extra = cuts.filter((_, j) => !used.has(j));
const ok = beats.every(b => b.ok);
console.log(JSON.stringify({ film, ok, tolerance_s: tol, beats, extra_cuts_s: extra, detected_cuts_s: cuts }, null, 1));
process.exit(ok ? 0 : 1);
