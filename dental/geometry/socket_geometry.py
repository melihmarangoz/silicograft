"""Idealized beagle P3 single-root extraction socket in a block of alveolar bone:
gmsh geometry, CalculiX mesh and the initial agent lattice for the SG-Bone dental model.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

Coordinates (mm): x mesio-distal, y bucco-lingual (y < 0 buccal, y > 0 lingual), z vertical with
z = 0 at the alveolar crest and the socket below it (z < 0). The central mesio-distal section of
Hong et al. 2014 is the plane y = 0.

Dimensions and sources (literature table: dental/literature/GAPS_SEARCH.md, section 1 and 3):
  socket depth 8.5 mm                  [nakajima2026: beagle P3/P4 mesial sockets 8.2-8.7 mm;
                                         fan2021: beagle P3 distal socket 8.5 mm]
  crest diameter 3.6 mm, circular      between P3 distal 3.2 mm [fan2021] and P3/P4 mesial
                                         3.9 (BL) x 4.25 (MD) mm [nakajima2026]; circular section ASSUMED
  apex diameter = 50 % of crest        ASSUMED (GAPS_SEARCH recommendation, sensitivity 30-70 %);
                                         taper half-angle 6.8 deg, inside the 6-9 deg of human premolars [sun2018]
  rounded fundus                       ASSUMED: hemisphere with the apex radius
  buccal wall 0.6 mm at the crest, 1.55 mm at 5 mm depth, outer surface vertical below
                                       [zhang2021atm, Labrador premolars; beagle 0.75 mm at 1 mm: nakajima2026]
  lingual wall 1.5 mm at the crest, outer surface vertical   ASSUMED (no open source)
  flat crest                           ASSUMED (lingual crest is 0.3-0.45 mm higher in beagles)
  block 10 mm mesio-distal, bottom 3.5 mm below the apex      ASSUMED (crest to canal 8.2 mm at P3, xie2018)
  alveolar process around the root compact (BV/TV 0.98) [huja2006]: E 13.7 GPa [zapata2011; ashman1985]
  trabecular body below z = -9.0 with a 1.2 mm cortical shell buccally and lingually:
                                         E 375 MPa (DERIVED, GAPS_SEARCH section 3), shell thickness ASSUMED
  Poisson's ratio 0.3 for both bone types   ASSUMED

The socket (callus equivalent) is meshed with quadratic tets of about --socket-size mm so that each
element holds enough lattice points for the per-element cell rules (see dental/README.md).

Outputs (in --out):
  model_template.inp   nodes, elements, bone materials, node sets and fixed boundary conditions
                       (socket materials and the load step are appended by the C++ Write_ccx_input)
  node_file.txt        all nodes "label, x, y, z"
  element_file.txt     socket elements "label, n1..n10" (CalculiX C3D10 order)
  model_info.h         NUMBER_NODES, NUMBER_ELEMS, lattice size and origin, block length
  lattice_init.raw     uint8 [LATTICE_X][LATTICE_Y][LATTICE_Z]: 0 socket, 11 native bone, 14 soft-tissue cover
                       above the crest (the C++ code reconciles it with the socket elements and seeds the MSCs)
  mesh.vtu             for ParaView
  mesh_summary.json    parameters, counts and volumes
"""
import argparse, json, math, os, sys
import numpy as np
import gmsh

p = argparse.ArgumentParser()
p.add_argument("--out", default="mesh")
p.add_argument("--socket-size", type=float, default=0.8, help="socket element size (mm)")
p.add_argument("--bone-size", type=float, default=1.0, help="compact bone element size (mm)")
p.add_argument("--trab-size", type=float, default=1.5, help="trabecular bone element size (mm)")
# socket
p.add_argument("--depth", type=float, default=8.5)
p.add_argument("--crest-diameter", type=float, default=3.6)
p.add_argument("--apex-ratio", type=float, default=0.5, help="apex diameter / crest diameter")
# walls and block
p.add_argument("--buccal-crest", type=float, default=0.6)
p.add_argument("--buccal-5mm", type=float, default=1.55)
p.add_argument("--lingual", type=float, default=1.5)
p.add_argument("--block-x", type=float, default=10.0, help="mesio-distal block length (mm)")
p.add_argument("--below-apex", type=float, default=3.5)
p.add_argument("--trab-top-below-apex", type=float, default=0.5)
p.add_argument("--shell", type=float, default=1.2)
p.add_argument("--E-compact", type=float, default=13700.0)
p.add_argument("--E-trab", type=float, default=375.0)
# lattice
p.add_argument("--lattice-margin", type=float, default=0.3, help="lattice margin around the socket (mm)")
a = p.parse_args()
os.makedirs(a.out, exist_ok=True)

