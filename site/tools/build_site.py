"""Speed-up pass over the assembled site (_site), run by .github/workflows/pages.yml after "Assemble _site".

The sources stay as they are (the viewers are also published as claude.ai artifacts, whose CSP allows Google
Fonts and jsDelivr but not same-origin files); only the deployed copies change:

- index.html: tokens.css, base.css and styles.css are inlined in place of the stylesheet link, so the first
  paint waits for no CSS request (styles.css used to @import the other two: a chain of round trips).
- cells/index.html and viewer/index.html: the Google Fonts stylesheet (render-blocking, 1.7-1.8 s on a
  throttled phone in Lighthouse) is replaced by @font-face rules for the same IBM Plex files served from
  assets/fonts/ (Google's own latin and latin-ext subsets, unchanged; OFL in assets/fonts/OFL-IBMPlex.txt),
  with the sans file preloaded; three.js r147 is loaded from vendor/three-0.147.0/ on this site instead of
  jsDelivr (no extra DNS and TLS setup on the critical path); an empty data: favicon stops the /favicon.ico 404.

Usage: python3 site/tools/build_site.py _site
"""
import pathlib, re, sys

SITE = pathlib.Path(sys.argv[1])

LATIN = ("U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, "
         "U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD")
LATIN_EXT = ("U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, "
             "U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF")


def tek(yol, eski, yeni, kez=1):
    s = yol.read_text(encoding="utf-8")
    assert s.count(eski) == kez, f"{yol}: expected {kez}x {eski[:70]!r}, found {s.count(eski)}"
    yol.write_text(s.replace(eski, yeni), encoding="utf-8")


def css_sade(css):
    """Drop comments and indentation; keep everything else (no reordering, no value rewriting)."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    return "\n".join(l.strip() for l in css.splitlines() if l.strip())


# ---- home page: inline the CSS
stil = SITE / "styles.css"
govde = "\n".join(l for l in stil.read_text(encoding="utf-8").splitlines() if not l.startswith("@import"))
# styles.css opens with the Hallmark stamp comments (stamp, critique, waivers, dismissals); they stay,
# verbatim and first, in the inlined CSS, so sloplint still reads them on the built page
damga = re.match(r"\s*((?:/\*\s*Hallmark.*?\*/\s*)+)", govde, re.S)
assert damga, "styles.css does not start with the Hallmark stamp"
butun = damga.group(1).strip() + "\n" + css_sade((SITE / "tokens.css").read_text(encoding="utf-8") + "\n" + (SITE / "base.css").read_text(encoding="utf-8") + "\n" + govde)
assert "</style" not in butun
tek(SITE / "index.html", '<link rel="stylesheet" href="styles.css">', "<style>\n" + butun + "\n</style>")

# ---- the two viewers: fonts and three.js from this site
GOOGLE = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">'
def yuz(aile, dosya, agirlik, aralik):
    return (f'@font-face {{ font-family: "{aile}"; src: url("../assets/fonts/{dosya}") format("woff2"); font-weight: {agirlik}; '
            f'font-style: normal; font-display: swap; unicode-range: {aralik}; }}')
YAZI = ('<link rel="preload" href="../assets/fonts/ibm-plex-sans-latin.woff2" as="font" type="font/woff2" crossorigin>\n<style>\n'
        + "\n".join([yuz("IBM Plex Sans", "ibm-plex-sans-latin-ext.woff2", "400 600", LATIN_EXT),
                     yuz("IBM Plex Sans", "ibm-plex-sans-latin.woff2", "400 600", LATIN),
                     yuz("IBM Plex Mono", "ibm-plex-mono-400-latin-ext.woff2", "400", LATIN_EXT),
                     yuz("IBM Plex Mono", "ibm-plex-mono-400-latin.woff2", "400", LATIN),
                     yuz("IBM Plex Mono", "ibm-plex-mono-500-latin-ext.woff2", "500", LATIN_EXT),
                     yuz("IBM Plex Mono", "ibm-plex-mono-500-latin.woff2", "500", LATIN)]) + "\n</style>")
for sayfa in (SITE / "cells/index.html", SITE / "viewer/index.html"):
    s = sayfa.read_text(encoding="utf-8")
    s = re.sub(r'<link rel="preconnect" href="https://fonts\.(googleapis|gstatic)\.com"( crossorigin)?>\n?', "", s)
    assert s.count(GOOGLE) == 1, f"{sayfa}: Google Fonts link not found once"
    s = s.replace(GOOGLE, YAZI)
    n = s.count("https://cdn.jsdelivr.net/npm/three@0.147.0/")
    assert n >= 2, f"{sayfa}: three.js URLs not found"
    s = s.replace("https://cdn.jsdelivr.net/npm/three@0.147.0/", "../vendor/three-0.147.0/")
    for yol in re.findall(r'src="\.\./vendor/three-0\.147\.0/([^"]+)"', s):
        assert (SITE / "vendor/three-0.147.0" / yol).is_file(), f"{sayfa}: missing vendor/three-0.147.0/{yol}"
    if 'rel="icon"' not in s:
        s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<link rel="icon" href="data:,">', 1)
    assert "fonts.googleapis.com" not in s and "fonts.gstatic.com" not in s and "cdn.jsdelivr.net" not in s
    sayfa.write_text(s, encoding="utf-8")
    print(f"{sayfa.relative_to(SITE)}: fonts and {n} three.js files from this site")
print(f"index.html: {len(butun) // 1024} kB of CSS inlined")
