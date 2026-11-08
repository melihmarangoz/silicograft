"""Cut the website's part of the whole-callus package: the tiles around the mid-frontal plane.

The full package (araclar/hucre3b_paket.py, about 54 MB for three runs) stays local. The website carries only
the tiles that cross lattice i = 175..185 (the preset slab with its margin). This script copies those tiles
from a full package folder, writes a filtered veri/<run>/parca.json, and adds "ic_aralik": the box centres i
for which every tile a box needs is present. The viewer holds its depth sliders to that range.

Usage: python3 araclar/hucre3b_site_paket.py <full package web3d_uygulama folder>
"""
import json, pathlib, shutil, sys

KAYNAK = pathlib.Path(sys.argv[1])
HEDEF = pathlib.Path(__file__).resolve().parent.parent / "web3d_uygulama"
DILIM = (175, 185)   # lattice i the website must cover (the presets' 5-site slab plus the 3-site margin)

for kosu in sorted(p.name for p in (KAYNAK / "veri").iterdir() if (p / "parca.json").is_file()):
    ind = json.loads((KAYNAK / "veri" / kosu / "parca.json").read_text())
    NX, NY, NZ = ind["kafes"]
    nx, pay = ind["kutu"][0], ind["pay"]

    def kapsar(p, a, b):
        i0, px = p["k"][0], p["k"][3]
        return i0 <= b and i0 + px - 1 >= a

    secilen = [p for p in ind["parcalar"] if kapsar(p, *DILIM)]
    # i is fully served when the chosen tiles containing it cover the same (j, k) area as all tiles do
    alan = lambda ps, i: sum(p["k"][4] * p["k"][5] for p in ps if kapsar(p, i, i))
    tam = [i for i in range(NX) if alan(secilen, i) == alan(ind["parcalar"], i) > 0]
    orta = sum(DILIM) // 2
    assert orta in tam, f"{kosu}: the mid-plane is not fully covered"
    a = b = orta
    while a - 1 in tam: a -= 1
    while b + 1 in tam: b += 1
    # a box centred on ic reads i = ic - 2 - pay .. ic + 2 + pay (5 sites thick plus the margin)
    yari = nx // 2 + pay
    ic_aralik = [a + yari, b - yari]
    assert ic_aralik[0] <= orta <= ic_aralik[1], (kosu, ic_aralik)

    hedef = HEDEF / "veri" / kosu
    (hedef / "parca").mkdir(parents=True, exist_ok=True)
    bayt = 0
    for p in secilen:
        shutil.copyfile(KAYNAK / "veri" / kosu / p["d"], hedef / p["d"])
        bayt += (hedef / p["d"]).stat().st_size
    yeni = dict(ind, parcalar=secilen, ic_aralik=ic_aralik, toplam_bayt=sum(p["b"] for p in secilen),
                not_="website subset: tiles crossing lattice i %d..%d (araclar/hucre3b_site_paket.py)" % DILIM)
    (hedef / "parca.json").write_text(json.dumps(yeni, separators=(",", ":")))
    print(f"{kosu}: {len(secilen)}/{len(ind['parcalar'])} tiles, {bayt / 1e6:.1f} MB, full i {a}..{b}, "
          f"box centres i {ic_aralik[0]}..{ic_aralik[1]} (x {ic_aralik[0] * 0.1 - 18:+.1f}..{ic_aralik[1] * 0.1 - 18:+.1f} mm)")
