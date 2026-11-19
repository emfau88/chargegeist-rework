"""Cut the ChatGPT kit sheets into single parts.

Each part is found by the top-left corner of its bounding box on the sheet (see the
component listing printed with --list). Writes native-resolution PNGs to
  <out>/<ghost>/<part>.png   and   <out>/items/<item>.png
plus a contact sheet <out>/_contact.png for a visual check.

Usage: python -I extract_kits.py <rig_input_dir> <out_dir> [--list]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

src, out = Path(sys.argv[1]), Path(sys.argv[2])
LIST = "--list" in sys.argv

FACE = ["eye_open_L", "eye_open_R", "eye_happy_L", "eye_happy_R", "eye_sleep_L", "eye_sleep_R",
        "mouth_smile", "mouth_laugh", "mouth_o", "mouth_line", "blush_L", "blush_R", "arm_L", "arm_R"]


def face(*corners):
    assert len(corners) == len(FACE)
    return dict(zip(FACE, corners))


# ---------- sheet specs: part -> (x0, y0) of its component ----------
SHEETS = {
    "kit_companions_v1.webp": {
        "ghosts": {
            "ember": dict(body=(26, 143), tuft=(428, 400), **face(
                (294, 116), (374, 116), (293, 202), (378, 201), (296, 270), (380, 270),
                (283, 330), (330, 316), (404, 322), (450, 333), (302, 382), (377, 382), (264, 438), (350, 437))),
            "luna": dict(body=(524, 140), tuft=(933, 404), **face(
                (786, 116), (868, 115), (787, 204), (871, 203), (789, 273), (875, 272),
                (781, 333), (828, 318), (901, 325), (947, 336), (801, 386), (874, 386), (761, 444), (849, 444))),
            "sprout": dict(body=(1022, 140), tuft=(1424, 424), **face(
                (1299, 117), (1382, 117), (1298, 203), (1383, 203), (1299, 273), (1386, 272),
                (1281, 333), (1331, 317), (1409, 325), (1464, 337), (1307, 385), (1382, 385), (1258, 441), (1353, 442))),
            "mochi": dict(body=(211, 609), tuft=(642, 878), **face(
                (503, 593), (586, 592), (502, 675), (588, 675), (503, 744), (591, 744),
                (488, 798), (542, 785), (621, 791), (671, 802), (507, 846), (583, 846), (467, 899), (553, 899))),
            "sunny": dict(body=(792, 607), tuft=(1241, 873), **face(
                (1084, 593), (1165, 593), (1082, 675), (1168, 674), (1083, 744), (1171, 744),
                (1068, 798), (1124, 785), (1200, 791), (1252, 802), (1094, 849), (1172, 849), (1053, 899), (1145, 898))),
        },
        "items": {},
    },
    "kit_costumes_v1.webp": {
        "frames": True,
        "ghosts": {
            "pumpkin": dict(body=("pt", 160, 200), **face(
                (399, 18), (482, 17), (402, 96), (487, 96), (402, 152), (487, 152),
                (375, 202), (438, 190), (513, 196), (564, 205), (400, 244), (471, 244), (349, 284), (450, 284))),
            "samurai": dict(body=("pt", 950, 200), **face(
                (1161, 18), (1238, 18), (1160, 96), (1240, 96), (1159, 152), (1239, 152),
                (1142, 203), (1202, 191), (1273, 196), (1326, 205), (1174, 243), (1246, 243), (1121, 285), (1226, 285))),
            "witch": dict(body=(18, 376), **face(
                (378, 384), (452, 384), (377, 451), (454, 451), (377, 498), (454, 498),
                (353, 545), (413, 534), (479, 539), (526, 549), (385, 585), (452, 585), (337, 626), (457, 626))),
            "owl": dict(body=(786, 384), **face(
                (1149, 384), (1222, 384), (1151, 450), (1224, 450), (1151, 497), (1223, 497),
                (1128, 542), (1185, 532), (1247, 536), (1293, 545), (1160, 582), (1224, 582), (1119, 621), (1237, 620))),
        },
        "items": {
            "pumpkin_hat": [(548, 231)],
            "samurai_helmet": [(1362, 203)],
            "samurai_sash": [(1349, 305)],
            "witch_hat": [(537, 409)],
            "witch_collar": [(555, 550)],
            "owl_ears": [(1337, 416), (1419, 413)],
            "owl_goggles": [(1352, 500)],
            "owl_beak": [(1417, 566)],
        },
    },
    "kit_costumes_v2.webp": {
        "ghosts": {
            "reaper": dict(body=(18, 7), **face(
                (356, 17), (438, 17), (360, 88), (442, 88), (360, 138), (441, 138),
                (335, 182), (398, 172), (466, 179), (504, 187), (365, 221), (441, 221), (331, 265), (438, 265))),
            "pirate": dict(body=(765, 2), **face(
                (1127, 17), (1210, 17), (1131, 88), (1213, 88), (1131, 138), (1213, 138),
                (1105, 182), (1169, 172), (1239, 179), (1283, 187), (1136, 221), (1213, 221), (1103, 265), (1211, 265))),
            "kitsune": dict(body=(18, 351), **face(
                (360, 359), (434, 360), (370, 429), (439, 429), (370, 474), (439, 475),
                (356, 515), (408, 505), (472, 511), (506, 520), (377, 551), (449, 550), (358, 594), (455, 594))),
            "aviator": dict(body=(775, 352), **face(
                (1128, 359), (1209, 359), (1135, 429), (1210, 429), (1135, 475), (1210, 475),
                (1110, 515), (1169, 505), (1234, 512), (1277, 520), (1130, 551), (1208, 551), (1107, 594), (1211, 594))),
            "starmage": dict(body=(7, 673), **face(
                (357, 691), (439, 691), (360, 760), (439, 760), (360, 807), (439, 807),
                (335, 848), (397, 839), (464, 846), (503, 854), (366, 887), (442, 887), (334, 930), (441, 931))),
            "forest": dict(body=(768, 679), **face(
                (1131, 690), (1213, 691), (1135, 760), (1216, 760), (1136, 807), (1216, 807),
                (1109, 849), (1173, 839), (1241, 846), (1283, 855), (1140, 887), (1216, 887), (1105, 929), (1215, 930))),
        },
        "items": {
            # one component holds scythe and hood: split at y=131
            "reaper_scythe": [(536, 10, "y<", 131)],
            "reaper_hood": [(536, 10, "y>=", 131)],
            "reaper_cloak": [(552, 248)],
            "pirate_hat": [(1309, 7)],
            "pirate_eyepatch": [(1366, 132)],
            "pirate_bandana": [(1327, 195)],
            "kitsune_mask": [(539, 358)],
            "kitsune_collar": [(553, 478)],
            "kitsune_tail": [(560, 562)],
            "aviator_cap": [(1306, 353)],
            # one component holds scarf and lantern: split at y=540
            "aviator_scarf": [(1328, 478, "y<", 540)],
            "aviator_lantern": [(1328, 478, "y>=", 540, "x>=", 1440)],
            "star_halo": [(538, 678)],
            "star_hood": [(545, 791)],
            "star_collar": [(557, 923)],
            "forest_antlers": [(1291, 686)],
            "forest_collar": [(1325, 819)],
        },
    },
}

PAD = 6


def remove_frames(a, lab, objs):
    """Erase the thin rounded panel frames (components wider than 700 px)."""
    alpha = a[..., 3].copy()
    for i, s in enumerate(objs, 1):
        y0, y1, x0, x1 = s[0].start, s[0].stop, s[1].start, s[1].stop
        if x1 - x0 < 700:
            continue
        inset, rad = 11, 26
        yy, xx = np.mgrid[y0:y1, x0:x1]
        ix0, iy0, ix1, iy1 = x0 + inset, y0 + inset, x1 - 1 - inset, y1 - 1 - inset
        inside = (xx >= ix0) & (xx <= ix1) & (yy >= iy0) & (yy <= iy1)
        cx = np.clip(xx, ix0 + rad, ix1 - rad)
        cy = np.clip(yy, iy0 + rad, iy1 - rad)
        inside &= (xx - cx) ** 2 + (yy - cy) ** 2 <= rad * rad
        sub = alpha[y0:y1, x0:x1]
        sub[(lab[y0:y1, x0:x1] == i) & ~inside] = 0
    a = a.copy()
    a[..., 3] = alpha
    return a


def cut(a, mask):
    region = ndi.binary_dilation(mask, iterations=4)
    ys, xs = np.nonzero(mask)
    y0, y1 = max(0, ys.min() - PAD), min(a.shape[0], ys.max() + 1 + PAD)
    x0, x1 = max(0, xs.min() - PAD), min(a.shape[1], xs.max() + 1 + PAD)
    crop = a[y0:y1, x0:x1].copy()
    crop[..., 3] = np.where(region[y0:y1, x0:x1], crop[..., 3], 0)
    crop[crop[..., 3] == 0, :3] = 0
    return Image.fromarray(crop), (x0, y0)


def hollow_hood(im):
    """Make the dark inside of a hood transparent so a face can show through.
    The inside is dark purple (lum 8..50); the outlines around it are near black and stay."""
    a = np.asarray(im).copy()
    lum = a[..., :3].astype(float) @ np.array([0.3, 0.55, 0.15])
    solid = a[..., 3] > 200
    dist = ndi.distance_transform_edt(solid)
    mid = solid & (lum > 7) & (lum < 50)
    lab, n = ndi.label(mid & (dist > 3))
    if not n:
        return im
    sizes = ndi.sum(np.ones_like(lum), lab, range(1, n + 1))
    hole = lab == (int(np.argmax(sizes)) + 1)
    hole = ndi.binary_closing(hole, iterations=2) & solid
    # the bottom outline below the opening goes too
    ys, xs = np.nonzero(hole)
    low = {}
    for y, x in zip(ys, xs):
        low[x] = max(low.get(x, 0), y)
    for x, y in low.items():
        col = a[y:, x]
        dark = (col[:, :3].astype(float) @ np.array([0.3, 0.55, 0.15])) < 60
        k = 0
        while k < len(col) and dark[k]:
            k += 1
        hole[y:y + k, x] = True
    soft = ndi.gaussian_filter(hole.astype(float), 0.8)
    a[..., 3] = (a[..., 3] * (1 - np.clip(soft * 1.6, 0, 1))).astype(np.uint8)
    a[a[..., 3] == 0, :3] = 0
    return Image.fromarray(a)


def main():
    out.mkdir(parents=True, exist_ok=True)
    (out / "items").mkdir(exist_ok=True)
    tiles = []
    for sheet, spec in SHEETS.items():
        a = np.asarray(Image.open(src / sheet).convert("RGBA"))
        lab, n = ndi.label(a[..., 3] > 40)
        objs = ndi.find_objects(lab)
        if spec.get("frames"):
            a = remove_frames(a, lab, objs)
            lab, n = ndi.label(a[..., 3] > 40)
            objs = ndi.find_objects(lab)
        corners = {}
        for i, s in enumerate(objs, 1):
            area = int((lab[s] == i).sum())
            if area < 60:
                continue
            corners[(s[1].start, s[0].start)] = i
            if LIST:
                print(sheet, i, s[1].start, s[0].start, s[1].stop - s[1].start, s[0].stop - s[0].start, area)

        def comp(key):
            if key[0] == "pt":
                return int(lab[key[2], key[1]])
            best = min(corners, key=lambda c: abs(c[0] - key[0]) + abs(c[1] - key[1]))
            assert abs(best[0] - key[0]) + abs(best[1] - key[1]) <= 8, (sheet, key, best)
            return corners[best]

        for gid, parts in spec["ghosts"].items():
            gdir = out / gid
            gdir.mkdir(exist_ok=True)
            for part, key in parts.items():
                i = comp(key)
                assert i > 0, (gid, part)
                mask = lab == i
                if part == "body":
                    mask = ndi.binary_fill_holes(mask) & (a[..., 3] > 40) | mask
                im, at = cut(a, mask)
                im.save(gdir / f"{part}.png")
                tiles.append((f"{gid}/{part}", im))
        for item, keys in spec["items"].items():
            mask = np.zeros(lab.shape, bool)
            for key in keys:
                m = lab == comp(key[:2])
                yy = np.arange(lab.shape[0])[:, None]
                xx = np.arange(lab.shape[1])[None, :]
                for op, v in zip(key[2::2], key[3::2]):
                    m &= {"y<": yy < v, "y>=": yy >= v, "x<": xx < v, "x>=": xx >= v}[op]
                mask |= m
            # drop specks that came along with a split
            lab2, n2 = ndi.label(mask)
            if n2 > 1:
                sizes = ndi.sum(mask, lab2, range(1, n2 + 1))
                keep = [k + 1 for k, v in enumerate(sizes) if v >= 0.05 * sizes.max()]
                mask = np.isin(lab2, keep)
            im, at = cut(a, mask)
            if item == "reaper_hood":
                im = hollow_hood(im)
            im.save(out / "items" / f"{item}.png")
            tiles.append((f"items/{item}", im))
    # contact sheet
    cols, cell = 12, 150
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 14)), (236, 236, 242))
    d = ImageDraw.Draw(sheet)
    for k, (name, im) in enumerate(tiles):
        x, y = (k % cols) * cell, (k // cols) * (cell + 14)
        t = im.copy()
        t.thumbnail((cell - 8, cell - 8))
        bg = Image.new("RGBA", t.size, (200, 210, 230, 255))
        bg.alpha_composite(t)
        sheet.paste(bg.convert("RGB"), (x + (cell - t.width) // 2, y + (cell - t.height) // 2))
        d.text((x + 3, y + cell), name[-24:], fill=(20, 20, 40))
    sheet.save(out / "_contact.png")
    print(len(tiles), "parts written")


main()
