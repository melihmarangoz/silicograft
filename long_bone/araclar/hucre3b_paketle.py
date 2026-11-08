"""Make the publishable single page of the cell viewer.

The artifact host runs only inline scripts and scripts from its CDN allowlist, so the page's own scripts
(hucre/hucre_geometri.js and hucre/marching_cubes_r147.js) are inlined here. Data files (veri/...) stay
separate and are fetched.

Usage: python3 araclar/hucre3b_paketle.py <output.html> [--yayin yayin.json]

--yayin writes the list of data files the artifact needs (paths relative to web3d_uygulama/, the same
paths the page fetches), split into publishes that respect the artifact limits (at most 255 files and
64 MB per publish, 511 files and 256 MB per version, 16 MB per file). The first publish carries the page,
bolgeler.json and every run's small files, so the viewer works after it; the whole-callus package tiles
(veri/<run>/parca/) follow in the next publishes to the same artifact URL.
"""
import argparse, json, pathlib

w = pathlib.Path(__file__).resolve().parent.parent / "web3d_uygulama"
ap = argparse.ArgumentParser()
ap.add_argument("cikti")
ap.add_argument("--yayin", help="write the publish file list (JSON) here")
a = ap.parse_args()

sayfa = (w / "hucre3b.html").read_text(encoding="utf-8")
for ad in ["hucre_geometri.js", "marching_cubes_r147.js"]:
    kod = (w / "hucre" / ad).read_text(encoding="utf-8")
    etiket = f'<script src="hucre/{ad}"></script>'
    assert sayfa.count(etiket) == 1, f"script tag for {ad} not found exactly once"
    assert "</script" not in kod, f"{ad} must not contain a closing script tag"
    sayfa = sayfa.replace(etiket, "<script>\n" + kod + "\n</script>")
assert '<script src="hucre/' not in sayfa, "a local script is still loaded by URL"
cikti = sayfa
pathlib.Path(a.cikti).write_text(cikti, encoding="utf-8")
print("yazıldı:", a.cikti, len(cikti) // 1024, "KB")

if a.yayin:
    v = w / "veri"
    kucuk = [v / "bolgeler.json"]
    parcalar = []
    for k in sorted(p for p in v.iterdir() if p.is_dir()):
        kucuk += sorted(f for f in k.iterdir() if f.is_file())
        parcalar += sorted((k / "parca").glob("p*.b64.txt")) if (k / "parca").is_dir() else []
    DOSYA, BAYT, SURUM_DOSYA, SURUM_BAYT = 255, 64e6, 511, 256e6
    gruplar, grup, bayt = [], [], len(cikti.encode())
    for f in kucuk + parcalar:
        s = f.stat().st_size
        assert s <= 16e6, f"{f} is larger than 16 MB"
        if len(grup) + 1 > DOSYA - (1 if not gruplar else 0) or bayt + s > BAYT * 0.98:
            gruplar.append(grup); grup, bayt = [], 0
        grup.append(f); bayt += s
    gruplar.append(grup)
    toplam_dosya = 1 + len(kucuk) + len(parcalar)
    toplam_bayt = len(cikti.encode()) + sum(f.stat().st_size for f in kucuk + parcalar)
    assert toplam_dosya <= SURUM_DOSYA and toplam_bayt <= SURUM_BAYT, (toplam_dosya, toplam_bayt)
    out = {"sayfa": "hucre3b.html", "toplam_dosya": toplam_dosya, "toplam_mb": round(toplam_bayt / 1e6, 1),
           "yayinlar": [[str(f.relative_to(w)) for f in g] for g in gruplar]}
    pathlib.Path(a.yayin).write_text(json.dumps(out, indent=1), encoding="utf-8")
    for n, g in enumerate(gruplar):
        print(f"yayın {n + 1}: {len(g) + (1 if n == 0 else 0)} dosya, {sum(f.stat().st_size for f in g) / 1e6:.1f} MB")
    print(f"toplam: {toplam_dosya} dosya, {toplam_bayt / 1e6:.1f} MB ->", a.yayin)
