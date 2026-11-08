"""Mechanabio (CalculiX) kosusunun gorsellestirilmesi.

Kullanim:
  python3 araclar/gorsellestir.py <kosu_klasoru> <cikti_klasoru> [--etiket ad] [--gif]

Okur: lattice_N.raw (361x361x401 uint8, C sirasi [i][j][k]), istatistik.csv, kesit_eleman.bin (varsa),
      uz_yerdegistirme.txt.
Uretir: <etiket>_kesitler.png (secili gunlerde 2 boyuna kesit + defekt ortasi enine kesit),
        <etiket>_doku_zaman.png (kallus doku oranlari + uyaran dagilimi + eksenel yer degistirme),
        <etiket>_animasyon.gif (--gif; boyuna kesit, kaydedilen her gun).
"""
import argparse, glob, os, re
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm
from matplotlib.patches import Patch

NX, NY, NZ = 361, 361, 401
H = 0.1  # mm

p = argparse.ArgumentParser()
p.add_argument("kosu"); p.add_argument("cikti")
p.add_argument("--etiket", default="kosu"); p.add_argument("--gif", action="store_true")
a = p.parse_args()
os.makedirs(a.cikti, exist_ok=True)

# renk kodlari: 0 bos kallus, 1 MSC, 2 kemik, 4 kikirdak, 5 fibroz, 11 saglam kemik, 12 iskele, 13 plak, 20 kallus disi
SINIF = [(0, "boş kallus", "#f4f1ea"), (1, "MSC", "#f2c14e"), (2, "yeni kemik", "#d1495b"),
         (4, "kıkırdak", "#4f86c6"), (5, "fibröz doku", "#6aa84f"), (11, "sağlam kemik", "#7a6a5a"),
         (12, "iskele", "#a47ac7"), (13, "plak", "#2f3e46"), (20, "kallus dışı", "#ffffff")]
KOD2IDX = {k: i for i, (k, _, _) in enumerate(SINIF)}
cmap = ListedColormap([c for _, _, c in SINIF])
norm = BoundaryNorm(np.arange(len(SINIF) + 1) - 0.5, len(SINIF))

def kafes(n):
    return np.fromfile(os.path.join(a.kosu, f"lattice_{n}.raw"), dtype=np.uint8).reshape(NX, NY, NZ)

eleman = None
kf = os.path.join(a.kosu, "kesit_eleman.bin")
if os.path.exists(kf):
    v = np.fromfile(kf, dtype=np.int32)
    eleman = (v[:NY * NZ].reshape(NY, NZ), v[NY * NZ:NY * NZ + NX * NZ].reshape(NX, NZ), v[NY * NZ + NX * NZ:].reshape(NX, NY))

def kesitler(L):
    ci, cj, ck = (NX - 1) // 2, (NY - 1) // 2, (NZ - 1) // 2
    ks = [L[ci, :, :].copy(), L[:, cj, :].copy(), L[:, :, ck].copy()]
    out = []
    for n, s in enumerate(ks):
        s = s.astype(np.int16)
        s[s > 5] = np.where(np.isin(s[s > 5], [11, 12, 13]), s[s > 5], s[s > 5] - 5)  # gecici "yeni" kodlari 6..10
        if eleman is not None:
            s[(eleman[n] == 0) & (s == 0)] = 20
        idx = np.vectorize(lambda c: KOD2IDX.get(int(c), 0))(s)
        out.append(idx)
    return out

gunler = sorted(int(re.search(r"lattice_(\d+)\.raw", f).group(1)) for f in glob.glob(os.path.join(a.kosu, "lattice_*.raw")))
gunler = [g for g in gunler if g != 999]
if not gunler:
    raise SystemExit("lattice_*.raw bulunamadi")
secim = sorted(set([gunler[0]] + [g for g in gunler if g in (10, 30, 60, 120, 240)] + [gunler[-1]]))[:6]

def ciz_satir(axs, L, gun):
    ks = kesitler(L)
    ext_yz = [-18, 18, 0, 40]
    axs[0].imshow(ks[0].T, origin="lower", cmap=cmap, norm=norm, extent=ext_yz, interpolation="nearest")
    axs[0].set_title(f"gün {gun}: frontal (x=0)", fontsize=9); axs[0].set_xlabel("y (mm) → plak"); axs[0].set_ylabel("z (mm)")
    axs[1].imshow(ks[1].T, origin="lower", cmap=cmap, norm=norm, extent=ext_yz, interpolation="nearest")
    axs[1].set_title(f"gün {gun}: sagittal (y=0)", fontsize=9); axs[1].set_xlabel("x (mm)")
    axs[2].imshow(ks[2].T, origin="lower", cmap=cmap, norm=norm, extent=[-18, 18, -18, 18], interpolation="nearest")
    axs[2].set_title(f"gün {gun}: enine (z=20, defekt ortası)", fontsize=9); axs[2].set_xlabel("x (mm)"); axs[2].set_ylabel("y (mm)")
    for ax in axs: ax.set_aspect("equal"); ax.tick_params(labelsize=7)

