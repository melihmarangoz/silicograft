#!/usr/bin/env python3
"""Export one SG-Bone long-bone run as binary 3D assets for the Three.js film scene (film/SPEC.md).

Reads one run folder (model_sablon.inp, node_file.txt, element_file.txt, lattice_N.raw[.zst] for every
day, kesit_eleman.bin, without_scaffold.dat/.inp, stimulus_N.bin, istatistik.csv) and writes to --out:

  surf_<part>.bin    boundary surfaces of the C3D10 regions; *_half: cut at x = 0, the half x <= 0 kept
  elem_*.bin         per callus element: centroid, E on every FE day, day-357 strain, pressure and class
  vox_days.bin       0.3 mm tissue blocks of the callus lattice for days 0, 3, ..., 357 and 359
  vox_index.json     per-day offsets, counts and tissue totals of vox_days.bin
  manifest.json      every file and array (dtype, shape, unit, meaning), codes, frames, scene_transform,
                     load case, FE schedule and the verification results
  summary.json       counts and ranges for captions and checks

The C++ rules (Lattice_point_in_element, Update_model, Read_stimulus) are the numpy versions of
site_stages.py, and each rebuilt quantity is checked against a file the C++ program wrote; the script
stops if a check fails. All binaries are little-endian, coordinates are millimetres in the model frame.
Lattices are streamed one day at a time. Intermediate arrays go to --cache (delete
film_day_pass.npz there to recompute the day pass).

Usage (from the repo root):
  python3 long_bone/araclar/film_export.py --run <run folder> --out film/assets/data [--cache <folder>]
"""
import argparse, json, math, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import site_stages as ss  # noqa: E402

NX, NY, NZ = ss.NX, ss.NY, ss.NZ
CELL = float(ss.CELL)
BLOCK = 3                                            # lattice points per block edge (0.3 mm)
NBX, NBY, NBZ = (-(-n // BLOCK) for n in (NX, NY, NZ))
MIN_FILLED = 4                                       # a block is stored when >= 4 of its 27 points are non-empty
E_LO, E_HI = 0.2, 17000.0                            # uint16 log mapping range of E (MPa)
CREASE_DEG = 40.0                                    # normals are smooth across edges flatter than this
ZERO = 1e-9                                          # |x| below this is on the cut plane (mm)

# lattice codes (main.cpp, Cell_*.cpp, Update_model.cpp, Write_statistics.cpp)
LATTICE_CODES = {
    0: "empty (free lattice site; granulation tissue in the rule of mixtures, 0.2 MPa)",
    1: "stem cell (MSC; 0.2 MPa in the rule of mixtures)",
    2: "osteoblast / bone (mature osteoblast = woven bone, 17000 MPa)",
    3: "unused (no rule creates it; 8 -> 3 in Cell_proliferation.cpp never happens)",
    4: "chondrocyte (cartilage, 10 MPa)",
    5: "fibroblast (fibrous tissue, 2 MPa)",
    6: "transient new MSC during mitosis/migration (6..10 = new 1..5; never in a written lattice)",
    11: "intact bone of the two bone ends (outside the callus)",
    12: "scaffold (not used in this run)",
    13: "fixation plate (lattice copy; outside the callus)",
}
TISSUE = (1, 2, 4, 5)
TISSUE_NAME = {1: "stem_cell", 2: "bone", 4: "chondrocyte", 5: "fibroblast"}
STIMULUS_CLASSES = {1: "resorption", 2: "intramembranous bone formation", 4: "endochondral (cartilage)",
                    5: "fibrocartilage / connective (fibrous)"}
REGION_CODE = {"KALLUS": 1, "KORTEKS": 2, "ILIK": 3, "PLAK": 4, "VIDA": 5}
TAG_CUT = 255
FACE_TAGS = {0: "free surface (nothing on the other side)", 1: "against the callus", 2: "against the cortex",
             3: "against the marrow", 4: "against the plate (contact only, the callus is not bonded to it)",
             5: "against a screw", TAG_CUT: "flat cut face on the plane x = 0 (normal +x)"}
TAG_ORDER = [0, 1, 2, 3, 4, 5, TAG_CUT]

# C3D10 -> 8 straight sub-tetrahedra through the mid-side nodes (4=01 5=12 6=20 7=03 8=13 9=23), as site_stages
SUB = np.array([(0, 4, 6, 7), (4, 1, 5, 8), (6, 5, 2, 9), (7, 8, 9, 3),
                (6, 8, 4, 5), (6, 8, 5, 9), (6, 8, 9, 7), (6, 8, 7, 4)])
TET_FACES = np.array([(0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)])
TET_OPP = np.array([3, 2, 1, 0])
TET_EDGES = [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)]


def log(*a):
    print(*a, flush=True)


# ----------------------------------------------------------------------------- mesh surfaces
def sub_tets(conn):
    """(E, 10) C3D10 connectivity -> (8E, 4) straight tetrahedra and the parent element row of each."""
    return conn[:, SUB].reshape(-1, 4), np.repeat(np.arange(len(conn)), len(SUB))


def face_keys(F, geo):
    g = np.sort(geo[F], axis=1)
    return (g[:, 0] << 34) | (g[:, 1] << 17) | g[:, 2]


def boundary_faces(tets, parent, X, geo):
    """Faces of the sub-tetrahedra used once within the region, oriented outward (CCW seen from outside)."""
    F = tets[:, TET_FACES].reshape(-1, 3)
    opp = tets[:, TET_OPP].reshape(-1)
    par = np.repeat(parent, 4)
    key = face_keys(F, geo)
    _, inv, cnt = np.unique(key, return_inverse=True, return_counts=True)
    once = cnt[inv.reshape(-1)] == 1
    F, opp, par, key = F[once], opp[once], par[once], key[once]
    n = np.cross(X[F[:, 1]] - X[F[:, 0]], X[F[:, 2]] - X[F[:, 0]])
    flip = np.einsum("ij,ij->i", n, X[opp] - X[F[:, 0]]) > 0
    F[flip] = F[flip][:, [0, 2, 1]]
    return F, par, key


class VertexPool:
    """Mesh nodes (by label) plus the points where edges cross the plane x = 0 (one per edge)."""

    def __init__(self, X):
        self.X, self.n0, self.new, self.index = X, len(X), [], {}

    def edge(self, a, b):
        a, b = (int(a), int(b)) if a < b else (int(b), int(a))
        v = self.index.get((a, b))
        if v is None:
            pa, pb = self.X[a], self.X[b]
            p = pa + pa[0] / (pa[0] - pb[0]) * (pb - pa)
            p[0] = 0.0
            v = self.n0 + len(self.new)
            self.new.append(p)
            self.index[(a, b)] = v
        return v

    def point(self, v):
        return self.X[v] if v < self.n0 else self.new[v - self.n0]

    def coords(self, ids):
        ids = np.asarray(ids)
        out = np.empty(ids.shape + (3,))
        old = ids < self.n0
        out[old] = self.X[ids[old]]
        if (~old).any():
            out[~old] = np.array(self.new)[ids[~old] - self.n0]
        return out


def side(X, ids):
    x = X[ids][..., 0]
    return np.where(x > ZERO, 1, np.where(x < -ZERO, -1, 0)).astype(np.int8)


def clip_skin(F, par, tag, X, pool):
    """Keep the part of each boundary triangle with x <= 0 (Sutherland-Hodgman, orientation kept)."""
    s = side(X, F)
    on_plane = (s == 0).all(1)
    nx = np.cross(X[F[:, 1]] - X[F[:, 0]], X[F[:, 2]] - X[F[:, 0]])[:, 0]
    keep = ((s <= 0).all(1) & ~on_plane) | (on_plane & (nx > 0))
    outF, outP, outT = [F[keep]], [par[keep]], [tag[keep]]
    tris, ps, ts = [], [], []
    for m in np.flatnonzero((s.min(1) < 0) & (s.max(1) > 0)):
        poly = []
        for k in range(3):
            p, q, sp, sq = F[m, k], F[m, (k + 1) % 3], s[m, k], s[m, (k + 1) % 3]
            if sp <= 0:
                poly.append(int(p))
            if sp * sq < 0:
                poly.append(pool.edge(p, q))
        for j in range(1, len(poly) - 1):
            tris.append((poly[0], poly[j], poly[j + 1])); ps.append(par[m]); ts.append(tag[m])
    if tris:
        outF.append(np.array(tris)); outP.append(np.array(ps)); outT.append(np.array(ts))
    return np.concatenate(outF), np.concatenate(outP), np.concatenate(outT)


def cut_section(tets, parent, X, geo, pool):
    """Section of the region's sub-tetrahedra by the plane x = 0: flat triangles, normal +x."""
    s = side(X, tets)
    polys, par = [], []
    for t in np.flatnonzero((s.min(1) < 0) & (s.max(1) > 0)):
        pts = [int(tets[t, k]) for k in range(4) if s[t, k] == 0]
        pts += [pool.edge(tets[t, a], tets[t, b]) for a, b in TET_EDGES if s[t, a] * s[t, b] < 0]
        if len(pts) >= 3:
            polys.append(pts); par.append(parent[t])
    # tetrahedra with a whole face on the plane: that face is a cut face when the region continues on x > 0
    three = (s == 0).sum(1) == 3
    zero_face = lambda rows: np.array([[tets[r, k] for k in range(4) if s[r, k] == 0] for r in rows]).reshape(-1, 3)
    neg, pos = np.flatnonzero(three & (s.min(1) < 0)), np.flatnonzero(three & (s.max(1) > 0))
    if len(neg) and len(pos):
        fn, fp = zero_face(neg), zero_face(pos)
        hit = np.isin(face_keys(fn, geo), face_keys(fp, geo))
        for r, f in zip(neg[hit], fn[hit]):
            polys.append([int(v) for v in f]); par.append(parent[r])
    tris, tp = [], []
    for pts, p in zip(polys, par):
        P = np.array([pool.point(v) for v in pts])[:, 1:]   # (y, z)
        c = P.mean(0)
        order = np.argsort(np.arctan2(P[:, 1] - c[1], P[:, 0] - c[0]))   # CCW in (y, z) -> normal +x
        pts = [pts[i] for i in order]
        for j in range(1, len(pts) - 1):
            tris.append((pts[0], pts[j], pts[j + 1])); tp.append(p)
    return np.array(tris, np.int64).reshape(-1, 3), np.array(tp, np.int64)


def smooth_normals(V, F, crease_deg=CREASE_DEG):
    """Area-weighted vertex normals, split where neighbouring faces meet at more than crease_deg.
    Returns new vertices, normals and faces (vertices duplicated along creases)."""
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    a2 = np.linalg.norm(fn, axis=1)
    fu = fn / np.where(a2 > 0, a2, 1)[:, None]
    nV, M = len(V), len(F)
    cv, cf = F.reshape(-1), np.repeat(np.arange(M), 3)
    order = np.argsort(cv, kind="stable")
    deg = np.bincount(cv, minlength=nV)
    start = np.concatenate([[0], np.cumsum(deg)[:-1]])
    inc = np.full((nV, deg.max()), -1, np.int64)
    inc[cv[order], np.arange(len(order)) - start[cv[order]]] = cf[order]
    cosc = math.cos(math.radians(crease_deg))
    cn = np.empty((3 * M, 3))
    for c0 in range(0, 3 * M, 60000):
        c1 = min(3 * M, c0 + 60000)
        g = inc[cv[c0:c1]]
        valid = g >= 0
        g = np.where(valid, g, 0)
        w = valid & (np.einsum("cdk,ck->cd", fu[g], fu[cf[c0:c1]]) >= cosc)
        cn[c0:c1] = np.einsum("cd,cdk->ck", w, fn[g])
    ln = np.linalg.norm(cn, axis=1)
    bad = ln == 0
    cn[bad] = fu[cf[bad]]
    cn = (cn / np.where(bad, 1, ln)[:, None]).astype(np.float32)
    key = np.column_stack([cv.astype(np.int64), cn.view(np.int32).astype(np.int64)])
    uk, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return V[cv[first]], cn[first], inv.reshape(-1).reshape(M, 3)


def drop_degenerate(F, *per_face, coords):
    P = coords(F)
    a2 = np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1)
    ok = a2 > 0
    return (F[ok],) + tuple(x[ok] for x in per_face)


