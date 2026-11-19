"""Render deterministic states of the rig page with headless Chrome.
Usage: python -I test_rig.py <page.html> <out_dir> <width> <height> [scenario ...]"""
import subprocess, sys
from pathlib import Path
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
page, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
W, H = int(sys.argv[3]), int(sys.argv[4])
SC = {
 "idle":  "run(2.0);",
 "blink": "run(1.0); nextBlink=T; run(0.035);",
 "happyin": "run(1.0); poke(); run(0.06);",
 "cheer": "run(1.0); celebrate(false); run(0.42);",
 "focus": "setMode('focus'); run(5.5);",
 "sleep": "setMode('sleep'); run(4.5);",
 "wave":  "run(1.0); waveUntil=T+1.3; run(0.45);",
 "look":  "run(0.5); pointer.x=60; pointer.y=150; pointer.last=T; run(1.0);",
 "poke":  "run(1.0); poke(); run(0.12);",
 "d1": "run(2.0);", "d2": "run(2.35);", "d3": "run(2.7);", "d4": "run(3.05);",
}
names = sys.argv[5:] or list(SC)
src = page.read_text(encoding="utf-8")
pre = """<script>
(function(){let s=12345;Math.random=()=>(s=(s*16807)%2147483647)/2147483647;})();
window.requestAnimationFrame=()=>0;
addEventListener('error',e=>{const d=document.createElement('pre');d.style.cssText='position:fixed;left:0;top:0;z-index:99;background:#b00;color:#fff;font:14px monospace;padding:8px';d.textContent='ERR '+e.message+' @'+e.lineno;document.documentElement.appendChild(d);});
</script>
"""
out.mkdir(parents=True, exist_ok=True)
for n in names:
    post = f"""<script>
function run(sec){{for(let i=0;i<Math.round(sec*60);i++)tick(1/60);}}
ready.then(()=>{{ if("{n}"!=="blink")nextBlink=99; {SC[n]} render(); const d=document.createElement('div');d.id='renderer';d.textContent=gl?'webgl2':'2d';d.style.cssText='position:fixed;right:4px;bottom:2px;font:11px monospace;color:#888';document.body.appendChild(d); }}).catch(e=>{{document.title='ERR '+e;}});
</script>"""
    html = src.replace('<script>\n"use strict";', pre + '<script>\n"use strict";', 1) + post
    tp = out / f"t_{n}.html"
    tp.write_text(html, encoding="utf-8")
    shot = out / f"{n}.png"
    subprocess.run([CHROME, "--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars",
                    f"--window-size={W},{H}", "--virtual-time-budget=5000", f"--screenshot={shot}", tp.as_uri()],
                   check=True, capture_output=True, timeout=120)
    print("shot", shot)