CELL = 0.1
R_C = a.crest_diameter / 2
R_A = R_C * a.apex_ratio
Z_B = -(a.depth - R_A)            # centre of the fundus hemisphere = bottom of the frustum
Z_APEX = -a.depth
TAN = (R_C - R_A) / (-Z_B)
COS = 1.0 / math.sqrt(1 + TAN ** 2)
Y_BUC_0 = -(R_C + a.buccal_crest)                         # buccal outer surface at the crest
Y_BUC_5 = -((R_C - TAN * 5.0) + a.buccal_5mm)             # ... at 5 mm depth, vertical below
Y_LIN = R_C + a.lingual
Z_BOT = Z_APEX - a.below_apex
Z_TRAB = Z_APEX - a.trab_top_below_apex
X0, X1 = -a.block_x / 2, a.block_x / 2
assert Y_BUC_5 <= Y_BUC_0, "buccal outer surface must not move inwards with depth"

gmsh.initialize()
gmsh.option.setNumber("General.Terminal", 1)
gmsh.option.setNumber("General.Verbosity", 2)
gmsh.model.add("socket")
occ = gmsh.model.occ

# --- socket: frustum + hemispherical fundus
cone = occ.addCone(0, 0, Z_B, 0, 0, -Z_B, R_A, R_C)
sph = occ.addSphere(0, 0, Z_B, R_A)
socket, _ = occ.fuse([(3, cone)], [(3, sph)])

# --- block: y-z profile extruded along x
pts = [occ.addPoint(X0, y, z) for (y, z) in [(Y_BUC_0, 0.0), (Y_LIN, 0.0), (Y_LIN, Z_BOT), (Y_BUC_5, Z_BOT), (Y_BUC_5, -5.0)]]
lines = [occ.addLine(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]
face = occ.addPlaneSurface([occ.addCurveLoop(lines)])
ext = occ.extrude([(2, face)], a.block_x, 0, 0)
block = [e for e in ext if e[0] == 3]

# --- trabecular core below the apex, inside the buccal and lingual shells
trab = [(3, occ.addBox(X0, Y_BUC_5 + a.shell, Z_BOT, a.block_x, (Y_LIN - a.shell) - (Y_BUC_5 + a.shell), Z_TRAB - Z_BOT))]
occ.synchronize()

objects = {"SOCKET": socket, "TRABECULAR": trab, "COMPACT": block}
all_e, owner = [], []
for name, lst in objects.items():
    for e in lst:
        all_e.append(e); owner.append(name)
out, out_map = occ.fragment(all_e, [])
occ.synchronize()
priority = ["SOCKET", "TRABECULAR", "COMPACT"]
region = {}
for e, name in zip(out_map, owner):
    for v in e:
        if v[0] != 3: continue
        prev = region.get(v[1])
        if prev is None or priority.index(name) < priority.index(prev):
            region[v[1]] = name
for name in priority:
    gmsh.model.addPhysicalGroup(3, [t for t, r in region.items() if r == name], name=name)
vol = {n: 0.0 for n in priority}
for t, r in region.items():
    vol[r] += occ.getMass(3, t)
print("Volumes (mm3):", {k: round(v, 2) for k, v in vol.items()})

# --- mesh: constant size per region
gmsh.option.setNumber("Mesh.MeshSizeFromPoints", 0)
gmsh.option.setNumber("Mesh.MeshSizeExtendFromBoundary", 0)
gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 0)
fields = []
for name, h in [("SOCKET", a.socket_size), ("COMPACT", a.bone_size), ("TRABECULAR", a.trab_size)]:
    f = gmsh.model.mesh.field.add("Constant")
    gmsh.model.mesh.field.setNumbers(f, "VolumesList", [t for t, r in region.items() if r == name])
    gmsh.model.mesh.field.setNumber(f, "VIn", h)
    gmsh.model.mesh.field.setNumber(f, "VOut", 1e3)
    gmsh.model.mesh.field.setNumber(f, "IncludeBoundary", 1)
    fields.append(f)