def assemble(skin, cut, pool):
    """skin/cut: (faces as pool ids, parent element row, tag). Skin gets crease-smoothed normals, cut faces
    flat +x normals and their own vertices. Faces are sorted by tag; returns arrays and tag groups."""
    F, par, tag = drop_degenerate(*skin, coords=pool.coords)
    order = np.argsort([TAG_ORDER.index(t) for t in tag], kind="stable")
    F, par, tag = F[order], par[order], tag[order]
    ids, inv = np.unique(F, return_inverse=True)
    V, N, Fl = smooth_normals(pool.coords(ids), inv.reshape(-1, 3))
    if cut is not None and len(cut[0]):
        Fc, pc = drop_degenerate(*cut, coords=pool.coords)
        idc, invc = np.unique(Fc, return_inverse=True)
        V = np.vstack([V, pool.coords(idc)])
        N = np.vstack([N, np.tile(np.float32([1, 0, 0]), (len(idc), 1))])
        Fl = np.vstack([Fl, invc.reshape(-1, 3) + (len(V) - len(idc))])
        par = np.concatenate([par, pc])
        tag = np.concatenate([tag, np.full(len(Fc), TAG_CUT)])
    groups = []
    for t in TAG_ORDER:
        idx = np.flatnonzero(tag == t)
        if len(idx):
            groups.append(dict(tag=int(t), meaning=FACE_TAGS[t], first_face=int(idx[0]), n_faces=int(len(idx))))
    return V, N, Fl, par, tag, groups


