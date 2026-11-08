"""Coklu kosu analizi (plak bagi duzeltmesi + tohum tekrarlari) ve Perier-Metz 2022 ile kiyas.

Kullanim: python3 araclar/analiz_coklu.py <kosular_klasoru> <cikti_klasoru>
Kosu klasor adlari: <bagli|bagsiz>_<orijinal|claes>_t<tohum>

Uretir:
  hacimler.csv            her kosu icin 90. ve 359. gunde doku hacimleri (mm3)
  grup_ozeti.csv          grup ortalamasi +- standart sapma (tohumlar uzerinden)
  kemik_zaman.png         toplam kemik hacmi - gun (her kosu bir cizgi)
  histoloji_gun359.png    makalenin Sekil 3a'sina benzer orta-frontal kesitler (siyah kemik, koyu kirmizi
                          kikirdak, acik kirmizi fibroz, beyaz bos/granulasyon, gri saglam kemik ve plak)
"""
import csv, glob, os, re, sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap

NX, NY, NZ = 361, 361, 401
K, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
y = np.arange(NY) * 0.1 - 18.0
z = np.arange(NZ) * 0.1
DEFEKT = (z > 5) & (z < 35)
PLAK_YAKIN = y > 6.0  # plak +y tarafinda, alt yuzu y = 9 mm

kosular = sorted(d for d in glob.glob(os.path.join(K, "b*_*_t*")) if os.path.isdir(d))

def ad_coz(d):
    m = re.match(r"(bagli|bagsiz)_(orijinal|claes)_t(\d+)", os.path.basename(d))
    return m.group(1), m.group(2), int(m.group(3))

def olc(L):
    kem = np.isin(L, (2, 7)); kik = np.isin(L, (4, 9)); fib = np.isin(L, (5, 10))
    kd = kem[:, :, DEFEKT]
    plak = kd[:, PLAK_YAKIN, :]
    # plak boyunca kopru: defektteki z dilimlerinin yuzde kacinda plak yaninda kemik var
    # bir z dilimi, plak yaninda en az 1 mm2 (100 kafes noktasi) kemik varsa kopru sayilir
    kopru = 100 * (plak.sum(axis=(0, 1)) >= 100).mean()
    return dict(kemik=kem.sum() / 1e3, kemik_defekt=kd.sum() / 1e3, kemik_plak=plak.sum() / 1e3,
                kopru_yuzde=kopru, kikirdak=kik.sum() / 1e3, fibroz=fib.sum() / 1e3)

satir = []
for d in kosular:
    plak, isaret, tohum = ad_coz(d)
    for g in (90, 359):
        f = os.path.join(d, f"lattice_{g}.raw")
        if not os.path.exists(f):
            continue
        L = np.fromfile(f, np.uint8).reshape(NX, NY, NZ)
        satir.append(dict(kosu=os.path.basename(d), plak=plak, isaret=isaret, tohum=tohum, gun=g, **olc(L)))
        print(satir[-1])

