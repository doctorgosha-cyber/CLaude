#!/usr/bin/env python3
"""check_srt.py - subtitle text + timing QA against narration audio with faster-whisper.

  python check_srt.py <audio.wav> <subs.srt> [--model base.en] [--beam-size 1] [--vad-filter]
                      [--wer-threshold 0.05] [--timing-ms 300] [--language en] [--compute-type int8]
                      [--asr-words-json words.json]   # bypass the model: use precomputed words (self-test only)

Prints one JSON document.  Exit code 0 = no findings, 1 = findings, 2 = error.

Per cue it reports: the ASR words assigned to the cue, cue WER (normalised tokens: lower case,
punctuation stripped, number words -> digits, UK/US spelling aliases), the "critical" tokens of the
cue (tokens with digits, and capitalised words that are not sentence-initial = product names) that
the ASR did not say, and |asr_start - srt_start| / |asr_end - srt_end| in ms.
Findings: type "text" when WER > threshold or a critical token is missing; type "timing" when the
start or end error exceeds --timing-ms.
"""
import argparse, difflib, json, os, re, sys, time

# ---------- normalisation ----------
UNITS = {"zero":0,"one":1,"two":2,"three":3,"four":4,"five":5,"six":6,"seven":7,"eight":8,"nine":9,"ten":10,
         "eleven":11,"twelve":12,"thirteen":13,"fourteen":14,"fifteen":15,"sixteen":16,"seventeen":17,
         "eighteen":18,"nineteen":19}
TENS = {"twenty":20,"thirty":30,"forty":40,"fifty":50,"sixty":60,"seventy":70,"eighty":80,"ninety":90}
ALIASES = {"millimeters":"millimetres","millimeter":"millimetre","meters":"metres","meter":"metre",
           "liters":"litres","liter":"litre","milliliters":"millilitres","milliliter":"millilitre",
           "celsius":"celsius","hotswap":"hot swap","gooseneck":"gooseneck","pourover":"pour over"}

def tokenize(text):
    text = text.replace("-", " ").replace("/", " ")
    text = re.sub(r"(\d),(\d)", r"\1\2", text)            # 1,200 -> 1200
    raw = re.findall(r"[A-Za-z0-9]+(?:\.\d+)?", text)
    return raw

def words_to_digits(tokens):
    """collapse number-word runs: 'forty five' -> '45', 'one hundred' -> '100', 'twelve' -> '12'."""
    out, i = [], 0
    while i < len(tokens):
        t = tokens[i]; n = None; j = i
        if t in UNITS or t in TENS:
            n = 0; cur = 0
            while j < len(tokens):
                w = tokens[j]
                if w in UNITS: cur += UNITS[w]; j += 1
                elif w in TENS: cur += TENS[w]; j += 1
                elif w == "hundred" and cur: cur *= 100; j += 1
                elif w == "thousand" and cur: n += cur * 1000; cur = 0; j += 1
                else: break
            n += cur
        if n is not None and j > i:
            out.append(str(n)); i = j
        else:
            out.append(t); i += 1
    return out

def normalise(text):
    toks = [t.lower() for t in tokenize(text)]
    toks = [ALIASES.get(t, t) for t in toks]
    toks = " ".join(toks).split()
    return words_to_digits(toks)

def critical_tokens(text):
    """digits + capitalised words that are not sentence-initial (product names)."""
    raw = tokenize(text); crit = []
    for k, t in enumerate(raw):
        if re.search(r"\d", t): crit.append(t.lower())
        elif t[0].isupper() and k > 0 and not re.search(r"[.!?]\s*$", " ".join(raw[:k]) if False else ""):
            # sentence-initial: first token or preceded by terminal punctuation in the original text
            prev = text[:text.find(t)]
            if re.search(r"[.!?]\s*$", prev.strip()) or k == 0: continue
            crit.append(t.lower())
    return [ALIASES.get(c, c) for c in crit]

# ---------- SRT ----------
def parse_ts(s):
    h, m, rest = s.split(":"); sec, ms = rest.replace(".", ",").split(",")
    return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000.0

def parse_srt(path):
    cues, blk = [], []
    with open(path, encoding="utf-8-sig") as f:
        lines = [l.rstrip("\n") for l in f] + [""]
    for line in lines:
        if line.strip() == "":
            if len(blk) >= 2:
                idx = int(blk[0].strip()) if blk[0].strip().isdigit() else len(cues) + 1
                a, b = [x.strip() for x in blk[1].split("-->")]
                cues.append({"index": idx, "start": parse_ts(a), "end": parse_ts(b), "text": " ".join(blk[2:]).strip()})
            blk = []
        else:
            blk.append(line)
    return cues