def build_surfaces(X, sets, zmid):
    """All parts, full and half, as {name: (V, N, F, parent element row, tag, groups)}."""
    geo = np.full(len(X), -1, np.int64)
    _, inv = np.unique(X[1:], axis=0, return_inverse=True)
    geo[1:] = inv.reshape(-1)
    regions = {}
    for name in REGION_CODE:
        labels, conn = sets[name]
        tets, parent = sub_tets(conn)
        F, par, key = boundary_faces(tets, parent, X, geo)
        regions[name] = dict(conn=conn, tets=tets, parent=parent, F=F, par=par, key=key,
                             tag=np.zeros(len(F), np.int64), cz=X[conn[:, :4]][..., 2].mean(1))
    interfaces = {}
    for a in REGION_CODE:
        for b in REGION_CODE:
            if a != b:
                hit = np.isin(regions[a]["key"], regions[b]["key"])
                regions[a]["tag"][hit] = REGION_CODE[b]
                if hit.any():
                    interfaces[f"{a}->{b}"] = int(hit.sum())
    parts = {"cortex_prox": ("KORTEKS", 1), "cortex_dist": ("KORTEKS", -1), "marrow_prox": ("ILIK", 1),
             "marrow_dist": ("ILIK", -1), "plate": ("PLAK", 0), "screws": ("VIDA", 0), "callus_hull": ("KALLUS", 0)}
    pool = VertexPool(X)
    out, tet_volume = {}, {}
    for part, (reg, half_z) in parts.items():
        r = regions[reg]
        emask = np.ones(len(r["conn"]), bool) if half_z == 0 else (half_z * (r["cz"] - zmid) > 0)
        fm, tm = emask[r["par"]], emask[r["parent"]]
        T = X[r["tets"][tm]]
        tet_volume[part] = float(np.abs(np.einsum("ij,ij->i", np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]),
                                                  T[:, 3] - T[:, 0])).sum() / 6)
        skin = (r["F"][fm], r["par"][fm], r["tag"][fm])
        out[part] = assemble(skin, None, pool)
        hs = clip_skin(*skin, X, pool)
        hc = cut_section(r["tets"][tm], r["parent"][tm], X, geo, pool)
        if part == "callus_hull":
            out["callus_hull_half"] = assemble(hs, None, pool)
            ones = np.full(len(hc[0]), TAG_CUT)
            V, N, F, par, tag, groups = assemble((hc[0], hc[1], ones), None, pool)
            N[:] = np.float32([1, 0, 0])                 # flat: the cut is planar, keep exact +x
            out["callus_cut"] = (V, N, F, par, tag, groups)
        else:
            out[part + "_half"] = assemble(hs, hc, pool)
    return out, interfaces, tet_volume


def mesh_volume(V, F):
    """Enclosed volume by the divergence theorem (positive when the triangles face outward)."""
    return float(np.einsum("ij,ij->i", V[F[:, 0]], np.cross(V[F[:, 1]], V[F[:, 2]])).sum() / 6)


def open_edges(V, F):
    """Edges not shared by exactly two triangles, vertices matched by position (creases split vertices)."""
    _, vid = np.unique(V, axis=0, return_inverse=True)
    Fv = vid.reshape(-1)[F]
    e = np.sort(np.concatenate([Fv[:, [0, 1]], Fv[:, [1, 2]], Fv[:, [2, 0]]]), axis=1)
    _, c = np.unique(e, axis=0, return_counts=True)
    return int((c != 2).sum())


def write_surface(path, V, N, F, par, tag, groups, with_elem):
    arrays = [("position", V.astype("<f4"), "float32", "vertex position, mm, model frame"),
              ("normal", N.astype("<f4"), "float32", "unit vertex normal, model frame (smooth per part with "
               f"{CREASE_DEG:g} deg creases; flat +x on cut faces)"),
              ("index", F.astype("<u4"), "uint32", "triangle vertex indices, counter-clockwise seen from outside")]
    if with_elem:
        arrays.append(("element", par.astype("<u4"), "uint32",
                       "callus element of each triangle: 0-based row of elem_*.bin (= C3D10 label - 1)"))
    arrays.append(("face_tag", tag.astype("u1"), "uint8", "what is on the other side of each triangle (codes.face_tag)"))
    meta, off = {}, 0
    with open(path, "wb") as f:
        for name, arr, dt, meaning in arrays:
            meta[name] = dict(offset=off, dtype=dt, shape=list(arr.shape), meaning=meaning)
            f.write(arr.tobytes()); off += arr.nbytes
    return dict(bytes=off, n_vertices=int(len(V)), n_faces=int(len(F)), arrays=meta, face_groups=groups,
                bbox_mm=[V.min(0).round(4).tolist(), V.max(0).round(4).tolist()])


# ----------------------------------------------------------------------------- lattice day pass
PACK = np.zeros(256, np.uint32)
for _k, _c in enumerate(TISSUE):
    PACK[_c] = 1 << (5 * _k)
PACK[[c for c in range(1, 256) if c not in TISSUE]] = 1 << 20        # any other non-empty code
DOMINANT_ORDER = np.array([1, 5, 4, 2], np.uint8)   # tie-break: bone > chondrocyte > fibroblast > stem cell


def block_pass(L, callus_mask):
    """0.3 mm blocks of the callus lattice: per-code counts (5 fields of 5 bits in one uint32 sum)."""
    P = np.zeros((NBX * BLOCK, NBY * BLOCK, NBZ * BLOCK), np.uint8)
    np.copyto(P[:NX, :NY, :NZ], L, where=callus_mask)
    acc = np.empty((NBX, NBY, NBZ), np.uint32)
    for b0 in range(0, NBX, 41):
        b1 = min(NBX, b0 + 41)
        w = PACK[P[BLOCK * b0:BLOCK * b1]]
        w = w.reshape(-1, NBY * BLOCK, NBZ, BLOCK).sum(-1, dtype=np.uint32)
        w = w.reshape(-1, NBY, BLOCK, NBZ).sum(2, dtype=np.uint32)
        acc[b0:b1] = w.reshape(b1 - b0, BLOCK, NBY, NBZ).sum(1, dtype=np.uint32)
    acc = acc.reshape(-1)
    f = [((acc >> (5 * k)) & 31).astype(np.uint8) for k in range(5)]     # stem, bone, chondro, fibro, other
    filled = f[0] + f[1] + f[2] + f[3] + f[4]
    idx = np.flatnonzero(filled >= MIN_FILLED).astype(np.uint32)
    score = np.stack([f[0][idx] * 4, f[3][idx] * 4 + 1, f[2][idx] * 4 + 2, f[1][idx] * 4 + 3])
    code = DOMINANT_ORDER[np.argmax(score, axis=0)]
    exact = {c: int(f[k].sum(dtype=np.int64)) for k, c in enumerate(TISSUE)}
    exact["other"] = int(f[4].sum(dtype=np.int64))
    return idx, code, exact


