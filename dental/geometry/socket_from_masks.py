"""Socket model from segmentation masks: CalculiX mesh and initial lattice for SG-Bone dental.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

Generic builder for extraction sockets segmented on a CT/CBCT. It contains no patient data; the inputs and outputs
of a real case belong outside the repository.

Inputs
  --labels L.nii.gz   uint8 label volume on an isotropic grid (spacing from the header), array axes x, y, z.
                      Label numbers are given in the sockets JSON: "labels": {"soft": 0, "bone": 1, "tooth": 2}
                      (soft = soft tissue / air outside the bone; tooth = remaining teeth, meshed as dentine) and
                      one label per socket.
  --sockets S.json    {"labels": {...}, "sockets": [{"name", "label", "crest": [x,y,z], "apex": [x,y,z]}, ...]};
                      coordinates in mm on the label grid (x = i * spacing, ...). Crest and apex give each
                      socket's axis for the thirds (coronal, middle, apical: equal parts of the crest-apex length).
  --graft NAME        socket(s) filled with graft (graft_mask.raw); repeatable

FE mesh: the block = the sockets' bounding box + --block-margin, cut out of the bone. It is a grid of cubes of
--cube mm, each split into 6 tetrahedra (Kuhn triangulation, conformal) with straight-edged quadratic nodes (C3D10).
  * socket elements (the model's "callus"): cubes holding any socket point of the lattice-spacing grid; numbered first
  * host elements: cubes that are mostly bone or tooth. Bone is cortical (COMPACT) within --shell mm of the soft
    tissue / air and trabecular (TRABECULAR) deeper (a shell rule); teeth are TOOTH.
  * load: MESIAL / DISTAL are the block faces at the lowest / highest x, so FARFIELD strain acts along x.
Lattice (--cell mm, 0.1 as in the dog model) covering the socket elements, offset so that no lattice point lies on a
tetrahedron face. lattice_init.raw codes: 0 socket, 11 native bone or tooth, 14 soft tissue. Socket elements are
coarser than the socket outline; with SG_INIT_DECIDES (written to model_info.h) the code decides inside them too.
Also written: zone_map.raw + zone_names.txt (socket x third), graft_mask.raw, socket_map.raw (socket ids),
model_template.inp, node_file.txt, element_file.txt, model_info.h, mesh_summary.json.
"""
import argparse, itertools, json, math, os
import numpy as np
import nibabel as nib
from scipy import ndimage

p = argparse.ArgumentParser()
p.add_argument("--labels", required=True)
p.add_argument("--sockets", required=True)
p.add_argument("--out", required=True)
p.add_argument("--graft", action="append", default=[])
p.add_argument("--cube", type=float, default=0.8, help="FE cube size (mm); 0.8 mm gives about 85 lattice points per tet")
p.add_argument("--cell", type=float, default=0.1)
p.add_argument("--block-margin", type=float, default=4.0)
p.add_argument("--lattice-margin", type=float, default=0.2)
p.add_argument("--shell", type=float, default=1.5, help="cortical shell thickness (mm)")
p.add_argument("--E-compact", type=float, default=13700.0)
p.add_argument("--E-trab", type=float, default=375.0)
p.add_argument("--E-tooth", type=float, default=18000.0)
a = p.parse_args()
os.makedirs(a.out, exist_ok=True)

img = nib.load(a.labels)
L = np.asarray(img.dataobj).astype(np.uint8)         # (x, y, z)
sp = float(img.header.get_zooms()[0])
S = json.load(open(a.sockets))
LB = S["labels"]
socks = S["sockets"]
sock_labels = [s_["label"] for s_ in socks]
shape = np.array(L.shape)
ext = (shape - 1) * sp

def sample(pts):
    """labels at points (N, 3) in mm, nearest voxel; outside the volume -> soft"""
    idx = np.rint(pts / sp).astype(int)
    ok = np.all((idx >= 0) & (idx < shape), axis=1)
    out = np.full(len(pts), LB["soft"], np.uint8)
    out[ok] = L[idx[ok, 0], idx[ok, 1], idx[ok, 2]]
    return out

