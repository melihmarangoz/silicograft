"""Data for the cell-level 3D viewer (web3d_uygulama/hucre3b.html).

Reads the DAILY full-resolution lattices of one run (lattice_N.raw.zst, written with
-DRAW_WRITE_INTERVAL=1, see araclar/gunluk_kosu.sh) and writes:

  roi_<name>.bin.gz   every lattice site of one region (slab) plus a margin of m sites on every side
                      (the margin lets the viewer follow cells that cross the slab faces), every day:
                      'MBR2' | uint16 nx ny nz n_days m | int16 i0 j0 k0 | uint16 days[n_days]
                      | uint8 mask[nx*ny*nz]   (0 outside the callus, 1 callus element, 2 marrow cavity)
                      | uint8 codes[n_days][ceil(nx*ny*nz/2)]  (4-bit codes, two sites per byte, low nibble
                        first; site index = (i*ny + j)*nz + k; 0 empty, 1 MSC, 2 bone, 4 chondrocyte,
                        5 fibroblast, 11 intact cortex, 13 plate)
                      nx, ny, nz, i0, j0, k0 describe the box WITH the margin.
  makro.bin.gz        tissue fractions of the whole callus on coarse blocks, every --makro-aralik days
                      'MBM1' | uint16 bx by bz n_frames | float32 block_mm | uint16 days[n_frames]
                      | uint8 frac[n_frames][4][bx*by*bz]  (MSC, bone, cartilage, fibrous; 255 = block full)
  sayilar.json        whole-callus and per-region agent counts for every day
  The whole-callus package for the free region choice (any box, not only these regions) is built by
  hucre3b_paket.py, which also rewrites the roi_*.b64.txt files from it (same codes, true 3D mask).
  manifest.json       what the viewer needs to know about the run: id, display names, seed, model variant, days,
                      cell codes (names, colours), regions, the per-site channels the viewer derives, provenance

Usage:
  python3 hucre3b_veri.py secim <run_dir> <out_dir> [--gunler 30,90,180,359]   -> region-choice maps (PNG + npz)
  python3 hucre3b_veri.py cikar <run_dir> <out_dir> --roi rois.json            -> the files above
  python3 hucre3b_veri.py manifest <run_dir|-> <out_dir> [--bolgeler bolgeler.json] -> manifest.json only, from the
                      files already in out_dir (roi_*.b64.txt or roi_*.bin.gz headers, sayilar.json); no raw lattices
rois.json: [{"ad": "korteks_ucu", "i0": .., "j0": .., "k0": .., "nx": .., "ny": .., "nz": ..}, ...]
Lattice: 361 x 361 x 401 sites, 0.1 mm; x = i*0.1-18, y = j*0.1-18 (plate at +y), z = k*0.1.
"""
import argparse, base64, glob, gzip, io, json, os, re, struct, subprocess
import numpy as np

NX, NY, NZ = 361, 361, 401
KODLAR = (1, 2, 4, 5)  # MSC, bone, chondrocyte, fibroblast


def gunler_listesi(kosu):
    g = sorted(int(re.search(r"lattice_(\d+)\.raw", f).group(1))
               for f in glob.glob(os.path.join(kosu, "lattice_*.raw*")))
    return [x for x in g if x != 999]


def kafes_oku(kosu, gun):
    zst = os.path.join(kosu, f"lattice_{gun}.raw.zst")
    if os.path.exists(zst):
        try:  # python zstandard if installed, else the zstd tool
            import zstandard
            ham = zstandard.ZstdDecompressor().decompress(open(zst, "rb").read(), max_output_size=NX * NY * NZ)
        except ImportError:
            ham = subprocess.run(["zstd", "-dc", zst], check=True, capture_output=True).stdout
    else:
        ham = open(os.path.join(kosu, f"lattice_{gun}.raw"), "rb").read()
    L = np.frombuffer(ham, np.uint8).reshape(NX, NY, NZ)
    # transient "new" codes used during mitosis/migration (6-10) map back to the cell type
    return np.where((L >= 6) & (L <= 10), L - 5, L)