def daily_modulus(code, elem, total, n):
    """Young_modulus_prop / Poison_ratio_prop of Update_model.cpp for one day, same arithmetic as
    site_stages.daily_modulus (checked bit for bit), with less memory: total is the static point count."""
    nb = np.bincount(elem[code == 2], minlength=n).astype(np.float64)
    nc = np.bincount(elem[code == 4], minlength=n).astype(np.float64)
    nf = np.bincount(elem[code == 5], minlength=n).astype(np.float64)
    t = np.where(total > 0, total, 1.0)
    rest = (total.astype(np.float32) - nf.astype(np.float32) - nb.astype(np.float32) - nc.astype(np.float32)).astype(np.float64)
    E = (nc * 10.0 / t) + (nf * 2.0 / t) + (nb * 17000.0 / t) + (rest * 0.2 / t)
    nu = (nc * 0.167 / t) + (nf * 0.167 / t) + (nb * 0.3 / t) + (rest * 0.167 / t)
    return E.astype(np.float32), nu.astype(np.float32)


def update_model_average(daily, t, empty, init, rest):
    """Young_mod_elem (or Poison_rat_elem) written by Update_model at iteration t: float32 sum of the daily
    values t, t-1, ... (at most 10, stopping at day 0; days 0-5 hold the 0.2 / 0.167 initial value of
    main.cpp), plus init * (10 - count) in double when fewer than 10 days exist, divided by 10."""
    s = np.zeros(len(empty), np.float32)
    i, count = t, 0
    while i >= 0 and count < 10:
        s = (s + (daily[i] if i >= 6 else np.float32(init))).astype(np.float32)
        count += 1; i -= 1
    if count <= 9:
        s = (s.astype(np.float64) + rest * (10 - count)).astype(np.float32)
    s = (s / np.float32(10)).astype(np.float32)
    s[empty] = np.float32(init)
    return s


def day_pass(run, n_days, e_days, vox_days, flat, elem, total, n_el, callus_mask, threads):
    e_set, v_set = set(e_days), set(vox_days)

    def work(t):
        L = ss.read_lattice(run, t)
        r = {"t": t}
        if t in e_set:
            r["E"], r["nu"] = daily_modulus(L.reshape(-1)[flat], elem, total, n_el)
        if t in v_set:
            r["idx"], r["code"], r["exact"] = block_pass(L, callus_mask)
        return r

    daily_E, daily_nu, vox = {}, {}, {}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=threads) as ex:
        for r in ex.map(work, range(n_days)):
            t = r["t"]
            if "E" in r:
                daily_E[t] = r["E"]
                if t >= n_days - 11:
                    daily_nu[t] = r["nu"]
            if "idx" in r:
                vox[t] = (r["idx"], r["code"], r["exact"])
            if t % 40 == 0:
                log(f"    day {t} ({time.time() - t0:.0f} s)")
    return daily_E, daily_nu, vox


def save_day_cache(p, daily_E, daily_nu, vox):
    ed, nd, vd = sorted(daily_E), sorted(daily_nu), sorted(vox)
    cnt = np.array([len(vox[d][0]) for d in vd])
    exact = np.array([[vox[d][2][c] for c in list(TISSUE) + ["other"]] for d in vd])
    np.savez(p, e_days=ed, E=np.stack([daily_E[d] for d in ed]), nu_days=nd, nu=np.stack([daily_nu[d] for d in nd]),
             vox_days=vd, vox_count=cnt, vox_idx=np.concatenate([vox[d][0] for d in vd]),
             vox_code=np.concatenate([vox[d][1] for d in vd]), vox_exact=exact)


def load_day_cache(p):
    with np.load(p) as zf:
        z = {k: zf[k] for k in zf.files}          # each zf[k] reads the whole array again: read once
    daily_E = {int(d): z["E"][i] for i, d in enumerate(z["e_days"])}
    daily_nu = {int(d): z["nu"][i] for i, d in enumerate(z["nu_days"])}
    vox, o = {}, 0
    for i, d in enumerate(z["vox_days"]):
        n = int(z["vox_count"][i])
        ex = dict(zip(list(TISSUE) + ["other"], (int(v) for v in z["vox_exact"][i])))
        vox[int(d)] = (z["vox_idx"][o:o + n], z["vox_code"][o:o + n], ex)
        o += n
    return daily_E, daily_nu, vox


# ----------------------------------------------------------------------------- load case
def read_nsets(path):
    sets, cur = {}, None
    for line in open(path):
        if line.startswith("*"):
            m = re.match(r"\*NSET,\s*NSET=(\w+)", line, re.I)
            cur = m.group(1) if m else None
            if cur:
                sets[cur] = []
        elif cur and not line.startswith("**"):
            sets[cur] += [int(v) for v in line.split(",") if v.strip()]
    return sets


def load_case(run, X, sets, R, t):
    inp = open(os.path.join(run, "without_scaffold.inp")).read()
    sab = open(os.path.join(run, "model_sablon.inp")).read()
    cl = {m.group(1): (int(m.group(2)), float(m.group(3)))
          for m in re.finditer(r"\*CLOAD\n(\w+),\s*(\d+),\s*([-+\d.eE]+)", inp)}
    m = re.search(r"\*RIGID BODY, NSET=(\w+), REF NODE=(\d+), ROT NODE=(\d+)", sab)
    ref, rot = int(m.group(2)), int(m.group(3))
    bcs = re.findall(r"\*BOUNDARY\n((?:[^*\n][^\n]*\n)+)", sab)
    ns = read_nsets(os.path.join(run, "model_sablon.inp"))
    scene = lambda p: (R @ np.asarray(p, float) + t).round(6).tolist()
    sdir = lambda v: (R @ np.asarray(v, float)).round(6).tolist()
    assert cl["REF"][0] == 3 and cl["ROT"][0] == 2, cl
    F, Mv = cl["REF"][1], cl["ROT"][1]
    pref = X[ref]
    # screws: cluster the VIDA nodes by z
    vn = np.unique(sets["VIDA"][1])
    P = X[vn]
    zs = np.sort(np.unique(P[:, 2].round(3)))
    cuts = np.flatnonzero(np.diff(zs) > 2.0)
    bounds = np.split(zs, cuts + 1)
    screws = []
    for b in bounds:
        q = P[(P[:, 2] >= b[0] - 1e-6) & (P[:, 2] <= b[-1] + 1e-6)]
        c = [0.5 * (q[:, 0].min() + q[:, 0].max()), 0.5 * (q[:, 2].min() + q[:, 2].max())]
        r_ = 0.25 * ((q[:, 0].max() - q[:, 0].min()) + (q[:, 2].max() - q[:, 2].min()))
        y0, y1 = q[:, 1].min(), q[:, 1].max()
        screws.append(dict(axis_model=[0.0, 1.0, 0.0], radius_mm=round(float(r_), 4),
                           head_model_mm=[round(c[0], 4), round(float(y1), 4), round(c[1], 4)],
                           tip_model_mm=[round(c[0], 4), round(float(y0), 4), round(c[1], 4)],
                           head_scene_mm=scene([c[0], y1, c[1]]), tip_scene_mm=scene([c[0], y0, c[1]]),
                           side="distal" if c[1] < 20 else "proximal"))
    pn = np.unique(sets["PLAK"][1]); PP = X[pn]
    dist, prox = X[ns["DISTAL"]], X[ns["PROKSIMAL"]]
    return dict(
        source="without_scaffold.inp (*CLOAD written by Update_model.cpp) and model_sablon.inp (*RIGID BODY, *BOUNDARY)",
        axial_force=dict(value_N=abs(F), vector_model_N=[0.0, 0.0, F], vector_scene_N=sdir([0, 0, F]),
                         application_point_model_mm=pref.tolist(), application_point_scene_mm=scene(pref),
                         note=f"CLOAD on node REF ({ref}), DOF 3: {F} N along the bone axis, i.e. compression pushing "
                              "the proximal end towards the clamp. REF is the reference node of a rigid body over the "
                              f"whole proximal end face (node set PROKSIMAL, {len(ns['PROKSIMAL'])} nodes at z = "
                              f"{prox[:, 2].mean():g} mm)."),
        bending_moment=dict(value_Nmm=Mv, axis_model=[0.0, 1.0, 0.0], axis_scene=sdir([0, 1, 0]),
                            vector_model_Nmm=[0.0, Mv, 0.0], vector_scene_Nmm=sdir([0, Mv, 0]),
                            application_point_model_mm=X[rot].tolist(), application_point_scene_mm=scene(X[rot]),
                            note=f"CLOAD on the rotational node ROT ({rot}), DOF 2 = rotation about +y: {Mv} N mm "
                                 "(right-hand rule) on the proximal rigid body. It bends the bone in the model x-z "
                                 "plane (scene x-y plane): sideways, perpendicular to the cut plane x = 0 and parallel "
                                 "to the plate surface."),
        clamp=dict(end="distal", node_set="DISTAL", n_nodes=len(ns["DISTAL"]), z_model_mm=float(dist[:, 2].mean()),
                   face_centre_model_mm=[0.0, 0.0, float(dist[:, 2].mean())],
                   face_centre_scene_mm=scene([0.0, 0.0, float(dist[:, 2].mean())]),
                   fixed="DOF 1-3 of every node on the distal end face (encastre for solid elements)"),
        proximal_constraints=dict(text="REF DOF 1, 2 fixed (no lateral translation); ROT DOF 3 fixed (no twist about "
                                       "the bone axis). Free: axial translation and the two bending rotations.",
                                  boundary_cards=[b.strip() for b in bcs]),
        screws=screws,
        plate=dict(bbox_model_mm=[PP.min(0).round(4).tolist(), PP.max(0).round(4).tolist()],
                   bone_facing_surface_y_mm=float(PP[:, 1].min()), outer_surface_y_mm=float(PP[:, 1].max()),
                   bonded_to_callus=bool(len(np.intersect1d(pn, np.unique(sets["KALLUS"][1]))))),
    )


