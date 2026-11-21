"""Compose the app icon: night gradient, a glow in the ghost's colour, and the ghost.

The ghost is a still portrait drawn by the app itself (tools/portrait.mjs), so the icon shows it
exactly as the app does. The icon shows the first starter (DEFAULT_COMPANION in src/data/catalog.ts).
Writes public/icon-192.png, icon-512.png and icon-square-512.png.

Usage: python -I tools/make_icon.py <portrait.png> <app_root> [glow colour, rrggbb]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

portrait, app = Path(sys.argv[1]), Path(sys.argv[2])
hexc = sys.argv[3] if len(sys.argv) > 3 else "7fd8ff"
GLOW = tuple(int(hexc[i:i + 2], 16) for i in (0, 2, 4))
S = 1024
GHOST = 770  # the longer side of the ghost in the rounded icon
SAFE = 650  # and in the square one: a launcher may cut that to a circle, so the ghost stays inside its safe zone


def scene(side):
    """The night with the ghost in it, the ghost's longer side `side` px long."""
    bg = Image.new("RGBA", (S, S))
    d = ImageDraw.Draw(bg)
    for y in range(S):
        k = y / S
        c = tuple(int(a + (b - a) * k) for a, b in zip((52, 42, 120), (14, 11, 36)))
        d.line([(0, y), (S, y)], fill=c + (255,))
    # a soft glow behind the ghost, wide enough to show around it
    r = side * 0.56
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((S / 2 - r, S / 2 - r, S / 2 + r, S / 2 + r), fill=GLOW + (150,))
    bg = Image.alpha_composite(bg, glow.filter(ImageFilter.GaussianBlur(100)))
    st = ImageDraw.Draw(bg)
    for x, y, q in [(150, 170, 5), (860, 140, 6), (900, 420, 4), (120, 520, 4), (780, 880, 5), (230, 860, 4), (520, 90, 4)]:
        st.ellipse((x - q, y - q, x + q, y + q), fill=(216, 222, 255, 200))

    ghost = Image.open(portrait).convert("RGBA")
    ghost = ghost.crop(ghost.getbbox())
    k = side / max(ghost.size)
    ghost = ghost.resize((round(ghost.width * k), round(ghost.height * k)), Image.LANCZOS)
    gx, gy = (S - ghost.width) // 2, (S - ghost.height) // 2 + 4
    # the shadow lies under the ghost's hem
    foot, w = gy + ghost.height, side * 0.24
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((S / 2 - w, foot - 22, S / 2 + w, foot + 38), fill=(3, 2, 10, 150))
    bg = Image.alpha_composite(bg, shadow.filter(ImageFilter.GaussianBlur(18)))
    bg.alpha_composite(ghost, (gx, gy))
    return bg


# rounded mask like a launcher icon
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=230, fill=255)
icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
icon.paste(scene(GHOST), (0, 0), mask)
for size in (512, 192):
    icon.resize((size, size), Image.LANCZOS).save(app / "public" / f"icon-{size}.png")
scene(SAFE).convert("RGB").resize((512, 512), Image.LANCZOS).save(app / "public" / "icon-square-512.png")
print("icons written")
