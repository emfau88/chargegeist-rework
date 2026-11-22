"""Build the parts of the second-generation ghosts from the raw cuts of extract_new.py.

  <kits>/<ghost>/_raw/*.png  ->  <kits>/<ghost>/<part>.png   (native sheet resolution)

The body is the finished figure of the sheet, with its painted eyes and mouth taken out again.
Its blush stays where the artist put it. Parts that move are cut out of the figure (ARMS).
Phoenix and moon deer have a picture of their own instead (SHEETS, in rig_input/neu): the figure without
face, wings or ears, and the wings or ears beside it.

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
sheets = kits.parent.parent / "rig_input" / "neu"
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


# ---------- parts that are painted into the figure: cut out, each a picture of its own ----------
# L and R become arm_L and arm_R (cactus arms, wings, fins), top becomes the tuft (the lantern on its stalk).
#   rough   a rough shape around the part.
#   cut     "contour" (the usual case): the part is found by its surface, the light areas inside the rough shape
#           as far as a dark contour encloses them; the contour around them goes with the part.
#           "shape": the part has no contour towards the figure, it grows out of it. Then the rough shape itself
#           is the part, and inside "root" it fades out over "feather" pixels.
#   front   the part lies in front of the figure. All of it goes, and what it covered is painted in: "behind"
#           lists, back to front, ("ink", polygon), ("fill", polygon, a point on the visible surface whose colours
#           are carried in) and ("line", points of a contour that continues one that is visible, width).
#   back    (front=False) the part lies behind the figure. The figure keeps its own contour along the cut.
#           grow: the hidden base of the part is grown on under the figure by this many pixels, so nothing
#           gapes when it turns.
#   near    the contour goes with the part wherever the part's surface is nearer than the figure's (for contours
#           wider than LINE). keep: the width of the contour the figure keeps along the cut of a part behind it.
# All in pixels of _raw/figure.png.
ARMS = {
    "cactus": dict(
        L=dict(rough=[(20, 240), (70, 232), (112, 262), (120, 292), (150, 300), (150, 345), (120, 382), (40, 385), (15, 340)],
               front=True, behind=[
                   ("ink", [(128, 296), (152, 296), (152, 336), (128, 336)]),  # where the contours of face, hood and cloth meet
                   ("fill", [(76.5, 232), (77, 262), (82, 292), (94, 316), (114, 333), (146, 331), (133, 310), (129, 288), (131, 262), (131, 232)], (105, 245)),
                   ("fill", [(152, 331), (126, 332), (110, 337), (93, 353), (81, 372), (75, 392), (175, 392), (175, 331)], (165, 352)),
                   ("line", [(76.5, 236), (77, 262), (82, 292), (94, 316), (114, 333)], 7.5),      # the side of the hood
                   ("line", [(131, 262), (129, 288), (133, 310), (145, 329)], 7.5),               # the face
                   ("line", [(152, 331), (126, 332), (110, 337), (93, 353), (81, 372), (75, 392)], 7.5),  # the shoulder of the cloth
               ]),
        R=dict(rough=[(362, 268), (392, 250), (450, 225), (470, 290), (462, 345), (420, 380), (382, 372), (372, 340), (360, 300)],
               front=False),
    ),
    # The wings lie behind head, bow and paws.
    "dragon": dict(
        L=dict(rough=[(5, 205), (60, 198), (104, 212), (130, 300), (122, 332), (95, 352), (40, 366), (5, 345)], front=False, grow=20, near=True, keep=9.5),
        R=dict(rough=[(372, 252), (410, 238), (470, 252), (532, 330), (530, 368), (480, 388), (430, 398), (385, 374), (366, 336), (372, 300)],
               front=False, grow=20, near=True, keep=9.5),
    ),
    # The fins grow out of the bell without a contour of their own; the lantern stands on it, behind its rim.
    "jellyfish": dict(
        L=dict(rough=[(0, 250), (84, 250), (92, 262), (104, 270), (97, 300), (90, 340), (84, 372), (66, 392), (50, 392), (0, 360)],
               cut="shape", root=[(92, 262), (132, 272), (132, 372), (84, 372), (90, 340), (97, 300), (104, 270)], feather=26,
               front=True, behind=[
                   ("fill", [(88, 256), (81, 290), (74, 325), (66, 360), (60, 388), (140, 396), (140, 254)], (170, 300)),
                   ("line", [(93, 246), (87, 262), (81, 290), (74, 325), (66, 360), (58, 390), (50, 401)], 12),
               ]),
        R=dict(rough=[(557, 250), (442, 250), (434, 262), (422, 270), (429, 300), (436, 340), (444, 372), (462, 392), (478, 392), (557, 360)],
               cut="shape", root=[(434, 262), (394, 272), (394, 372), (444, 372), (436, 340), (429, 300), (422, 270)], feather=26,
               front=True, behind=[
                   ("fill", [(432, 256), (441, 290), (448, 325), (454, 360), (460, 388), (385, 396), (385, 254)], (370, 300)),
                   ("line", [(427, 246), (433, 262), (441, 290), (448, 325), (454, 360), (462, 390), (470, 401)], 12),
               ]),
        top=dict(rough=[(214, 166), (214, 105), (250, 20), (340, -5), (450, 0), (557, 60), (557, 215), (480, 252), (405, 216), (395, 150), (330, 90), (312, 166)],
                 front=False, near=True, keep=10),
    ),
}
PART_FILE = dict(L="arm_L", R="arm_R", top="tuft")
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


def carry_in(a, region, source):
    """Colours for a region from the surface next to it. Where the surface touches the region they flow in smoothly
    (a harmonic fill, like airbrushed skin); where a contour lies between, each pixel takes the nearest colour."""
    if not (ndi.binary_dilation(region) & source).any():
        iy, ix = ndi.distance_transform_edt(~source, return_distances=False, return_indices=True)
        return ndi.gaussian_filter(a[iy, ix, :3], (5, 5, 0))
    h, w = region.shape
    ys, xs = np.nonzero(region)
    idx = -np.ones((h, w), int)
    idx[ys, xs] = np.arange(len(ys))
    A = lil_matrix((len(ys), len(ys)))
    b = np.zeros((len(ys), 3))
    for k, (y, x) in enumerate(zip(ys, xs)):
        n = 0
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if not (0 <= yy < h and 0 <= xx < w):
                continue
            if region[yy, xx]:
                A[k, idx[yy, xx]] = -1
                n += 1
            elif source[yy, xx]:
                b[k] += a[yy, xx, :3]
                n += 1
        A[k, k] = max(n, 1)
    A = A.tocsr()
    out = a[..., :3].copy()
    for c in range(3):
        out[ys, xs, c] = spsolve(A, b[:, c])
    return out


def split_arms(gid):
    """Take the parts out of body.png: arm_L.png, arm_R.png, tuft.png, and the body without them.
    arms.json says where each picture lies in the figure (its top left corner)."""
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
    by_contour = [k for k in spec if spec[k].get("cut", "contour") == "contour"]

    # the surface of each part that a contour encloses
    arm_in = {}
    for k in by_contour:
        p = polygon(size, spec[k]["rough"])
        ids = [i for i in range(1, n + 1) if area[i - 1] > 3 and ((lab == i) & p).sum() / area[i - 1] > 0.9]
        arm_in[k] = np.isin(lab, ids)
    taken = np.zeros((h, w), bool)
    for k in by_contour:
        taken |= arm_in[k]
    # specks of light inside a contour are no surface of their own: next to a part they go with it
    for k in by_contour:
        near = ndi.distance_transform_edt(~arm_in[k]) <= 16
        for i in range(1, n + 1):
            if area[i - 1] < 60 and not taken[lab == i].any() and (near & (lab == i)).any():
                arm_in[k] |= lab == i
                taken |= lab == i
    body_in = inner & ~taken
    d_body = ndi.distance_transform_edt(~body_in)

    # how much of each pixel belongs to a part (0..1)
    share = {}
    arm = {}
    for k in by_contour:
        d_arm = ndi.distance_transform_edt(~arm_in[k])
        # surface, contour and the soft rim towards nothing
        arm[k] = arm_in[k] | (dark & (d_arm <= LINE)) | ((al > 0) & ~opaque & (d_arm <= LINE + 3))
        if spec[k].get("near"):
            around = ndi.binary_dilation(polygon(size, spec[k]["rough"]), iterations=6)
            arm[k] |= (al > 0) & ~inner & (d_arm < d_body) & (d_arm <= 3 * LINE) & around
    if by_contour:
        # flecks of contour that would be left behind go with the part next to them
        mine = np.zeros((h, w), bool)
        for k in by_contour:
            mine |= arm[k]
        rest = opaque & ~mine
        lb, m = ndi.label(rest)
        main = lb == (np.argmax(ndi.sum(rest, lb, range(1, m + 1))) + 1)
        loose = (al > 0) & ~mine & (ndi.distance_transform_edt(~main) > 2)
        # where the soft rim of the figure is wide, only what does not hang on to the figure is left over
        lr, _ = ndi.label((al > 0) & ~mine)
        apart = (al > 0) & ~mine & ~np.isin(lr, np.unique(lr[main]))
        for k in by_contour:
            arm[k] |= (apart if spec[k].get("near") else loose) & (ndi.distance_transform_edt(~arm[k]) <= 30)
            if spec[k].get("near"):
                # and what does not hang on to the part stays with the figure
                lk, _ = ndi.label(arm[k])
                arm[k] &= np.isin(lk, np.unique(lk[arm_in[k]]))
    for k in spec:
        if k in arm:
            share[k] = arm[k].astype(float)
        else:
            solid = polygon(size, spec[k]["rough"], 4)
            fade = np.clip(1 - ndi.distance_transform_edt(solid < 0.5) / spec[k]["feather"], 0, 1) * polygon(size, spec[k]["root"])
            share[k] = np.maximum(solid, fade)
    gone = np.zeros((h, w), bool)
    for k in spec:
        gone |= share[k] > 0

    # the body without the parts
    body = a.copy()
    between = {}
    for k in spec:
        m = share[k] > 0
        if not spec[k]["front"]:
            # the figure keeps a contour of even width along the cut
            keep = spec[k].get("keep", KEEP)
            stay = np.clip(keep + 0.5 - d_body, 0, 1)
            stay[arm_in[k]] = 0   # the surface of the part never stays, however close it lies
            if spec[k].get("grow"):
                # and all of the contour that lies between its surface and the part's, away from the open edge:
                # under it the part has no contour of its own (see the hidden base below)
                between[k] = m & ~arm_in[k] & (d_body <= keep + 5) & (ndi.distance_transform_edt(al > 0) > 6)
                stay = np.maximum(stay, ndi.gaussian_filter(between[k].astype(float), 0.7))
            body[m, 3] = np.minimum(body[m, 3], 255 * stay[m])
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
                lay(stroke(size, step[1], step[2]), INK)
            else:
                x, y = step[2]
                source = (lab == lab[int(y), int(x)]) & ~gone
                lay(polygon(size, step[1], 4), carry_in(a, polygon(size, step[1]) & m, source))
        body = np.where(m[..., None], paint, body)
    save(gid, "body", Image.fromarray(np.clip(body, 0, 255).astype(np.uint8)))

    # the parts
    under = ndi.binary_erosion(body[..., 3] > 200, iterations=3)
    origin = {}
    for k in spec:
        part = a.copy()
        part[..., 3] = al * share[k]
        g = spec[k].get("grow", 0)
        if g:
            # The hidden base. Along the figure the part has no contour of its own: there its surface runs on under
            # the figure, in the colours of the surface next to it. Its free contour ends in a round tip.
            m = share[k] > 0
            keep = spec[k].get("keep", KEEP)
            shared = between[k]
            free = m & ~arm_in[k] & ~shared
            reach = (ndi.distance_transform_edt(~m) <= g) & under & ~m
            d_free = ndi.distance_transform_edt(~free) if free.any() else np.full((h, w), 1e9)
            d_surf = ndi.distance_transform_edt(~arm_in[k])
            core = ndi.binary_erosion(arm_in[k], iterations=3)
            sy, sx = ndi.distance_transform_edt(~(core if core.any() else arm_in[k]), return_distances=False, return_indices=True)
            surface = ndi.gaussian_filter(a[sy, sx, :3], (1.5, 1.5, 0))
            # a pixel under the figure is surface if the part's surface is nearer than its free contour
            on = (reach & (d_surf < d_free)) | shared | (m & (body[..., 3] > 128) & ~arm_in[k])
            tip = reach & ~on & (d_free <= keep)
            part[on, :3] = surface[on]
            part[tip, :3] = INK
            part[on | tip, 3] = 255
        ys, xs = np.nonzero(part[..., 3] > 0)
        box = (max(0, xs.min() - 4), max(0, ys.min() - 4), min(w, xs.max() + 5), min(h, ys.max() + 5))
        save(gid, PART_FILE[k], Image.fromarray(np.clip(part, 0, 255).astype(np.uint8)).crop(box))
        origin[k] = [int(box[0]), int(box[1])]
    (kits / gid / "arms.json").write_text(json.dumps(origin))


# ---------- figures with a picture of their own: the figure without face and parts, the parts beside it ----------
# The picture holds three things on a clear ground: the figure (the largest) and a left and a right part.
#   scale    how much larger the figure is than on the old sheet: the face parts of that sheet grow by it
#   cheeks   boxes around the painted cheeks; they are cut out as blush_L and blush_R, and the skin closes over them
#   parts    root: the joint in the part as it lies in the picture (pixels from the corner of its own box).
#            at: where the joint sits on the figure. size, turn: how the part is scaled and turned (degrees,
#            counter-clockwise) before it is put there.
# cheeks and at are in pixels of body.png.
SHEET_PAD = 6
SHEETS = {
    "phoenix": dict(file="fenix_teile.png", scale=1.928, cheeks=[(268, 403, 356, 471), (472, 405, 546, 468)], parts=dict(
        L=dict(root=(400, 255), at=(231, 528), size=0.63, turn=20),
        R=dict(root=(42, 269), at=(551, 528), size=0.63, turn=-20))),
    "moondeer": dict(file="elara_teile.png", scale=2.156, cheeks=[(249, 432, 337, 499), (451, 432, 533, 498)], parts=dict(
        L=dict(root=(304, 153), at=(253, 406), size=0.63, turn=25),
        R=dict(root=(27, 156), at=(531, 406), size=0.63, turn=-25))),
}


def build_sheet(gid):
    spec = SHEETS[gid]
    im = Image.open(sheets / spec["file"]).convert("RGBA")
    px = np.asarray(im).copy()
    lab, n = ndi.label(px[..., 3] > 40)
    found = ndi.find_objects(lab)
    order = sorted(range(n), key=lambda i: -(found[i][0].stop - found[i][0].start) * (found[i][1].stop - found[i][1].start))[:3]
    boxes = [(found[i][1].start, found[i][0].start, found[i][1].stop, found[i][0].stop) for i in order]

    def alone(box):
        """What lies in a box, without its neighbours and without the crumbs the image tool left beside it."""
        i = order[boxes.index(box)]
        one = px.copy()
        one[~ndi.binary_dilation(lab == i + 1, iterations=3), 3] = 0
        return Image.fromarray(one).crop(box)

    fbox = boxes[0]
    left, right = sorted(boxes[1:], key=lambda b: b[0])
    P = SHEET_PAD
    fig = Image.new("RGBA", (fbox[2] - fbox[0] + 2 * P, fbox[3] - fbox[1] + 2 * P), (0, 0, 0, 0))
    fig.alpha_composite(alone(fbox), (P, P))

    # the cheeks: each becomes a picture of its own, centred on the cheek, and the skin closes over the place
    a = np.asarray(fig).astype(np.float64)
    h, w = a.shape[:2]
    rgb = a[..., :3]
    lum = rgb @ LUM
    pink = (rgb[..., 0] - rgb[..., 1] > 60) & (rgb[..., 0] > 225) & (rgb[..., 2] > 60) & (a[..., 3] > 200)
    gone = np.zeros((h, w), bool)
    for side, (x0, y0, x1, y1) in zip("LR", spec["cheeks"]):
        cheek = pink & rect((h, w), x0, y0, x1, y1)
        ys, xs = np.nonzero(cheek)
        cx, cy = (xs.min() + xs.max() + 1) / 2, (ys.min() + ys.max() + 1) / 2
        rx, ry = int(np.ceil((xs.max() - xs.min()) / 2)) + 6, int(np.ceil((ys.max() - ys.min()) / 2)) + 6
        soft = ndi.gaussian_filter(cheek.astype(float), 1.0)
        blush = a.copy()
        blush[..., 3] = 255 * np.clip(soft * 1.6 - 0.3, 0, 1)
        save(gid, f"blush_{side}", Image.fromarray(np.clip(blush, 0, 255).astype(np.uint8)).crop(
            (int(round(cx - rx)), int(round(cy - ry)), int(round(cx + rx)), int(round(cy + ry)))))
        print(f"  {gid} cheek {side}: centre ({cx:.1f}, {cy:.1f})")
        gone |= ndi.binary_dilation(cheek, iterations=6)
    skin = (lum > 205) & ~gone & (a[..., 3] > 200)
    a[gone, :3] = carry_in(a, gone, skin)[gone]
    save(gid, "body", Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)))

    # the parts: turned and scaled around their joint, then set on the figure by that joint
    origin = {}
    for key, box in (("L", left), ("R", right)):
        ps = spec["parts"][key]
        part = alone(box)
        big = Image.new("RGBA", (part.width * 3, part.height * 3), (0, 0, 0, 0))
        big.alpha_composite(part, (part.width, part.height))
        c = (part.width + ps["root"][0], part.height + ps["root"][1])
        big = big.rotate(ps["turn"], center=c, resample=Image.BICUBIC)
        big = big.resize((round(big.width * ps["size"]), round(big.height * ps["size"])), Image.LANCZOS)
        cut, tb = trim(big)
        save(gid, f"arm_{key}", cut)
        origin[key] = [round(ps["at"][0] - c[0] * ps["size"] + tb[0]), round(ps["at"][1] - c[1] * ps["size"] + tb[1])]
    (kits / gid / "arms.json").write_text(json.dumps(origin))

    # the face comes from the old sheet, grown to the new figure
    k = spec["scale"]
    sleep = raw(gid, "eye_sleep_L")
    for name in ("eye_open_L", "eye_open_R", "eye_happy_L", "eye_happy_R", "eye_sleep_L", "eye_sleep_R", "mouth_laugh", "mouth_o", "mouth_line"):
        save(gid, name, scaled(raw(gid, name), k))
    save(gid, "mouth_smile", scaled(sleep, 1.15 * k))


def build_phoenix():
    build_sheet("phoenix")


def build_moondeer():
    build_sheet("moondeer")


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
    split_arms(g)
    face(g, **{p: p for p in ["eye_open_L", "eye_open_R", "eye_happy_L", "eye_happy_R", "eye_sleep_L", "eye_sleep_R",
                               "mouth_smile", "mouth_laugh", "mouth_o", "mouth_line", "blush_L", "blush_R"]})


def build_jellyfish():
    g = "jellyfish"
    build_figure(g)
    split_arms(g)
    face(g, **{p: p for p in ["eye_open_L", "eye_open_R", "eye_happy_L", "eye_happy_R", "eye_sleep_L", "eye_sleep_R",
                               "mouth_smile", "mouth_laugh", "mouth_o", "mouth_line", "blush_L", "blush_R"]})


BUILD = dict(phoenix=build_phoenix, moondeer=build_moondeer, cloud=build_cloud, cactus=build_cactus, dragon=build_dragon,
             jellyfish=build_jellyfish)

for gid, fn in BUILD.items():
    if ONLY and gid not in ONLY:
        continue
    fn()
    print(gid, "built")
