"""Compose every kit ghost from its parts with the landmarks in kit_rigs.py, for tuning.
Usage: python -I preview_kits.py <kits_dir> <out.png> [ids,...]"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from kit_rigs import RIGS  # noqa: E402

kits, out = Path(sys.argv[1]), Path(sys.argv[2])
ids = sys.argv[3].split(",") if len(sys.argv) > 3 else list(RIGS)
SC = 1.6


def load(g, p):
    return Image.open(kits / g / f"{p}.png").convert("RGBA")


def arm_anchor(im, side):
    return (im.width * (0.8 if side == "L" else 0.2), im.height * 0.28)


def compose(g, mode="open"):
    R = RIGS[g]
    body = load(g, "body")
    W, H = body.width + 160, body.height + 80
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ox, oy = 80, 60

    def put(im, x, y, s=1.0, anchor=None):
        if s != 1:
            im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        if anchor is None:
            c.alpha_composite(im, (round(ox + x - im.width / 2), round(oy + y - im.height / 2)))
        else:
            c.alpha_composite(im, (round(ox + x - anchor[0] * s), round(oy + y - anchor[1] * s)))

    if "tuft" in R:
        t = load(g, "tuft")
        put(t, R["tuft"][0], R["tuft"][1], 1.0, (t.width / 2, t.height * 0.97))
    c.alpha_composite(body, (ox, oy - 20 + 20))
    fs = R["fs"]
    bx, by = R["blush"]
    put(load(g, "blush_L"), R["cx"] - bx, by, fs)
    put(load(g, "blush_R"), R["cx"] + bx, by, fs)
    eye = "eye_open" if mode == "open" else "eye_happy"
    for side, sgn in (("L", -1), ("R", 1)):
        if side in R["eyes"]:
            put(load(g, f"{eye}_{side}"), R["cx"] + sgn * R["eye_dx"], R["eye_y"], fs)
    put(load(g, "mouth_smile" if mode == "open" else "mouth_laugh"), R["cx"], R["mouth_y"], fs * 0.85)
    for side, key in (("L", "arm_l"), ("R", "arm_r")):
        a = load(g, f"arm_{side}")
        put(a, R[key][0], R[key][1], R["arm_s"], arm_anchor(a, side))
    return c


tiles = []
for g in ids:
    for m in ("open", "happy"):
        im = compose(g, m)
        im = im.resize((round(im.width * SC), round(im.height * SC)), Image.LANCZOS)
        tiles.append((f"{g} {m}", im))
cell_w = max(t.width for _, t in tiles)
cell_h = max(t.height for _, t in tiles) + 16
cols = 6
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), (40, 34, 80))
d = ImageDraw.Draw(sheet)
for k, (name, im) in enumerate(tiles):
    x, y = (k % cols) * cell_w, (k // cols) * cell_h
    sheet.paste(im, (x, y), im)
    d.text((x + 4, y + cell_h - 14), name, fill=(255, 255, 255))
sheet.save(out)
print(out, sheet.size)
