#!/usr/bin/env python3
"""Naive home-made cut detector: mean absolute difference between consecutive
downscaled greyscale frames, fixed threshold. Represents 'what we could do
ourselves in 10 minutes'. Usage: baseline.py clip.mp4 [threshold] -> JSON list of cut times (s)."""
import sys, json, time
import cv2, numpy as np

path = sys.argv[1]
THRESH = float(sys.argv[2]) if len(sys.argv) > 2 else 20.0   # mean |diff| on 0-255 scale, chosen once a priori
MIN_GAP = 10                                                 # frames; ignore re-triggers within 1/3 s
t0 = time.time()
cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
prev, i, last, cuts = None, 0, -MIN_GAP, []
while True:
    ok, frame = cap.read()
    if not ok:
        break
    g = cv2.cvtColor(cv2.resize(frame, (270, 480), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.int16)
    if prev is not None:
        d = float(np.abs(g - prev).mean())
        if d > THRESH and i - last >= MIN_GAP:
            cuts.append(round(i / fps, 3)); last = i
    prev, i = g, i + 1
print(json.dumps({"clip": path, "threshold": THRESH, "frames": i, "fps": fps,
                  "cuts_s": cuts, "runtime_s": round(time.time() - t0, 2)}))