def secim(a):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    gunler = [int(x) for x in a.gunler.split(",")]
    os.makedirs(a.cikti, exist_ok=True)
    renk = np.zeros((256, 3)) + [0.08, 0.1, 0.12]
    renk[[1, 2, 4, 5]] = [[0.85, 0.64, 0.23], [0.94, 0.89, 0.77], [0.35, 0.63, 0.88], [0.88, 0.48, 0.54]]
    renk[11] = [0.45, 0.43, 0.4]   # intact cortex (context)
    renk[13] = [0.25, 0.3, 0.35]   # plate (context)
    fig, ax = plt.subplots(2, len(gunler), figsize=(4.2 * len(gunler), 8.4))
    ozet = {}
    for c, g in enumerate(gunler):
        L = kafes_oku(a.kosu, g)
        ozet[g] = {int(k): int((L == k).sum()) for k in KODLAR}
        # mid-frontal plane (x = 0): rows = y (plate at top), columns = z
        ax[0, c].imshow(renk[L[NX // 2, ::-1, :]], aspect="equal", extent=[0, 40, -18, 18])
        ax[0, c].set_title(f"day {g}: x = 0 (y-z)")
        # plane just under the plate side, y = +9.3 mm: rows = x, columns = z
        jp = int(round((9.3 + 18) / 0.1))
        ax[1, c].imshow(renk[L[::-1, jp, :]], aspect="equal", extent=[0, 40, -18, 18])
        ax[1, c].set_title(f"day {g}: y = +9.3 mm (x-z)")
        np.savez_compressed(os.path.join(a.cikti, f"kesit_{g}.npz"), xorta=L[NX // 2], yplak=L[:, jp, :])
    for x in ax.flat:
        x.set_xlabel("z (mm)")
    fig.tight_layout()
    fig.savefig(os.path.join(a.cikti, "secim_kesitleri.png"), dpi=90)
    json.dump(ozet, open(os.path.join(a.cikti, "secim_ozet.json"), "w"), indent=1)
    print("written:", a.cikti)


def maske_kesiti(kosu):
    """Callus / marrow mask of the mid-frontal plane x = 0 (from kesit_eleman.bin written by main.cpp)."""
    e = np.fromfile(os.path.join(kosu, "kesit_eleman.bin"), np.int32, count=NY * NZ).reshape(NY, NZ)
    m = (e != 0).astype(np.uint8)
    j = np.arange(NY)[:, None]; k = np.arange(NZ)[None, :]
    a_, b_, h = int(3.75 / 0.1) + 1, int(4.4 / 0.1) + 1, int(5 / 0.1) + 1  # as in Cell_migration.cpp
    ilik = ((j - (NY - 1) / 2) ** 2 / b_ ** 2 <= 1) & ((k < h) | (k >= NZ - h))
    m[ilik & (m == 0)] = 2
    return m


def cikar(a):
    rois = json.load(open(a.roi))
    M = a.pay
    assert M >= 1, "the viewer smooths the matrix over neighbours: keep a margin of at least one site"
    for r in rois:  # grow every region by the margin
        r.update(i0=r["i0"] - M, j0=r["j0"] - M, k0=r["k0"] - M, nx=r["nx"] + 2 * M, ny=r["ny"] + 2 * M, nz=r["nz"] + 2 * M)
        assert abs(r["i0"] + r["nx"] / 2 - NX / 2) < 8, "regions are meant to sit on the mid-frontal plane"
    gunler = [g for g in gunler_listesi(a.kosu) if a.son_gun is None or g <= a.son_gun]
    os.makedirs(a.cikti, exist_ok=True)
    mk = maske_kesiti(a.kosu)
    B = a.makro_blok
    bx, by, bz = -(-NX // B), -(-NY // B), -(-NZ // B)
    roi_kod = {r["ad"]: [] for r in rois}
    makro, makro_gun = [], []
    sayilar = {"gun": [], "kallus": {str(k): [] for k in KODLAR}, "roi": {r["ad"]: {str(k): [] for k in KODLAR} for r in rois}}
    for g in gunler:
        L = kafes_oku(a.kosu, g)
        say = np.bincount(L.ravel(), minlength=11)
        sayilar["gun"].append(g)
        for k in KODLAR:
            sayilar["kallus"][str(k)].append(int(say[k]))
        for r in rois:
            s = L[r["i0"]:r["i0"] + r["nx"], r["j0"]:r["j0"] + r["ny"], r["k0"]:r["k0"] + r["nz"]]
            assert s.shape == (r["nx"], r["ny"], r["nz"]), (r["ad"], s.shape)
            v = s.ravel()
            if v.size % 2:
                v = np.concatenate([v, [0]])
            roi_kod[r["ad"]].append((v[0::2] | (v[1::2] << 4)).astype(np.uint8))
            rs = np.bincount(s[M:-M or None, M:-M or None, M:-M or None].ravel(), minlength=14)  # counts: core slab only
            for k in KODLAR:
                sayilar["roi"][r["ad"]][str(k)].append(int(rs[k]))
        if g % a.makro_aralik == 0 or g == gunler[-1]:
            pad = np.zeros((bx * B, by * B, bz * B), np.uint8)
            pad[:NX, :NY, :NZ] = L
            v = pad.reshape(bx, B, by, B, bz, B)
            fr = [np.round((v == k).sum(axis=(1, 3, 5)) * (255.0 / B ** 3)).astype(np.uint8) for k in KODLAR]
            makro.append(np.stack(fr))
            makro_gun.append(g)
        print(f"day {g} done", flush=True)
    for r in rois:
        yol = os.path.join(a.cikti, f"roi_{r['ad']}.bin.gz")
        maske = np.broadcast_to(mk[r["j0"]:r["j0"] + r["ny"], r["k0"]:r["k0"] + r["nz"]][None], (r["nx"], r["ny"], r["nz"]))
        with gzip.open(yol, "wb", compresslevel=9) as f:
            f.write(b"MBR2")
            f.write(struct.pack("<HHHHHhhh", r["nx"], r["ny"], r["nz"], len(gunler), M, r["i0"], r["j0"], r["k0"]))
            f.write(np.array(gunler, "<u2").tobytes())
            f.write(np.ascontiguousarray(maske, np.uint8).tobytes())
            f.write(np.stack(roi_kod[r["ad"]]).tobytes())
        print("written:", yol, os.path.getsize(yol) // 1024, "KB")
    yol = os.path.join(a.cikti, "makro.bin.gz")
    with gzip.open(yol, "wb", compresslevel=9) as f:
        f.write(b"MBM1")
        f.write(struct.pack("<HHHHf", bx, by, bz, len(makro_gun), 0.1 * B))
        f.write(np.array(makro_gun, "<u2").tobytes())
        f.write(np.stack(makro).tobytes())
    print("written:", yol, os.path.getsize(yol) // 1024, "KB")
    json.dump(sayilar, open(os.path.join(a.cikti, "sayilar.json"), "w"))
    a.bolgeler = a.roi
    manifest(a)


# ---------- run manifest (read by the viewer; the binary formats above are unchanged)
# model codes as the viewer draws them (colours: hucre3b.html TURLER / matrix materials)
KOD_TANIM = [
    {"kod": 0, "ad": "Empty site", "en": "empty site (clot / granulation tissue in the callus)", "renk": "#c98a86"},
    {"kod": 1, "ad": "Stem cell (MSC)", "en": "mesenchymal stem cell", "renk": "#e7b860"},
    {"kod": 2, "ad": "Bone cell", "en": "bone cell; drawn as osteoblast (#a46ad8) on the bone surface, osteocyte (#c9b3ea) inside",
     "renk": "#a46ad8", "cizim": [{"ad": "Osteoblast", "renk": "#a46ad8"}, {"ad": "Osteocyte", "renk": "#c9b3ea"}]},
    {"kod": 4, "ad": "Chondrocyte", "en": "chondrocyte", "renk": "#6fb0e8"},
    {"kod": 5, "ad": "Fibroblast", "en": "fibroblast", "renk": "#e07a8a"},
    {"kod": 11, "ad": "Intact cortex", "en": "intact cortex (fixed, no cells)", "renk": "#cfc0a0"},
    {"kod": 13, "ad": "Plate", "en": "plate (fixed)", "renk": "#9c9d9e"},
]
KANALLAR = [
    {"ad": "kod", "birim": None, "tur": "kategorik", "kaynak": "model", "en": "lattice code of the site on that day (4 bit, codes above)"},
    {"ad": "maske", "birim": None, "tur": "kategorik", "kaynak": "model",
     "en": "0 outside the callus, 1 callus element, 2 marrow cavity, same for every day (hucre3b_paket.py: true 3D mask "
           "recomputed from the mesh; cikar alone broadcasts the mid-frontal plane)"},
    {"ad": "gun", "baslik": "Days at this site", "birim": "days", "tur": "skaler", "kaynak": "viewer",
     "en": "days the site has held the same code without a break (no cell identity in the model)"},
    {"ad": "komsu", "baslik": "Same-type neighbours", "birim": "neighbours (0-26)", "tur": "skaler", "kaynak": "viewer",
     "en": "sites with the same code among the 26 lattice neighbours"},
    {"ad": "uzak", "baslik": "Distance to bone", "birim": "mm", "tur": "skaler", "kaynak": "viewer",
     "en": "Euclidean distance to the nearest bone (2) or intact-cortex (11) site inside the region box"},
    {"ad": "once", "baslik": "Previous cell", "birim": None, "tur": "kategorik", "kaynak": "viewer",
     "en": "code that held the site before the current one (255: unchanged since day 0)"},
]
# re-runs of 2026-11-07 against the runs of 2026-10-26 (istatistik.csv, callus elements; HUCRE3B.md)
FARK = {
    "bagsiz_orijinal_t12345": {"ilk_farkli_gun": 10, "kemik_mm3": {"180": [169.4, 169.5], "359": [444.1, 488.7]}},
    "bagsiz_claes_t12345": {"ilk_farkli_gun": 31, "kemik_mm3": {"180": [169.1, 168.1], "359": [458.8, 429.2]}},
    "bagli_orijinal_t12345": {"ilk_farkli_gun": 7, "kemik_mm3": {"180": [648.8, 735.4], "359": [1302.0, 1675.2]}},
}


def roi_basligi(yol):
    """Header of a region file (.bin.gz or the artifact's .b64.txt = base64 of the gzip)."""
    ham = open(yol, "rb").read()
    if yol.endswith(".b64.txt"):
        ham = base64.b64decode(ham.strip())
    with gzip.GzipFile(fileobj=io.BytesIO(ham)) as f:
        bas = f.read(20)
        assert bas[:4] == b"MBR2", yol
        nx, ny, nz, nd, m, i0, j0, k0 = struct.unpack("<HHHHHhhh", bas[4:20])
        gunler = list(struct.unpack(f"<{nd}H", f.read(2 * nd)))
    return {"nx": nx, "ny": ny, "nz": nz, "pay": m, "i0": i0, "j0": j0, "k0": k0}, gunler


def manifest(a):
    kosu_id = os.path.basename(os.path.normpath(a.cikti))
    m = re.fullmatch(r"(bagli|bagsiz)_(orijinal|claes)_t(\d+)", kosu_id)
    assert m, f"run id {kosu_id} does not follow <bagli|bagsiz>_<orijinal|claes>_t<seed>"
    plak, isaret, tohum = m.group(1), m.group(2), int(m.group(3))
    if a.kosu not in (None, "-"):  # the build note of the run, when the raw run folder is at hand
        not_ = os.path.join(a.kosu, "derleme_bilgisi.txt")
        if os.path.exists(not_):
            m2 = re.search(r"isaret=(\w+)", open(not_).read())
            assert m2 and m2.group(1) == isaret, f"{not_} disagrees with the run id"
    sayilar = json.load(open(os.path.join(a.cikti, "sayilar.json")))
    tanim = json.load(open(a.bolgeler)) if a.bolgeler and os.path.exists(a.bolgeler) else []
    bolgeler = []
    for yol in sorted(glob.glob(os.path.join(a.cikti, "roi_*.b64.txt")) + glob.glob(os.path.join(a.cikti, "roi_*.bin.gz"))):
        ad = re.sub(r"\.(b64\.txt|bin\.gz)$", "", os.path.basename(yol))[4:]
        if any(b["ad"] == ad for b in bolgeler):
            continue
        kutu, gunler = roi_basligi(yol)
        assert gunler == sayilar["gun"], f"{yol}: days differ from sayilar.json"
        t = next((b for b in tanim if b["ad"] == ad), {})
        bolgeler.append({"ad": ad, "baslik": t.get("baslik"), "dosya": os.path.basename(yol), "kutu_payli": kutu,
                         "dilim": {k: t[k] for k in ("i0", "j0", "k0", "nx", "ny", "nz") if k in t}})
    sira = [b["ad"] for b in tanim]
    bolgeler.sort(key=lambda b: sira.index(b["ad"]) if b["ad"] in sira else 99)
    plak_ad = {"bagli": "Bonded plate", "bagsiz": "Unbonded plate"}[plak]
    isaret_ad = {"orijinal": "original stimulus", "claes": "Claes-Heigele stimulus"}[isaret]
    isaret_kisa = {"orijinal": "original", "claes": "Claes-Heigele"}[isaret]
    out = {
        "surum": 1,
        "kosu": kosu_id,
        "ad": f"{plak_ad} · {isaret_ad}",
        "kisa": f"{plak_ad.split()[0]} · {isaret_kisa}",
        "tohum": tohum,
        "model": {
            "plak": plak,
            "plak_en": "plate bonded to the bone" if plak == "bagli" else "plate-bone interface unbonded (duplicated interface nodes)",
            "isaret": isaret,
            "isaret_en": ("cartilage stimulus HP > 0.15 MPa (compression positive), built with -DCLAES_HEIGELE_BASMA_POZITIF"
                          if isaret == "claes" else "original sign: cartilage stimulus HP < -0.15 MPa (acts in tension)"),
            "kaynak": "long_bone/src/Read_stimulus.cpp:16-17,108-113; araclar/kosu_hazirla.sh:10-11",
        },
        "gunler": sayilar["gun"],
        "kafes": {"adim_mm": 0.1, "boyut": [NX, NY, NZ], "koordinat": "x = i*0.1-18, y = j*0.1-18 (plate at +y), z = k*0.1 (distal end at 0)"},
        "kodlar": KOD_TANIM,
        "bolgeler": bolgeler,
        "kanallar": KANALLAR,
        "dosyalar": {"makro": "makro.b64.txt", "sayilar": "sayilar.json",
                     **({"paket": "parca.json", "zemin": "zemin.b64.txt"} if os.path.exists(os.path.join(a.cikti, "parca.json")) else {})},
        "kaynak_bilgisi": {
            "yeniden_kosu": a.tarih,
            "gunluk_kafes": "RAW_WRITE_INTERVAL=1 (araclar/gunluk_kosu.sh)",
            "ayni_degil": "Not bit-identical to the 2026-10-26 runs of the same seed and settings; likely OMP_NUM_THREADS 4 -> 5 "
                          "in CalculiX (not verified). Qualitative result unchanged.",
            "ayni_degil_tr": "Not identical to the earlier run (see Methods)",
            "fark": FARK.get(kosu_id),
            "uretim": "araclar/hucre3b_veri.py manifest",
        },
    }
    yol = os.path.join(a.cikti, "manifest.json")
    metin = json.dumps(out, ensure_ascii=False, indent=1)
    # number lists (the day list) on one line
    metin = re.sub(r"\[\n\s*(-?[\d.]+(?:,\n\s*-?[\d.]+)*)\n\s*\]", lambda x: "[" + re.sub(r",\n\s*", ", ", x.group(1)) + "]", metin)
    open(yol, "w", encoding="utf-8").write(metin + "\n")
    print("written:", yol, len(bolgeler), "regions")


ap = argparse.ArgumentParser()
ap.add_argument("mod", choices=["secim", "cikar", "manifest"])
ap.add_argument("kosu")
ap.add_argument("cikti")
ap.add_argument("--gunler", default="30,90,180,359")
ap.add_argument("--roi")
ap.add_argument("--makro-blok", type=int, default=8)
ap.add_argument("--makro-aralik", type=int, default=10)
ap.add_argument("--pay", type=int, default=3, help="margin (sites) saved around every region")
ap.add_argument("--son-gun", type=int, help="use days up to this one only (testing on a running simulation)")
ap.add_argument("--bolgeler", help="region definitions with titles (manifest mode; default <out_dir>/../bolgeler.json)")
ap.add_argument("--tarih", default="2026-11-07", help="date of the daily re-run (manifest)")
a = ap.parse_args()
if a.mod == "manifest" and not a.bolgeler:
    a.bolgeler = os.path.join(os.path.dirname(os.path.normpath(a.cikti)), "bolgeler.json")
{"secim": secim, "cikar": cikar, "manifest": manifest}[a.mod](a)
