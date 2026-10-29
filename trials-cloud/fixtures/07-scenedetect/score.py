#!/usr/bin/env python3
"""Score detected cut times against KEY.json.
Usage: score.py KEY.json --detected a.json [--control b.json] [--tol 0.25]
  --detected : JSON file: list of seconds, or {"cuts_s":[...]}, or a PySceneDetect list-scenes CSV
  --control  : same formats; every detection there is a false positive
Hard cut matched if |det - t| <= tol. Crossfade matched if start-tol <= det <= end+tol;
its timing error is measured against the fade midpoint. Each true cut may match once;
each unmatched detection in the seeded clip is a false positive. Prints JSON."""
import sys, json, csv, argparse

def load(path):
    txt = open(path, encoding="utf-8").read()
    if path.lower().endswith(".csv"):
        rows = list(csv.reader(txt.splitlines()))
        hdr = next(i for i, r in enumerate(rows) if r and r[0] == "Scene Number")
        col = rows[hdr].index("Start Time (seconds)")
        return [float(r[col]) for r in rows[hdr + 1:] if r and r[0].isdigit()][1:]  # drop scene 1 (starts at 0)
    data = json.loads(txt)
    if isinstance(data, dict):
        data = data.get("cuts_s", data.get("cuts", []))
    return [float(x) for x in data]

ap = argparse.ArgumentParser()
ap.add_argument("key"); ap.add_argument("--detected", required=True)
ap.add_argument("--control"); ap.add_argument("--tol", type=float)
a = ap.parse_args()
key = json.load(open(a.key))
tol = a.tol if a.tol is not None else key.get("tolerance_s", 0.25)
det = sorted(load(a.detected)); used = set(); matched = []
for c in key["cuts"]:
    if c["type"] == "hard":
        lo, hi, ref = c["time_s"] - tol, c["time_s"] + tol, c["time_s"]
    else:
        lo, hi, ref = c["start_s"] - tol, c["end_s"] + tol, c["mid_s"]
    cands = [(abs(d - ref), j) for j, d in enumerate(det) if j not in used and lo <= d <= hi]
    if cands:
        err, j = min(cands); used.add(j)
        matched.append({"id": c["id"], "type": c["type"], "true_s": ref, "det_s": det[j], "err_ms": round(err * 1000, 1)})
fp_seeded = [d for j, d in enumerate(det) if j not in used]
fp_control = sorted(load(a.control)) if a.control else []
errs = [m["err_ms"] for m in matched]
print(json.dumps({
    "recall": f"{len(matched)}/{len(key['cuts'])}",
    "matched_ids": [m["id"] for m in matched],
    "missed_ids": [c["id"] for c in key["cuts"] if c["id"] not in {m["id"] for m in matched}],
    "false_positives": len(fp_seeded) + len(fp_control),
    "false_positives_seeded_s": fp_seeded, "false_positives_control_s": fp_control,
    "timing_error_ms_mean": round(sum(errs) / len(errs), 1) if errs else None,
    "timing_error_ms_max": max(errs) if errs else None,
    "tolerance_s": tol, "matches": matched, "detected_seeded_s": det}, indent=1))