fm = gmsh.model.mesh.field.add("Min")
gmsh.model.mesh.field.setNumbers(fm, "FieldsList", fields)
gmsh.model.mesh.field.setAsBackgroundMesh(fm)
gmsh.option.setNumber("Mesh.ElementOrder", 2)
gmsh.option.setNumber("Mesh.SecondOrderLinear", 1)  # straight edges: same planar faces as the lattice mapping, no curved-element distortion
gmsh.option.setNumber("Mesh.Optimize", 1)
gmsh.option.setNumber("Mesh.HighOrderOptimize", 0)
gmsh.model.mesh.generate(3)

ntags, ncoord, _ = gmsh.model.mesh.getNodes()
ncoord = ncoord.reshape(-1, 3)
elems, used = {}, set()
for name in priority:
    conn = []
    for t in [t for t, r in region.items() if r == name]:
        et, _, en = gmsh.model.mesh.getElements(3, t)
        for typ, nn in zip(et, en):
            assert typ == 11, f"unexpected element type {typ}"  # 11 = 10-node tet
            conn.append(np.asarray(nn, dtype=np.int64).reshape(-1, 10))
    c = np.vstack(conn)
    c = c[:, [0, 1, 2, 3, 4, 5, 6, 7, 9, 8]]  # gmsh tet10 -> CalculiX C3D10 (swap nodes 8 and 9)
    elems[name] = c
    used.update(np.unique(c).tolist())
tag2idx = {int(t): i for i, t in enumerate(ntags)}
old = np.array(sorted(used), dtype=np.int64)
new = {int(t): i + 1 for i, t in enumerate(old)}
X = np.array([ncoord[tag2idx[int(t)]] for t in old])
for name in elems:
    elems[name] = np.vectorize(new.get)(elems[name])

# mid-side node order (C3D10): 4=(0,1) 5=(1,2) 6=(2,0) 7=(0,3) 8=(1,3) 9=(2,3)
for name in elems:
    c = elems[name] - 1
    for k, (i, j) in enumerate([(0, 1), (1, 2), (2, 0), (0, 3), (1, 3), (2, 3)]):
        mid = 0.5 * (X[c[:, i]] + X[c[:, j]])
        assert np.abs(X[c[:, 4 + k]] - mid).max() < 1e-6, f"{name}: mid-side node order wrong (edge {k})"
def signed_volumes(c):
    c = c - 1
    return np.einsum("ij,ij->i", np.cross(X[c[:, 1]] - X[c[:, 0]], X[c[:, 2]] - X[c[:, 0]]), X[c[:, 3]] - X[c[:, 0]]) / 6
for name in elems:
    v = signed_volumes(elems[name])
    assert (v > 0).all(), f"{name}: {(v <= 0).sum()} elements with non-positive volume"

# element labels: socket 1..N (C++ FIRST_CALLUS_ELEMENT = 1), then bone
label = {}
nxt = 1
for name in ["SOCKET", "COMPACT", "TRABECULAR"]:
    n = len(elems[name]); label[name] = np.arange(nxt, nxt + n); nxt += n
N_NODE, N_SOCK = len(X), len(elems["SOCKET"])