# ---------- ASR ----------
def transcribe(audio, a):
    from faster_whisper import WhisperModel
    t0 = time.time()
    model = WhisperModel(a.model, device=a.device, compute_type=a.compute_type, download_root=a.model_dir)
    load_s = time.time() - t0
    t1 = time.time()
    segs, info = model.transcribe(audio, language=a.language, beam_size=a.beam_size, word_timestamps=True,
                                  vad_filter=a.vad_filter, condition_on_previous_text=False)
    words = []
    for s in segs:
        for w in s.words or []:
            words.append({"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)})
    return words, {"model_load_s": round(load_s, 2), "transcribe_s": round(time.time() - t1, 2),
                   "language": info.language, "language_probability": round(info.language_probability, 3)}

# ---------- alignment ----------
def levenshtein(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]

def align(cues, words, a):
    srt_tok, srt_cue = [], []
    for ci, c in enumerate(cues):
        for t in normalise(c["text"]): srt_tok.append(t); srt_cue.append(ci)
    asr_tok = []
    for w in words:
        n = normalise(w["word"]); asr_tok.append(n[0] if n else "")
    assign = [None] * len(words)                     # word index -> cue index
    sm = difflib.SequenceMatcher(a=srt_tok, b=asr_tok, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1): assign[j1 + k] = srt_cue[i1 + k]
        elif op == "replace":
            # map replaced ASR words onto the cue(s) of the replaced SRT tokens proportionally
            for k in range(j2 - j1):
                si = i1 + min(i2 - i1 - 1, int(k * (i2 - i1) / max(1, j2 - j1)))
                assign[j1 + k] = srt_cue[si]
    # unassigned (inserted) ASR words: attach to the neighbouring cue by time (midpoint rule)
    for wi, w in enumerate(words):
        if assign[wi] is not None: continue
        prev_c = next((assign[k] for k in range(wi - 1, -1, -1) if assign[k] is not None), None)
        next_c = next((assign[k] for k in range(wi + 1, len(words)) if assign[k] is not None), None)
        if prev_c is None and next_c is None: continue
        if prev_c is None: assign[wi] = next_c; continue
        if next_c is None or prev_c == next_c: assign[wi] = prev_c; continue
        mid = (cues[prev_c]["end"] + cues[next_c]["start"]) / 2
        assign[wi] = next_c if w["start"] >= mid else prev_c
    report, findings = [], []
    for ci, c in enumerate(cues):
        ws = [w for w, cc in zip(words, assign) if cc == ci]
        ref = normalise(c["text"]); hyp = [t for w in ws for t in normalise(w["word"])]
        wer = round(levenshtein(ref, hyp) / max(1, len(ref)), 3)
        crit = critical_tokens(c["text"]); hyp_set = set(hyp)
        missing = [t for t in crit if t not in hyp_set]
        row = {"index": c["index"], "srt_start": c["start"], "srt_end": c["end"], "srt_text": c["text"],
               "asr_text": " ".join(w["word"] for w in ws), "asr_start": ws[0]["start"] if ws else None,
               "asr_end": ws[-1]["end"] if ws else None, "wer": wer, "critical_missing": missing,
               "start_err_ms": None, "end_err_ms": None, "findings": []}
        if ws:
            row["start_err_ms"] = int(round((ws[0]["start"] - c["start"]) * 1000))
            row["end_err_ms"] = int(round((ws[-1]["end"] - c["end"]) * 1000))
        if wer > a.wer_threshold or missing:
            why = []
            if wer > a.wer_threshold: why.append(f"cue WER {wer} > {a.wer_threshold}")
            if missing: why.append("number/name token(s) not heard: " + ", ".join(missing))
            row["findings"].append({"type": "text", "detail": "; ".join(why)})
        if not ws:
            row["findings"].append({"type": "text", "detail": "no ASR words aligned to this cue"})
        elif abs(row["start_err_ms"]) > a.timing_ms or abs(row["end_err_ms"]) > a.timing_ms + a.end_slack_ms:
            row["findings"].append({"type": "timing", "detail": f"start error {row['start_err_ms']} ms, end error {row['end_err_ms']} ms (limit {a.timing_ms} ms)"})
        for f in row["findings"]:
            findings.append({"cue": c["index"], "type": f["type"], "detail": f["detail"]})
        report.append(row)
    return report, findings

def main():
    p = argparse.ArgumentParser()
    p.add_argument("audio"); p.add_argument("srt")
    p.add_argument("--model", default="base.en"); p.add_argument("--beam-size", type=int, default=1)
    p.add_argument("--vad-filter", action="store_true"); p.add_argument("--language", default="en")
    p.add_argument("--compute-type", default="int8"); p.add_argument("--device", default="cpu")
    p.add_argument("--model-dir", default=os.environ.get("WHISPER_MODEL_DIR"))
    p.add_argument("--wer-threshold", type=float, default=0.05); p.add_argument("--timing-ms", type=int, default=300)
    p.add_argument("--end-slack-ms", type=int, default=200, help="extra tolerance for cue end (word end timestamps are less precise)")
    p.add_argument("--asr-words-json", help="self-test: read ASR words from JSON instead of running the model")
    a = p.parse_args()
    t0 = time.time(); out = {"audio": a.audio, "srt": a.srt, "config": {k: v for k, v in vars(a).items() if k not in ("audio", "srt")}}
    try:
        cues = parse_srt(a.srt)
        if a.asr_words_json:
            with open(a.asr_words_json) as f: words = json.load(f)
            out["asr_source"] = "MOCK words from " + a.asr_words_json; out["asr_info"] = {}
        else:
            words, info = transcribe(a.audio, a); out["asr_source"] = f"faster-whisper {a.model}"; out["asr_info"] = info
        out["asr_words"] = words
        out["cues"], out["findings"] = align(cues, words, a)
    except Exception as e:
        out["error"] = f"{type(e).__name__}: {e}"; out["findings"] = []
        out["runtime_s"] = round(time.time() - t0, 2); print(json.dumps(out, indent=1)); sys.exit(2)
    out["runtime_s"] = round(time.time() - t0, 2); out["clean"] = not out["findings"]
    print(json.dumps(out, indent=1)); sys.exit(0 if out["clean"] else 1)

if __name__ == "__main__":
    main()