sock_any = np.isin(L, sock_labels)
sv = np.argwhere(sock_any) * sp
lo = np.maximum(sv.min(0) - a.block_margin, 0.0)
hi = np.minimum(sv.max(0) + a.block_margin, ext)
n = np.ceil((hi - lo) / a.cube).astype(int)
print("block", lo.round(2), hi.round(2), "cubes", n)

# distance (mm) to soft tissue / air, for the cortical shell
d_soft = ndimage.distance_transform_edt(L != LB["soft"], sampling=sp)

# --- one fine grid at the lattice spacing over the whole block, offset from the cube grid so that no point lies on
# a tetrahedron face; every cube holds exactly k^3 of its points (k = cube / cell), and the lattice is a sub-block of
# it, so every socket lattice point lies in a socket element by construction
k = int(round(a.cube / a.cell)); assert abs(k * a.cell - a.cube) < 1e-9, "cube must be a multiple of cell"
shift = np.array([0.05, 0.03, 0.01]) * a.cell / 0.1
fine = [lo[d] + shift[d] + a.cell * np.arange(k * n[d]) for d in range(3)]
FX, FY, FZ = np.meshgrid(*fine, indexing="ij")
F = sample(np.stack([FX.ravel(), FY.ravel(), FZ.ravel()], 1)).reshape(k * n[0], k * n[1], k * n[2])
del FX, FY, FZ
C = F.reshape(n[0], k, n[1], k, n[2], k)
is_sock = np.isin(C, sock_labels).any(axis=(1, 3, 5))
host_frac = np.isin(C, [LB["bone"], LB["tooth"]]).mean(axis=(1, 3, 5))
tooth_more = (C == LB["tooth"]).sum(axis=(1, 3, 5)) > (C == LB["bone"]).sum(axis=(1, 3, 5))
cube_type = {}
for ci in itertools.product(range(n[0]), range(n[1]), range(n[2])):
    if is_sock[ci]:
        cube_type[ci] = "SOCKET"; continue
    if host_frac[ci] < 0.5: continue
    if tooth_more[ci]:
        cube_type[ci] = "TOOTH"; continue
    c = np.rint((lo + (np.array(ci) + 0.5) * a.cube) / sp).astype(int).clip(0, shape - 1)
    cube_type[ci] = "COMPACT" if d_soft[tuple(c)] <= a.shell else "TRABECULAR"
counts = {kk: sum(1 for v in cube_type.values() if v == kk) for kk in ["SOCKET", "COMPACT", "TRABECULAR", "TOOTH"]}
print("cubes", counts)

# --- Kuhn tetrahedra with shared corner and mid-side nodes
node_id, X = {}, []
def nid(key, xyz):
    if key not in node_id:
        node_id[key] = len(X) + 1; X.append(xyz)
    return node_id[key]
def corner(g):  # g: integer grid index (2x for mid-side keys)
    return nid(("c",) + tuple(g), lo + np.array(g) * a.cube)
def mid(g1, g2):
    k = tuple(sorted([tuple(g1), tuple(g2)]))
    return nid(("m",) + k, lo + (np.array(g1) + np.array(g2)) / 2 * a.cube)
E = np.eye(3, dtype=int)
elems = {k: [] for k in ["SOCKET", "COMPACT", "TRABECULAR", "TOOTH"]}
for region in elems:
    for ci, t in cube_type.items():
        if t != region: continue
        g0 = np.array(ci)
        for perm in itertools.permutations(range(3)):
            path = [g0, g0 + E[perm[0]], g0 + E[perm[0]] + E[perm[1]], g0 + 1]
            P4 = [lo + q * a.cube for q in path]
            if np.dot(np.cross(P4[1] - P4[0], P4[2] - P4[0]), P4[3] - P4[0]) < 0:
                path[1], path[2] = path[2], path[1]
            c = [corner(q) for q in path]
            m = [mid(path[0], path[1]), mid(path[1], path[2]), mid(path[2], path[0]),
                 mid(path[0], path[3]), mid(path[1], path[3]), mid(path[2], path[3])]
            elems[region].append(c + m)