# ----------------------------------------------------------------------------- main
def stats(v):
    return dict(min=float(np.min(v)), median=float(np.median(v)), max=float(np.max(v)))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--run", required=True, help="run folder")
    ap.add_argument("--out", required=True, help="output folder (film/assets/data)")
    ap.add_argument("--cache", default=os.path.expanduser("~/mechanobio_calculix/site_stages_cache"),
                    help="cache folder shared with site_stages.py (lattice-element map, day pass)")
    ap.add_argument("--threads", type=int, default=4, help="days processed in parallel (about 300 MB each)")
    a = ap.parse_args()
    t_start = time.time()
    run = os.path.abspath(os.path.expanduser(a.run))
    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    key = f"{os.path.basename(run)}_{os.path.getsize(os.path.join(run, 'element_file.txt'))}"
    cdir = os.path.join(a.cache, key)
    os.makedirs(cdir, exist_ok=True)
    verify = {}

    build = open(os.path.join(run, "derleme_bilgisi.txt")).read().strip()
    claes = "CLAES_HEIGELE_BASMA_POZITIF" in build
    stat_rows = [l.strip().split(",") for l in open(os.path.join(run, "istatistik.csv"))]
    stat_head, stat = stat_rows[0], {int(r[0]): dict(zip(stat_rows[0], map(int, r))) for r in stat_rows[1:]}
    n_days = len(stat)
    fe_days = [t for t in range(n_days) if 5 < t < n_days - 1 and t % 3 == 0]          # main.cpp
    um_days = [t for t in range(n_days) if 5 < t < n_days - 1]                          # Update_model calls
    inp_day, fe_last = um_days[-1], fe_days[-1]
    vox_days = list(range(0, fe_last + 1, 3)) + [n_days - 1]
    seed = re.search(r"Random number seed: (\d+)", open(os.path.join(run, "kosu_log.txt")).read()).group(1)
    log(f"run {run}\n  build: {build}; seed {seed}; days 0..{n_days - 1}; FE days {fe_days[0]}..{fe_last} "
        f"({len(fe_days)}); .inp from day {inp_day}")

    # ---- mesh
    X, sets = ss.read_inp_mesh(os.path.join(run, "model_sablon.inp"))
    labels, conn = sets["KALLUS"]
    n_el = len(labels)
    assert (labels == np.arange(1, n_el + 1)).all()
    assert (conn == ss.read_callus_elements(run)).all(), "element_file.txt and model_sablon.inp differ"
    kc = X[sets["KORTEKS"][1][:, :4]].reshape(-1, 3)
    z_dist_end, z_prox_end = kc[kc[:, 2] < 20, 2].max(), kc[kc[:, 2] > 20, 2].min()
    zmid = 0.5 * (z_dist_end + z_prox_end)
    axis_xy = 0.5 * (kc[:, :2].min(0) + kc[:, :2].max(0))
    centre = np.array([axis_xy[0], axis_xy[1], zmid])
    log(f"  mesh: {len(X) - 1} nodes, " + ", ".join(f"{k} {len(v[0])}" for k, v in sets.items())
        + f"; gap z {z_dist_end:g}..{z_prox_end:g}, centre {centre.round(4).tolist()}")
    # scene frame: y = bone axis (proximal up), z = plate side (+y model), x = y_scene x z_scene; proper rotation
    R = np.array([[-1.0, 0, 0], [0, 0, 1.0], [0, 1.0, 0]])
    tvec = -R @ centre
    assert abs(np.linalg.det(R) - 1) < 1e-12

    # ---- surfaces
    t0 = time.time()
    surfs, interfaces, tet_volume = build_surfaces(X, sets, zmid)
    verify["surface_interfaces"] = interfaces
    pairs_ok = all(interfaces.get(f"{b}->{a}") == n for k, n in interfaces.items() for a, b in [k.split("->")])
    assert pairs_ok, interfaces
    files = {}
    for name, (V, N, F, par, tag, groups) in surfs.items():
        p = os.path.join(out, f"surf_{name}.bin")
        files[os.path.basename(p)] = dict(kind="surface", part=name, **write_surface(p, V, N, F, par, tag, groups,
                                                                                       name.startswith("callus")))
    # geometry checks: closed, outward, volume = sub-tetrahedra volume; half (with its cut faces) = half the volume
    geom = {}
    for name in ("cortex_prox", "cortex_dist", "marrow_prox", "marrow_dist", "plate", "screws", "callus_hull"):
        V, _, F = surfs[name][:3]
        if name == "callus_hull":
            Vh = np.vstack([surfs["callus_hull_half"][0], surfs["callus_cut"][0]])
            Fh = np.vstack([surfs["callus_hull_half"][2], surfs["callus_cut"][2] + len(surfs["callus_hull_half"][0])])
        else:
            Vh, Fh = surfs[name + "_half"][0], surfs[name + "_half"][2]
        vs, vh = mesh_volume(V, F), mesh_volume(Vh, Fh)
        geom[name] = dict(open_edges=open_edges(V, F), open_edges_half_with_cut=open_edges(Vh, Fh),
                          volume_mm3=round(vs, 3), volume_rel_diff_vs_tetrahedra=float(abs(vs / tet_volume[name] - 1)),
                          half_over_full_volume=round(vh / vs, 5))
        assert geom[name]["open_edges"] == 0 and geom[name]["open_edges_half_with_cut"] == 0, (name, geom[name])
        assert geom[name]["volume_rel_diff_vs_tetrahedra"] < 1e-9 and vs > 0, (name, geom[name])
    verify["surface_geometry"] = geom
    cut = surfs["callus_cut"]
    verify["callus_cut_max_abs_x_mm"] = float(np.abs(cut[0][:, 0]).max())
    log(f"  surfaces: {len(surfs)} files in {time.time() - t0:.0f} s")
    for k, v in geom.items():
        log(f"    {k}: {v}")

    # ---- lattice -> element map (Lattice_point_in_element.cpp), checked against kesit_eleman.bin
    nodes = ss.read_nodes_float32(run)
    gmin, lo, hi = ss.callus_bounds(nodes, conn)
    p = os.path.join(cdir, "lattice_element_map.npy")
    if os.path.exists(p):
        lpe = np.load(p)
    else:
        log("  computing the lattice-element map (slow, cached afterwards)")
        lpe = ss.lattice_element_map(nodes, conn, gmin, lo, hi); np.save(p, lpe)
    sx, sy, sz = ss.read_section_map(run)
    diff = int((lpe[180] != sx).sum() + (lpe[:, 180] != sy).sum() + (lpe[:, :, 200] != sz).sum())
    assert diff == 0
    verify["lattice_element_map_vs_kesit_eleman_bin"] = f"{diff} differing points on the 3 planes"
    callus_mask = lpe > 0
    n_callus = int(callus_mask.sum())
    assert n_callus == stat[0]["kallus_nokta"]
    flat, elem = ss.counted_points(lpe, lo, hi)
    del lpe
    flat = flat.astype(np.int32)
    total = np.bincount(elem, minlength=n_el).astype(np.float64)
    empty = total == 0
    log(f"  lattice: {n_callus} callus points (= istatistik.csv), {len(flat)} counted by Update_model, "
        f"{int(empty.sum())} elements without lattice points, gmin {gmin.tolist()}")

    # ---- day pass (streamed), or its cache
    cp = os.path.join(cdir, "film_day_pass.npz")
    e_days = [t for t in range(6, inp_day + 1)]
    if os.path.exists(cp):
        log(f"  day pass from cache {cp}")
        daily_E, daily_nu, vox = load_day_cache(cp)
    else:
        log(f"  day pass over {n_days} lattices with {a.threads} threads")
        daily_E, daily_nu, vox = day_pass(run, n_days, e_days, vox_days, flat, elem, total, n_el, callus_mask, a.threads)
        save_day_cache(cp, daily_E, daily_nu, vox)
    assert sorted(vox) == vox_days and sorted(daily_E) == e_days

    # lean daily modulus == site_stages.daily_modulus, bit for bit (one day)
    chk = fe_last
    E_ss, nu_ss, empty_ss = ss.daily_modulus(ss.read_lattice(run, chk), flat, elem, n_el)
    assert np.array_equal(E_ss, daily_E[chk]) and np.array_equal(nu_ss, daily_nu[chk]) and np.array_equal(empty_ss, empty)
    verify["daily_modulus_vs_site_stages"] = f"day {chk}: identical bits for all {n_el} elements"
    del flat, elem

    # ---- E for every FE day (Update_model.cpp), checked against the day-inp_day without_scaffold.inp
    E_inp = update_model_average(daily_E, inp_day, empty, 0.2, 0.2)
    nu_inp = update_model_average(daily_nu, inp_day, empty, 0.167, 0.167)
    ref = ss.read_inp_callus_materials(os.path.join(run, "without_scaffold.inp"), n_el)
    bad = sum(r != m for r, m in zip(ref, ss.cpp_text(E_inp, nu_inp)))
    assert bad == 0, bad
    verify["E_nu_vs_without_scaffold_inp"] = f"day {inp_day}: {bad} of {n_el} elements differ (text of E, nu)"
    E_days = np.stack([update_model_average(daily_E, d, empty, 0.2, 0.2) for d in fe_days])
    # site_stages.averaged_modulus agrees for the last FE day (it uses cached daily lattice moduli)
    E_ss_last, _ = ss.averaged_modulus(run, fe_last, None, None, n_el, cdir) if all(
        os.path.exists(os.path.join(cdir, f"daily_modulus_{t}.npz")) for t in range(fe_last - 9, fe_last + 1)) else (None, None)
    if E_ss_last is not None:
        assert np.array_equal(E_ss_last, E_days[-1])
        verify["E_last_FE_day_vs_site_stages_averaged_modulus"] = f"day {fe_last}: identical"
    q = np.clip(np.rint(np.log(np.clip(E_days, E_LO, E_HI) / E_LO) / math.log(E_HI / E_LO) * 65535), 0, 65535).astype("<u2")
    back = E_LO * (E_HI / E_LO) ** (q.astype(np.float64) / 65535)
    rel = float(np.max(np.abs(back / np.clip(E_days, E_LO, E_HI) - 1)))
    verify["E_uint16_roundtrip_max_relative_error"] = rel
    verify["E_outside_mapping_range"] = int(((E_days < E_LO * (1 - 1e-6)) | (E_days > E_HI * (1 + 1e-6))).sum())

    # ---- day-fe_last strain, pressure and class (Read_stimulus.cpp), checked against stimulus_N.bin
    ep, hp = ss.read_dat(os.path.join(run, "without_scaffold.dat"), n_el)
    st = ss.classify(ep, hp, claes).astype(np.uint8)
    ref_st = np.fromfile(os.path.join(run, f"stimulus_{fe_last + 1}.bin"), np.int8)
    bad = int((ref_st != st).sum())
    assert bad == 0
    verify["class_vs_stimulus_bin"] = f"stimulus_{fe_last + 1}.bin (the day-{fe_last} solve): {bad} of {n_el} differ"
    st_csv = {1: "uyaran_rezorpsiyon", 2: "uyaran_kemik", 4: "uyaran_kikirdak", 5: "uyaran_fibroz"}
    assert all(int((st == c).sum()) == stat[fe_last + 1][k] for c, k in st_csv.items())

    # ---- element files
    cen = X[conn[:, :4]].mean(1).astype("<f4")
    elem_arrays = {
        "elem_centroid.bin": (cen, "float32", "mm", "centroid of each callus element (mean of its 4 corner nodes), model frame"),
        "elem_E_days.bin": (q, "uint16", "MPa via mapping",
                            "Young's modulus of each callus element in each FE solve (row = fe_days index), "
                            "rule of mixtures + 10-day average of Update_model.cpp, log-mapped to uint16"),
        f"elem_strain_{fe_last}.bin": (ep.astype("<f4"), "float32", "strain (fraction, 1 = 100 %)",
                                       f"minimum principal strain, mean of the 4 integration points, day-{fe_last} solve "
                                       "(signed; negative = compression)"),
        f"elem_hp_{fe_last}.bin": (hp.astype("<f4"), "float32", "MPa",
                                   f"hydrostatic pressure HP = -(s11+s22+s33)/3, mean of the 4 integration points, day-{fe_last} "
                                   "solve, compression positive (Read_stimulus.cpp)"),
        f"elem_class_{fe_last}.bin": (st, "uint8", "code", f"Read_stimulus.cpp class of each element from the day-{fe_last} "
                                      "solve; drives days {}-{} (codes.stimulus_class)".format(fe_last + 1, fe_last + 2)),
    }
    for fn, (arr, dt, unit, meaning) in elem_arrays.items():
        arr.tofile(os.path.join(out, fn))
        files[fn] = dict(kind="element_field", dtype=dt, shape=list(arr.shape), units=unit, meaning=meaning, bytes=arr.nbytes)
    files["elem_E_days.bin"]["decode"] = dict(
        formula="E_MPa = 0.2 * Math.pow(17000 / 0.2, q / 65535)", E_min_MPa=E_LO, E_max_MPa=E_HI,
        encode="q = round(65535 * ln(E / 0.2) / ln(17000 / 0.2)), clipped to 0..65535",
        max_relative_error=rel, row_days="fe_schedule.fe_days")

    # ---- voxels
    block_mm3 = (BLOCK * CELL) ** 3
    vox_meta, comp = {}, {}
    with open(os.path.join(out, "vox_days.bin"), "wb") as f:
        for d in vox_days:
            idx, code, exact = vox[d]
            off = f.tell(); assert off % 4 == 0
            f.write(idx.astype("<u4").tobytes()); f.write(code.astype("u1").tobytes())
            f.write(b"\0" * (-f.tell() % 4))
            nb = {TISSUE_NAME[c]: int((code == c).sum()) for c in TISSUE}
            vox_meta[str(d)] = dict(offset=off, count=int(len(idx)), code_offset=off + 4 * len(idx), blocks_per_code=nb,
                                    block_volume_mm3={k: round(v * block_mm3, 3) for k, v in nb.items()},
                                    lattice_volume_mm3={TISSUE_NAME[c]: round(exact[c] * CELL ** 3, 3) for c in TISSUE})
            s = stat[d]
            assert [exact[1], exact[2], exact[4], exact[5]] == [s["MSC"], s["kemik"], s["kikirdak"], s["fibroz"]], d
            assert exact["other"] == 0, d
            comp[d] = {TISSUE_NAME[c]: (round(nb[TISSUE_NAME[c]] * block_mm3 / (s[k] * CELL ** 3), 4) if s[k] else None)
                       for c, k in zip(TISSUE, ("MSC", "kemik", "kikirdak", "fibroz"))}
        vox_bytes = f.tell()
    verify["voxel_lattice_totals_vs_istatistik_csv"] = (f"all {len(vox_days)} sampled days: the per-code lattice point counts "
                                                         "inside the callus equal istatistik.csv exactly")
    verify["voxel_block_volume_over_istatistik_volume"] = {str(d): comp[d] for d in (0, 30, 90, 180, 357, vox_days[-1]) if d in comp}
    vox_index = dict(
        file="vox_days.bin",
        layout=("for each day: uint32 block_index[count] at offset, then uint8 code[count] at code_offset, then zero "
                "padding to a multiple of 4 bytes; offsets in bytes from the start of the file"),
        grid="manifest.voxels.grid", days=vox_meta)
    json.dump(vox_index, open(os.path.join(out, "vox_index.json"), "w"), indent=1)
    files["vox_days.bin"] = dict(kind="voxels", bytes=vox_bytes, index="vox_index.json",
                                 arrays={"block_index": dict(dtype="uint32", meaning="flat block index into voxels.grid"),
                                         "code": dict(dtype="uint8", meaning="dominant non-empty lattice code of the block "
                                                                             "(codes.lattice: 1, 2, 4 or 5)")})
    files["vox_index.json"] = dict(kind="index", meaning="day -> offset, count and tissue totals of vox_days.bin")

    # ---- manifest
    lc = load_case(run, X, sets, R, tvec)
    Rq = [0.0, math.sqrt(0.5), math.sqrt(0.5), 0.0]   # 180 deg about (0, 1, 1)/sqrt(2): equals R
    rows = np.vstack([np.column_stack([R, tvec]), [0, 0, 0, 1]])
    pl = lc["plate"]["bbox_model_mm"]
    manifest = dict(
        format="SG-Bone film assets 1", generator="long_bone/araclar/film_export.py",
        created=time.strftime("%Y-%m-%d %H:%M:%S"), endianness="little",
        run=dict(folder=run, label=f"{os.path.basename(run)}: plate {'bonded' if lc['plate']['bonded_to_callus'] else 'unbonded'}, "
                 f"{'Claes-Heigele' if claes else 'original'} stimulus sign, seed {seed}, {n_days} days",
                 build=build, seed=int(seed), n_days=n_days, claes_heigele_sign=claes,
                 plate_bonded_to_callus=lc["plate"]["bonded_to_callus"]),
        units=dict(length="mm", E="MPa", stress="MPa", force="N", moment="N mm", strain="fraction (0.01 = 1 %)",
                   volume="mm^3", time="simulated day"),
        model_frame=dict(
            bone_axis=f"z (x = {axis_xy[0]:g}, y = {axis_xy[1]:g}); proximal end z = {X[1:, 2].max():g} (loaded), distal end "
                      f"z = {X[1:, 2].min():g} (clamped)",
            defect=f"z = {z_dist_end:g} to {z_prox_end:g} mm, centre {centre.tolist()}",
            plate=f"on +y: x {pl[0][0]:g}..{pl[1][0]:g}, y {pl[0][1]:g}..{pl[1][1]:g} (bone-facing face y = {pl[0][1]:g}, "
                  f"0.5 mm off the cortex at y = 8.5), z {pl[0][2]:g}..{pl[1][2]:g}",
            cortex="elliptic tube, outer half axes 7.5 (x) x 8.5 (y) mm, marrow 3.75 x 4.4 mm",
            callus="z 0..40 mm, revolved circular arc, radius 9 mm at z = 0 and 40 and 18 mm at z = 20, minus the bone ends "
                   "and the box above the plate (|x| < 6.8, y > 9)",
            lattice=dict(shape=[NX, NY, NZ], spacing_mm=CELL, origin_mm=[float(v) for v in gmin],
                         point_mm="(x, y, z) = origin + 0.1 * (i, j, k); the origin is the callus mesh min corner "
                                  "(Calculate_lattice.cpp), so the bone axis is i = j = 180 and the defect centre k = 200"),
            half_model="*_half files keep x <= 0 (scene x >= 0), cut by the plane x = 0, which contains the bone axis "
                       "and the plate normal (y) and so is perpendicular to the plate; cut faces have normal +x"),
        scene_transform=dict(
            meaning="scene = R * model + t (mm). Scene: y up along the bone axis with proximal up, the defect centre at the "
                    "origin, the plate on +z; x = y cross z (a proper rotation, no mirroring, so winding and handedness are kept)",
            R=R.tolist(), t=tvec.tolist(), matrix_rows=rows.tolist(),
            three_matrix4_elements=rows.T.reshape(-1).tolist(),
            three_object3d=dict(quaternion_xyzw=Rq, position=tvec.tolist(),
                                usage="group.quaternion.set(0, Math.SQRT1_2, Math.SQRT1_2, 0); group.position.set(0, -20, 0); "
                                      "add every part, voxel and centroid to this group; normals follow automatically"),
            per_axis="scene.x = -model.x, scene.y = model.z - 20, scene.z = model.y",
            camera_hint=dict(position=[-160.0, 0.0, 0.0], target=[0.0, 0.0, 0.0], up=[0.0, 1.0, 0.0],
                             note="looking along +x at the cut face (its normal maps to scene -x); screen right is +z, "
                                  "so the plate is on the right and proximal is up. A three-quarter view moves the "
                                  "camera towards +z."),
            not_the_cell_viewer_mapping="hucre3b.html maps lattice (x, y, z) -> (x, z - 20, y): a mirror image (det -1) of "
                                        "this transform; x has the opposite sign"),
        codes=dict(lattice={str(k): v for k, v in LATTICE_CODES.items()},
                   voxel_codes_present=[int(c) for c in TISSUE],
                   stimulus_class={str(k): v for k, v in STIMULUS_CLASSES.items()},
                   stimulus_thresholds=dict(ss.THRESH, rule=(
                       "first match wins: resorption |HP| < 0.0016 and |eps| < 0.0004; bone |HP| < 0.15 and |eps| < 0.05; "
                       + ("cartilage HP > 0.15" if claes else "cartilage HP < -0.15 (hydrostatic tension, the original sign)")
                       + " and |eps| < 0.15; fibrous otherwise")),
                   face_tag={str(k): v for k, v in FACE_TAGS.items()},
                   region_material_MPa=dict(cortex=[17000.0, 0.3], marrow=[2.0, 0.167], plate=[210000.0, 0.3],
                                            screws=[210000.0, 0.3])),
        fe_schedule=dict(
            fe_days=fe_days, n=len(fe_days),
            rule="main.cpp: CalculiX runs once before day 0 with every callus element at 0.2 MPa, then on every iteration "
                 f"t with 5 < t < {n_days - 1} and t % 3 == 0. The solve on day t uses the moduli Update_model writes on "
                 "day t (lattices t-9..t) and sets the stimulus of days t+1..t+3.",
            initial_solve="before day 0, E = 0.2 MPa everywhere (not stored; elem_E_days row 0 is day 6)",
            update_model_days=f"{um_days[0]}..{um_days[-1]} (every day; only every third one is solved)",
            last_solve=f"day {fe_last}: without_scaffold.dat; without_scaffold.inp is the unsolved day-{inp_day} input"),
        surfaces=dict(
            method=("boundary faces of the C3D10 elements of each region; each 6-node face is split into 4 flat "
                    "triangles through its mid-side nodes (curved geometry as CalculiX sees it). Half parts: the "
                    "triangles are clipped to x <= 0 and the section of the region's sub-tetrahedra by x = 0 is added "
                    "as flat cut faces (tag 255). callus_hull_half has no cut faces: they are callus_cut."),
            parts=dict(cortex_prox="KORTEKS, z > 20", cortex_dist="KORTEKS, z < 20", marrow_prox="ILIK, z > 20",
                       marrow_dist="ILIK, z < 20", plate="PLAK", screws="VIDA (6 screws)",
                       callus_hull="KALLUS, its whole closed boundary; face group tag 0 is the outer skin, tags 2-4 "
                                   "are the faces against the bone ends and the plate"),
            note="faces are sorted by face_tag; face_groups give the ranges (THREE.BufferGeometry.addGroup(first*3, n*3, m))"),
        voxels=dict(
            grid=dict(shape=[NBX, NBY, NBZ], block_mm=BLOCK * CELL, lattice_points_per_block=BLOCK,
                      index="block_index = (bi * %d + bj) * %d + bk" % (NBY, NBZ),
                      decode_js="bk = idx %% %d; bj = Math.floor(idx / %d) %% %d; bi = Math.floor(idx / %d)" % (NBZ, NBZ, NBY, NBY * NBZ),
                      centre_model_mm="(x, y, z) = (%g, %g, %g) + 0.1 * (3 * (bi, bj, bk) + 1)" % tuple(float(v) for v in gmin),
                      covers="lattice points i = 3 bi .. 3 bi + 2 (same for j, k); the last blocks are partial",
                      cut_note="blocks bi <= 59 lie in x < 0 (their +x face is at x = -0.05 mm)"),
            days=vox_days, rule=(f"only lattice points inside the callus (lattice-element map != 0); a block is stored when "
                                 f">= {MIN_FILLED} of its 27 points are non-empty; code = the most frequent non-empty code, "
                                 "ties to bone > chondrocyte > fibroblast > stem cell"),
            block_volume_mm3=block_mm3),
        element_fields=dict(n_elements=n_el, element_index="0-based row = C3D10 label - 1 (labels 1..%d, KALLUS)" % n_el,
                            empty_elements=int(empty.sum())),
        load_case=lc,
        files=files,
        verification=verify,
    )
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), indent=1)

    # ---- summary
    di = {d: fe_days.index(d) for d in (9, 90, 180, fe_last) if d in fe_days}
    summary = dict(
        run=manifest["run"]["label"], n_callus_elements=n_el, n_mesh_nodes=int(len(X) - 1),
        surfaces={k: dict(vertices=v["n_vertices"], faces=v["n_faces"]) for k, v in files.items() if v["kind"] == "surface"},
        voxel_blocks_per_day={str(d): vox_meta[str(d)]["count"] for d in vox_days},
        voxel_blocks_per_code_last_days={str(d): vox_meta[str(d)]["blocks_per_code"] for d in (fe_last, vox_days[-1])},
        E_MPa={str(d): stats(E_days[i]) for d, i in di.items()},
        strain_day=fe_last, min_principal_strain=stats(ep), abs_min_principal_strain=stats(np.abs(ep)),
        hydrostatic_pressure_MPa=stats(hp),
        class_counts={STIMULUS_CLASSES[c] + f" ({c})": int((st == c).sum()) for c in (1, 2, 4, 5)},
        voxel_block_over_lattice_volume=verify["voxel_block_volume_over_istatistik_volume"],
        verification=verify, seconds=round(time.time() - t_start, 1))
    json.dump(summary, open(os.path.join(out, "summary.json"), "w"), indent=1)
    total_bytes = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
    log(f"  wrote {len(os.listdir(out))} files, {total_bytes / 1e6:.1f} MB, in {time.time() - t_start:.0f} s")


if __name__ == "__main__":
    main()
