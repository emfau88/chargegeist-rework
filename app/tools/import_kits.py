"""Bring the cut kit parts into the app.

  public/assets/ghosts/<id>/<part>.webp   (kit ghosts at 2x the sheet size, Volti as is)
  src/data/rigs.gen.ts                    (rig landmarks)

Ghosts always look exactly like their kit. The separate costume pieces on the costume sheets are not
imported: costume ghosts already wear them in their body art. The second generation (NEW in kit_rigs.py)
takes the finished figure of its sheet as the body, see rig_tools/build_new.py.

Usage: python -I tools/import_kits.py <kits_dir> <rig_tools_dir> <volti_parts_dir> <app_root> [--force]
"""
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

kits, tools, volti_dir, app = (Path(p) for p in sys.argv[1:5])
sys.path.insert(0, str(tools))
from kit_rigs import NEW, RIGS  # noqa: E402

UP = 2.0  # kit sheets are small: store parts at twice their size
PUB = app / "public" / "assets"
PARTS = ["body", "eye_open_L", "eye_open_R", "eye_happy_L", "eye_happy_R", "eye_sleep_L", "eye_sleep_R",
         "mouth_smile", "mouth_laugh", "mouth_o", "mouth_line", "blush_L", "blush_R", "arm_L", "arm_R"]

# Volti's own rig (hand-tuned in its body space, 1x)
VOLTI = dict(k=0.37, cx=349, cy=360, pivot=240, eyeY=405, eyeDX=112, mouth=[349, 505], blush=[192, 488, 0.82],
             fs=1, ms=0.8, u=1, m=1, eyes="LR", armL=dict(at=[70, 520], anchor=[138, 40], s=1),
             armR=dict(at=[628, 520], anchor=[33, 40], s=1), tuft=dict(at=[345, 32], anchor=[62, 190], rest=-8),
             flow=[110, 368], breath=[150, 230], tail=[590, 765, 560, 650], top=3)
K = 0.52            # body units -> stage units for kit ghosts
FOOT = 459          # stage y of the lowest body point (as Volti)


def up(im, f=UP):
    if f == 1:
        return im
    im = im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)
    a = np.asarray(im).copy()
    rgb = Image.fromarray(a[..., :3]).filter(ImageFilter.UnsharpMask(radius=1.4, percent=45, threshold=1))
    out = np.dstack([np.asarray(rgb), a[..., 3]])
    out[out[..., 3] == 0, :3] = 0
    return Image.fromarray(out)


FORCE = "--force" in sys.argv


def save(im, path):
    """Write a webp (slow at method 6), unless it is already there."""
    if path.exists() and not FORCE:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=90, method=6)


def bbox(im):
    a = np.asarray(im)[..., 3] > 40
    ys, xs = np.nonzero(a)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def hand_point(im, anchor):
    """The arm tip: mean of the opaque pixels farthest from the shoulder."""
    a = np.asarray(im)[..., 3] > 120
    ys, xs = np.nonzero(a)
    d = (xs - anchor[0]) ** 2 + (ys - anchor[1]) ** 2
    far = d >= np.quantile(d, 0.92)
    return [round(float(xs[far].mean()), 1), round(float(ys[far].mean()), 1)]


rigs = {}
sizes = {}

# ---------- Volti ----------
vdst = PUB / "ghosts" / "volti"
vdst.mkdir(parents=True, exist_ok=True)
for p in PARTS + ["tuft"]:
    src = PUB / "companions" / "volti" / f"{p}.webp"
    if src.exists():
        shutil.copyfile(src, vdst / f"{p}.webp")
    else:
        save(Image.open(volti_dir / f"{p}.png").convert("RGBA"), vdst / f"{p}.webp")
va = Image.open(volti_dir / "arm_L.png").convert("RGBA")
vb = Image.open(volti_dir / "arm_R.png").convert("RGBA")
VOLTI["armL"]["hand"] = hand_point(va, VOLTI["armL"]["anchor"])
VOLTI["armR"]["hand"] = hand_point(vb, VOLTI["armR"]["anchor"])
rigs["volti"] = VOLTI

