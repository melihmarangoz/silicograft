"""3B web görüntüleyici için veri: kafes çıktılarını 0.4 mm voksellere indirger ve her vokselin
doku geçmişini tek bir sıkıştırılmış ikili dosyaya yazar.

Kullanım: python3 araclar/web3d_veri.py <kosu_klasoru> <cikti.bin.gz> [--blok 4]

Dosya biçimi (küçük uçlu, gzip içinde):
  'MBV1' | uint16 nx ny nz | uint16 n_kare | uint32 n_voksel | float32 voksel_mm | uint16 gunler[n_kare]
  uint8 konum[n_voksel][3]          (blok indeksleri i, j, k)
  uint8 kod[n_voksel][n_kare]       (0 boş, 1 MSC, 2 kemik, 3 kıkırdak, 4 fibröz)
Kafes: 361 x 361 x 401, 0.1 mm; x = i*0.1-18, y = j*0.1-18 (plak +y), z = k*0.1.
"""
import argparse, glob, gzip, os, re, struct
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("kosu"); ap.add_argument("cikti")
ap.add_argument("--blok", type=int, default=4)
ap.add_argument("--esik", type=int, default=8, help="bir blokta dokunun sayılması için gereken en az kafes noktası")
a = ap.parse_args()
NX, NY, NZ = 361, 361, 401
B = a.blok
bx, by, bz = -(-NX // B), -(-NY // B), -(-NZ // B)

gunler = sorted(int(re.search(r"lattice_(\d+)\.raw", f).group(1))
                for f in glob.glob(os.path.join(a.kosu, "lattice_*.raw")))
gunler = [g for g in gunler if g != 999]
print("kareler:", gunler)

def indir(L):
    # mitoz/göç sırasındaki geçici "yeni" kodlar (6-10) asıl koda döner
    L = np.where((L >= 6) & (L <= 10), L - 5, L)
    pad = np.zeros((bx * B, by * B, bz * B), np.uint8)
    pad[:NX, :NY, :NZ] = L
    v = pad.reshape(bx, B, by, B, bz, B)
    say = [((v == c).sum(axis=(1, 3, 5))) for c in (1, 2, 4, 5)]  # MSC, kemik, kıkırdak, fibröz
    say = np.stack(say, -1).astype(np.int32)
    agirlik = say * np.array([1, 4, 2, 2])  # doku MSC'den önce görünsün, kemik öncelikli
    kod = np.argmax(agirlik, -1).astype(np.uint8) + 1  # 1 MSC, 2 kemik, 3 kıkırdak, 4 fibröz
    kod[say.max(-1) < a.esik] = 0
    return kod

kodlar = []
for g in gunler:
    L = np.fromfile(os.path.join(a.kosu, f"lattice_{g}.raw"), np.uint8).reshape(NX, NY, NZ)
    kodlar.append(indir(L))
    print(f"gün {g}: dolu blok {int((kodlar[-1] > 0).sum())}")
K = np.stack(kodlar, -1)                      # bx, by, bz, n_kare
dolu = K.any(-1)
konum = np.argwhere(dolu).astype(np.uint8)    # n x 3
kod = K[dolu].astype(np.uint8)                # n x n_kare
print(f"voksel {len(konum)}, kare {len(gunler)}")

with gzip.open(a.cikti, "wb", compresslevel=9) as f:
    f.write(b"MBV1")
    f.write(struct.pack("<HHHHIf", bx, by, bz, len(gunler), len(konum), 0.1 * B))
    f.write(np.array(gunler, "<u2").tobytes())
    f.write(konum.tobytes())
    f.write(kod.tobytes())
print("yazıldı:", a.cikti, os.path.getsize(a.cikti) // 1024, "KB")
