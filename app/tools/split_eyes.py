"""Split each open eye into layers, so the gaze can move inside the eye while the highlights stay.

  public/assets/ghosts/<id>/eye_back_<S>.webp    the shape of the eye, filled with its ink
  public/assets/ghosts/<id>/eye_iris_<S>.webp    what lies inside the rim, with the highlights painted out
  public/assets/ghosts/<id>/eye_ring_<S>.webp    the rim, with a hole where the inside shows
  public/assets/ghosts/<id>/eye_glint_<S>.webp   the highlights alone
  src/data/eyes.gen.ts                           per ghost: how far the inside may move, rim width, ink

All four layers have the size of eye_open_<S>.webp and lie exactly on top of each other. Drawn in
this order without moving anything they give the original eye again.

Usage: python -I tools/split_eyes.py <app_root> <ghost,ghost|all> [--sheet <out.png>] [--force]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

app = Path(sys.argv[1])
GHOSTS_DIR = app / "public" / "assets" / "ghosts"
GEN = app / "src" / "data" / "eyes.gen.ts"
FORCE = "--force" in sys.argv
SHEET = Path(sys.argv[sys.argv.index("--sheet") + 1]) if "--sheet" in sys.argv else None
want = sys.argv[2]
ghosts = sorted(p.name for p in GHOSTS_DIR.iterdir() if p.is_dir()) if want == "all" else want.split(",")


def shifted(m, dy, dx):
    """m moved by (dy, dx), with False coming in at the border."""
    out = np.zeros_like(m)
    h, w = m.shape
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = m[ys, xs]
    return out


N4 = [(0, 1), (0, -1), (1, 0), (-1, 0)]
N8 = N4 + [(1, 1), (1, -1), (-1, 1), (-1, -1)]


def erode(m, n):
    out = m.copy()
    for dy, dx in n:
        out &= shifted(m, dy, dx)
    return out


def dilate(m, n):
    out = m.copy()
    for dy, dx in n:
        out |= shifted(m, dy, dx)
    return out


def depth(solid):
    """How many pixels each pixel lies inside the shape (1 at the edge). 4 and 8 neighbours take turns, which comes close to a round distance."""
    d = np.zeros(solid.shape, np.int32)
    cur = solid.copy()
    k = 0
    while cur.any():
        k += 1
        nxt = erode(cur, N4 if k % 2 else N8)
        d[cur & ~nxt] = k
        cur = nxt
    return d


def components(m):
    """Connected areas of a mask, as a list of masks."""
    left = m.copy()
    out = []
    while left.any():
        y, x = np.argwhere(left)[0]
        comp = np.zeros_like(m)
        comp[y, x] = True
        while True:
            grown = dilate(comp, N8) & left
            if (grown == comp).all():
                break
            comp = grown
        out.append(comp)
        left &= ~comp
    return out


def paint_out(rgb, hole, keep, rounds=400):
    """Fills the hole from its surroundings: every hole pixel becomes the mean of its neighbours, again and again."""
    out = rgb.copy()
    known = keep & ~hole
    start = rgb[known].mean(axis=0) if known.any() else np.zeros(3)
    out[hole] = start
    w = (keep | hole).astype(np.float64)
    for _ in range(rounds):
        acc = np.zeros_like(out)
        cnt = np.zeros(hole.shape)
        for dy, dx in N4:
            sm = np.zeros_like(w)
            sv = np.zeros_like(out)
            h, wd = hole.shape
            ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
            xs, xd = (slice(0, wd - dx), slice(dx, wd)) if dx >= 0 else (slice(-dx, wd), slice(0, wd + dx))
            sm[yd, xd] = w[ys, xs]
            sv[yd, xd] = out[ys, xs]
            acc += sv * sm[..., None]
            cnt += sm
        ok = hole & (cnt > 0)
        out[ok] = acc[ok] / cnt[ok][:, None]
    return out


def split(im):
    px = np.asarray(im.convert("RGBA")).astype(np.float64) / 255
    rgb, a = px[..., :3], px[..., 3]
    solid = a > 0.5
    d = depth(solid)

    # highlights: bright and nearly without colour. The brightest part of an iris is pale too, but
    # as a whole it still has a clear tint (measured on all 16 ghosts: highlights stay below 0.15
    # in saturation and above 0.84 in their darkest channel, pale iris lies at 0.20 to 0.27 and 0.69 to 0.79)
    hi, lo = rgb.max(axis=2), rgb.min(axis=2)
    white = solid & (hi > 0.8) & (lo > 0.62) & ((hi - lo) / np.maximum(hi, 1e-6) < 0.28) & (d > 2)

    def is_highlight(c):
        col = rgb[c].mean(axis=0)
        return c.sum() >= 10 and (col.max() - col.min()) / col.max() < 0.17 and col.min() > 0.82

    cores = [c for c in components(white) if is_highlight(c)]
    hole = np.zeros_like(solid)
    for c in cores:
        hole |= dilate(dilate(dilate(c, N8), N4), N8)
    hole &= solid
    base = paint_out(rgb, hole, solid)

    # each highlight keeps its own colour; how much of it covers a pixel follows from the painted-out eye below
    glint = np.zeros(px.shape)
    for c in cores:
        zone = dilate(dilate(dilate(c, N8), N4), N8) & solid
        col = rgb[erode(c, N4) if erode(c, N4).any() else c].mean(axis=0)
        diff = col - base
        cover = np.clip(((rgb - base) * diff).sum(axis=2) / np.maximum((diff * diff).sum(axis=2), 1e-6), 0, 1)
        cover = np.where(zone, cover, 0)
        glint[..., :3] = np.where(cover[..., None] > glint[..., 3:4], col, glint[..., :3])
        glint[..., 3] = np.maximum(glint[..., 3], cover * a)

    # ink: the colour of the rim, read just inside the edge
    near = solid & (d >= 2) & (d <= 4) & ~hole
    ink = np.median(base[near], axis=0)

    # the rim ends where the picture stops being ink
    far = np.sqrt(((base - ink) ** 2).sum(axis=2))
    rim = 5
    for k in range(3, int(d.max())):
        at = d == k
        if at.sum() and (far[at] > 0.16).mean() > 0.10:
            break
        rim = k
    rim = int(np.clip(rim, 5, 24))

    # inside: everything deeper than the rim, with a soft edge that still lies in the ink
    hard = (d >= rim - 1).astype(np.float64)
    inside = np.asarray(Image.fromarray((hard * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))).astype(np.float64) / 255

    def layer(color, alpha):
        out = np.dstack([np.broadcast_to(color, rgb.shape), alpha])
        out[alpha <= 0, :3] = 0
        return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))

    return {
        "back": layer(ink, a),
        "iris": layer(base, a * inside),
        "ring": layer(base, a * (1 - inside)),
        "glint": Image.fromarray((np.clip(glint, 0, 1) * 255 + 0.5).astype(np.uint8)),
    }, rim, ink, len(cores)


def put(dst, src, dx=0, dy=0):
    tmp = Image.new("RGBA", dst.size, (0, 0, 0, 0))
    tmp.paste(src, (dx, dy))
    return Image.alpha_composite(dst, tmp)


def stack(layers, move=(0, 0), glint=0.12, size=None):
    """The eye as the rig draws it: the inside moved, the highlights moved a little with it."""
    out = Image.new("RGBA", size or layers["back"].size, (0, 0, 0, 0))
    out = put(out, layers["back"])
    out = put(out, layers["iris"], *move)
    out = put(out, layers["ring"])
    return put(out, layers["glint"], round(move[0] * glint), round(move[1] * glint))


info = {}
rows = []
for g in ghosts:
    per = {}
    for side in "LR":
        src = GHOSTS_DIR / g / f"eye_open_{side}.webp"
        if not src.exists():
            continue
        im = Image.open(src)
        layers, rim, ink, n = split(im)
        orig = np.asarray(im.convert("RGBA")).astype(np.float64)
        again = np.asarray(stack(layers)).astype(np.float64)
        err = float(np.abs(orig[..., :3] * orig[..., 3:] / 255 - again[..., :3] * again[..., 3:] / 255).mean())
        per[side] = dict(rim=rim, ink=ink, size=im.size)
        for name, lim in layers.items():
            path = GHOSTS_DIR / g / f"eye_{name}_{side}.webp"
            if FORCE or not path.exists():
                lim.save(path, "WEBP", quality=92, method=6)
        print(f"{g:9s} {side}: rim {rim:2d} px, highlights {n}, ink {np.round(ink, 3).tolist()}, mean difference to the original {err:.2f} of 255")
        rows.append((g, side, im.convert("RGBA"), layers, rim))
    if per:
        rim = min(v["rim"] for v in per.values())
        ink = np.mean([v["ink"] for v in per.values()], axis=0)
        info[g] = dict(shift=round(rim - 2.5, 1), rim=rim, ink=[round(float(v), 3) for v in ink])

# the generated table keeps the ghosts it already has
old = {}
if GEN.exists():
    txt = GEN.read_text(encoding="utf-8")
    start = txt.index("= {") + 2
    old = json.loads(txt[start : txt.rindex("}") + 1])
old.update(info)
body = ",\n".join(f"  {json.dumps(k)}: {json.dumps(old[k])}" for k in sorted(old))
GEN.write_text(
    "// Generated by tools/split_eyes.py. Do not edit by hand.\n"
    "/**\n"
    " * Ghosts whose open eyes come in layers (back, iris, ring, glint). In pixels of the eye part:\n"
    " * shift is how far the inside may move, rim how wide the rim is. ink is the colour of rim and lid line.\n"
    " */\n"
    "export interface EyeKit {\n  shift: number;\n  rim: number;\n  ink: [number, number, number];\n}\n\n"
    f"export const EYES: Record<string, EyeKit> = {{\n{body}\n}};\n",
    encoding="utf-8",
    newline="\n",
)
print("wrote", GEN.name, "with", len(old), "ghosts")

if SHEET:
    Z = 3
    cw, ch = 160 * Z, 176 * Z
    cols = ["original", "layers again", "iris", "ring", "glint", "look left", "look right", "look up", "look down"]
    sheet = Image.new("RGBA", (cw * len(cols), ch * len(rows)), (126, 200, 190, 255))
    for r, (g, side, orig, layers, rim) in enumerate(rows):
        s = round(rim - 2.5)
        tiles = [orig, stack(layers), layers["iris"], layers["ring"], layers["glint"], stack(layers, (-s, 0)), stack(layers, (s, 0)), stack(layers, (0, -round(s * 0.8))), stack(layers, (0, round(s * 0.8)))]
        for c, t in enumerate(tiles):
            t = t.resize((t.width * Z, t.height * Z), Image.NEAREST)
            sheet.alpha_composite(t, (c * cw + 8, r * ch + 8))
    sheet.convert("RGB").save(SHEET)
    print("sheet", SHEET, sheet.size, "columns:", ", ".join(cols))
