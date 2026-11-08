"""Check the whole-callus package (hucre3b_paket.py) against the region files and, optionally, the raw lattices.

  python3 hucre3b_paket_test.py <package_dir> <roi_dir> [--bolgeler veri/bolgeler.json] [--ham <run_dir> --rastgele 3]

For every preset region, the box assembled from the tiles must give the same code at every site on every day
as roi_<name>.b64.txt (or roi_<name>.bin.gz) in <roi_dir>, the files hucre3b_veri.py cut straight from the lattices. The mask is
compared too and differences are reported, not failed: hucre3b_veri.py broadcasts the mask of the mid-frontal
plane across the slab, the package has the true 3D mask (recomputed from the mesh).
With --ham, random boxes anywhere in the lattice are also checked against the raw daily lattices.
Exit code 0 when every code matches.
"""
import argparse, gzip, json, os, struct, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hucre3b_paket as hp

ap = argparse.ArgumentParser()
ap.add_argument("paket")
ap.add_argument("roi")
ap.add_argument("--bolgeler", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web3d_uygulama", "veri", "bolgeler.json"))
ap.add_argument("--ham", help="raw run folder (daily lattices) for random boxes")
ap.add_argument("--rastgele", type=int, default=3)
a = ap.parse_args()

P = hp.Paket(a.paket)
ind = P.ind
nd = len(ind["gunler"])
hata = 0


def mbr2_oku(b):
    assert b[:4] == b"MBR2"
    nx, ny, nz, n, m, i0, j0, k0 = struct.unpack("<HHHHHhhh", b[4:20])
    o = 20 + 2 * n
    gunler = list(struct.unpack(f"<{n}H", b[20:o]))
    N = nx * ny * nz
    maske = np.frombuffer(b, np.uint8, N, o); o += N
    y = (N + 1) // 2
    p = np.frombuffer(b, np.uint8, n * y, o).reshape(n, y)
    kod = np.empty((n, 2 * y), np.uint8); kod[:, 0::2] = p & 15; kod[:, 1::2] = p >> 4
    return (nx, ny, nz, i0, j0, k0, m), gunler, maske, kod[:, :N]


for r in json.load(open(a.bolgeler)):
    yol = os.path.join(a.roi, f"roi_{r['ad']}.b64.txt")
    ham = hp.b64_gz_oku(yol) if os.path.exists(yol) else gzip.decompress(open(os.path.join(a.roi, f"roi_{r['ad']}.bin.gz"), "rb").read())
    (nx, ny, nz, i0, j0, k0, m), gunler, maske0, kod0 = mbr2_oku(ham)
    assert gunler == ind["gunler"], "day lists differ"
    kod, maske = P.bolge(i0, j0, k0, nx, ny, nz)
    fark = int((kod != kod0).sum())
    gun_fark = sorted(set(np.flatnonzero((kod != kod0).any(1)).tolist()))
    mf = int((maske != maske0).sum())
    print(f"{r['ad']}: kutu {nx}x{ny}x{nz} @ ({i0},{j0},{k0}), {len(P.kesisen(i0, j0, k0, nx, ny, nz))} parça, "
          f"kod farkı {fark} (gün: {gun_fark[:5]}), maske farkı {mf} / {maske.size} site"
          + (f" (yeni {np.unique(maske[maske != maske0]).tolist()}, eski {np.unique(maske0[maske != maske0]).tolist()})" if mf else ""))
    hata += fark != 0

if a.ham:
    rng = np.random.default_rng(7)
    BX, BY, BZ = (ind["kutu"][d] + 2 * ind["pay"] for d in range(3))
    kutular = [(int(rng.integers(50, 300)), int(rng.integers(40, 300)), int(rng.integers(0, hp.NZ - BZ))) for _ in range(a.rastgele)]
    birlesik = [P.bolge(i0, j0, k0, BX, BY, BZ)[0] for i0, j0, k0 in kutular]
    farklar = [0] * len(kutular)
    for d, g in enumerate(ind["gunler"]):
        L = hp.kafes_oku(a.ham, g)
        for n, (i0, j0, k0) in enumerate(kutular):
            farklar[n] += int((L[i0:i0 + BX, j0:j0 + BY, k0:k0 + BZ].ravel() != birlesik[n][d]).sum())
    for (i0, j0, k0), f in zip(kutular, farklar):
        dolu = int((birlesik[kutular.index((i0, j0, k0))] != 0).sum())
        print(f"rastgele kutu @ ({i0},{j0},{k0}): ham kafesle kod farkı {f} ({dolu} dolu site-gün)")
        hata += f != 0

print("TAMAM" if hata == 0 else f"HATA: {hata} kutu farklı")
sys.exit(1 if hata else 0)
