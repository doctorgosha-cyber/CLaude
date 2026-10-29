#!/usr/bin/env python3
"""Build the 01-whisper fixtures: 3 synthetic English narrations (espeak-ng),
reference SRTs whose cue times come from the measured audio, seeded SRTs with
8 known defects, and KEY.json.  Invoked by make-fixtures.sh.

Method: every sentence is synthesised to its own WAV, converted to 16 kHz mono
s16, leading/trailing silence trimmed (-50 dB), its duration measured with
ffprobe, and the sentences are concatenated with 0.4 s of silence between them
(0.5 s lead-in / lead-out).  Cue i therefore starts exactly at the measured
offset of sentence i and ends at offset + duration.
"""
import json, os, subprocess, sys, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
GAP, LEAD = 0.4, 0.5
VOICE, SPEED = "en-us", "150"

SCRIPTS = {
    "keyboard": [
        "The Kestrel T45 is a tactile mechanical keyboard switch built for long typing sessions.",
        "Each switch is rated for 80 million key presses and actuates at 45 grams of force.",
        "Inside the housing, a copper leaf makes contact when the stem travels 2 millimetres.",
        "A small bump in the stem gives your finger feedback before the key bottoms out at 4 millimetres.",
        "Factory lubrication keeps the stroke smooth and reduces the sound by about 6 decibels.",
        "The Kestrel T45 fits any standard hot swap board, so you can install it without soldering.",
    ],
    "thermos": [
        "The Polar Flask 500 is a vacuum insulated bottle that keeps drinks hot for 12 hours.",
        "Two stainless steel walls are welded together with a vacuum gap between them.",
        "Because there is almost no air in the gap, heat cannot travel by conduction or convection.",
        "A copper coating on the inner wall reflects radiant heat back into the drink.",
        "The Polar Flask 500 holds half a litre and weighs just 310 grams when empty.",
    ],
    "kettle": [
        "The Nimbus Kettle is an electric gooseneck kettle designed for pour over coffee.",
        "A dial on the base sets the water temperature anywhere from 40 to 100 degrees Celsius.",
        "The 1200 watt element brings 600 millilitres of water to the boil in about 3 minutes.",
        "The narrow spout gives you a slow, steady stream, so the coffee grounds bloom evenly.",
        "After boiling, the Nimbus Kettle holds the chosen temperature for 60 minutes.",
    ],
}

# Seeded defects: (file, cue index 1-based, type, subtype, how to seed)
DEFECTS = [
    dict(id="D1", file="keyboard", cue=2, type="text", subtype="number_swap",
         original="45 grams", seeded="54 grams"),
    dict(id="D2", file="keyboard", cue=4, type="timing", subtype="start_shift_ms", shift_ms=450, which="start"),
    dict(id="D3", file="keyboard", cue=5, type="text", subtype="dropped_word",
         original="the stroke smooth and", seeded="the stroke and"),
    dict(id="D4", file="thermos", cue=1, type="text", subtype="wrong_product_name",
         original="Polar Flask 500", seeded="Arctic Flask 500"),
    dict(id="D5", file="thermos", cue=3, type="timing", subtype="cue_shift_ms", shift_ms=-600, which="both"),
    dict(id="D6", file="thermos", cue=5, type="text", subtype="added_word",
         original="weighs just 310 grams", seeded="weighs just under 310 grams"),
    dict(id="D7", file="kettle", cue=2, type="text", subtype="changed_word",
         original="water temperature", seeded="water pressure"),
    dict(id="D8", file="kettle", cue=4, type="timing", subtype="cue_shift_ms", shift_ms=900, which="both"),
]

CMDS = []  # exact commands, echoed into make-fixtures.log

def run(cmd, **kw):
    CMDS.append(" ".join(repr(c) if " " in c else c for c in cmd))
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)

