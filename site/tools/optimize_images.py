"""Make the site's AVIF and WebP images (the JPEGs stay as the fallback for old browsers).

Stage posters come from the source render (lossless frames at each stage's "still" time in film_stages.json), so
the 1920 px versions are sharper than the old 1280 px JPEG posters. The hero still and the viewer poster have
only their JPEG as source and are re-encoded from it.

Quality was chosen by SSIM against the lossless frame of the most detailed stage (stage 2): AVIF quality 70 gives
0.973 at 1920 px for 135 kB, against 0.945 for the old 1280 px JPEG (116 kB) shown at the same size.

Usage (from the repo root):
  python3 site/tools/optimize_images.py [--render film/renders/silicograft-dive.mp4]
Without --render the stage posters are left as they are. Needs Pillow >= 11 (AVIF) and ffmpeg.
"""
import argparse, json, pathlib, subprocess, tempfile
from PIL import Image

SITE = pathlib.Path(__file__).resolve().parent.parent
AVIF_Q, WEBP_Q = 70, 88


def yaz(img, yol, genislik):
    """Save one width of an image as AVIF and WebP next to yol (yol without extension)."""
    if img.width != genislik:
        img = img.resize((genislik, round(img.height * genislik / img.width)), Image.LANCZOS)
    img.save(f"{yol}.avif", "AVIF", quality=AVIF_Q, speed=4)
    img.save(f"{yol}.webp", "WEBP", quality=WEBP_Q, method=6)
    return img


def jpeg_yaz(img, yol, genislik):
    if img.width != genislik:
        img = img.resize((genislik, round(img.height * genislik / img.width)), Image.LANCZOS)
    img.save(yol, "JPEG", quality=90, optimize=True, progressive=True)


ap = argparse.ArgumentParser()
ap.add_argument("--render", help="source film render for the stage posters")
a = ap.parse_args()

# hero still: 1200 and 1920 px
hero = Image.open(SITE / "assets/hero-still.jpg").convert("RGB")
for w in (1200, 1920):
    yaz(hero, SITE / f"assets/hero-still-{w}", w)

# viewer poster: 900 and 1800 px
poster = Image.open(SITE / "assets/viewer-poster.jpg").convert("RGB")
for w in (900, 1800):
    yaz(poster, SITE / f"assets/viewer-poster-{w}", w)

# stage posters from the render: 1280 and 1920 px AVIF/WebP, and the 1280 px JPEG fallback
if a.render:
    stages = json.loads((SITE / "tools/film_stages.json").read_text())["stages"]
    with tempfile.TemporaryDirectory() as t:
        for n, s in enumerate(stages, 1):
            png = pathlib.Path(t) / f"stage-{n}.png"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(s["still"]), "-i", a.render, "-frames:v", "1",
                            "-vf", "setsar=1", str(png)], check=True)
            img = Image.open(png).convert("RGB")
            for w in (1280, 1920):
                yaz(img, SITE / f"assets/film/stills/stage-{n}-{w}", w)
            jpeg_yaz(img, SITE / f"assets/film/stills/stage-{n}.jpg", 1280)

for f in sorted(SITE.glob("assets/**/*.avif")) + sorted(SITE.glob("assets/**/*.webp")):
    print(f"{f.stat().st_size // 1024:5d} kB  {f.relative_to(SITE)}")
