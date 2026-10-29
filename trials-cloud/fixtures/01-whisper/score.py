#!/usr/bin/env python3
"""score.py - run check_srt.py over every fixture (clean + seeded) and score against KEY.json.

  python score.py --name default [check_srt options...]        e.g. --model base.en
  python score.py --name tuned --model small.en --beam-size 5 --vad-filter --wer-threshold 0.06
  python score.py --name selftest --mock                       # synthetic word timings, no model

Output (JSON on stdout): recall (defects found / expected), false_positives (findings on the control
SRTs), extra_findings_on_seeded (findings on seeded SRTs that are not in the key), runtime, per-defect hits.
"""
import argparse, json, os, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))

def mock_words(cues):
    words = []
    for c in cues:
        toks = c["text"].split(); n = len(toks); span = c["end"] - c["start"]
        for i, t in enumerate(toks):
            words.append({"word": t, "start": round(c["start"] + span * i / n, 3), "end": round(c["start"] + span * (i + 1) / n, 3), "p": 1.0})
    return words

def main():
    p = argparse.ArgumentParser(); p.add_argument("--name", required=True); p.add_argument("--mock", action="store_true")
    p.add_argument("--out-dir", default=None)
    a, rest = p.parse_known_args()
    key = json.load(open(os.path.join(HERE, "KEY.json")))
    out_dir = a.out_dir or HERE; os.makedirs(out_dir, exist_ok=True)
    py = sys.executable; results = {}; t0 = time.time(); errors = []
    for f in key["files"]:
        wav = os.path.join(HERE, f["wav"]); extra = []
        if a.mock:
            sys.path.insert(0, HERE); import check_srt
            mw = os.path.join(out_dir, f"{f['name']}.mockwords.json")
            json.dump(mock_words(check_srt.parse_srt(os.path.join(HERE, f["clean_srt"]))), open(mw, "w"))
            extra = ["--asr-words-json", mw]
        for kind in ("clean_srt", "seeded_srt"):
            srt = os.path.join(HERE, f[kind]); outp = os.path.join(out_dir, f"{a.name}.{f['name']}.{kind.split('_')[0]}.json")
            r = subprocess.run([py, "-I", os.path.join(HERE, "check_srt.py"), wav, srt] + rest + extra, capture_output=True, text=True)
            open(outp, "w").write(r.stdout)
            try: j = json.loads(r.stdout)
            except Exception: j = {"error": (r.stderr or r.stdout)[-800:], "findings": []}
            if j.get("error"): errors.append({"file": f[kind], "error": j["error"]})
            results[(f["name"], kind)] = j
    runtime = round(time.time() - t0, 2)
    found, fp, extra_seeded = {}, [], []
    for d in key["defects"]:
        j = results[(d["file"], "seeded_srt")]
        found[d["id"]] = any(x["cue"] == d["cue"] and x["type"] == d["type"] for x in j.get("findings", []))
    for f in key["files"]:
        for x in results[(f["name"], "clean_srt")].get("findings", []): fp.append({"file": f["clean_srt"], **x})
        keyed = {(d["cue"], d["type"]) for d in key["defects"] if d["file"] == f["name"]}
        for x in results[(f["name"], "seeded_srt")].get("findings", []):
            if (x["cue"], x["type"]) not in keyed: extra_seeded.append({"file": f["seeded_srt"], **x})
    n = sum(found.values()); tot = len(found)
    summary = {"name": a.name, "mock": a.mock, "check_args": rest, "found": found, "recall": f"{n}/{tot}", "recall_frac": round(n / tot, 3),
               "false_positives": len(fp), "false_positive_detail": fp, "extra_findings_on_seeded": extra_seeded,
               "runtime_s": runtime, "asr_runtime_s": round(sum(j.get("runtime_s", 0) for j in results.values()), 2),
               "errors": errors, "per_file_asr_info": {f"{k[0]}/{k[1]}": v.get("asr_info") for k, v in results.items()}}
    if errors and not a.mock: summary["recall"] = None; summary["false_positives"] = None; summary["recall_frac"] = None
    print(json.dumps(summary, indent=1))

if __name__ == "__main__":
    main()
