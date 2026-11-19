"""Plain ghost wearing each wardrobe item, for tuning ITEMS in kit_rigs.py.
Usage: python -I preview_items.py <kits_dir> <out.png> [ghost] [outfit sets separated by ';', items by ',']"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).parent))
from kit_rigs import RIGS, ITEMS, SLOT_ORDER  # noqa: E402

kits, out = Path(sys.argv[1]), Path(sys.argv[2])
g = sys.argv[3] if len(sys.argv) > 3 else "luna"
sets = [s.split(",") for s in sys.argv[4].split(";")] if len(sys.argv) > 4 else [[k] for k in ITEMS]
R = RIGS[g]


def load(p):
    return Image.open(kits / g / f"{p}.png").convert("RGBA")


def compose(items):
    W, H = 520, 520
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ox, oy = 130, 130

    def put(im, x, y, s=1.0, anchor=(0.5, 0.5), rot=0):
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        ax, ay = anchor[0] * im.width, anchor[1] * im.height
        if rot:
            big = Image.new("RGBA", (im.width * 3, im.height * 3), (0, 0, 0, 0))
            big.paste(im, (im.width, im.height))
            big = big.rotate(-rot, resample=Image.BICUBIC, center=(im.width + ax, im.height + ay))
            c.alpha_composite(big, (round(ox + x - im.width - ax), round(oy + y - im.height - ay)))
        else:
            c.alpha_composite(im, (round(ox + x - ax), round(oy + y - ay)))

    hide = set()
    worn = {ITEMS[i]["slot"]: i for i in items}
    for i in items:
        hide |= set(ITEMS[i].get("hide", []))
    if "head" in worn:
        hide.add("tuft")

    def item_layer(slot):
        if slot in worn:
            it = ITEMS[worn[slot]]
            put(Image.open(kits / "items" / f"{worn[slot]}.png").convert("RGBA"), *it["at"], it["s"], it["anchor"], it.get("rot", 0))

    for slot in SLOT_ORDER:
        if slot == "body":
            if "tuft" not in hide:
                t = load("tuft")
                put(t, *R["tuft"], 1.0, (0.5, 0.97))
            c.alpha_composite(load("body"), (ox, oy))
        elif slot == "face":
            fs = R["fs"]
            bx, by = R["blush"]
            put(load("blush_L"), R["cx"] - bx, by, fs)
            put(load("blush_R"), R["cx"] + bx, by, fs)
            for side, sg in (("L", -1), ("R", 1)):
                if f"eye_{side}" not in hide:
                    put(load(f"eye_open_{side}"), R["cx"] + sg * R["eye_dx"], R["eye_y"], fs)
            put(load("mouth_smile"), R["cx"], R["mouth_y"], fs * 0.85)
        elif slot == "arms":
            for side, key, ax in (("L", "arm_l", 0.8), ("R", "arm_r", 0.2)):
                put(load(f"arm_{side}"), *R[key], R["arm_s"], (ax, 0.28))
        else:
            item_layer(slot)
    return c


tiles = [(",".join(s), compose(s)) for s in sets]
cols = 7
cell = 520
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell, rows * (cell + 16)), (40, 34, 80))
d = ImageDraw.Draw(sheet)
for k, (name, im) in enumerate(tiles):
    x, y = (k % cols) * cell, (k // cols) * (cell + 16)
    sheet.paste(im, (x, y), im)
    d.text((x + 6, y + cell), name, fill=(255, 255, 255))
sheet = sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS)
sheet.save(out)
print(out, sheet.size)
