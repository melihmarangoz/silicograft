"""Whole-callus cell package for the free region choice of the cell viewer (web3d_uygulama/hucre3b.html).

The viewer cuts any region box (the fixed 5 x 28 x 28 site slab plus its 3-site margin) out of this
package in the browser, so it can show every place of the callus, not only the preset regions.

Reads the DAILY full-resolution lattices of one run (lattice_N.raw.zst, araclar/gunluk_kosu.sh) and the
run's mesh (node_file.txt, element_file.txt) and writes into <out_dir>:

  parca.json            index: days, lattice size, box size, one entry per tile file {"d": file, "k": [i0, j0, k0,
                        nx, ny, nz], "b": bytes of the published text}
  parca/pNNN.b64.txt    one tile = an axis-aligned block of the lattice, base64 of the gzip of
                        'MBT1' | uint16 nx ny nz n_days | int16 i0 j0 k0 | uint16 0 | uint32 n_events
                        | uint8 code0[ceil(N/2)]   day-0 codes, 4 bit, low nibble first, site = (i*ny + j)*nz + k
                        | uint8 mask[N]            0 outside the callus, 1 callus element, 2 marrow cavity
                        | var   count[N]           number of code changes at the site over the run
                        | var   step[n_events]     day-index step from the site's previous change (first: from 0)
                        | uint8 code[n_events]     the new code
                        "var" = one byte below 255, else 255 followed by uint16. Events are in site order,
                        then day order. Codes as in hucre3b_veri.py (6-10 already mapped back to 1-5).
  zemin.b64.txt         static anatomy for the viewer's map: base64 of gzip of
                        'MBZ1' | uint16 bx by bz | uint8 step | uint8 0 | uint8 cat[bx*by*bz]
                        (lattice site (step*a, step*b, step*c); 0 outside, 1 callus, 2 marrow, 3 intact
                        cortex, 4 plate; index (a*by + b)*bz + c)
  roi_<name>.b64.txt    (with --bolgeler) the preset regions, assembled from the tiles exactly as the viewer
                        assembles a custom box (MBR2, see hucre3b_veri.py)

Tiles: the lattice is split in half recursively (k-d) until a tile's gzip is at most --butce bytes and it
holds at most --en-cok-site sites; blocks that never hold a code and lie outside the callus are not
stored. The split axis is the longest one relative to the region box (11 x 34 x 34 with margin), which
keeps the number of tiles one box overlaps small.

The 3D callus mask is recomputed from the mesh with the model's own point-in-tetrahedron test
(src/Lattice_point_in_element.cpp, float32 like the C++ build) and checked against the three planes of
kesit_eleman.bin that main.cpp writes; the run must stop if they differ.

Usage:
  python3 hucre3b_paket.py <run_dir> <out_dir> [--bolgeler bolgeler.json] [--butce 400000]
"""
import argparse, base64, glob, gzip, io, json, os, re, struct, subprocess, sys, time
import numpy as np

NX, NY, NZ = 361, 361, 401
KUTU = (5, 28, 28)   # core slab of a region (x, y, z sites); same as veri/bolgeler.json
PAY = 3              # margin around the core, as hucre3b_veri.py --pay


def gunler_listesi(kosu):
    g = sorted(int(re.search(r"lattice_(\d+)\.raw", f).group(1)) for f in glob.glob(os.path.join(kosu, "lattice_*.raw*")))
    return [x for x in g if x != 999]


def kafes_oku(kosu, gun):
    zst = os.path.join(kosu, f"lattice_{gun}.raw.zst")
    if os.path.exists(zst):
        try:
            import zstandard
            ham = zstandard.ZstdDecompressor().decompress(open(zst, "rb").read(), max_output_size=NX * NY * NZ)
        except ImportError:
            ham = subprocess.run(["zstd", "-dc", zst], check=True, capture_output=True).stdout
    else:
        ham = open(os.path.join(kosu, f"lattice_{gun}.raw"), "rb").read()
    L = np.frombuffer(ham, np.uint8).reshape(NX, NY, NZ)
    return np.where((L >= 6) & (L <= 10), L - 5, L).astype(np.uint8)


