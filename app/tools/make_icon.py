"""Compose the app icon from Volti's parts: night gradient, glow, Volti. Writes public/icon-192.png and icon-512.png.

Usage: python -I tools/make_icon.py <rig_parts_dir> <app_root>
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

parts, app = Path(sys.argv[1]), Path(sys.argv[2])
S = 1024
P = {p.stem: Image.open(p).convert("RGBA") for p in parts.glob("*.png")}
R = dict(cx=349, eyeY=405, eyeDX=112, mouth=(349, 505), blush=(192, 488, 0.82),
         armL=((70, 520), (138, 40)), armR=((628, 520), (33, 40)), tuft=((345, 32), (62, 190), -8))

# background: night gradient with a soft cyan glow
bg = Image.new("RGBA", (S, S))
d = ImageDraw.Draw(bg)
for y in range(S):
    k = y / S
    c = tuple(int(a + (b - a) * k) for a, b in zip((52, 42, 120), (14, 11, 36)))
    d.line([(0, y), (S, y)], fill=c + (255,))
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((170, 170, 854, 854), fill=(91, 227, 255, 120))
bg = Image.alpha_composite(bg, glow.filter(ImageFilter.GaussianBlur(110)))
st = ImageDraw.Draw(bg)
for i, (x, y, r) in enumerate([(150, 170, 5), (860, 140, 6), (900, 420, 4), (120, 520, 4), (780, 880, 5), (230, 860, 4), (520, 90, 4)]):
    st.ellipse((x - r, y - r, x + r, y + r), fill=(216, 222, 255, 200))

# ghost in body space, then scale into the icon
W, H = 900, 1060
ghost = Image.new("RGBA", (W, H), (0, 0, 0, 0))
OX, OY = 70, 190


def put(name, x, y, s=1.0, rot=0.0, anchor=None):
    im = P[name]
    if s != 1.0:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    if anchor is None:
        ghost.alpha_composite(im, (round(OX + x - im.width / 2), round(OY + y - im.height / 2)))
        return
    ax, ay = anchor
    big = Image.new("RGBA", (im.width * 3, im.height * 3), (0, 0, 0, 0))
    big.paste(im, (im.width + 0, im.height + 0))
    cx, cy = im.width + ax, im.height + ay
    big = big.rotate(-rot, resample=Image.BICUBIC, center=(cx, cy))
    ghost.alpha_composite(big, (round(OX + x - cx), round(OY + y - cy)))


put("tuft", *R["tuft"][0], rot=R["tuft"][2], anchor=R["tuft"][1])
b = P["body"]
ghost.alpha_composite(b, (OX, OY))
bx, by, bs = R["blush"]
put("blush_L", R["cx"] - bx, by, bs)
put("blush_R", R["cx"] + bx, by, bs)
put("eye_open_L", R["cx"] - R["eyeDX"], R["eyeY"])
put("eye_open_R", R["cx"] + R["eyeDX"], R["eyeY"])
put("mouth_smile", *R["mouth"], 0.8)
put("arm_L", *R["armL"][0], rot=0, anchor=R["armL"][1])
put("arm_R", *R["armR"][0], rot=0, anchor=R["armR"][1])
ghost = ghost.crop(ghost.getbbox())
scale = 760 / max(ghost.size)
ghost = ghost.resize((round(ghost.width * scale), round(ghost.height * scale)), Image.LANCZOS)

shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((330, 860, 694, 920), fill=(3, 2, 10, 150))
bg = Image.alpha_composite(bg, shadow.filter(ImageFilter.GaussianBlur(18)))
bg.alpha_composite(ghost, ((S - ghost.width) // 2, (S - ghost.height) // 2 + 10))

# rounded mask like a launcher icon
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=230, fill=255)
icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
icon.paste(bg, (0, 0), mask)
for size in (512, 192):
    icon.resize((size, size), Image.LANCZOS).save(app / "public" / f"icon-{size}.png")
bg.convert("RGB").resize((512, 512), Image.LANCZOS).save(app / "public" / "icon-square-512.png")
print("icons written", math.floor(scale * 100) / 100)
