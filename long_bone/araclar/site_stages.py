"""Six stage images of the SG-Bone feedback loop for the website scroll story.

Every pixel comes from the output of one run (lattice_N.raw[.zst], without_scaffold.dat,
without_scaffold.inp, kesit_eleman.bin, stimulus_N.bin) and from that run's own mesh
(model_sablon.inp). Nothing is drawn by hand except the two load arrows of stage 1.

Usage (from the repo root; needs numpy, matplotlib, Pillow, and zstandard for .zst lattices):
  python3 long_bone/araclar/site_stages.py --run <run folder> --out site/assets/stages \
      [--cache <folder>] [--early-day 9] [--palette]

Stages (1 to 5 share one frame: section x = 0, 60 x 60 mm centred on the defect)
  1  defect and load: section of the FE mesh (quadratic tetrahedra split into 8) + load arrows
  2  cells arrive: lattice plane i = 180 (x = 0) on --early-day over the same section
  3  tissue forms: lattice plane on the day of the last CalculiX solve
  4  stiffness: Young's modulus of every element in that solve, rebuilt from the lattices with the
     rule of mixtures and 10-day average of Update_model.cpp (checked against without_scaffold.inp)
  5  strain: |minimum principal strain| per callus element of that solve (without_scaffold.dat)
  6  decision plane: |min principal strain| vs hydrostatic pressure of every callus element,
     with the exact thresholds of Read_stimulus.cpp (checked against stimulus_N.bin)

The C++ rules are re-implemented in numpy with the same float32/float64 arithmetic, and each
one is checked against a file the C++ program wrote; the script stops if a check fails.
Only the last solve of a run can be drawn, because run.sh keeps only the newest .dat.
"""
import argparse, json, math, os, re, time
import numpy as np

NX, NY, NZ = 361, 361, 401          # header.h LATTICE_X/Y/Z
CELL = np.float32(0.1)              # header.h CELL_DIAMETER (float)
IPS = 4                             # header.h IPS_PER_ELEM
FIRST_CALLUS = 1                    # header.h FIRST_CALLUS_ELEMENT

# ----------------------------------------------------------------------------- colours
def oklch_to_hex(L, C, h):
    """OKLCH (L in 0..1) -> sRGB hex, Bjoern Ottosson's OKLab matrices, gamut checked."""
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
    if min(lin) < -1e-4 or max(lin) > 1 + 1e-4:
        raise ValueError(f"oklch({L} {C} {h}) is outside sRGB")
    enc = [12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055 for v in (min(max(x, 0), 1) for x in lin)]
    return "#" + "".join(f"{round(v * 255):02x}" for v in enc)

OKLCH = {  # name: (L, C, h); site tokens (site/tokens.css) and the figure colours
    "paper":      (0.14, 0.048, 264),   # page paper, must be #02071d
    "paper-2":    (0.185, 0.052, 264),
    "paper-3":    (0.23, 0.055, 264),   # empty callus (granulation tissue); low end of the field maps
    "ink":        (0.95, 0.016, 250),   # new bone; high end of the field maps
    "ink-2":      (0.88, 0.05, 245),    # load arrows
    "muted":      (0.73, 0.04, 256),    # key and tick text
    "rule":       (0.40, 0.06, 262),    # plate and screws, chart rules
    "accent":     (0.80, 0.11, 230),    # cartilage
    "accent-2":   (0.58, 0.10, 236),    # stem cells (MSC); middle of the field maps
    "fibrous":    (0.62, 0.07, 285),    # fibrous tissue
    "cortex":     (0.50, 0.03, 260),    # intact cortical bone
    "marrow":     (0.31, 0.035, 258),   # marrow
    "resorption": (0.50, 0.02, 256),    # decision plane: resorption zone
}
HEX = {k: oklch_to_hex(*v) for k, v in OKLCH.items()}
assert HEX["paper"] == "#02071d", HEX["paper"]

def rgb(name):
    h = HEX[name]
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255

# ----------------------------------------------------------------------------- run files
def read_lattice(run, day):
    p = os.path.join(run, f"lattice_{day}.raw")
    if os.path.exists(p):
        raw = open(p, "rb").read()
    elif os.path.exists(p + ".zst"):
        import zstandard
        raw = zstandard.ZstdDecompressor().decompress(open(p + ".zst", "rb").read())
    else:
        raise FileNotFoundError(p)
    assert len(raw) == NX * NY * NZ, f"{p}: {len(raw)} bytes"
    return np.frombuffer(raw, np.uint8).reshape(NX, NY, NZ)

def read_section_map(run):
    """kesit_eleman.bin (main.cpp): lattice_point_element on the planes i=180 (j,k), j=180 (i,k), k=200 (i,j)."""
    v = np.fromfile(os.path.join(run, "kesit_eleman.bin"), np.int32)
    return v[:NY * NZ].reshape(NY, NZ), v[NY * NZ:NY * NZ + NX * NZ].reshape(NX, NZ), v[NY * NZ + NX * NZ:].reshape(NX, NY)

def read_nodes_float32(run):
    """node_file.txt as Read_node_file.cpp reads it (float)."""
    d = np.loadtxt(os.path.join(run, "node_file.txt"), delimiter=",", dtype=np.float64)
    nodes = np.full((int(d[:, 0].max()), 3), 999999, np.float32)
    nodes[d[:, 0].astype(int) - 1] = d[:, 1:4].astype(np.float32)
    return nodes

def read_callus_elements(run):
    d = np.loadtxt(os.path.join(run, "element_file.txt"), delimiter=",", dtype=np.int64)
    return d[:, 1:11]

def read_inp_mesh(path):
    """All nodes and C3D10 element sets of model_sablon.inp: (coords[float64, label-1], {set: (labels, conn)})."""
    nodes, sets, cur, mode = {}, {}, None, None
    with open(path) as f:
        for line in f:
            if line.startswith("**"):
                continue
            if line.startswith("*"):
                kw = line.upper()
                if kw.startswith("*NODE") and "PRINT" not in kw:
                    mode = "node"
                elif kw.startswith("*ELEMENT"):
                    mode, cur = "elem", re.search(r"ELSET=(\w+)", kw).group(1)
                    sets.setdefault(cur, [])
                else:
                    mode = None
                continue
            if mode == "node":
                p = line.split(",")
                nodes[int(p[0])] = (float(p[1]), float(p[2]), float(p[3]))
            elif mode == "elem":
                sets[cur].append([int(x) for x in line.split(",")])
    X = np.zeros((max(nodes) + 1, 3))
    for k, v in nodes.items():
        X[k] = v
    return X, {k: (np.array(v)[:, 0], np.array(v)[:, 1:]) for k, v in sets.items()}

