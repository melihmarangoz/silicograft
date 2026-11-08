"""Iki kosuyu karsilastir: orijinal isaret (HP < -0.15) ve Claes-Heigele isareti (HP > 0.15).

Kullanim: python3 araclar/karsilastir.py <kosu_orijinal> <kosu_claes> <cikti_klasoru>
Uretir: karsilastirma_zaman.png, karsilastirma_son_gun.png, karsilastirma_ozet.csv
"""
import csv, glob, os, re, sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm
from matplotlib.patches import Patch

NX, NY, NZ = 361, 361, 401
kosular = {"orijinal işaret (yazarların kodu)": sys.argv[1], "Claes-Heigele işareti (düzeltilmiş)": sys.argv[2]}
out = sys.argv[3]; os.makedirs(out, exist_ok=True)

def oku(d):
    rows = list(csv.DictReader(open(os.path.join(d, "istatistik.csv"))))
    r = {k: np.array([float(x[k]) for x in rows]) for k in rows[0]}
    return r

veri = {ad: oku(d) for ad, d in kosular.items()}
fig, ax = plt.subplots(1, 4, figsize=(17, 4))
stil = ["-", "--"]
for n, (ad, r) in enumerate(veri.items()):
    t, kal = r["gun"], r["kallus_nokta"]
    for i, (k, lab, c) in enumerate([("kemik", "yeni kemik", "#d1495b"), ("kikirdak", "kıkırdak", "#4f86c6"), ("fibroz", "fibröz", "#6aa84f")]):
        ax[i].plot(t, 100 * r[k] / kal, stil[n], color=c, label=ad)
        ax[i].set_title(f"{lab} (% kallus)"); ax[i].set_xlabel("gün")
    ne = r["uyaran_rezorpsiyon"] + r["uyaran_kemik"] + r["uyaran_kikirdak"] + r["uyaran_fibroz"]
    ax[3].plot(t, 100 * r["uyaran_kemik"] / ne, stil[n], color="#d1495b", label=f"kemik uyaranı – {ad.split(' (')[0]}")
    ax[3].plot(t, 100 * r["uyaran_kikirdak"] / ne, stil[n], color="#4f86c6", label=f"kıkırdak uyaranı – {ad.split(' (')[0]}")
ax[3].set_title("uyaran (% eleman)"); ax[3].set_xlabel("gün")
ax[0].legend(fontsize=7); ax[3].legend(fontsize=7)
fig.suptitle("Orijinal ve düzeltilmiş mekanoregülasyon işareti: kallus doku gelişimi (düz: orijinal, kesikli: Claes-Heigele)")
fig.tight_layout(); fig.savefig(os.path.join(out, "karsilastirma_zaman.png"), dpi=130); plt.close(fig)

# son gun frontal/sagittal kesitler (x=0 frontal, y=0 sagittal)
SINIF = [(0, "#f4f1ea", "boş kallus"), (1, "#f2c14e", "MSC"), (2, "#d1495b", "yeni kemik"), (4, "#4f86c6", "kıkırdak"),
         (5, "#6aa84f", "fibröz"), (11, "#7a6a5a", "sağlam kemik"), (13, "#2f3e46", "plak"), (20, "#ffffff", "kallus dışı")]
lut = np.zeros(256, int)
for i, (k, _, _) in enumerate(SINIF): lut[k] = i
for k in range(6, 11): lut[k] = lut[k - 5]
cmap = ListedColormap([c for _, c, _ in SINIF]); norm = BoundaryNorm(np.arange(len(SINIF) + 1) - 0.5, len(SINIF))
fig, ax = plt.subplots(1, 4, figsize=(13, 5))
ozet = []
for n, (ad, d) in enumerate(kosular.items()):
    gun = max(int(re.search(r"lattice_(\d+)\.raw", f).group(1)) for f in glob.glob(os.path.join(d, "lattice_*.raw")) if "999" not in f)
    L = np.fromfile(os.path.join(d, f"lattice_{gun}.raw"), np.uint8).reshape(NX, NY, NZ)
    ke = os.path.join(d, "kesit_eleman.bin")
    E = np.fromfile(ke, np.int32) if os.path.exists(ke) else None
    for m, (s, e, xl) in enumerate([(L[180, :, :], None if E is None else E[:NY * NZ].reshape(NY, NZ), "y (mm) → plak"),
                                    (L[:, 180, :], None if E is None else E[NY * NZ:NY * NZ + NX * NZ].reshape(NX, NZ), "x (mm)")]):
        idx = lut[s]
        if e is not None: idx[(e == 0) & (s == 0)] = len(SINIF) - 1
        a = ax[2 * n + m]
        a.imshow(idx.T, origin="lower", cmap=cmap, norm=norm, extent=[-18, 18, 0, 40], interpolation="nearest")
        a.set_title(f"{ad.split(' (')[0]}\ngün {gun}, {'frontal' if m == 0 else 'sagittal'}", fontsize=9); a.set_xlabel(xl)
    r = veri[ad]; kal = r["kallus_nokta"][-1]
    ozet.append([ad, int(r["gun"][-1])] + [round(100 * r[k][-1] / kal, 2) for k in ["kemik", "kikirdak", "fibroz", "MSC", "bos"]])
fig.legend(handles=[Patch(color=c, label=l) for _, c, l in SINIF], loc="lower center", ncol=8, fontsize=8, frameon=False)
fig.tight_layout(rect=[0, 0.06, 1, 1]); fig.savefig(os.path.join(out, "karsilastirma_son_gun.png"), dpi=130); plt.close(fig)
with open(os.path.join(out, "karsilastirma_ozet.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["kosu", "son_gun", "kemik_%", "kikirdak_%", "fibroz_%", "MSC_%", "bos_%"]); w.writerows(ozet)
for o in ozet: print(o)