X = np.array(X)
label, nxt = {}, 1
for region in ["SOCKET", "COMPACT", "TRABECULAR", "TOOTH"]:
    label[region] = np.arange(nxt, nxt + len(elems[region])); nxt += len(elems[region])
N_NODE, N_SOCK = len(X), len(elems["SOCKET"])
for region, el in elems.items():
    if not el: continue
    c = np.array(el) - 1
    v = np.einsum("ij,ij->i", np.cross(X[c[:, 1]] - X[c[:, 0]], X[c[:, 2]] - X[c[:, 0]]), X[c[:, 3]] - X[c[:, 0]]) / 6
    assert (v > 0).all(), f"{region}: non-positive tetrahedron volume"
tol = 1e-6
x0, x1 = X[:, 0].min(), X[:, 0].max()
mesial = np.where(np.abs(X[:, 0] - x0) < tol)[0] + 1
distal = np.where(np.abs(X[:, 0] - x1) < tol)[0] + 1
mm_ = mesial - 1
pin_a = int(mm_[np.lexsort((-X[mm_, 1], X[mm_, 2]))[0]] + 1)
pin_b = int(mm_[np.lexsort((-X[mm_, 1], -X[mm_, 2]))[0]] + 1)
print(f"nodes {N_NODE}, socket elements {N_SOCK}, all {nxt - 1}, mesial {len(mesial)}, distal {len(distal)}")

def rows(v, k=16):
    v = list(v); return "\n".join(", ".join(str(x) for x in v[i:i + k]) for i in range(0, len(v), k))
with open(os.path.join(a.out, "model_template.inp"), "w") as f:
    f.write("** SG-Bone dental: socket model from segmentation masks (dental/geometry/socket_from_masks.py)\n")
    f.write("*NODE, NSET=NALL\n")
    for i, x in enumerate(X):
        f.write(f"{i+1}, {x[0]:.6f}, {x[1]:.6f}, {x[2]:.6f}\n")
    for region in ["SOCKET", "COMPACT", "TRABECULAR", "TOOTH"]:
        if not elems[region]: continue
        f.write(f"*ELEMENT, TYPE=C3D10, ELSET={region}\n")
        for e, c in zip(label[region], elems[region]):
            f.write(f"{e}, " + ", ".join(str(v) for v in c) + "\n")
    f.write("*NSET, NSET=MESIAL\n" + rows(mesial) + "\n*NSET, NSET=DISTAL\n" + rows(distal) + "\n")
    f.write(f"*NSET, NSET=PIN_A\n{pin_a}\n*NSET, NSET=PIN_B\n{pin_b}\n")
    for region, E_, nu in [("COMPACT", a.E_compact, 0.3), ("TRABECULAR", a.E_trab, 0.3), ("TOOTH", a.E_tooth, 0.31)]:
        if elems[region]:
            f.write(f"*MATERIAL, NAME=M_{region}\n*ELASTIC\n{E_}, {nu}\n*SOLID SECTION, ELSET={region}, MATERIAL=M_{region}\n")
    f.write("*BOUNDARY\nMESIAL, 1, 1\nPIN_A, 2, 3\nPIN_B, 2, 2\n")
    f.write("** ---- the C++ code (Write_ccx_input) appends from here ----\n")
with open(os.path.join(a.out, "node_file.txt"), "w") as f:
    for i, x in enumerate(X):
        f.write(f"{i+1}, {x[0]:.6f}, {x[1]:.6f}, {x[2]:.6f}\n")
with open(os.path.join(a.out, "element_file.txt"), "w") as f:
    for e, c in zip(label["SOCKET"], elems["SOCKET"]):
        f.write(f"{e}, " + ", ".join(str(v) for v in c) + "\n")