# ----------------------------------------------------------------------------- C++ rules in numpy
def callus_bounds(nodes, elems):
    """Calculate_lattice.cpp (Global_min) and Extremes_element.cpp (index box per element)."""
    pos = nodes[elems - 1]                                    # (E, 10, 3) float32
    gmin = pos.reshape(-1, 3).min(axis=0)
    emin, emax = pos.min(axis=1), pos.max(axis=1)
    def idx(v):  # int(((v - Gmin) / CELL_DIAMETER) + 0.5): float32 division, double + 0.5, truncation
        q = ((v - gmin) / CELL).astype(np.float64) + 0.5
        return np.trunc(q).astype(np.int64)
    lo, hi = idx(emin), idx(emax)
    lim = np.array([NX - 1, NY - 1, NZ - 1])
    return gmin, np.clip(lo, 0, lim), np.clip(hi, 0, lim)

def plane(p1, p2, p3):
    """Plane_intersection.cpp coefficients, float32, same operation order."""
    (x1, y1, z1), (x2, y2, z2), (x3, y3, z3) = p1, p2, p3
    A = y1 * (z2 - z3) + y2 * (z3 - z1) + y3 * (z1 - z2)
    B = z1 * (x2 - x3) + z2 * (x3 - x1) + z3 * (x1 - x2)
    C = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)
    D = -(x1 * (y2 * z3 - y3 * z2) + x2 * (y3 * z1 - y1 * z3) + x3 * (y1 * z2 - y2 * z1))
    return A, B, C, D

def lattice_element_map(nodes, elems, gmin, lo, hi):
    """Lattice_point_in_element.cpp: label of the first callus element that contains each lattice point."""
    lpe = np.zeros((NX, NY, NZ), np.int32)
    faces = ((0, 2, 1), (0, 1, 3), (0, 3, 2), (1, 2, 3))
    for e in range(len(elems)):
        P = [tuple(np.float32(c) for c in nodes[elems[e, n] - 1]) for n in range(4)]
        (i0, j0, k0), (i1, j1, k1) = lo[e], hi[e]
        xs = (np.arange(i0, i1 + 1).astype(np.float32) * CELL + gmin[0])[:, None, None]
        ys = (np.arange(j0, j1 + 1).astype(np.float32) * CELL + gmin[1])[None, :, None]
        zs = (np.arange(k0, k1 + 1).astype(np.float32) * CELL + gmin[2])[None, None, :]
        inside = None
        for f in faces:
            A, B, C, D = plane(P[f[0]], P[f[1]], P[f[2]])
            s = A * xs + B * ys + C * zs + D
            inside = (s <= 0) if inside is None else inside & (s <= 0)
        sub = lpe[i0:i1 + 1, j0:j1 + 1, k0:k1 + 1]
        sub[inside & (sub == 0)] = e + 1
    return lpe

def counted_points(lpe, lo, hi):
    """Lattice points that Update_model.cpp counts: its loops run i < imax (half-open box), unlike
    Lattice_point_in_element (i <= imax). Returns flat lattice index and element index (0-based)."""
    flat, elem = [], []
    J, K = np.meshgrid(np.arange(NY), np.arange(NZ), indexing="ij")
    for i in range(NX):
        s = lpe[i]
        m = s > 0
        if not m.any():
            continue
        e = s[m] - 1
        ok = (i < hi[e, 0]) & (J[m] < hi[e, 1]) & (K[m] < hi[e, 2])
        flat.append((i * NY * NZ + J[m] * NZ + K[m])[ok].astype(np.int64))
        elem.append(e[ok].astype(np.int32))
    return np.concatenate(flat), np.concatenate(elem)

def daily_modulus(L, flat, elem, n_elem):
    """Young_modulus_prop[elem][t] and Poison_ratio_prop of Update_model.cpp for one lattice (float32),
    plus the empty mask (total == 0 -> fixed 0.2 MPa / 0.167, no history)."""
    code = L.reshape(-1)[flat]
    cls = np.zeros(code.shape, np.int64)
    cls[code == 2] = 1; cls[code == 4] = 2; cls[code == 5] = 3
    cnt = np.bincount(elem.astype(np.int64) * 4 + cls, minlength=4 * n_elem).reshape(n_elem, 4).astype(np.float64)
    total = cnt.sum(axis=1)
    nb, nc, nf = cnt[:, 1], cnt[:, 2], cnt[:, 3]
    t = np.where(total > 0, total, 1.0)
    rest = (total.astype(np.float32) - nf.astype(np.float32) - nb.astype(np.float32) - nc.astype(np.float32)).astype(np.float64)
    E = (nc * 10.0 / t) + (nf * 2.0 / t) + (nb * 17000.0 / t) + (rest * 0.2 / t)
    nu = (nc * 0.167 / t) + (nf * 0.167 / t) + (nb * 0.3 / t) + (rest * 0.167 / t)
    return E.astype(np.float32), nu.astype(np.float32), total == 0

def averaged_modulus(run, day, flat, elem, n_elem, cache):
    """Young_mod_elem / Poison_rat_elem written to without_scaffold.inp at iteration `day` (day >= 9):
    float32 sum of the last ten daily values (t, t-1, ..., t-9), divided by 10."""
    assert day >= 9
    Es, nus = np.zeros(n_elem, np.float32), np.zeros(n_elem, np.float32)
    for t in range(day, day - 10, -1):
        p = os.path.join(cache, f"daily_modulus_{t}.npz")
        if os.path.exists(p):
            z = np.load(p); E, nu, empty = z["E"], z["nu"], z["empty"]
        else:
            E, nu, empty = daily_modulus(read_lattice(run, t), flat, elem, n_elem)
            np.savez(p, E=E, nu=nu, empty=empty)
        Es = (Es + E).astype(np.float32); nus = (nus + nu).astype(np.float32)
    Es = (Es / np.float32(10)).astype(np.float32); nus = (nus / np.float32(10)).astype(np.float32)
    Es[empty] = np.float32(0.2); nus[empty] = np.float32(0.167)
    return Es, nus

