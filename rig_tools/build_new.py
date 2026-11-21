"""Build the parts of the second-generation ghosts from the raw cuts of extract_new.py.

  <kits>/<ghost>/_raw/*.png  ->  <kits>/<ghost>/<part>.png   (native sheet resolution)

The body is the finished figure of the sheet, with its painted eyes and mouth taken out again.
Its blush, and arms it holds up already, stay where the artist put them.

Usage: python -I build_new.py <kits_dir> [ghost ...]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import spsolve

kits = Path(sys.argv[1])
ONLY = sys.argv[2:]
PAD = 6
LUM = np.array([0.3, 0.55, 0.15])


def raw(gid, name):
    return Image.open(kits / gid / "_raw" / f"{name}.png").convert("RGBA")


def save(gid, name, im):
    im.save(kits / gid / f"{name}.png")


def trim(im, pad=PAD):
    a = np.asarray(im)
    ys, xs = np.nonzero(a[..., 3] > 40)
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + 1 + pad), min(im.height, ys.max() + 1 + pad))
    return im.crop(box), box


def ellipse(shape, cx, cy, rx, ry):
    yy, xx = np.mgrid[: shape[0], : shape[1]]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1


def rect(shape, x0, y0, x1, y1):
    m = np.zeros(shape, bool)
    m[y0:y1, x0:x1] = True
    return m


def take_out(im, shapes, lum_min=140):
    """Paint skin over the eyes and the mouth of a finished figure.
    The skin is carried in from around each shape (a harmonic fill: smooth, like the airbrushed skin itself).
    Outlines and blush next to a shape neither count as skin nor get painted over."""
    a = np.asarray(im).astype(np.float64)
    h, w = a.shape[:2]
    rgb = a[..., :3]
    lum = rgb @ LUM
    pink = (rgb[..., 0] - rgb[..., 1] > 28) & (rgb[..., 0] > 170)
    gone = np.zeros((h, w), bool)
    for s in shapes:
        gone |= ellipse((h, w), *s[1:]) if s[0] == "e" else rect((h, w), *s[1:])
    # blush that reaches into a shape stays (with a pixel of rim, so no pink fringe is left behind);
    # the pink inside a mouth lies deep in its shape and goes
    gone &= ~ndi.binary_dilation(pink & ~ndi.binary_erosion(gone, iterations=7), iterations=1)
    # skin to carry in: light, not blush, and not the soft edge of a line that stayed
    skin = ~gone & (a[..., 3] > 200) & (lum >= lum_min) & ~pink & ~ndi.binary_dilation(~gone & (lum < lum_min), iterations=2)
    idx = -np.ones((h, w), int)
    ys, xs = np.nonzero(gone)
    idx[ys, xs] = np.arange(len(ys))
    A = lil_matrix((len(ys), len(ys)))
    b = np.zeros((len(ys), 3))
    for k, (y, x) in enumerate(zip(ys, xs)):
        n = 0
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if not (0 <= yy < h and 0 <= xx < w):
                continue
            if gone[yy, xx]:
                A[k, idx[yy, xx]] = -1
                n += 1
            elif skin[yy, xx]:
                b[k] += rgb[yy, xx]
                n += 1
        A[k, k] = max(n, 1)
    A = A.tocsr()
    out = a.copy()
    for c in range(3):
        out[ys, xs, c] = spsolve(A, b[:, c])
    # a breath of blur over the seam
    soft = ndi.gaussian_filter(out[..., :3], (1.2, 1.2, 0))
    band = ndi.binary_dilation(gone, iterations=2) & (skin | gone)
    out[band, :3] = soft[band]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def flip_v(im):
    return im.transpose(Image.FLIP_TOP_BOTTOM)


def scaled(im, f):
    return im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)


def face(gid, **names):
    """Copy face parts under their rig names; a value is a raw name or a ready picture."""
    for part, v in names.items():
        save(gid, part, raw(gid, v) if isinstance(v, str) else v)


# ---------- the figures whose face is taken out: shapes in pixels of _raw/figure.png ----------
FIGURES = {
    "phoenix": [("r", 155, 173, 205, 203), ("r", 235, 174, 275, 203), ("r", 200, 194, 243, 237)],
    "moondeer": [("r", 135, 178, 183, 208), ("r", 207, 173, 245, 199), ("r", 179, 196, 220, 234)],
    "cloud": [("r", 169, 232, 240, 273), ("r", 288, 232, 344, 272), ("r", 236, 265, 296, 323)],
    "cactus": [("r", 167, 239, 234, 276), ("r", 280, 239, 336, 276), ("r", 233, 268, 288, 325)],
    "dragon": [("e", 163.5, 200, 34, 44), ("e", 292, 193.5, 45, 49), ("r", 187, 212, 250, 278)],
    "jellyfish": [("e", 188, 323, 47, 53), ("e", 345, 322.5, 47, 52.5), ("r", 230, 340, 304, 410)],
}
# skin darker than usual still counts as skin (the outlines are far darker)
LUM_MIN = {"dragon": 90, "jellyfish": 70}


def build_figure(gid):
    fig = raw(gid, "figure")
    body = take_out(fig, FIGURES[gid], LUM_MIN.get(gid, 140))
    save(gid, "body", body)
    # before and after, to look at
    xs = [s[1] - (s[3] if s[0] == "e" else 0) for s in FIGURES[gid]]
    ys = [s[2] - (s[4] if s[0] == "e" else 0) for s in FIGURES[gid]]
    x0, y0 = int(max(0, min(xs) - 40)), int(max(0, min(ys) - 40))
    box = (x0, y0, x0 + 300, y0 + 200)
    both = Image.new("RGBA", (600, 200), (120, 130, 160, 255))
    both.alpha_composite(fig.crop(box), (0, 0))
    both.alpha_composite(body.crop(box), (300, 0))
    both.convert("RGB").resize((1500, 500), Image.LANCZOS).save(kits / gid / "_face_out.png")


def build_phoenix():
    g = "phoenix"
    build_figure(g)
    sleep = raw(g, "eye_sleep_L")
    face(g, eye_open_L="eye_open_L", eye_open_R="eye_open_R", eye_happy_L="eye_happy_L", eye_happy_R="eye_happy_R",
         eye_sleep_L="eye_sleep_L", eye_sleep_R="eye_sleep_R", mouth_laugh="mouth_laugh", mouth_o="mouth_o",
         mouth_line="mouth_line", mouth_smile=scaled(sleep, 1.15), blush_L="blush_L", blush_R="blush_R",
         arm_L="arm_L", arm_R="arm_R")


def build_moondeer():
    g = "moondeer"
    build_figure(g)
    sleep = raw(g, "eye_sleep_L")
    face(g, eye_open_L="eye_open_L", eye_open_R="eye_open_R", eye_happy_L="eye_happy_L", eye_happy_R="eye_happy_R",
         eye_sleep_L="eye_sleep_L", eye_sleep_R="eye_sleep_R", mouth_laugh="mouth_laugh", mouth_o="mouth_o",
         mouth_line="mouth_line", mouth_smile=scaled(sleep, 1.15), blush_L="blush_L", blush_R="blush_R")


def build_cloud():
    g = "cloud"
    build_figure(g)
    flat_l, flat_r = raw(g, "eye_flat_L"), raw(g, "eye_flat_R")
    face(g, eye_open_L="eye_open_L", eye_open_R="eye_open_R", eye_happy_L="eye_happy_L", eye_happy_R="eye_happy_R",
         eye_sleep_L=flip_v(flat_l), eye_sleep_R=flip_v(flat_r), mouth_laugh="mouth_laugh", mouth_o="mouth_o",
         mouth_line="mouth_line", mouth_smile=flip_v(flat_l), blush_L="blush_L", blush_R="blush_R",
         arm_L="arm_L", arm_R="arm_R")


def build_cactus():
    g = "cactus"
    build_figure(g)
    flat_l, flat_r = raw(g, "eye_flat_L"), raw(g, "eye_flat_R")
    face(g, eye_open_L="eye_open_L", eye_open_R="eye_open_R", eye_happy_L="eye_happy_L", eye_happy_R="eye_happy_R",
         eye_sleep_L=flip_v(flat_l), eye_sleep_R=flip_v(flat_r), mouth_laugh="mouth_laugh", mouth_o="mouth_o",
         mouth_line="mouth_line", mouth_smile=flip_v(flat_l), blush_L="blush_L", blush_R="blush_R")


def build_dragon():
    g = "dragon"
    build_figure(g)
    face(g, **{p: p for p in ["eye_open_L", "eye_open_R", "eye_happy_L", "eye_happy_R", "eye_sleep_L", "eye_sleep_R",
                               "mouth_smile", "mouth_laugh", "mouth_o", "mouth_line", "blush_L", "blush_R"]})


def build_jellyfish():
    g = "jellyfish"
    build_figure(g)
    face(g, **{p: p for p in ["eye_open_L", "eye_open_R", "eye_happy_L", "eye_happy_R", "eye_sleep_L", "eye_sleep_R",
                               "mouth_smile", "mouth_laugh", "mouth_o", "mouth_line", "blush_L", "blush_R"]})


BUILD = dict(phoenix=build_phoenix, moondeer=build_moondeer, cloud=build_cloud, cactus=build_cactus, dragon=build_dragon,
             jellyfish=build_jellyfish)

for gid, fn in BUILD.items():
    if ONLY and gid not in ONLY:
        continue
    fn()
    print(gid, "built")
