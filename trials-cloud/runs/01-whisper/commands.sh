#!/usr/bin/env bash
# Trial 01 - SYSTRAN/faster-whisper 1.2.1 as a subtitle text+timing QA check.
# Everything below ran in the cloud sandbox EXCEPT the ASR itself: huggingface.co is denied by the
# sandbox network policy, so the model could not be fetched (see model-download.err).
# On a machine with internet (or a pre-downloaded model dir), steps 3-5 are the whole trial.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"          # trials-cloud/
FIX="$ROOT/fixtures/01-whisper"; RUN="$ROOT/runs/01-whisper"
VENV="${VENV:-$RUN/venv}"

# 1. install (measured in sandbox: 37.0 s, 470 MB venv, Python 3.13.16)
python3 -m venv "$VENV" && "$VENV/bin/pip" install -q faster-whisper==1.2.1
"$VENV/bin/pip" list --format=freeze > "$RUN/pip-freeze.txt"

# 2. fixtures (espeak-ng 1.51 + ffmpeg 6.1.1; deterministic; already committed, re-run only if needed)
# (cd "$FIX" && ./make-fixtures.sh)

# 3. logic self-test with synthetic word timings (no model) -> must be 8/8, 0 FP
"$VENV/bin/python" -I "$FIX/score.py" --name selftest --mock --out-dir "$RUN/selftest" > "$RUN/selftest-mock.json"

# 4. model download attempt (what failed here). Optional offline alternative:
#    export WHISPER_MODEL_DIR=/path/to/dir containing Systran/faster-whisper-base.en (and -small.en)
"$VENV/bin/python" -c 'from faster_whisper import WhisperModel; WhisperModel("base.en", device="cpu", compute_type="int8"); print("MODEL OK")' 2> "$RUN/model-download.err" || true

# 5. candidate runs (each writes per-file JSON + a score JSON into $RUN)
"$VENV/bin/python" -I "$FIX/score.py" --name default --out-dir "$RUN" --model base.en                       > "$RUN/default.score.json"
"$VENV/bin/python" -I "$FIX/score.py" --name tuned   --out-dir "$RUN" --model small.en --beam-size 5 --vad-filter > "$RUN/tuned.score.json"

# single file, as the Node wrapper would call it (exit 0 clean / 1 findings / 2 error):
# "$VENV/bin/python" -I "$FIX/check_srt.py" "$FIX/keyboard.wav" "$FIX/keyboard.seeded.srt" --model base.en