tol = 1e-6
mesial = np.where(np.abs(X[:, 0] - X0) < tol)[0] + 1
distal = np.where(np.abs(X[:, 0] - X1) < tol)[0] + 1
# rigid-body suppression on the mesial face: PIN_A (bottom, lingual) uy = uz = 0, PIN_B (crest, lingual) uy = 0
m = mesial - 1
pin_a = int(m[np.lexsort((-X[m, 1], X[m, 2]))[0]] + 1)    # lowest z, then largest y
pin_b = int(m[np.lexsort((-X[m, 1], -X[m, 2]))[0]] + 1)   # highest z, then largest y
print(f"Nodes {N_NODE}, socket elements {N_SOCK}, all elements {nxt - 1}, mesial {len(mesial)}, distal {len(distal)}, "
      f"PIN_A {pin_a} {X[pin_a-1].round(3)}, PIN_B {pin_b} {X[pin_b-1].round(3)}")

def rows(v, n=16):
    v = list(v)
    return "\n".join(", ".join(str(x) for x in v[i:i + n]) for i in range(0, len(v), n))

with open(os.path.join(a.out, "model_template.inp"), "w") as f:
    f.write("** SG-Bone dental: idealized beagle P3 single-root socket in alveolar bone (CalculiX template)\n")
    f.write("** Written by dental/geometry/socket_geometry.py. Socket materials and the load step are appended by the C++ code.\n")
    f.write("*NODE, NSET=NALL\n")
    for i, x in enumerate(X):
        f.write(f"{i+1}, {x[0]:.6f}, {x[1]:.6f}, {x[2]:.6f}\n")
    for name in ["SOCKET", "COMPACT", "TRABECULAR"]:
        f.write(f"*ELEMENT, TYPE=C3D10, ELSET={name}\n")
        for e, c in zip(label[name], elems[name]):
            f.write(f"{e}, " + ", ".join(str(v) for v in c) + "\n")
    f.write("*NSET, NSET=MESIAL\n" + rows(mesial) + "\n")
    f.write("*NSET, NSET=DISTAL\n" + rows(distal) + "\n")
    f.write(f"*NSET, NSET=PIN_A\n{pin_a}\n*NSET, NSET=PIN_B\n{pin_b}\n")
    f.write("** native bone (see socket_geometry.py for sources)\n")
    for name, E, nu in [("COMPACT", a.E_compact, 0.3), ("TRABECULAR", a.E_trab, 0.3)]:
        f.write(f"*MATERIAL, NAME=M_{name}\n*ELASTIC\n{E}, {nu}\n*SOLID SECTION, ELSET={name}, MATERIAL=M_{name}\n")
    f.write("** fixed supports: mesial face ux = 0, two pins against rigid-body motion\n")
    f.write("*BOUNDARY\nMESIAL, 1, 1\nPIN_A, 2, 3\nPIN_B, 2, 2\n")
    f.write("** ---- the C++ code (Write_ccx_input) appends from here ----\n")
with open(os.path.join(a.out, "node_file.txt"), "w") as f:
    for i, x in enumerate(X):
        f.write(f"{i+1}, {x[0]:.6f}, {x[1]:.6f}, {x[2]:.6f}\n")
with open(os.path.join(a.out, "element_file.txt"), "w") as f:
    for e, c in zip(label["SOCKET"], elems["SOCKET"]):
        f.write(f"{e}, " + ", ".join(str(v) for v in c) + "\n")

