# Exports bundled scikit-image sample photos (no pooch download) as PNG sources.
# Run with the trial venv: venv/bin/python gen_photos.py <outdir>
import sys, os
from skimage import data, io
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
photos = {
    "photo_astronaut": (data.astronaut, "NASA Great Images (Eileen Collins), public domain"),
    "photo_chelsea":   (data.chelsea,   "CC0, Stefan van der Walt"),
    "photo_coffee":    (data.coffee,    "CC0, Rachel Michetti (Pikolo Espresso Bar)"),
    "photo_rocket":    (data.rocket,    "SpaceX DSCOVR launch, public domain (bundled as JPEG; decoded to PNG)"),
}
for name, (fn, lic) in photos.items():
    img = fn()
    io.imsave(os.path.join(out, name + ".png"), img, check_contrast=False)
    print(name, img.shape, lic)