def duration(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=nw=1:nk=1", path]).stdout.strip()
    return float(out)

def ts(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def write_srt(path, cues):
    with open(path, "w", encoding="utf-8") as f:
        for i, (st, en, text) in enumerate(cues, 1):
            f.write(f"{i}\n{ts(st)} --> {ts(en)}\n{text}\n\n")

def build(name, sentences, work):
    os.makedirs(work, exist_ok=True)
    parts, cues, t = [], [], LEAD
    silence_gap = os.path.join(work, "gap.wav"); silence_lead = os.path.join(work, "lead.wav")
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", str(GAP), "-sample_fmt", "s16", silence_gap])
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", str(LEAD), "-sample_fmt", "s16", silence_lead])
    parts.append(silence_lead)
    for i, sent in enumerate(sentences, 1):
        raw = os.path.join(work, f"{name}-{i}-raw.wav"); trimmed = os.path.join(work, f"{name}-{i}.wav")
        run(["espeak-ng", "-v", VOICE, "-s", SPEED, "-w", raw, sent])
        # 16 kHz mono s16 + trim leading/trailing silence so the cue starts at speech onset
        run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-ar", "16000", "-ac", "1", "-sample_fmt", "s16",
             "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
             trimmed])
        d = duration(trimmed)
        cues.append((t, t + d, sent))
        parts.append(trimmed)
        t += d
        if i < len(sentences):
            parts.append(silence_gap); t += GAP
    parts.append(silence_lead); t += LEAD
    lst = os.path.join(work, f"{name}-concat.txt")
    with open(lst, "w") as f:
        for p in parts: f.write(f"file '{p}'\n")
    out_wav = os.path.join(HERE, f"{name}.wav")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", out_wav])
    total = duration(out_wav)
    assert abs(total - t) < 0.02, (name, total, t)
    return out_wav, cues, total

def seed(name, cues):
    cues = [list(c) for c in cues]
    for d in DEFECTS:
        if d["file"] != name: continue
        c = cues[d["cue"] - 1]
        if d["type"] == "text":
            assert d["original"] in c[2], (d, c[2])
            c[2] = c[2].replace(d["original"], d["seeded"])
        else:
            sh = d["shift_ms"] / 1000.0
            if d["which"] in ("start", "both"): c[0] += sh
            if d["which"] in ("end", "both"): c[1] += sh
    return [tuple(c) for c in cues]

def main():
    work = os.path.join(HERE, "_work")
    if os.path.isdir(work): shutil.rmtree(work)
    key = {"task": "subtitle text + timing QA against narration audio (HANDOFF item 1)",
           "tts": f"espeak-ng 1.51, voice {VOICE}, -s {SPEED}, per-sentence WAV -> ffmpeg 16 kHz mono s16, silence trimmed at -50 dB, concatenated with {GAP} s gaps and {LEAD} s lead-in/out",
           "timing_tolerance_ms": 300, "files": [], "defects": []}
    for name, sents in SCRIPTS.items():
        wav, cues, total = build(name, sents, work)
        write_srt(os.path.join(HERE, f"{name}.clean.srt"), cues)      # control: correct for the audio
        write_srt(os.path.join(HERE, f"{name}.seeded.srt"), seed(name, cues))
        key["files"].append({"name": name, "wav": f"{name}.wav", "duration_s": round(total, 3),
                             "cues": len(cues), "clean_srt": f"{name}.clean.srt", "seeded_srt": f"{name}.seeded.srt",
                             "cue_times": [[round(a, 3), round(b, 3)] for a, b, _ in cues]})
        print(f"{name}: {total:.2f} s, {len(cues)} cues", file=sys.stderr)
    for d in DEFECTS:
        e = dict(d); e["srt"] = f"{d['file']}.seeded.srt"
        e["expected_detection"] = ("text finding on this cue (cue WER above threshold and/or a number/name token "
                                   "that the ASR did not say)" if d["type"] == "text" else
                                   f"timing finding on this cue (|asr_start - srt_start| = {abs(d['shift_ms'])} ms > 300 ms)")
        key["defects"].append(e)
    key["expected_total"] = len(DEFECTS)
    key["controls_expected_findings"] = 0
    with open(os.path.join(HERE, "KEY.json"), "w") as f: json.dump(key, f, indent=2)
    with open(os.path.join(HERE, "make-fixtures.log"), "w") as f: f.write("\n".join(CMDS) + "\n")
    shutil.rmtree(work)

if __name__ == "__main__":
    main()
