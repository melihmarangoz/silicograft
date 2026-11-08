"""Build the callus viewer page from its template.

web3d_uygulama/kallus3b_sablon.html is the source: edit the page there. It has one placeholder,
__ISTATISTIK__, which this script replaces with the daily tissue volumes of the three runs
(web3d_uygulama/data/kallus3b_istatistik.json: per run id, the arrays kemik, kikirdak, fibroz, msc in mm³
and gun, one value per day, from the full-resolution lattice). The result is web3d_uygulama/kallus3b.html,
which the site deploys as viewer/index.html. The voxel data (data/<run>.b64.txt) stays separate and is
fetched by the page.

Usage: python3 araclar/kallus3b_derle.py [--kontrol]
  --kontrol: do not write, exit 1 if kallus3b.html is not what the template and the volumes give.
"""
import json, pathlib, sys

w = pathlib.Path(__file__).resolve().parent.parent / "web3d_uygulama"
sablon = (w / "kallus3b_sablon.html").read_text(encoding="utf-8")
istatistik = json.loads((w / "data" / "kallus3b_istatistik.json").read_text(encoding="utf-8"))
assert sablon.count("__ISTATISTIK__") == 1, "the template must hold __ISTATISTIK__ exactly once"
sayfa = sablon.replace("__ISTATISTIK__", json.dumps(istatistik, separators=(",", ":")))
hedef = w / "kallus3b.html"
if "--kontrol" in sys.argv[1:]:
    ayni = hedef.read_text(encoding="utf-8") == sayfa
    print("kallus3b.html is up to date" if ayni else "kallus3b.html differs from the template: run kallus3b_derle.py")
    sys.exit(0 if ayni else 1)
hedef.write_text(sayfa, encoding="utf-8")
print(f"wrote {hedef} ({len(sayfa.encode('utf-8')) // 1024} KB)")