# --- lattice: covers the socket plus a margin; voxel centres on a 0.1 mm grid with x = y = 0 on a point
nxy = int(round((R_C + a.lattice_margin) / CELL))
LX = LY = 2 * nxy + 1
# z planes sit half a voxel off the crest (z = -0.05 is the top socket layer, z = +0.05 the first cover
# layer), so that no lattice plane lies on the socket's top face; y = 0 (the central section) is a lattice plane
k_crest = int(round((-Z_APEX + a.lattice_margin) / CELL))  # index of the plane z = -0.05
LZ = k_crest + int(round(a.lattice_margin / CELL)) + 1
ORIGIN = (-nxy * CELL, -nxy * CELL, -(k_crest * CELL + CELL / 2))
ii, jj, kk = np.meshgrid(np.arange(LX), np.arange(LY), np.arange(LZ), indexing="ij")
xs, ys, zs = (ii - nxy) * CELL, (jj - nxy) * CELL, (kk - k_crest) * CELL - CELL / 2
r = np.hypot(xs, ys)
# signed distance to the socket wall (lateral cone and fundus; the crest plane is not a wall)
d_cone = (r - (R_A + TAN * (zs - Z_B))) * COS
d_sph = np.sqrt(r ** 2 + (zs - Z_B) ** 2) - R_A
d_wall = np.where(zs >= Z_B, d_cone, d_sph)
inside = (d_wall < 0) & (zs < 0)
lattice = np.full((LX, LY, LZ), 11, dtype=np.uint8)
lattice[zs > 0] = 14
lattice[inside] = 0
lattice.tofile(os.path.join(a.out, "lattice_init.raw"))
print(f"Lattice {LX} x {LY} x {LZ}, origin {ORIGIN}, socket points {int(inside.sum())} ({inside.sum() * 1e-3:.2f} mm3)")

with open(os.path.join(a.out, "model_info.h"), "w") as f:
    f.write("// Written by dental/geometry/socket_geometry.py\n#pragma once\n"
            f"constexpr int NUMBER_NODES = {N_NODE};\n"
            f"constexpr int NUMBER_ELEMS = {N_SOCK}; // socket elements\n"
            f"constexpr int LATTICE_X = {LX};\nconstexpr int LATTICE_Y = {LY};\nconstexpr int LATTICE_Z = {LZ};\n"
            f"constexpr float LATTICE_ORIGIN_X = {ORIGIN[0]:.6f}f;\n"
            f"constexpr float LATTICE_ORIGIN_Y = {ORIGIN[1]:.6f}f;\n"
            f"constexpr float LATTICE_ORIGIN_Z = {ORIGIN[2]:.6f}f;\n"
            f"constexpr float BLOCK_LENGTH_X = {a.block_x:.6f}f; // mesial to distal face (mm)\n"
            f"constexpr float SOCKET_Z_APEX = {Z_APEX:.6f}f; // socket fundus; crest at z = 0\n"
            f"constexpr int SECTION_J = {nxy}; // lattice plane y = 0 (central mesio-distal section)\n")

import meshio
cells, reg = [], []
for k, name in enumerate(["SOCKET", "COMPACT", "TRABECULAR"]):
    cells.append(("tetra10", elems[name][:, [0, 1, 2, 3, 4, 5, 6, 7, 9, 8]] - 1))
    reg.append(np.full(len(elems[name]), k))
meshio.write(os.path.join(a.out, "mesh.vtu"), meshio.Mesh(X, cells, cell_data={"region": reg}))

sv = signed_volumes(elems["SOCKET"])
summary = dict(parameters=vars(a), nodes=N_NODE, socket_elements=N_SOCK, elements=int(nxt - 1),
               volumes_mm3=vol, socket_volume_from_mesh=float(sv.sum()),
               socket_element_volume_mm3=dict(mean=float(sv.mean()), min=float(sv.min()), max=float(sv.max())),
               lattice=dict(size=[LX, LY, LZ], origin=ORIGIN, crest_k=k_crest, centre_ij=nxy,
                            socket_points_analytic=int(inside.sum())),
               socket=dict(z_crest=0.0, z_apex=Z_APEX, crest_radius=R_C, apex_radius=R_A, taper_half_angle_deg=math.degrees(math.atan(TAN))),
               block=dict(x=[X0, X1], y_buccal_crest=Y_BUC_0, y_buccal_below_5mm=Y_BUC_5, y_lingual=Y_LIN, z=[Z_BOT, 0.0], z_trabecular_top=Z_TRAB),
               nsets=dict(mesial=len(mesial), distal=len(distal), pin_a=pin_a, pin_b=pin_b))
json.dump(summary, open(os.path.join(a.out, "mesh_summary.json"), "w"), indent=1)
print(json.dumps({k: summary[k] for k in ["nodes", "socket_elements", "elements", "socket_volume_from_mesh", "socket_element_volume_mm3"]}, indent=1))
gmsh.finalize()