def read_inp_callus_materials(path, n_elem):
    """(E, nu) text of each callus element in a without_scaffold.inp written by Write_ccx_input."""
    txt = open(path).read().split("** ---- buradan sonrasi")[-1]
    out = [None] * n_elem
    for m in re.finditer(r"\*MATERIAL, NAME=material_\d+\n\*ELASTIC\n([^\n]+)\n\*ELSET, ELSET=KALLUS_\d+\n(.*?)\*SOLID", txt, re.S):
        for lab in re.findall(r"\d+", m.group(2)):
            out[int(lab) - FIRST_CALLUS] = m.group(1)
    assert all(v is not None for v in out), "callus element without material"
    return out

def cpp_text(E, nu):
    """ostream << float with default precision 6 (Write_ccx_input key)."""
    return [f"{float(a):g},{float(b):g}" for a, b in zip(E, nu)]

def read_dat(path, n_elem):
    """Last S and E tables of a CalculiX .dat (Read_stimulus.cpp): IP mean of the minimum principal
    strain (eigenvalue of the tensor strain) and HP = -(sxx + syy + szz) / 3."""
    lines = open(path).read().splitlines()
    def table(title):
        start = max(i for i, s in enumerate(lines) if title in s and "for set" in s)
        rows = []
        for s in lines[start + 1:]:
            if "(" in s:
                break
            p = s.split()
            if len(p) == 8:
                rows.append([float(x) for x in p])
        a = np.array(rows)
        idx = a[:, 0].astype(int) - FIRST_CALLUS
        keep = (idx >= 0) & (idx < n_elem)
        a, idx = a[keep], idx[keep]
        assert np.bincount(idx, minlength=n_elem).max() == IPS and np.bincount(idx, minlength=n_elem).min() == IPS
        order = np.lexsort((a[:, 1], idx))
        return a[order, 2:].reshape(n_elem, IPS, 6)
    S, Ee = table("stresses (elem"), table("strains (elem")
    T = np.zeros(Ee.shape[:2] + (3, 3))
    T[..., 0, 0], T[..., 1, 1], T[..., 2, 2] = Ee[..., 0], Ee[..., 1], Ee[..., 2]
    T[..., 0, 1] = T[..., 1, 0] = Ee[..., 3]
    T[..., 0, 2] = T[..., 2, 0] = Ee[..., 4]
    T[..., 1, 2] = T[..., 2, 1] = Ee[..., 5]
    ep_min = np.linalg.eigvalsh(T)[..., 0].mean(axis=1)
    hp = (-(S[..., 0] + S[..., 1] + S[..., 2]) / 3).mean(axis=1)
    return ep_min, hp

# Read_stimulus.cpp thresholds (|HP| in MPa, |min principal strain| as a fraction)
THRESH = dict(res_hp=0.0016, res_ep=0.0004, bone_hp=0.15, bone_ep=0.05, cart_hp=0.15, cart_ep=0.15)

def classify(ep, hp, claes=False):
    """Read_stimulus.cpp, same order (first match wins): 1 resorption, 2 bone, 4 cartilage, 5 fibrous.
    Original sign: cartilage at HP < -0.15 (HP is compression-positive, so this is hydrostatic tension)."""
    T = THRESH
    a = np.abs(ep)
    st = np.full(np.broadcast(ep, hp).shape, 5, np.int8)
    cart = ((hp > T["cart_hp"]) if claes else (hp < -T["cart_hp"])) & (a < T["cart_ep"])
    st[cart] = 4
    st[(np.abs(hp) < T["bone_hp"]) & (a < T["bone_ep"])] = 2
    st[(np.abs(hp) < T["res_hp"]) & (a < T["res_ep"])] = 1
    return st

# ----------------------------------------------------------------------------- frame and FE section
FRAME_MM = 60.0                 # square field of view (mm): the 30 mm gap, 15 mm of each bone end, the plate
FRAME_YC, FRAME_ZC = 0.0, 20.0  # centre: bone axis, middle of the 30 mm defect
OUT = 1200                      # output pixels
SS = 3                          # supersampling of the drawing canvas
CAN = OUT * SS
PX = FRAME_MM / CAN             # mm per canvas pixel (1/60: one lattice point = 6 x 6 canvas pixels)
Y0, Z1 = FRAME_YC - FRAME_MM / 2, FRAME_ZC + FRAME_MM / 2
X_SECTION = -1e-3               # FE section plane x (mm); the callus mesh has faces on x = 0, so stay off it
REGIONS = {"KORTEKS": 2, "ILIK": 3, "KALLUS": 1, "PLAK": 4, "VIDA": 5}   # drawing order = priority
R_NONE, R_CALLUS, R_CORTEX, R_MARROW, R_PLATE, R_SCREW = 0, 1, 2, 3, 4, 5

def to_canvas(y, z):
    return (y - Y0) / PX, (Z1 - z) / PX