# ---------- kit ghosts ----------
for gid, R in RIGS.items():
    dst = PUB / "ghosts" / gid
    names = PARTS + (["tuft"] if "tuft" in R else [])
    ims = {}
    for p in names:
        im = up(Image.open(kits / gid / f"{p}.png").convert("RGBA"))
        save(im, dst / f"{p}.webp")
        ims[p] = im
    body = ims["body"]
    x0, y0, x1, y1 = bbox(body)
    W, H = x1 - x0, y1 - y0
    m = 0.37 / K  # Volti's motion constants are in its own units
    cy = y1 - (FOOT - 280) / K
    f = UP
    aL, aR = ims["arm_L"], ims["arm_R"]
    ancL = [round(aL.width * 0.8, 1), round(aL.height * 0.28, 1)]
    ancR = [round(aR.width * 0.2, 1), round(aR.height * 0.28, 1)]
    rig = dict(
        # pivot, flow and breath are measured from cy, like Volti's, scaled to this body
        k=K, cx=R["cx"] * f, cy=round(cy, 1), pivot=round(VOLTI["pivot"] * m, 1),
        eyeY=R["eye_y"] * f, eyeDX=R["eye_dx"] * f, mouth=[R["cx"] * f, R["mouth_y"] * f],
        blush=[R["blush"][0] * f, R["blush"][1] * f, R["fs"]],
        fs=R["fs"], ms=round(0.85 * R["fs"], 3), u=round(R["fs"] * ims["eye_open_L"].width / 141, 3), m=round(m, 3),
        eyes=R["eyes"],
        armL=dict(at=[R["arm_l"][0] * f, R["arm_l"][1] * f], anchor=ancL, s=R["arm_s"], hand=hand_point(aL, ancL)),
        armR=dict(at=[R["arm_r"][0] * f, R["arm_r"][1] * f], anchor=ancR, s=R["arm_s"], hand=hand_point(aR, ancR)),
        tuft=None,
        flow=[round(VOLTI["flow"][0] * m, 1), round(VOLTI["flow"][1] * m, 1)],
        breath=[round(VOLTI["breath"][0] * m, 1), round(VOLTI["breath"][1] * m, 1)],
        tail=[round(x0 + 0.77 * W, 1), x1, round(y0 + 0.66 * H, 1), round(y0 + 0.77 * H, 1)],
        top=y0,
    )
    if "tuft" in R:
        t = ims["tuft"]
        rig["tuft"] = dict(at=[R["tuft"][0] * f, R["tuft"][1] * f], anchor=[round(t.width / 2, 1), round(t.height * 0.97, 1)], rest=0)
    rigs[gid] = rig
    sizes[gid] = [body.width, body.height]