# ---------- 3D callus / marrow mask
def kallus_maskesi(kosu):
    """0 outside, 1 callus element, 2 marrow cavity, for every lattice site (int8 array NX x NY x NZ)."""
    f32 = np.float32
    nod = np.loadtxt(os.path.join(kosu, "node_file.txt"), delimiter=",", dtype=np.float64)
    P = np.zeros((int(nod[:, 0].max()) + 1, 3), np.float32)
    P[nod[:, 0].astype(int)] = nod[:, 1:4].astype(np.float32)
    el = np.loadtxt(os.path.join(kosu, "element_file.txt"), delimiter=",", dtype=np.int64)[:, 1:]
    gmin = P[np.unique(el)].min(0)  # Calculate_lattice.cpp: Global_min over the callus element nodes
    cd = f32(0.1)
    lim = np.array([NX - 1, NY - 1, NZ - 1])
    E = np.zeros((NX, NY, NZ), np.int32)

    def duzlem(F, x, y, z):  # Plane_intersection.cpp, same operation order
        (x1, y1, z1), (x2, y2, z2), (x3, y3, z3) = F
        A = y1 * (z2 - z3) + y2 * (z3 - z1) + y3 * (z1 - z2)
        B = z1 * (x2 - x3) + z2 * (x3 - x1) + z3 * (x1 - x2)
        C = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)
        D = -(x1 * (y2 * z3 - y3 * z2) + x2 * (y3 * z1 - y1 * z3) + x3 * (y1 * z2 - y2 * z1))
        return A * x + B * y + C * z + D

    for e in range(el.shape[0]):
        n = el[e]; Q = P[n]
        lo = np.clip(((Q.min(0) - gmin) / cd + f32(0.5)).astype(np.int32), 0, lim)  # Extremes_element.cpp
        hi = np.clip(((Q.max(0) - gmin) / cd + f32(0.5)).astype(np.int32), 0, lim)
        I, J, K = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1), np.arange(lo[2], hi[2] + 1), indexing="ij")
        x = I.astype(f32) * cd + gmin[0]; y = J.astype(f32) * cd + gmin[1]; z = K.astype(f32) * cd + gmin[2]
        p1, p2, p3, p4 = P[n[0]], P[n[1]], P[n[2]], P[n[3]]
        ok = E[I, J, K] == 0
        for F in ((p1, p3, p2), (p1, p2, p4), (p1, p4, p3), (p2, p3, p4)):
            ok &= duzlem(F, x, y, z) <= 0
        E[I[ok], J[ok], K[ok]] = e + 1
    # check against the three planes main.cpp wrote
    v = np.fromfile(os.path.join(kosu, "kesit_eleman.bin"), np.int32)
    ci, cj, ck = (NX - 1) // 2, (NY - 1) // 2, (NZ - 1) // 2
    assert (v[:NY * NZ].reshape(NY, NZ) == E[ci]).all(), "mask differs from kesit_eleman.bin (x plane)"
    assert (v[NY * NZ:NY * NZ + NX * NZ].reshape(NX, NZ) == E[:, cj]).all(), "mask differs from kesit_eleman.bin (y plane)"
    assert (v[NY * NZ + NX * NZ:].reshape(NX, NY) == E[:, :, ck]).all(), "mask differs from kesit_eleman.bin (z plane)"
    m = (E != 0).astype(np.uint8)
    del E
    # marrow cavity: Cell_migration.cpp (ellipse a x b in x-y at both bone ends, h sites high)
    h, a_, b_ = int(5 / 0.1) + 1, int(3.75 / 0.1) + 1, int(4.4 / 0.1) + 1
    i = np.arange(NX)[:, None, None]; j = np.arange(NY)[None, :, None]; k = np.arange(NZ)[None, None, :]
    ilik = ((i - (NX - 1) // 2) ** 2 / a_ ** 2 + (j - (NY - 1) // 2) ** 2 / b_ ** 2 <= 1) & ((k < h) | (k >= NZ - h))
    m[ilik & (m == 0)] = 2
    return m


# ---------- tiles
def _var(a):
    a = np.asarray(a, np.int64)
    if not (a >= 255).any():
        return a.astype(np.uint8).tobytes()
    assert a.max() < 65536
    b = bytearray()
    for v in a.tolist():
        if v < 255:
            b.append(v)
        else:
            b.append(255); b += int(v).to_bytes(2, "little")
    return bytes(b)


class Olaylar:
    """All code changes of a run: site (flat lattice index), day index, new code; plus day 0 and the mask."""

    def __init__(self, kosu, gunler, maske):
        self.gunler = gunler
        S, D, C = [], [], []
        L0 = kafes_oku(kosu, gunler[0]); onceki = L0
        for n, g in enumerate(gunler[1:], 1):
            L = kafes_oku(kosu, g)
            s = np.flatnonzero(L != onceki).astype(np.int32)
            S.append(s); D.append(np.full(s.size, n, np.uint16)); C.append(L.ravel()[s])
            onceki = L
            if n % 60 == 0:
                print(f"  gün {g}", flush=True)
        S = np.concatenate(S); o = np.argsort(S, kind="stable")  # site order, then day order (days were appended in order)
        self.S, self.D, self.C = S[o], np.concatenate(D)[o], np.concatenate(C)[o]
        del S, o
        self.ii, self.jj, self.kk = [a.astype(np.int16) for a in np.unravel_index(self.S, (NX, NY, NZ))]
        self.L0, self.maske = L0, maske

    def sec(self, e, k):
        (a0, a1), (b0, b1), (c0, c1) = k
        ii, jj, kk = self.ii[e], self.jj[e], self.kk[e]
        return e[(ii >= a0) & (ii < a1) & (jj >= b0) & (jj < b1) & (kk >= c0) & (kk < c1)]

    def ham(self, k, e):
        """Uncompressed MBT1 bytes of block k (None when it never holds a code and lies outside the callus)."""
        (a0, a1), (b0, b1), (c0, c1) = k
        blk = self.L0[a0:a1, b0:b1, c0:c1]; mk = self.maske[a0:a1, b0:b1, c0:c1]
        if e.size == 0 and not blk.any() and not mk.any():
            return None
        nx, ny, nz = blk.shape; N = nx * ny * nz
        v = blk.ravel()
        if v.size % 2:
            v = np.append(v, 0)
        li = ((self.ii[e].astype(np.int64) - a0) * ny + (self.jj[e] - b0)) * nz + (self.kk[e] - c0)
        dd = self.D[e].astype(np.int64)
        ilk = np.r_[True, li[1:] != li[:-1]] if e.size else np.zeros(0, bool)
        onc = np.r_[0, dd[:-1]] if e.size else dd
        onc[ilk] = 0
        bas = b"MBT1" + struct.pack("<HHHHhhhHI", nx, ny, nz, len(self.gunler), a0, b0, c0, 0, e.size)
        return b"".join([bas, (v[0::2] | (v[1::2] << 4)).astype(np.uint8).tobytes(), np.ascontiguousarray(mk, np.uint8).tobytes(),
                         _var(np.bincount(li, minlength=N)), _var(dd - onc), self.C[e].tobytes()])

    def bol(self, butce, en_cok):
        """k-d split of the lattice into tiles: list of (block, gzip bytes)."""
        kutu = (KUTU[0] + 2 * PAY, KUTU[1] + 2 * PAY, KUTU[2] + 2 * PAY)
        out = []

        def rec(k, e):
            dims = [k[d][1] - k[d][0] for d in range(3)]
            buyuk = np.prod(dims) > en_cok
            if buyuk:  # too large for one tile anyway: split without encoding (keeps memory low)
                if e.size == 0 and not self.L0[k[0][0]:k[0][1], k[1][0]:k[1][1], k[2][0]:k[2][1]].any() \
                        and not self.maske[k[0][0]:k[0][1], k[1][0]:k[1][1], k[2][0]:k[2][1]].any():
                    return
            else:
                h = self.ham(k, e)
                if h is None:
                    return
                if len(gzip.compress(h, 6, mtime=0)) <= butce or max(dims) <= 8:
                    out.append((k, gzip.compress(h, 9, mtime=0))); return
            d = int(np.argmax([dims[x] / kutu[x] for x in range(3)]))
            m = k[d][0] + dims[d] // 2
            for yarim in ((k[d][0], m), (m, k[d][1])):
                k2 = list(k); k2[d] = yarim; k2 = tuple(k2)
                rec(k2, self.sec(e, k2))

        rec(((0, NX), (0, NY), (0, NZ)), np.arange(self.S.size))
        return out


# ---------- reading the package back (the same steps as the viewer's JS)
def _var_oku(b, o, n):
    out = np.empty(n, np.int64)
    for x in range(n):
        v = b[o]; o += 1
        if v == 255:
            v = b[o] | (b[o + 1] << 8); o += 2
        out[x] = v
    return out, o


def _var_oku_hizli(b, o, n):
    """Vectorised reader for var streams (same result as _var_oku); escapes are rare."""
    a = np.frombuffer(b, np.uint8)
    out, kalan = [], n
    while kalan:
        parca = a[o:o + kalan]
        f = np.flatnonzero(parca == 255)
        if not f.size:
            out.append(parca.astype(np.int64)); o += kalan; break
        f = int(f[0])
        out.append(parca[:f].astype(np.int64)); out.append(np.array([int(a[o + f + 1]) | (int(a[o + f + 2]) << 8)], np.int64))
        o += f + 3; kalan -= f + 1
    return (np.concatenate(out) if out else np.zeros(0, np.int64)), o


def parca_coz(ham):
    """MBT1 bytes -> dict with code0 (N), mask (N), start (N+1) offsets into step/code, days (absolute day index)."""
    assert ham[:4] == b"MBT1"
    nx, ny, nz, nd, i0, j0, k0, _, ne = struct.unpack("<HHHHhhhHI", ham[4:24])
    N = nx * ny * nz; o = 24
    p = np.frombuffer(ham, np.uint8, count=(N + 1) // 2, offset=o); o += (N + 1) // 2
    kod0 = np.empty(2 * p.size, np.uint8); kod0[0::2] = p & 15; kod0[1::2] = p >> 4; kod0 = kod0[:N]
    maske = np.frombuffer(ham, np.uint8, count=N, offset=o); o += N
    sayi, o = _var_oku_hizli(ham, o, N)
    adim, o = _var_oku_hizli(ham, o, ne)
    kod = np.frombuffer(ham, np.uint8, count=ne, offset=o); o += ne
    assert o == len(ham), "trailing bytes in tile"
    bas = np.zeros(N + 1, np.int64); np.cumsum(sayi, out=bas[1:])
    # absolute day index: cumulative step within each site
    gun = np.cumsum(adim)
    if ne:
        sifir = np.repeat(np.r_[0, gun][bas[:-1]], sayi)  # value of the running sum before each site's first event
        gun = gun - sifir
    return {"k": (i0, j0, k0, nx, ny, nz), "nd": nd, "kod0": kod0, "maske": maske, "bas": bas, "gun": gun, "kod": kod}


def bolge_kur(parcalar, i0, j0, k0, nx, ny, nz, nd):
    """Assemble the codes (nd x N) and mask (N) of a box from decoded tiles. Sites in no tile stay 0."""
    N = nx * ny * nz
    kod = np.zeros((nd, nx, ny, nz), np.uint8); maske = np.zeros((nx, ny, nz), np.uint8)
    for P in parcalar:
        a0, b0, c0, px, py, pz = P["k"]
        lo = [max(i0, a0), max(j0, b0), max(k0, c0)]; hi = [min(i0 + nx, a0 + px), min(j0 + ny, b0 + py), min(k0 + nz, c0 + pz)]
        if any(lo[d] >= hi[d] for d in range(3)):
            continue
        I, J, K = np.meshgrid(*[np.arange(lo[d], hi[d]) for d in range(3)], indexing="ij")
        ps = ((I - a0) * py + (J - b0)) * pz + (K - c0)
        bi, bj, bk = I - i0, J - j0, K - k0
        maske[bi, bj, bk] = P["maske"][ps]
        kod[:, bi, bj, bk] = P["kod0"][ps][None]
        ps, bi, bj, bk = ps.ravel(), bi.ravel(), bj.ravel(), bk.ravel()
        n = P["bas"][ps + 1] - P["bas"][ps]
        for s, x, y, z, a, b in zip(ps[n > 0], bi[n > 0], bj[n > 0], bk[n > 0], P["bas"][ps[n > 0]], P["bas"][ps[n > 0] + 1]):
            g, c = P["gun"][a:b], P["kod"][a:b]
            sinir = np.r_[g, nd]
            for e in range(b - a):
                kod[sinir[e]:sinir[e + 1], x, y, z] = c[e]
    return kod.reshape(nd, N), maske.ravel()


def mbr2(kod, maske, kutu, gunler, pay):
    """MBR2 bytes (hucre3b_veri.py format) from assembled codes."""
    nx, ny, nz, i0, j0, k0 = kutu
    out = [b"MBR2", struct.pack("<HHHHHhhh", nx, ny, nz, len(gunler), pay, i0, j0, k0), np.array(gunler, "<u2").tobytes(), maske.tobytes()]
    for d in range(len(gunler)):
        v = kod[d]
        if v.size % 2:
            v = np.append(v, 0)
        out.append((v[0::2] | (v[1::2] << 4)).astype(np.uint8).tobytes())
    return b"".join(out)


def b64_gz_oku(yol):
    return gzip.decompress(base64.b64decode(open(yol, "rb").read().strip()))


class Paket:
    """The package of one run: index plus tiles decoded on demand (only the tiles a box needs)."""

    def __init__(self, klasor):
        self.klasor = klasor
        self.ind = json.load(open(os.path.join(klasor, "parca.json")))
        self._onbellek = {}

    def parca(self, p):
        if p["d"] not in self._onbellek:
            if len(self._onbellek) > 24:
                self._onbellek.pop(next(iter(self._onbellek)))
            self._onbellek[p["d"]] = parca_coz(b64_gz_oku(os.path.join(self.klasor, p["d"])))
        return self._onbellek[p["d"]]

    def kesisen(self, i0, j0, k0, nx, ny, nz):
        sec = []
        for p in self.ind["parcalar"]:
            a0, b0, c0, px, py, pz = p["k"]
            if a0 < i0 + nx and i0 < a0 + px and b0 < j0 + ny and j0 < b0 + py and c0 < k0 + nz and k0 < c0 + pz:
                sec.append(self.parca(p))
        return sec

    def bolge(self, i0, j0, k0, nx, ny, nz):
        return bolge_kur(self.kesisen(i0, j0, k0, nx, ny, nz), i0, j0, k0, nx, ny, nz, len(self.ind["gunler"]))


# ---------- build
def yaz_b64(yol, gz):
    with open(yol, "wb") as f:
        f.write(base64.b64encode(gz))
    return os.path.getsize(yol)


def paketle(a):
    t0 = time.time()
    gunler = gunler_listesi(a.kosu)
    assert gunler == list(range(len(gunler))), "the package stores day indices; expected days 0..n-1"
    os.makedirs(os.path.join(a.cikti, "parca"), exist_ok=True)
    print("maske (kafes-ağ testi)...", flush=True)
    maske = kallus_maskesi(a.kosu)
    print(f"  {time.time() - t0:.0f} s, kallus {int((maske == 1).sum())} site, ilik {int((maske == 2).sum())}", flush=True)
    O = Olaylar(a.kosu, gunler, maske)
    print(f"olaylar: {O.S.size} değişim, {time.time() - t0:.0f} s", flush=True)
    for f in glob.glob(os.path.join(a.cikti, "parca", "p*.b64.txt")):
        os.remove(f)
    parcalar = O.bol(a.butce, a.en_cok_site)
    parcalar.sort(key=lambda x: (x[0][0][0], x[0][1][0], x[0][2][0]))
    ind = {"surum": 1, "bicim": "MBT1", "gunler": gunler, "kafes": [NX, NY, NZ], "kutu": list(KUTU), "pay": PAY,
           "butce": a.butce, "parcalar": [], "zemin": "zemin.b64.txt"}
    for n, (k, g) in enumerate(parcalar):
        ad = f"parca/p{n:03d}.b64.txt"
        b = yaz_b64(os.path.join(a.cikti, ad), g)
        ind["parcalar"].append({"d": ad, "k": [k[0][0], k[1][0], k[2][0], k[0][1] - k[0][0], k[1][1] - k[1][0], k[2][1] - k[2][0]], "b": b})
    # static anatomy for the map, every --zemin-adim sites
    st = a.zemin_adim
    z = maske[::st, ::st, ::st].astype(np.uint8)
    l0 = O.L0[::st, ::st, ::st]
    z[l0 == 11] = 3; z[l0 == 13] = 4
    bx, by, bz = z.shape
    yaz_b64(os.path.join(a.cikti, "zemin.b64.txt"),
            gzip.compress(b"MBZ1" + struct.pack("<HHHBB", bx, by, bz, st, 0) + z.tobytes(), 9, mtime=0))
    ind["toplam_bayt"] = sum(p["b"] for p in ind["parcalar"])
    json.dump(ind, open(os.path.join(a.cikti, "parca.json"), "w"), separators=(",", ":"))
    print(f"yazıldı: {len(parcalar)} parça, {ind['toplam_bayt'] / 1e6:.1f} MB (base64), {time.time() - t0:.0f} s", flush=True)
    del O
    if a.bolgeler:  # the preset regions, assembled from the tiles like any custom box
        P = Paket(a.cikti)
        for r in json.load(open(a.bolgeler)):
            kutu = (r["nx"] + 2 * PAY, r["ny"] + 2 * PAY, r["nz"] + 2 * PAY, r["i0"] - PAY, r["j0"] - PAY, r["k0"] - PAY)
            nx, ny, nz, i0, j0, k0 = kutu
            kod, mk = P.bolge(i0, j0, k0, nx, ny, nz)
            yol = os.path.join(a.cikti, f"roi_{r['ad']}.b64.txt")
            yaz_b64(yol, gzip.compress(mbr2(kod, mk, kutu, gunler, PAY), 9, mtime=0))
            print("yazıldı:", yol, os.path.getsize(yol) // 1024, "KB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("kosu")
    ap.add_argument("cikti")
    ap.add_argument("--bolgeler", help="write roi_<name>.b64.txt of these preset regions from the tiles")
    ap.add_argument("--butce", type=int, default=400000, help="largest gzip size of a tile (bytes)")
    ap.add_argument("--en-cok-site", type=int, default=1 << 20, help="largest tile volume (sites)")
    ap.add_argument("--zemin-adim", type=int, default=2, help="map anatomy sampled every this many sites")
    paketle(ap.parse_args())