def fe_section(inp_path, cache):
    """Rasterise the section x = X_SECTION of every tetrahedron (corner nodes) of model_sablon.inp onto the
    canvas: region code and callus element index (0-based, -1 elsewhere) per canvas pixel."""
    p = os.path.join(cache, f"fe_section_{FRAME_MM:g}mm_{CAN}px.npz")
    if os.path.exists(p):
        z = np.load(p); return z["region"], z["element"]
    X, sets = read_inp_mesh(inp_path)
    region = np.zeros((CAN, CAN), np.uint8)
    element = np.full((CAN, CAN), -1, np.int32)
    edges = [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)]
    # C3D10 -> 8 straight sub-tetrahedra through the mid-side nodes (4=01 5=12 6=20 7=03 8=13 9=23), so curved
    # surfaces (cortex, marrow, callus arc) follow the quadratic geometry CalculiX uses, not the corner chords
    SUB = np.array([(0, 4, 6, 7), (4, 1, 5, 8), (6, 5, 2, 9), (7, 8, 9, 3),
                    (6, 8, 4, 5), (6, 8, 5, 9), (6, 8, 9, 7), (6, 8, 7, 4)])
    for name, code in REGIONS.items():
        labels, conn = sets[name]
        C = X[conn[:, SUB]].reshape(-1, 4, 3)            # (8E, 4, 3)
        labels = np.repeat(labels, len(SUB))
        d = C[:, :, 0] - X_SECTION
        assert not (d == 0).any()
        hit = np.flatnonzero((d.min(1) < 0) & (d.max(1) > 0))
        for e in hit:
            pts = []
            for a, b in edges:
                if d[e, a] * d[e, b] < 0:
                    t = d[e, a] / (d[e, a] - d[e, b])
                    q = C[e, a] + t * (C[e, b] - C[e, a])
                    pts.append(to_canvas(q[1], q[2]))
            P = np.array(pts)
            c0 = P.mean(0)
            P = P[np.argsort(np.arctan2(P[:, 1] - c0[1], P[:, 0] - c0[0]))]
            lo = np.maximum(np.floor(P.min(0)).astype(int), 0)
            hi = np.minimum(np.ceil(P.max(0)).astype(int), CAN - 1)
            if (lo > hi).any():
                continue
            cc, rr = np.meshgrid(np.arange(lo[0], hi[0] + 1) + 0.5, np.arange(lo[1], hi[1] + 1) + 0.5)
            inside = np.ones(cc.shape, bool)
            for k in range(len(P)):
                (ax, ay), (bx, by) = P[k], P[(k + 1) % len(P)]
                inside &= (bx - ax) * (rr - ay) - (by - ay) * (cc - ax) >= -1e-9
            sl = (slice(lo[1], hi[1] + 1), slice(lo[0], hi[0] + 1))
            region[sl][inside] = code
            if name == "KALLUS":
                element[sl][inside] = labels[e] - FIRST_CALLUS
    np.savez_compressed(p, region=region, element=element)
    return region, element

def lattice_on_canvas(sec_jk, gmin):
    """Lattice plane i = 180 (j, k) -> canvas array (codes), 255 outside the lattice box."""
    out = np.full((CAN, CAN), 255, np.uint8)
    blk = int(round(float(CELL) / PX))
    assert abs(blk * PX - float(CELL)) < 1e-6
    img = np.repeat(np.repeat(sec_jk.T[::-1], blk, 0), blk, 1)   # rows: z descending, cols: y ascending
    c0, r0 = to_canvas(float(gmin[1]) - float(CELL) / 2, float(gmin[2]) + (NZ - 1) * float(CELL) + float(CELL) / 2)
    c0, r0 = int(round(c0)), int(round(r0))
    rs, cs = max(0, -r0), max(0, -c0)                            # clip to the canvas
    re_, ce = min(img.shape[0], CAN - r0), min(img.shape[1], CAN - c0)
    out[r0 + rs:r0 + re_, c0 + cs:c0 + ce] = img[rs:re_, cs:ce]
    return out

def outline(region, codes, width):
    """Canvas pixels on the border of the given regions (for hairlines)."""
    m = np.isin(region, codes)
    edge = np.zeros_like(m)
    edge[:-1] |= m[:-1] != m[1:]; edge[1:] |= m[:-1] != m[1:]
    edge[:, :-1] |= m[:, :-1] != m[:, 1:]; edge[:, 1:] |= m[:, :-1] != m[:, 1:]
    for _ in range(width - 1):
        e2 = edge.copy()
        e2[1:] |= edge[:-1]; e2[:-1] |= edge[1:]; e2[:, 1:] |= edge[:, :-1]; e2[:, :-1] |= edge[:, 1:]
        edge = e2
    return edge

# ----------------------------------------------------------------------------- drawing
W_MSC = 0.85        # stem cells: accent-2 laid over the callus at this weight (tissues are opaque)
FONT_PX = 25        # key and tick text height at 1200 px

def cmap_seq():
    from matplotlib.colors import LinearSegmentedColormap
    return LinearSegmentedColormap.from_list("site_seq", [HEX["paper-3"], HEX["accent-2"], HEX["ink"]])

def region_canvas(region):
    c = np.empty((CAN, CAN, 3), np.float32)
    c[:] = rgb("paper")
    for code, name in [(R_CALLUS, "paper-3"), (R_CORTEX, "cortex"), (R_MARROW, "marrow"), (R_PLATE, "rule"), (R_SCREW, "rule")]:
        c[region == code] = rgb(name)
    return c

def paint_cells(c, lat):
    m = lat == 1
    c[m] = (1 - W_MSC) * c[m] + W_MSC * rgb("accent-2")
    c[lat == 2] = rgb("ink"); c[lat == 4] = rgb("accent"); c[lat == 5] = rgb("fibrous")
    return c

def field_canvas(region, element, values, vmin, vmax, cortex=None, marrow=None):
    """Callus elements coloured by log10(value) on the site map; cortex/marrow by a constant value or,
    when None, left as quiet no-data context (paper-2 with a rule hairline)."""
    cm = cmap_seq()
    def colour(v):
        t = (np.log10(np.clip(v, vmin, vmax)) - math.log10(vmin)) / (math.log10(vmax) - math.log10(vmin))
        return cm(t)[..., :3].astype(np.float32)
    c = np.empty((CAN, CAN, 3), np.float32)
    c[:] = rgb("paper")
    m = element >= 0
    c[m] = colour(values[element[m]])
    for code, v in [(R_CORTEX, cortex), (R_MARROW, marrow)]:
        c[region == code] = rgb("paper-2") if v is None else colour(np.array([v]))[0]
    c[np.isin(region, [R_PLATE, R_SCREW])] = rgb("rule")
    if cortex is None:
        edge = (outline(region, [R_CORTEX], 4) | outline(region, [R_MARROW], 4)) & np.isin(region, [R_CORTEX, R_MARROW])
        c[edge] = rgb("rule")
    return c

def font(px):
    from PIL import ImageFont
    import matplotlib
    return ImageFont.truetype(os.path.join(matplotlib.get_data_path(), "fonts", "ttf", "DejaVuSans.ttf"), px)

def to_image(c):
    from PIL import Image
    return Image.fromarray((np.clip(c, 0, 1) * 255 + 0.5).astype(np.uint8))

def downsample(im):
    from PIL import Image
    return im.resize((OUT, OUT), Image.BOX)

def mm(y, z):
    return to_canvas(y, z)