# --- lattice: the fine grid over the socket elements' bounding box plus --lattice-margin
sc = np.array([ci for ci, t in cube_type.items() if t == "SOCKET"])
mg = int(round(a.lattice_margin / a.cell))
m0 = np.maximum(sc.min(0) * k - mg, 0); m1 = np.minimum((sc.max(0) + 1) * k + mg, k * n)
ORIGIN = lo + shift + m0 * a.cell
LN = m1 - m0
gi = [ORIGIN[d] + a.cell * np.arange(LN[d]) for d in range(3)]
GX, GY, GZ = np.meshgrid(*gi, indexing="ij")
pts = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], 1)
lab = F[m0[0]:m1[0], m0[1]:m1[1], m0[2]:m1[2]].copy()
init = np.full(tuple(LN), 11, np.uint8)
init[lab == LB["soft"]] = 14
sock_map = np.zeros(tuple(LN), np.uint8); zone = np.zeros(tuple(LN), np.uint8); graft = np.zeros(tuple(LN), np.uint8)
names, info = [], []
for n_, s_ in enumerate(socks):
    m = lab == s_["label"]
    init[m] = 0; sock_map[m] = n_ + 1
    cr, ap = np.array(s_["crest"]), np.array(s_["apex"])
    Lax = np.linalg.norm(ap - cr); u = (ap - cr) / Lax
    t = ((pts.reshape(*LN, 3) - cr) @ u) / Lax
    third = np.where(t >= 2 / 3, 0, np.where(t >= 1 / 3, 1, 2))           # 0 apical, 1 middle, 2 coronal
    zone[m] = 1 + 3 * n_ + third[m]
    names += [f"{s_['name']}_apical", f"{s_['name']}_middle", f"{s_['name']}_coronal"]
    if s_["name"] in a.graft: graft[m] = 1
    info.append(dict(name=s_["name"], label=s_["label"], grafted=s_["name"] in a.graft, lattice_points=int(m.sum()),
                     volume_mm3_lattice=round(float(m.sum() * a.cell ** 3), 2), crest_to_apex_mm=round(float(Lax), 2)))
for arr, nm in [(init, "lattice_init.raw"), (zone, "zone_map.raw"), (graft, "graft_mask.raw"), (sock_map, "socket_map.raw")]:
    arr.tofile(os.path.join(a.out, nm))
open(os.path.join(a.out, "zone_names.txt"), "w").write("\n".join(names) + "\n")
yc = np.argwhere(sock_map > 0)[:, 1].mean()
SECTION_J = int(round(yc))
with open(os.path.join(a.out, "model_info.h"), "w") as f:
    f.write("// Written by dental/geometry/socket_from_masks.py\n#pragma once\n#define SG_INIT_DECIDES 1\n"
            f"constexpr int NUMBER_NODES = {N_NODE};\nconstexpr int NUMBER_ELEMS = {N_SOCK}; // socket elements\n"
            f"constexpr int LATTICE_X = {LN[0]};\nconstexpr int LATTICE_Y = {LN[1]};\nconstexpr int LATTICE_Z = {LN[2]};\n"
            f"constexpr float LATTICE_ORIGIN_X = {ORIGIN[0]:.6f}f;\nconstexpr float LATTICE_ORIGIN_Y = {ORIGIN[1]:.6f}f;\n"
            f"constexpr float LATTICE_ORIGIN_Z = {ORIGIN[2]:.6f}f;\nconstexpr float BLOCK_LENGTH_X = {x1 - x0:.6f}f; // MESIAL to DISTAL face (mm)\n"
            f"constexpr float SOCKET_Z_APEX = {-info[0]['crest_to_apex_mm']:.6f}f; // unused with zone_map.raw\n"
            f"constexpr int SECTION_J = {SECTION_J}; // lattice plane y through the sockets' centre\n")
summary = dict(parameters=vars(a), nodes=N_NODE, socket_elements=N_SOCK, elements=int(nxt - 1), cubes=counts,
               block_mm=dict(lo=lo.tolist(), hi=hi.tolist()), load_axis="x", lattice=dict(size=LN.tolist(), origin=ORIGIN.tolist(),
               section_j=SECTION_J), sockets=info, zones=names,
               socket_element_mean_volume_mm3=round(a.cube ** 3 / 6, 4))
json.dump(summary, open(os.path.join(a.out, "mesh_summary.json"), "w"), indent=1)
print(json.dumps({k: summary[k] for k in ["nodes", "socket_elements", "elements", "cubes", "lattice", "sockets"]}, indent=1))
