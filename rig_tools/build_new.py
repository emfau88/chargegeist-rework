"""Build the parts of the second-generation ghosts from the raw cuts of extract_new.py.

  <kits>/<ghost>/_raw/*.png  ->  <kits>/<ghost>/<part>.png   (native sheet resolution)

The body is the finished figure of the sheet, with its painted eyes and mouth taken out again.
Its blush, and arms it holds up already, stay where the artist put them.

Usage: python -I build_new.py <kits_dir> [ghost ...]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
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


# ---------- arms that are painted into the figure: cut out along their contour, each a picture of its own ----------
# A part is found by its surface: the light areas inside the rough shape, as far as the dark contour encloses them.
# The contour around them goes with the part.
#   front   the part lies in front of the figure. All of it goes, and what it covered is painted in: "behind"
#           lists, back to front, ("ink", polygon), ("fill", polygon, a point on the visible surface whose colours
#           are carried in) and ("line", points of a contour that continues one that is visible).
#   back    (front=False) the part lies behind the figure. The figure keeps its own contour along the cut.
# All in pixels of _raw/figure.png.
ARMS = {
    "cactus": dict(
        L=dict(rough=[(20, 240), (70, 232), (112, 262), (120, 292), (150, 300), (150, 345), (120, 382), (40, 385), (15, 340)],
               front=True, behind=[
                   ("ink", [(128, 296), (152, 296), (152, 336), (128, 336)]),  # where the contours of face, hood and cloth meet
                   ("fill", [(76.5, 232), (77, 262), (82, 292), (94, 316), (114, 333), (146, 331), (133, 310), (129, 288), (131, 262), (131, 232)], (105, 245)),
                   ("fill", [(152, 331), (126, 332), (110, 337), (93, 353), (81, 372), (75, 392), (175, 392), (175, 331)], (165, 352)),
                   ("line", [(76.5, 236), (77, 262), (82, 292), (94, 316), (114, 333)]),      # the side of the hood
                   ("line", [(131, 262), (129, 288), (133, 310), (145, 329)]),               # the face
                   ("line", [(152, 331), (126, 332), (110, 337), (93, 353), (81, 372), (75, 392)]),  # the shoulder of the cloth
               ]),
        R=dict(rough=[(362, 268), (392, 250), (450, 225), (470, 290), (462, 345), (420, 380), (382, 372), (372, 340), (360, 300)],
               front=False),
    ),
}
INK = np.array([13, 17, 38.0])
LINE = 9      # how far the dark contour of a part reaches from its surface
KEEP = 7.0    # the contour the figure keeps where a part lay behind it


def polygon(size, pts, ss=1):
    """A filled polygon as a mask; ss > 1 gives soft edges (0..1)."""
    w, h = size
    m = Image.new("L", (w * ss, h * ss), 0)
    ImageDraw.Draw(m).polygon([(x * ss, y * ss) for x, y in pts], fill=255)
    return np.asarray(m.resize((w, h), Image.LANCZOS)).astype(float) / 255 if ss > 1 else np.asarray(m) > 0


def stroke(size, pts, width, ss=4):
    """A smooth line through the points (Catmull-Rom), with round ends, as a soft mask."""
    w, h = size
    p = [np.array(v, float) for v in [pts[0]] + list(pts) + [pts[-1]]]
    q = []
    for i in range(1, len(p) - 2):
        for t in np.linspace(0, 1, 40, endpoint=False):
            q.append(0.5 * (2 * p[i] + (p[i + 1] - p[i - 1]) * t + (2 * p[i - 1] - 5 * p[i] + 4 * p[i + 1] - p[i + 2]) * t * t
                            + (3 * p[i] - p[i - 1] - 3 * p[i + 1] + p[i + 2]) * t ** 3))
    q = [(x * ss, y * ss) for x, y in q + [p[-1]]]
    m = Image.new("L", (w * ss, h * ss), 0)
    d = ImageDraw.Draw(m)
    d.line(q, fill=255, width=round(width * ss), joint="curve")
    r = width * ss / 2
    for x, y in q:
        d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    return np.asarray(m.resize((w, h), Image.LANCZOS)).astype(float) / 255


def split_arms(gid):
    """Take the arms out of body.png: arm_L.png and arm_R.png, and the body without them.
    arms.json says where each arm picture lies in the figure (its top left corner)."""
    spec = ARMS[gid]
    fig = Image.open(kits / gid / "body.png").convert("RGBA")
    a = np.asarray(fig).astype(np.float64)
    h, w = a.shape[:2]
    size = (w, h)
    lum = a[..., :3] @ LUM
    al = a[..., 3]
    opaque = al > 128
    dark = opaque & (lum < 62)
    inner = opaque & ~dark
    lab, n = ndi.label(inner)
    area = ndi.sum(inner, lab, range(1, n + 1))

    # the surface of each arm
    arm_in = {}
    for k in "LR":
        p = polygon(size, spec[k]["rough"])
        ids = [i for i in range(1, n + 1) if area[i - 1] > 3 and ((lab == i) & p).sum() / area[i - 1] > 0.9]
        arm_in[k] = np.isin(lab, ids)
    # specks of light inside a contour are no surface of their own: next to an arm they go with the arm
    for k in "LR":
        near = ndi.distance_transform_edt(~arm_in[k]) <= 16
        for i in range(1, n + 1):
            if area[i - 1] < 60 and not arm_in["L"][lab == i].any() and not arm_in["R"][lab == i].any() and (near & (lab == i)).any():
                arm_in[k] |= lab == i
    body_in = inner & ~arm_in["L"] & ~arm_in["R"]
    d_body = ndi.distance_transform_edt(~body_in)

    # surface, contour and the soft rim towards nothing
    arm = {}
    for k in "LR":
        d_arm = ndi.distance_transform_edt(~arm_in[k])
        arm[k] = arm_in[k] | (dark & (d_arm <= LINE)) | ((al > 0) & ~opaque & (d_arm <= LINE + 3))
    # flecks of contour that would be left behind go with the arm next to them
    rest = opaque & ~arm["L"] & ~arm["R"]
    lb, m = ndi.label(rest)
    main = lb == (np.argmax(ndi.sum(rest, lb, range(1, m + 1))) + 1)
    loose = (al > 0) & ~arm["L"] & ~arm["R"] & (ndi.distance_transform_edt(~main) > 2)
    for k in "LR":
        arm[k] |= loose & (ndi.distance_transform_edt(~arm[k]) <= 30)

    body = a.copy()
    origin = {}
    for k in "LR":
        m = arm[k]
        part = a.copy()
        part[~m, 3] = 0
        ys, xs = np.nonzero(part[..., 3] > 0)
        box = (max(0, xs.min() - 4), max(0, ys.min() - 4), min(w, xs.max() + 5), min(h, ys.max() + 5))
        save(gid, f"arm_{k}", Image.fromarray(np.clip(part, 0, 255).astype(np.uint8)).crop(box))
        origin[k] = [int(box[0]), int(box[1])]
        if not spec[k]["front"]:
            # the figure keeps a contour of even width along the cut
            body[m, 3] = np.minimum(body[m, 3], 255 * np.clip(KEEP + 0.5 - d_body[m], 0, 1))
            continue
        paint = np.zeros((h, w, 4))

        def lay(mask, rgb):
            t = np.clip(mask, 0, 1)[..., None]
            paint[..., :3] = rgb * t + paint[..., :3] * (1 - t)
            paint[..., 3:] = np.maximum(paint[..., 3:], t * 255)

        for step in spec[k]["behind"]:
            if step[0] == "ink":
                lay(polygon(size, step[1], 4), INK)
            elif step[0] == "line":
                lay(stroke(size, step[1], 7.5), INK)
            else:
                # each pixel takes the colour of the nearest pixel of that surface; then the patch is smoothed
                x, y = step[2]
                source = lab == lab[int(y), int(x)]
                iy, ix = ndi.distance_transform_edt(~source, return_distances=False, return_indices=True)
                lay(polygon(size, step[1], 4), ndi.gaussian_filter(a[iy, ix, :3], (5, 5, 0)))
        body = np.where(m[..., None], paint, body)
    save(gid, "body", Image.fromarray(np.clip(body, 0, 255).astype(np.uint8)))
    (kits / gid / "arms.json").write_text(json.dumps(origin))


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
    split_arms(g)
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