def arrow(draw, p0, p1, colour, width_px=4.0, head_px=22.0, heads=1):
    """Straight arrow on the canvas, from p0 to p1 (canvas px); `heads` stacked heads at p1 (2 = moment vector)."""
    w, hl = width_px * SS, head_px * SS
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0); ux, uy = (x1 - x0) / L, (y1 - y0) / L; nx, ny = -uy, ux
    tip_shaft = (x1 - ux * hl * 0.6, y1 - uy * hl * 0.6)
    draw.line([(x0, y0), tip_shaft], fill=colour, width=int(round(w)))
    for h in range(heads):
        tx, ty = x1 - ux * h * hl * 0.75, y1 - uy * h * hl * 0.75
        bx, by = tx - ux * hl, ty - uy * hl
        draw.polygon([(tx, ty), (bx + nx * hl * 0.45, by + ny * hl * 0.45), (bx - nx * hl * 0.45, by - ny * hl * 0.45)], fill=colour)

def key_bar(im, vmin, vmax, ticks):
    """Quiet colour key, bottom left: thin bar and 2-3 labels (value, text) in the muted colour."""
    from PIL import ImageDraw
    cm = cmap_seq()
    (xa, ya), (xb, yb) = mm(-28.5, -5.0), mm(-10.5, -5.45)
    xa, xb, ya, yb = int(xa), int(xb), int(ya), int(yb)
    t = np.linspace(0, 1, xb - xa)
    bar = (cm(t)[:, :3] * 255 + 0.5).astype(np.uint8)
    arr = np.array(im)
    arr[ya:yb, xa:xb] = bar[None, :, :]
    im.paste(to_image(arr.astype(np.float32) / 255))
    d = ImageDraw.Draw(im)
    f = font(FONT_PX * SS)
    for v, text in ticks:
        x = xa + (math.log10(v) - math.log10(vmin)) / (math.log10(vmax) - math.log10(vmin)) * (xb - xa)
        w = d.textlength(text, font=f)
        anchor_x = x if v == vmin else (x - w if v == vmax else x - w / 2)
        d.line([(x, yb), (x, yb + 6 * SS)], fill=HEX["muted"], width=2 * SS)
        d.text((anchor_x, yb + 10 * SS), text, font=f, fill=HEX["muted"])
    return im

def save_stage(im, out_dir, png_dir, n, max_kb=250):
    assert im.size == (OUT, OUT)
    im.save(os.path.join(png_dir, f"stage-{n}.png"))
    q = 85
    while True:
        p = os.path.join(out_dir, f"stage-{n}.jpg")
        im.convert("RGB").save(p, "JPEG", quality=q, optimize=True, progressive=True, subsampling=0 if q >= 80 else 2)
        kb = os.path.getsize(p) / 1024
        if kb <= max_kb or q <= 60:
            return p, q, kb
        q -= 5

# ----------------------------------------------------------------------------- stage 6: decision plane
def decision_plane(ep, hp, st, path, claes=False):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    T = THRESH
    X0, X1 = 1e-6, 0.3            # |min principal strain|
    LT, Y1 = 1e-4, 3.0            # symlog linear threshold and limit (MPa)
    col = {1: HEX["resorption"], 2: HEX["ink"], 4: HEX["accent"], 5: HEX["fibrous"]}
    fig = plt.figure(figsize=(OUT / 100, OUT / 100), dpi=100, facecolor=HEX["paper"])
    ax = fig.add_axes([0.155, 0.085, 0.815, 0.885], facecolor=HEX["paper"])
    ax.set_xscale("log"); ax.set_yscale("symlog", linthresh=LT, linscale=0.6)
    ax.set_xlim(X0, X1); ax.set_ylim(-Y1, Y1)
    # region tints: the classify() rule evaluated on a dense grid
    gx = np.logspace(math.log10(X0), math.log10(X1), 1600)
    ty = np.linspace(-1, 1, 1601)
    tr = ax.yaxis.get_transform()
    lo, hi = tr.transform([-Y1, Y1])
    gy = tr.inverted().transform(lo + (ty + 1) / 2 * (hi - lo))
    G = classify(gx[None, :], gy[:, None], claes)
    tint = {1: 0.14, 2: 0.05, 4: 0.12, 5: 0.09}
    rgba = np.zeros(G.shape + (4,))
    for k, a in tint.items():
        c = np.array([int(col[k][i:i + 2], 16) / 255 for i in (1, 3, 5)])
        rgba[G == k, :3] = c; rgba[G == k, 3] = a
    ax.imshow(rgba, extent=[0, 1, 0, 1], transform=ax.transAxes, aspect="auto", origin="lower", interpolation="nearest", zorder=0)
    # region boundaries (Read_stimulus.cpp thresholds)
    lw, rc = 1.6, HEX["rule"]
    kw = dict(color=rc, lw=lw, zorder=1, solid_capstyle="butt")
    ax.plot([T["res_ep"]] * 2, [-T["res_hp"], T["res_hp"]], **kw)
    ax.plot([X0, T["res_ep"]], [T["res_hp"]] * 2, **kw); ax.plot([X0, T["res_ep"]], [-T["res_hp"]] * 2, **kw)
    sg = 1 if claes else -1      # side of the cartilage zone: HP < -0.15 (original sign) or HP > 0.15 (Claes-Heigele)
    ax.plot([T["bone_ep"]] * 2, [-T["bone_hp"], T["bone_hp"]], **kw)
    ax.plot([X0, T["bone_ep"]], [-sg * T["bone_hp"]] * 2, **kw)
    ax.plot([X0, T["cart_ep"]], [sg * T["cart_hp"]] * 2, **kw)
    ax.plot([T["cart_ep"]] * 2, [sg * Y1, sg * T["cart_hp"]], **kw)
    # elements
    for k in (2, 1, 5, 4):       # opaque dots: a translucent white dot would read as the grey resorption class
        m = st == k
        ax.scatter(np.clip(np.abs(ep[m]), X0, X1), np.clip(hp[m], -Y1, Y1), s=4 if k == 2 else 7, c=col[k],
                   alpha=1.0, linewidths=0, zorder=2 + (k != 2), rasterized=True)
    # axes: ticks with numbers and units only, muted
    for sp in ("top", "right"):
        ax.spines[sp].set_visible(False)
    for sp in ("left", "bottom"):
        ax.spines[sp].set_color(HEX["rule"]); ax.spines[sp].set_linewidth(1.2)
    xt = [1e-5, T["res_ep"], 1e-2, T["bone_ep"], T["cart_ep"]]
    ax.set_xticks(xt); ax.set_xticklabels(["0.001 %", "0.04 %", "1 %", "5 %", "15 %"])
    yt = [-1, -T["cart_hp"], -T["res_hp"], 0, T["res_hp"], T["bone_hp"], 1]
    ax.set_yticks(yt); ax.set_yticklabels(["−1 MPa", "−0.15", "−0.0016", "0", "0.0016", "0.15", "1 MPa"])
    ax.minorticks_off()
    ax.tick_params(colors=HEX["muted"], labelcolor=HEX["muted"], labelsize=FONT_PX * 0.72, length=6, width=1.2)
    fig.savefig(path, dpi=100, facecolor=HEX["paper"])
    plt.close(fig)

