"""Embed the cut parts into the rig page.
Usage: python -I build_rig.py <parts_dir> <template.html> <out.html>
"""
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

parts_dir, template, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
uris = {}
total = 0
for png in sorted(parts_dir.glob("*.png")):
    im = Image.open(png).convert("RGBA")
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=90, alpha_quality=100, method=6)
    data = buf.getvalue()
    total += len(data)
    uris[png.stem] = "data:image/webp;base64," + base64.b64encode(data).decode("ascii")
assert len(uris) == 16, sorted(uris)
html = template.read_text(encoding="utf-8").replace("__PARTS__", json.dumps(uris))
out.write_text(html, encoding="utf-8")
print(f"{len(uris)} parts, {total / 1024:.0f} KB images, page {out.stat().st_size / 1024:.0f} KB")