fig, axes = plt.subplots(len(secim), 3, figsize=(10.5, 3.3 * len(secim)), squeeze=False)
for r, g in enumerate(secim):
    ciz_satir(axes[r], kafes(g), g)
fig.legend(handles=[Patch(color=c, label=l) for _, l, c in SINIF], loc="lower center", ncol=5, fontsize=8, frameon=False)
fig.suptitle(f"{a.etiket}: doku dağılımı (koyun uzun kemik, 30 mm boş defekt, CalculiX)", fontsize=11)
fig.tight_layout(rect=[0, 0.04, 1, 0.97])
fig.savefig(os.path.join(a.cikti, f"{a.etiket}_kesitler.png"), dpi=130); plt.close(fig)

# zaman serileri
ist = os.path.join(a.kosu, "istatistik.csv")
if os.path.exists(ist):
    import csv
    rows = list(csv.DictReader(open(ist)))
    t = np.array([int(r["gun"]) for r in rows])
    kal = np.array([int(r["kallus_nokta"]) for r in rows], float)
    fig, ax = plt.subplots(1, 3, figsize=(14, 3.8))
    for key, lab, c in [("kemik", "yeni kemik", "#d1495b"), ("kikirdak", "kıkırdak", "#4f86c6"),
                        ("fibroz", "fibröz", "#6aa84f"), ("MSC", "MSC", "#f2c14e"), ("bos", "boş", "#999999")]:
        ax[0].plot(t, 100 * np.array([int(r[key]) for r in rows]) / kal, label=lab, color=c)
    ax[0].set_xlabel("gün"); ax[0].set_ylabel("kallus hacminin %'si"); ax[0].set_title("Kallus doku oranları"); ax[0].legend(fontsize=8)
    ne = sum(int(rows[0][k]) for k in ["uyaran_rezorpsiyon", "uyaran_kemik", "uyaran_kikirdak", "uyaran_fibroz"])
    for key, lab, c in [("uyaran_rezorpsiyon", "rezorpsiyon", "#999999"), ("uyaran_kemik", "kemik", "#d1495b"),
                        ("uyaran_kikirdak", "kıkırdak", "#4f86c6"), ("uyaran_fibroz", "fibröz", "#6aa84f")]:
        ax[1].plot(t, 100 * np.array([int(r[key]) for r in rows]) / ne, label=lab, color=c)
    ax[1].set_xlabel("gün"); ax[1].set_ylabel("kallus elemanlarının %'si"); ax[1].set_title("Mekanik uyaran (Claes-Heigele)"); ax[1].legend(fontsize=8)
    uz = os.path.join(a.kosu, "uz_yerdegistirme.txt")
    if os.path.exists(uz):
        u = np.loadtxt(uz, ndmin=1)
        fe_gun = [-1] + [g for g in range(6, 400, 3)][:len(u) - 1]  # baslangic + 6, 9, 12, ...
        ax[2].plot(fe_gun[:len(u)], -u * 1000, "o-", ms=3, color="#2f3e46")
        ax[2].set_xlabel("gün"); ax[2].set_ylabel("eksenel çökme (µm)"); ax[2].set_title("Proksimal uç yer değiştirmesi (823 N)")
    fig.tight_layout(); fig.savefig(os.path.join(a.cikti, f"{a.etiket}_doku_zaman.png"), dpi=130); plt.close(fig)

if a.gif:
    from PIL import Image
    kareler = []
    for g in gunler:
        ks = kesitler(kafes(g))
        rgb = (np.array([matplotlib.colors.to_rgb(c) for _, _, c in SINIF]) * 255).astype(np.uint8)
        img = np.concatenate([rgb[ks[0].T[::-1]], np.full((NZ, 10, 3), 255, np.uint8), rgb[ks[1].T[::-1]]], axis=1)
        im = Image.fromarray(img).resize((img.shape[1] * 3 // 2, img.shape[0] * 3 // 2), Image.NEAREST)
        from PIL import ImageDraw
        ImageDraw.Draw(im).text((8, 8), f"gun {g}", fill=(0, 0, 0))
        kareler.append(im)
    kareler[0].save(os.path.join(a.cikti, f"{a.etiket}_animasyon.gif"), save_all=True, append_images=kareler[1:], duration=400, loop=0)
print("Gorseller:", a.cikti)