# ----------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--run", required=True, help="run folder (lattice_N.raw[.zst], without_scaffold.dat/.inp, ...)")
    ap.add_argument("--out", required=True, help="output folder for stage-N.jpg and stages.json")
    ap.add_argument("--cache", default=os.path.expanduser("~/mechanobio_calculix/site_stages_cache"),
                    help="folder for intermediate arrays and the 1200 px PNGs (outside the repo)")
    ap.add_argument("--early-day", type=int, default=9, help="day of stage 2")
    ap.add_argument("--run-label", default=None, help="run description for stages.json")
    ap.add_argument("--palette", action="store_true", help="print the colours and exit")
    a = ap.parse_args()
    if a.palette:
        for k, v in OKLCH.items():
            print(f"{k:11s} oklch({v[0] * 100:g}% {v[1]:g} {v[2]:g})  {HEX[k]}")
        return
    run = os.path.abspath(os.path.expanduser(a.run))
    os.makedirs(a.out, exist_ok=True); os.makedirs(a.cache, exist_ok=True)
    png_dir = os.path.join(a.cache, "png"); os.makedirs(png_dir, exist_ok=True)
    t_start = time.time()
    build = open(os.path.join(run, "derleme_bilgisi.txt")).read().strip() if os.path.exists(os.path.join(run, "derleme_bilgisi.txt")) else "?"
    claes = "CLAES_HEIGELE_BASMA_POZITIF" in build
    n_iter = sum(1 for _ in open(os.path.join(run, "istatistik.csv"))) - 1
    fe_day = max(t for t in range(6, n_iter - 1) if t % 3 == 0)        # main.cpp: last CalculiX solve
    inp_day = n_iter - 2                                               # main.cpp: last Update_model call
    print(f"run {run}\n  build: {build}\n  days 0..{n_iter - 1}, last FE solve on day {fe_day}, .inp from day {inp_day}")

    # mesh and lattice -> element map (Lattice_point_in_element.cpp), checked against kesit_eleman.bin
    nodes = read_nodes_float32(run); elems = read_callus_elements(run); n_el = len(elems)
    gmin, lo, hi = callus_bounds(nodes, elems)
    key = f"{os.path.basename(run)}_{os.path.getsize(os.path.join(run, 'element_file.txt'))}"
    cdir = os.path.join(a.cache, key); os.makedirs(cdir, exist_ok=True)
    p = os.path.join(cdir, "lattice_element_map.npy")
    if os.path.exists(p):
        lpe = np.load(p)
    else:
        lpe = lattice_element_map(nodes, elems, gmin, lo, hi); np.save(p, lpe)
    sx, sy, sz = read_section_map(run)
    diff = int((lpe[180] != sx).sum() + (lpe[:, 180] != sy).sum() + (lpe[:, :, 200] != sz).sum())
    print(f"  check lattice->element map vs kesit_eleman.bin: {diff} differing points, {int((lpe > 0).sum())} callus points")
    assert diff == 0
    flat, elem = counted_points(lpe, lo, hi)
    del lpe

    # element moduli (Update_model.cpp), checked against without_scaffold.inp
    E_inp, nu_inp = averaged_modulus(run, inp_day, flat, elem, n_el, cdir)
    ref = read_inp_callus_materials(os.path.join(run, "without_scaffold.inp"), n_el)
    bad = sum(r != m for r, m in zip(ref, cpp_text(E_inp, nu_inp)))
    print(f"  check E, nu of day {inp_day} vs without_scaffold.inp: {bad} of {n_el} elements differ")
    assert bad == 0
    E_fe, _ = averaged_modulus(run, fe_day, flat, elem, n_el, cdir)

    # strain and pressure of the last solve (Read_stimulus.cpp), checked against stimulus_N.bin
    ep, hp = read_dat(os.path.join(run, "without_scaffold.dat"), n_el)
    st = classify(ep, hp, claes)
    ref_st = np.fromfile(os.path.join(run, f"stimulus_{fe_day + 1}.bin"), np.int8)
    bad = int((ref_st != st).sum())
    print(f"  check stimulus of the day-{fe_day} solve vs stimulus_{fe_day + 1}.bin: {bad} of {n_el} elements differ")
    assert bad == 0
    counts = {k: int((st == k).sum()) for k in (1, 2, 4, 5)}

    # FE section of the run's own mesh; bonded plate = plate and callus elements share nodes
    region, element = fe_section(os.path.join(run, "model_sablon.inp"), cdir)
    _, sets = read_inp_mesh(os.path.join(run, "model_sablon.inp"))
    bonded = bool(len(np.intersect1d(np.unique(sets["PLAK"][1]), np.unique(sets["KALLUS"][1]))))
    del sets
    m = re.search(r"Random number seed: (\d+)", open(os.path.join(run, "kosu_log.txt")).read()) if os.path.exists(os.path.join(run, "kosu_log.txt")) else None
    seed = m.group(1) if m else "?"
    home = os.path.expanduser("~/mechanobio_calculix")
    run_rel = os.path.relpath(run, home) if run.startswith(home) else run
    print(f"  plate {'bonded to' if bonded else 'not bonded to'} the callus, seed {seed}")
    from PIL import ImageDraw
    files = []

    # stage 1: defect and load
    im = to_image(region_canvas(region))
    d = ImageDraw.Draw(im)
    arrow(d, mm(0.0, 49.7), mm(0.0, 43.2), HEX["ink-2"])                  # 823 N axial, -z
    arrow(d, mm(0.9, 47.6), mm(7.6, 47.6), HEX["ink-2"], heads=2)         # 9777 N mm about +y
    files.append(save_stage(downsample(im), a.out, png_dir, 1))

    # stages 2 and 3: cells and tissue on the lattice plane i = 180 (x = 0)
    lat_counts = {}
    for n, day in ((2, a.early_day), (3, fe_day)):
        L = read_lattice(run, day)
        sec = L[180]
        lat_counts[day] = {k: int((sec == k).sum()) for k in (1, 2, 4, 5)}
        im = to_image(paint_cells(region_canvas(region), lattice_on_canvas(sec, gmin)))
        files.append(save_stage(downsample(im), a.out, png_dir, n))
        del L

    # stage 4: stiffness of the day-fe_day solve
    im = to_image(field_canvas(region, element, E_fe, 0.2, 17000.0, cortex=17000.0, marrow=2.0))
    im = key_bar(im, 0.2, 17000.0, [(0.2, "0.2 MPa"), (17000.0, "17 000 MPa")])
    files.append(save_stage(downsample(im), a.out, png_dir, 4))

    # stage 5: |minimum principal strain| of the same solve
    im = to_image(field_canvas(region, element, np.abs(ep), 1e-5, 1e-1))
    im = key_bar(im, 1e-5, 1e-1, [(1e-5, "0.001 %"), (1e-3, "0.1 %"), (1e-1, "10 %")])
    files.append(save_stage(downsample(im), a.out, png_dir, 5))

    # stage 6: decision plane
    from PIL import Image
    p6 = os.path.join(png_dir, "stage-6-raw.png")
    decision_plane(ep, hp, st, p6, claes)
    files.append(save_stage(Image.open(p6).convert("RGB"), a.out, png_dir, 6))

    # numbers for the captions
    sec_el = np.unique(element[element >= 0])
    stats = dict(fe_day=fe_day, inp_day=inp_day, early_day=a.early_day, n_elements=n_el, stimulus_counts=counts,
                 lattice_plane_counts=lat_counts, section_elements=int(len(sec_el)),
                 E_section_MPa=[float(E_fe[sec_el].min()), float(np.median(E_fe[sec_el])), float(E_fe[sec_el].max())],
                 abs_ep_section=[float(np.abs(ep[sec_el]).min()), float(np.median(np.abs(ep[sec_el]))), float(np.abs(ep[sec_el]).max())],
                 abs_ep_all=[float(np.abs(ep).min()), float(np.median(np.abs(ep))), float(np.abs(ep).max())],
                 hp_all=[float(hp.min()), float(np.median(hp)), float(hp.max())], claes_sign=claes, build=build,
                 bonded=bonded, seed=seed, run_rel=run_rel, n_days=n_iter)
    json.dump(stats, open(os.path.join(a.cache, "stage_numbers.json"), "w"), indent=1)
    write_json(a, stats, run)
    for p, q, kb in files:
        print(f"  {p}: JPEG q{q}, {kb:.0f} KB")
    print(f"done in {time.time() - t_start:.0f} s")

