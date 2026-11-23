"""The launcher icons of the Android app, made from the icons of the web app (see make_icon.py).

  mipmap-*/ic_launcher_foreground.png   the square icon, for launchers that cut their own shape out of it
  mipmap-*/ic_launcher.png              the rounded icon, for old launchers
  mipmap-*/ic_launcher_round.png        the square icon cut to a circle

Usage: python -I tools/android_icon.py <app_root>
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

app = Path(sys.argv[1])
res = app / "android" / "app" / "src" / "main" / "res"
square = Image.open(app / "public" / "icon-square-512.png").convert("RGBA")
rounded = Image.open(app / "public" / "icon-512.png").convert("RGBA")
DPI = dict(mdpi=1, hdpi=1.5, xhdpi=2, xxhdpi=3, xxxhdpi=4)

for name, k in DPI.items():
    d = res / f"mipmap-{name}"
    # A launcher shows the middle two thirds of this layer and may cut a circle out of them. The square icon
    # keeps the ghost inside 63 percent of its side: set a little smaller, it stays clear of every cut.
    side = round(108 * k)
    layer = square.resize((side, side), Image.LANCZOS)
    inner = round(side * 0.9)
    layer.alpha_composite(square.resize((inner, inner), Image.LANCZOS), ((side - inner) // 2, (side - inner) // 2))
    layer.save(d / "ic_launcher_foreground.png")
    small = round(48 * k)
    rounded.resize((small, small), Image.LANCZOS).save(d / "ic_launcher.png")
    big = square.resize((small * 4, small * 4), Image.LANCZOS)
    mask = Image.new("L", big.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big.width - 1, big.height - 1), fill=255)
    big.putalpha(mask)
    big.resize((small, small), Image.LANCZOS).save(d / "ic_launcher_round.png")
    print(name, side, small)