alan = ["kosu", "plak", "isaret", "tohum", "gun", "kemik", "kemik_defekt", "kemik_plak", "kopru_yuzde", "kikirdak", "fibroz"]
with open(os.path.join(OUT, "hacimler.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, alan); w.writeheader()
    for r in satir: w.writerow({k: (round(v, 2) if isinstance(v, float) else v) for k, v in r.items()})

with open(os.path.join(OUT, "grup_ozeti.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["plak", "isaret", "gun", "n_tohum"] + [f"{k}_ort" for k in alan[5:]] + [f"{k}_ss" for k in alan[5:]])
    for key in sorted({(r["plak"], r["isaret"], r["gun"]) for r in satir}):
        grp = [r for r in satir if (r["plak"], r["isaret"], r["gun"]) == key]
        v = np.array([[r[k] for k in alan[5:]] for r in grp])
        w.writerow(list(key) + [len(grp)] + list(np.round(v.mean(0), 2)) + list(np.round(v.std(0, ddof=1) if len(grp) > 1 else np.zeros(v.shape[1]), 2)))

# kemik hacmi - zaman
fig, ax = plt.subplots(figsize=(8, 4.5))
renk = {("bagsiz", "orijinal"): "#1f4e9c", ("bagsiz", "claes"): "#c0392b", ("bagli", "orijinal"): "#7f8c8d", ("bagli", "claes"): "#e67e22"}
for d in kosular:
    plak, isaret, tohum = ad_coz(d)
    ist = os.path.join(d, "istatistik.csv")
    if not os.path.exists(ist):
        continue
    r = list(csv.DictReader(open(ist)))
    t = [int(x["gun"]) for x in r]; kem = [int(x["kemik"]) / 1e3 for x in r]
    ax.plot(t, kem, color=renk[(plak, isaret)], lw=1.2, alpha=0.85, label=f"{plak}, {isaret}, tohum {tohum}")
ax.axvline(90, color="k", lw=0.6, ls=":"); ax.text(92, ax.get_ylim()[1] * 0.92, "3. ay", fontsize=8)
ax.errorbar([90], [170], yerr=[[60], [60]], fmt="s", color="green", ms=5, capsize=3, label="Perier-Metz 2022 deney, 3. ay (~170 mm³)")
ax.plot([90], [150], "D", color="darkorange", ms=5, label="Perier-Metz 2022 simülasyon, 3. ay (~150 mm³)")
ax.set_xlabel("gün"); ax.set_ylabel("yeni kemik hacmi (mm³, kallusun tamamı)")
ax.set_title("Boş defekt: yeni kemik hacmi")
ax.legend(fontsize=7, ncol=2); fig.tight_layout()
fig.savefig(os.path.join(OUT, "kemik_zaman.png"), dpi=140); plt.close(fig)

# histoloji benzeri orta-frontal kesitler (makale Sekil 3a renkleri)
renkler = ["#ffffff", "#000000", "#8b0000", "#f4a6a6", "#9e9e9e", "#5f5f5f"]  # bos, kemik, kikirdak, fibroz, saglam kemik, plak
cm = ListedColormap(renkler)
def histo(L):
    s = L[(NX - 1) // 2, :, :]
    h = np.zeros(s.shape, int)
    h[np.isin(s, (2, 7))] = 1; h[np.isin(s, (4, 9))] = 2; h[np.isin(s, (5, 10))] = 3
    h[s == 11] = 4; h[s == 13] = 5
    return h
secilen = [d for d in kosular if ad_coz(d)[2] == 12345]
fig, axs = plt.subplots(1, len(secilen), figsize=(3.2 * len(secilen), 4.6), squeeze=False)
for a, d in zip(axs[0], secilen):
    plak, isaret, tohum = ad_coz(d)
    f = os.path.join(d, "lattice_359.raw")
    if not os.path.exists(f):
        continue
    L = np.fromfile(f, np.uint8).reshape(NX, NY, NZ)
    a.imshow(histo(L).T, origin="lower", cmap=cm, vmin=-0.5, vmax=5.5, extent=[-18, 18, 0, 40], interpolation="nearest")
    a.set_title(f"{'kallus plağa bağlı' if plak == 'bagli' else 'kallus plağa bağsız'}\n{isaret} işaret, 12. ay", fontsize=9)
    a.set_xlabel("y (mm) → plak"); a.set_aspect("equal")
from matplotlib.patches import Patch
fig.legend(handles=[Patch(facecolor=c, edgecolor="k", lw=0.3, label=l) for c, l in
                    zip(renkler, ["boş / granülasyon", "yeni kemik", "kıkırdak", "fibröz", "sağlam kemik", "plak"])],
           loc="lower center", ncol=6, fontsize=8, frameon=False)
fig.suptitle("Orta-frontal kesit, 359. gün (Perier-Metz 2022 Şekil 3a ile aynı renkler)", fontsize=10)
fig.tight_layout(rect=[0, 0.07, 1, 0.95])
fig.savefig(os.path.join(OUT, "histoloji_gun359.png"), dpi=140); plt.close(fig)
print("bitti:", OUT)