def mix_hex(a, b, w):
    c = (1 - w) * rgb(a) + w * rgb(b)
    return "#" + "".join(f"{round(float(v) * 255):02x}" for v in c)

def num(v):
    return f"{v:,.0f}".replace(",", " ")   # thin-space thousands separator

def write_json(a, s, run):
    fe, early, n = s["fe_day"], s["early_day"], s["n_elements"]
    c = s["stimulus_counts"]
    geom = ("old geometry, callus bonded to the plate" if s["bonded"] else
            "current geometry, plate not bonded to the callus (unbonded, new)")
    run_txt = a.run_label or (f"{s['run_rel']}: {geom}; {'Claes-Heigele' if s['claes_sign'] else 'original'} stimulus sign; "
                              f"seed {s['seed']}; {s['n_days']} days")
    msc = mix_hex("paper-3", "accent-2", W_MSC)
    ctx = [{"label": "intact cortical bone", "colour_hex": HEX["cortex"]},
           {"label": "marrow", "colour_hex": HEX["marrow"]},
           {"label": "steel plate", "colour_hex": HEX["rule"]}]
    lc = lambda d, k: num(s["lattice_plane_counts"][d][k])
    sec = "Section x = 0 (the plane through the bone axis that cuts the plate), 60 x 60 mm, 0.05 mm per pixel"
    E0, Emed, E1 = s["E_section_MPa"]
    e0, emed, e1 = s["abs_ep_section"]
    stages = [
        dict(stage=1, file="stage-1.jpg", day=0, run=run_txt,
             what=("The run's CalculiX mesh cut through the bone axis: two sheep tibia ends (cortex and marrow), the 30 mm "
                   "gap filled with callus elements, and the steel plate, loaded with 823 N and a 9.78 N·m bending moment."),
             legend=ctx[:2] + [{"label": "callus region (empty, granulation tissue)", "colour_hex": HEX["paper-3"]}, ctx[2],
                               {"label": "loads: 823 N axial (single arrow), 9.78 N·m bending moment about y (double arrow)",
                                "colour_hex": HEX["ink-2"]}],
             key=(f"{sec}. Single arrow: 823 N axial compression, applied at the proximal end (above the frame). Double arrow: "
                  "9 777 N·mm moment vector about +y (right-hand rule), so the bending acts out of this plane. The distal end "
                  "(below the frame) is clamped. The six screws (r 1.75 mm) sit 25 to 55 mm beyond the gap ends, outside this shared frame."),
             alt="Section of a sheep tibia: two bone ends, a 30 mm gap, a steel plate at right, load arrows."),
        dict(stage=2, file="stage-2.jpg", day=early, run=run_txt,
             what=(f"Lattice plane x = 0 on day {early}: stem cells have spread about half a millimetre from the cut bone ends, "
                   "their outer surfaces and the marrow into the gap, and the first few have turned into bone."),
             legend=[{"label": "stem cells (MSC)", "colour_hex": msc}, {"label": "new bone", "colour_hex": HEX["ink"]},
                     {"label": "empty callus (granulation tissue)", "colour_hex": HEX["paper-3"]}] + ctx,
             key=(f"{sec}. One lattice point is one 0.1 mm cell. Points in this plane on day {early}: "
                  f"{lc(early, 1)} stem cells, {lc(early, 2)} bone. The thin stripes inside each marrow cavity are the initial "
                  "stem-cell seeding on every third lattice plane (Initialize_lattice.cpp), not an imaging artefact."),
             alt=f"Day {early}: a thin blue fringe of stem cells lines both bone ends at the edge of the gap."),
        dict(stage=3, file="stage-3.jpg", day=fe, run=run_txt,
             what=(f"The same plane on day {fe}: stem cells fill bands at both bone ends and along the plate, and new bone grows "
                   "in patches against the plate, with a little cartilage and fibrous tissue. The middle of the gap stays empty: no union."),
             legend=[{"label": "new bone", "colour_hex": HEX["ink"]}, {"label": "cartilage", "colour_hex": HEX["accent"]},
                     {"label": "fibrous tissue", "colour_hex": HEX["fibrous"]}, {"label": "stem cells (MSC)", "colour_hex": msc},
                     {"label": "empty callus (granulation tissue)", "colour_hex": HEX["paper-3"]}] + ctx,
             key=(f"{sec}. Day {fe} is the day of the last CalculiX solve of this {s['n_days']}-day run, and stages 4 to 6 use "
                  f"that solve. Points in this plane: {lc(fe, 1)} stem cells, {lc(fe, 2)} bone, {lc(fe, 4)} cartilage, "
                  f"{lc(fe, 5)} fibrous (0.01 mm² each)."
                  + ("" if s["bonded"] else " Cartilage and fibrous tissue stay rare when the plate is not bonded to the callus.")),
             alt=f"Day {fe}: stem cells line the bone ends and the plate; new bone patches grow along the plate."),
        dict(stage=4, file="stage-4.jpg", day=fe, run=run_txt,
             what=(f"Young's modulus of every element in the day-{fe} CalculiX solve: each callus element mixes its lattice "
                   "tissues (bone 17 000, cartilage 10, fibrous 2, anything else 0.2 MPa) and averages the last ten days."),
             legend=[{"label": "0.2 MPa (granulation tissue)", "colour_hex": HEX["paper-3"]},
                     {"label": "about 60 MPa (middle of the log scale)", "colour_hex": HEX["accent-2"]},
                     {"label": "17 000 MPa (bone, and the intact cortex)", "colour_hex": HEX["ink"]},
                     {"label": "steel plate, 210 000 MPa (off the scale)", "colour_hex": HEX["rule"]}],
             key=(f"Log scale from 0.2 to 17 000 MPa (dark navy to blue to near-white). The cortex is a fixed 17 000 MPa "
                  f"and the marrow 2 MPa. Callus elements in this section: {E0:.1f} to {num(E1)} MPa, median {Emed:.1f} MPa. "
                  f"The program does not write E out: it was rebuilt from the daily lattices of days {fe - 9} to {fe} with the rule "
                  f"of Update_model.cpp, and the same code reproduces the day-{s['inp_day']} without_scaffold.inp for all "
                  f"{num(n)} callus elements."),
             alt="Stiffness map: bright, stiff bone ends and plate-side bone; the soft gap stays dark."),
        dict(stage=5, file="stage-5.jpg", day=fe, run=run_txt,
             what=("Size of the minimum principal strain in every callus element of the same solve (mean of its four integration "
                   "points, without_scaffold.dat), under 823 N and 9.78 N·m."),
             legend=[{"label": "0.001 % or less", "colour_hex": HEX["paper-3"]}, {"label": "0.1 %", "colour_hex": HEX["accent-2"]},
                     {"label": "10 % or more", "colour_hex": HEX["ink"]},
                     {"label": "no strain output (bone ends, marrow)", "colour_hex": HEX["paper-2"]},
                     {"label": "steel plate", "colour_hex": HEX["rule"]}],
             key=(f"Log scale of |minimum principal strain| from 0.001 % to 10 %. In this section: {e0 * 100:.4f} % to "
                  f"{e1 * 100:.1f} %, median {emed * 100:.2f} %. Every value is compressive (negative). CalculiX prints strain "
                  "only for the callus, so the bone ends and the marrow are drawn as outlines."),
             alt="Strain map: the callus far from the plate strains most; bone along the plate barely strains."),
        dict(stage=6, file="stage-6.jpg", day=fe, run=run_txt,
             what=(f"All {num(n)} callus elements of the day-{fe} solve, placed by strain and pressure in the regions of "
                   "Read_stimulus.cpp. The region decides what the element's stem cells turn into over the next three days, "
                   "and whether its bone is resorbed."),
             legend=[{"label": f"resorption ({num(c[1])} elements)", "colour_hex": HEX["resorption"]},
                     {"label": f"bone formation ({num(c[2])})", "colour_hex": HEX["ink"]},
                     {"label": f"cartilage ({num(c[4])})", "colour_hex": HEX["accent"]},
                     {"label": f"fibrous tissue ({num(c[5])})", "colour_hex": HEX["fibrous"]}],
             key=("x: |minimum principal strain|, log scale, 0.0001 % to 30 %. y: hydrostatic pressure HP = -(s1+s2+s3)/3 in MPa, "
                  "compression positive, symmetric log scale (linear within ±0.0001 MPa). Thresholds of Read_stimulus.cpp, "
                  "first match wins: resorption |HP| < 0.0016 MPa and |ε| < 0.04 %; bone |HP| < 0.15 MPa and |ε| < 5 %; "
                  + ("cartilage HP > 0.15 MPa (compression) and |ε| < 15 %; fibrous otherwise." if s["claes_sign"] else
                     "cartilage HP < -0.15 MPa and |ε| < 15 %; fibrous otherwise. With the original sign the cartilage zone "
                     "is hydrostatic tension, the opposite of Claes & Heigele (1999); the model keeps the sign of its source code.")
                  + f" The classes match stimulus_{fe + 1}.bin of the run exactly."),
             alt="Scatter of callus elements by strain and pressure; nearly all fall in the bone region, few in cartilage or fibrous."),
    ]
    for d in stages:
        assert len(d["alt"].split()) <= 20, (d["stage"], len(d["alt"].split()))
    json.dump(stages, open(os.path.join(a.out, "stages.json"), "w"), indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
