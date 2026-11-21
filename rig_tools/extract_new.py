"""Cut the second generation of kit sheets (rig_input/neu) into single parts.

These sheets differ from the first ones: each shows the finished figure with its face painted in, a
blank body, loose costume pieces and the face parts. Parts are found by a point on them.
Writes native-resolution PNGs to <out>/<ghost>/_raw/<name>.png plus a contact sheet per ghost.
The bodies are built from these by build_new.py.

Usage: python -I extract_new.py <rig_input/neu> <out_dir>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

src, out = Path(sys.argv[1]), Path(sys.argv[2])
PAD = 6

# part -> a point on it (sheet pixels). Several points: the parts are cut together, as one picture.
SHEETS = {
    "kit_phoenix_moondeer.webp": {
        "phoenix": dict(
            figure=[(190, 280), (205, 447)], blank=(380, 120),
            eye_open_L=(357, 340), eye_open_R=(410, 340), eye_thin_L=(456, 342), eye_thin_R=(509, 342),
            eye_happy_L=(357, 384), eye_happy_R=(410, 384), eye_sleep_L=(459, 386), eye_sleep_R=(508, 386),
            mouth_laugh=(571, 390), mouth_o=(384, 420), mouth_o2=(543, 425), mouth_line=(577, 425),
            blush_L=(451, 424), blush_R=(502, 424), arm_L=(330, 455), arm_R=(437, 458)),
        "moondeer": dict(
            figure=(900, 260), blank=(1140, 130),
            eye_open_L=(1100, 345), eye_open_R=(1150, 345), eye_thin_L=(1197, 345), eye_thin_R=(1250, 345),
            eye_happy_L=(1100, 387), eye_happy_R=(1152, 387), eye_sleep_L=(1200, 388), eye_sleep_R=(1250, 388),
            mouth_laugh=(1310, 392), mouth_o=(1124, 422), mouth_o2=(1291, 426), mouth_line=(1327, 426),
            blush_L=(1201, 424), blush_R=(1251, 424)),
    },
    "kit_cloud_cactus.webp": {
        # on the sheet the cloud's left arm touches the tip of its cape, and its right arm the loose cape
        "_cuts": [(431, 312, 432, 330), (414, 329, 432, 330),
                  (592, 316, 593, 326), (593, 325, 594, 331), (594, 330, 595, 335), (595, 334, 596, 338), (596, 337, 597, 345)],
        "cloud": dict(
            figure=(233, 467), blank=(530, 160),
            eye_open_L=(485, 423), eye_open_R=(550, 423), eye_happy_L=(623, 421), eye_happy_R=(690, 421),
            eye_flat_L=(485, 475), eye_flat_R=(551, 475), mouth_line2=(623, 470), mouth_line=(690, 472),
            mouth_laugh=(493, 520), mouth_laugh2=(577, 520), mouth_o=(657, 523), mouth_o2=(718, 525),
            blush_L=(787, 527), blush_R=(850, 527), arm_L=(467, 333), arm_R=(557, 333)),
        "cactus": dict(
            figure=(1253, 507), blank=(1520, 180),
            eye_open_L=(1455, 427), eye_open_R=(1512, 427), eye_happy_L=(1581, 427), eye_happy_R=(1645, 427),
            eye_flat_L=(1453, 477), eye_flat_R=(1513, 477), mouth_line=(1581, 475), mouth_line2=(1645, 475),
            mouth_laugh=(1500, 520), mouth_laugh2=(1579, 520), mouth_o=(1657, 525), mouth_o2=(1717, 525),
            blush_L=(1787, 527), blush_R=(1850, 527), arm_L=(1673, 227), arm_R=(1777, 227)),
    },
    "kit_dragon_b.webp": {
        "dragon": dict(
            figure=(260, 350), blank=(800, 350),
            horn_L=(105, 715), horn_R=(450, 715), tuft=(285, 720), wing_L=(135, 905), wing_R=(420, 905),
            bow=(770, 850), tail=(1170, 850), swirl=(1415, 800),
            eye_open_L=(1205, 95), eye_open_R=(1390, 95), eye_happy_L=(1205, 200), eye_happy_R=(1390, 200),
            eye_sleep_L=(1205, 312), eye_sleep_R=(1390, 312), mouth_smile=(1143, 418), mouth_laugh=(1262, 400),
            mouth_o=(1368, 400), mouth_line=(1472, 402), blush_L=(1212, 492), blush_R=(1392, 492),
            arm_L=(1182, 600), arm_R=(1412, 600)),
    },
    "kit_jellyfish.webp": {
        "jellyfish": dict(
            figure=(270, 380), blank=(820, 400),
            lantern=(275, 890), tent_1=(470, 800), tent_2=(600, 800), tent_3=(700, 800), tent_4=(820, 800),
            frill=(1215, 700), fin_L=(1070, 880), fin_R=(1385, 880),
            eye_open_L=(1220, 85), eye_open_R=(1375, 85), eye_happy_L=(1205, 200), eye_happy_R=(1375, 200),
            eye_sleep_L=(1205, 335), eye_sleep_R=(1375, 335), mouth_smile=(1150, 432), mouth_laugh=(1265, 415),
            mouth_o=(1368, 420), mouth_line=(1462, 422), blush_L=(1205, 535), blush_R=(1385, 535)),
    },
}


def main():
    for sheet, ghosts in SHEETS.items():
        a = np.asarray(Image.open(src / sheet).convert("RGBA")).copy()
        solid = a[..., 3] > 40
        for x0, y0, x1, y1 in ghosts.pop("_cuts", []):
            solid[y0:y1, x0:x1] = False
        lab, n = ndi.label(solid)
        # the nearest solid pixel to any point
        _, (iy, ix) = ndi.distance_transform_edt(~solid, return_indices=True)
        near = lab[iy, ix]

        def comp(pt):
            x, y = pt
            ny, nx = iy[y, x], ix[y, x]
            assert abs(ny - y) + abs(nx - x) <= 14, (sheet, pt, (nx, ny))
            return lab[ny, nx]

        for gid, parts in ghosts.items():
            gdir = out / gid / "_raw"
            gdir.mkdir(parents=True, exist_ok=True)
            tiles, used = [], {}
            for name, pts in parts.items():
                pts = pts if isinstance(pts, list) else [pts]
                mask = np.zeros(lab.shape, bool)
                mine = np.zeros(lab.shape, bool)
                for pt in pts:
                    i = comp(pt)
                    assert i not in used or used[i] == name, (gid, name, "shares a component with", used.get(i))
                    used[i] = name
                    mask |= lab == i
                    mine |= near == i
                if name in ("figure", "blank"):
                    mask = ndi.binary_fill_holes(mask) & (a[..., 3] > 40) | mask
                # the soft rim around the part, but nothing of a neighbour that stands close
                region = ndi.binary_dilation(mask, iterations=4) & (mine | mask)
                ys, xs = np.nonzero(mask)
                y0, y1 = max(0, ys.min() - PAD), min(a.shape[0], ys.max() + 1 + PAD)
                x0, x1 = max(0, xs.min() - PAD), min(a.shape[1], xs.max() + 1 + PAD)
                crop = a[y0:y1, x0:x1].copy()
                crop[..., 3] = np.where(region[y0:y1, x0:x1], crop[..., 3], 0)
                crop[crop[..., 3] == 0, :3] = 0
                im = Image.fromarray(crop)
                im.save(gdir / f"{name}.png")
                tiles.append((f"{name} {im.width}x{im.height} @{x0},{y0}", im))
                (gdir / f"{name}.at").write_text(f"{x0} {y0}")
            cols, cell = 8, 190
            rows = (len(tiles) + cols - 1) // cols
            sh = Image.new("RGB", (cols * cell, rows * (cell + 14)), (120, 130, 160))
            d = ImageDraw.Draw(sh)
            for k, (label, im) in enumerate(tiles):
                x, y = (k % cols) * cell, (k // cols) * (cell + 14)
                t = im.copy()
                t.thumbnail((cell - 8, cell - 8))
                sh.paste(t, (x + (cell - t.width) // 2, y + (cell - t.height) // 2), t)
                d.text((x + 3, y + cell), label, fill=(255, 255, 255))
            sh.save(out / gid / "_raw_contact.png")
            print(gid, len(tiles), "parts")


main()
