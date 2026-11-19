"""Cut the ChatGPT parts sheet into single PNGs.
Usage: python -I extract.py <sheet> <out_dir>"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sheet, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
im = Image.open(sheet).convert("RGBA")
a = np.asarray(im)
lab, n = ndi.label(a[..., 3] > 20)
names = {}
# identify components by their bbox centre on the sheet
def name_for(cx, cy, w, h):
    if w > 500: return "body"
    if cy < 200: return "eye_open_L" if cx < 1120 else "eye_open_R"
    if cy < 340: return "eye_happy_L" if cx < 1120 else "eye_happy_R"
    if cy < 470: return "eye_sleep_L" if cx < 1120 else "eye_sleep_R"
    if cy < 640:
        return "mouth_smile" if cx < 1000 else "mouth_laugh" if cx < 1200 else "mouth_o" if cx < 1330 else "mouth_line"
    if cy < 780: return "blush_L" if cx < 1120 else "blush_R"
    return "arm_L" if cx < 1040 else "arm_R" if cx < 1280 else "tuft"
meta = {}
PAD = 6
for i, s in enumerate(ndi.find_objects(lab), 1):
    y0, y1, x0, x1 = s[0].start, s[0].stop, s[1].start, s[1].stop
    nm = name_for((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0)
    region = ndi.binary_dilation(lab == i, iterations=4)
    y0, y1 = max(0, y0 - PAD), min(a.shape[0], y1 + PAD)
    x0, x1 = max(0, x0 - PAD), min(a.shape[1], x1 + PAD)
    crop = a[y0:y1, x0:x1].copy()
    crop[..., 3] = np.where(region[y0:y1, x0:x1], crop[..., 3], 0)
    crop[crop[..., 3] == 0, :3] = 0
    Image.fromarray(crop).save(out / f"{nm}.png", optimize=True)
    meta[nm] = {"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0)}
    print(f"{nm:12s} {x0:5d},{y0:4d}  {x1-x0}x{y1-y0}")
(out / "parts.json").write_text(json.dumps(meta, indent=1))
assert len(meta) == 16, len(meta)
