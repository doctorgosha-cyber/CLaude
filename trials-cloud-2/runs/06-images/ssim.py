# Scores every row of bench*.json: SSIM (grey + RGB multichannel, scikit-image 0.26.0, data_range=255)
# and DSSIM (kornelski dssim 3.5.1 CLI, if present). Writes scored.json. Run with the trial venv.
import json, sys, subprocess, shutil, os
import numpy as np
from skimage import io
from skimage.color import rgb2gray
from skimage.metrics import structural_similarity as ssim
run = '/home/user/CLaude/trials-cloud-2/runs/06-images'
dssim_bin = sys.argv[1] if len(sys.argv) > 1 and os.path.exists(sys.argv[1]) else None
rows = []
for fn in ('bench.json', 'bench_squoosh.json'):
    p = os.path.join(run, fn)
    if os.path.exists(p): rows += json.load(open(p))
srcs = {}
def src(name):
    if name not in srcs:
        a = io.imread(f'/home/user/CLaude/trials-cloud-2/fixtures/06-images/src/{name}.png')[..., :3]
        srcs[name] = (a, rgb2gray(a))
    return srcs[name]
for r in rows:
    if r['encoder'] == 'png-source': continue
    a, ag = src(r['image'])
    b = io.imread(r['decoded'])[..., :3]
    r['ssim_rgb'] = round(float(ssim(a, b, channel_axis=-1, data_range=255)), 5)
    r['ssim_gray'] = round(float(ssim(ag, rgb2gray(b), data_range=1.0)), 5)
    if dssim_bin:
        out = subprocess.run([dssim_bin, f'/home/user/CLaude/trials-cloud-2/fixtures/06-images/src/{r["image"]}.png', r['decoded']], capture_output=True, text=True)
        r['dssim'] = float(out.stdout.split()[0]) if out.returncode == 0 else None
json.dump(rows, open(os.path.join(run, 'scored.json'), 'w'), indent=1)
print('scored', sum(1 for r in rows if 'ssim_rgb' in r), 'dssim', 'yes' if dssim_bin else 'no')