# ---------- second generation: the finished figure is the body ----------
for gid, R in NEW.items():
    dst = PUB / "ghosts" / gid
    f = R["up"]
    arms = "arm_l" in R or "arms" in R
    names = [p for p in PARTS if not p.startswith("blush") and (arms or not p.startswith("arm"))]
    ims = {}
    for p in names:
        im = up(Image.open(kits / gid / f"{p}.png").convert("RGBA"), f)
        save(im, dst / f"{p}.webp")
        ims[p] = im
    body = ims["body"]
    x0, y0, x1, y1 = bbox(body)
    W, H = x1 - x0, y1 - y0
    k = R["height"] / H
    m = 0.37 / k
    cy = y1 - (FOOT - 280) / k
    ex, ey = round(R["cx"] * f, 1), round(R["eye_y"] * f, 1)
    mx, my = round(R["mouth"][0] * f, 1), round(R["mouth"][1] * f, 1)
    if "arms" in R:
        # arms cut out of the figure: each hangs where it was painted and turns by a share of what a loose arm does
        origin = json.loads((kits / gid / "arms.json").read_text())

        def cut_arm(key):
            A, im = R["arms"][key], ims[f"arm_{key}"]
            anc = [round((A["at"][0] - origin[key][0]) * f, 1), round((A["at"][1] - origin[key][1]) * f, 1)]
            d = dict(at=[round(A["at"][0] * f, 1), round(A["at"][1] * f, 1)], anchor=anc, s=1, hand=hand_point(im, anc),
                     gain=A["gain"], up=A["up"], down=A["down"])
            return dict(d, back=True) if A.get("back") else d

        armL, armR = cut_arm("L"), cut_arm("R")
    elif arms:
        aL, aR = ims["arm_L"], ims["arm_R"]
        ancL = [round(aL.width * 0.8, 1), round(aL.height * 0.28, 1)]
        ancR = [round(aR.width * 0.2, 1), round(aR.height * 0.28, 1)]
        armL = dict(at=[round(R["arm_l"][0] * f, 1), round(R["arm_l"][1] * f, 1)], anchor=ancL, s=R["arm_s"], hand=hand_point(aL, ancL))
        armR = dict(at=[round(R["arm_r"][0] * f, 1), round(R["arm_r"][1] * f, 1)], anchor=ancR, s=R["arm_s"], hand=hand_point(aR, ancR))
    else:
        # no arms to draw: the points where they would hang still say where a charm floats and a high five lands.
        # They lie at the sides of the figure at chest height.
        chest = int(my + 4 * (my - ey))
        band = np.asarray(body)[max(0, chest - 30):chest + 30, :, 3] > 120
        xs = np.nonzero(band.any(axis=0))[0]
        reach = round(60 * m, 1)
        armL = dict(at=[float(xs.min()), float(chest)], anchor=[0, 0], s=1, hand=[-round(12 * m, 1), reach])
        armR = dict(at=[float(xs.max()), float(chest)], anchor=[0, 0], s=1, hand=[round(12 * m, 1), reach])
    rig = dict(
        k=round(k, 4), cx=ex, cy=round(cy, 1), pivot=round(VOLTI["pivot"] * m, 1),
        eyeY=ey, eyeDX=round(R["eye_dx"] * f, 1), mouth=[mx, my], blush=[0, 0, 0],
        fs=R["fs"], ms=R["ms"], u=round(R["fs"] * ims["eye_open_L"].width / 141, 3), m=round(m, 3),
        eyes="LR", armL=armL, armR=armR, tuft=None,
        flow=[round(VOLTI["flow"][0] * m, 1), round(VOLTI["flow"][1] * m, 1)],
        breath=[round(VOLTI["breath"][0] * m, 1), round(VOLTI["breath"][1] * m, 1)],
        tail=[round(x0 + 0.77 * W, 1), x1, round(y0 + 0.66 * H, 1), round(y0 + 0.77 * H, 1)],
        top=y0,
        baked=["blush"] if arms else ["arms", "blush"],
    )
    if "limbs" in R:
        # parts of the figure that bend at a joint: their points go from figure pixels to pixels of the body picture
        rig["limbs"] = {
            key: dict(at=[round(l["at"][0] * f, 1), round(l["at"][1] * f, 1)], shape=[round(v * f, 1) for p in l["shape"] for v in p],
                      ramp=[round(l["ramp"][0] * f, 1), round(l["ramp"][1] * f, 1)], gain=l["gain"], max=l["max"],
                      **({"lift": l["lift"]} if "lift" in l else {}))
            for key, l in R["limbs"].items()
        }
    rigs[gid] = rig

NL = chr(10)


def obj(d):
    """One entry per line keeps the generated file short and its diffs readable."""
    rows = [f"  {json.dumps(k)}: {json.dumps(v, separators=(', ', ': '))}," for k, v in d.items()]
    return "{" + NL + NL.join(rows) + NL + "}"


ts = [
    "// Generated by tools/import_kits.py from rig_tools/kit_rigs.py. Do not edit by hand.",
    "import type { RigConfig } from './rigTypes';",
    "",
    f"export const RIGS: Record<string, RigConfig> = {obj(rigs)};",
    "",
]
(app / "src" / "data" / "rigs.gen.ts").write_text("\n".join(ts), encoding="utf-8")
print(len(rigs), "rigs")
