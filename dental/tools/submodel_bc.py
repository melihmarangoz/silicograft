"""Load steps for the socket model from a larger model (submodelling): bc_file for the C++ code.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

The socket model (model_template.inp from geometry/socket_from_masks.py) is a block cut out of the jaw. Here its cut
faces (the nodes on the block's bounding planes) get the displacements of a larger model, e.g. a voxel model of the
whole jaw (tools/voxel_fe.py), interpolated trilinearly from that model's nodes. A step may also carry a pressure on
the coronal surface of the sockets (e.g. a pontic pressing on the soft tissue over them): *DLOAD on the free faces of
SOCKET elements that face coronally (outward normal within 60 degrees of the crest-ward socket axis) near the crest.

Field file (npz): origin (3), h, node_grid (n, 3) integer node indices, names (cases), u (cases, n, 3), in a frame that
is the socket model's block frame plus --offset (mm).
Steps: --step NAME=CASE[*w][+CASE[*w]...][@P_MPa | @d=DELTA_MM], e.g. "bite=incisal", "bite_p=incisal+ovate@0.01",
"bite_ovate=incisal@d=0.5". With @d= the nodes of those coronal faces (except nodes shared with bone or tooth
elements) are moved DELTA_MM along the apical socket axis on top of the field: a pontic seated into the soft tissue
over the socket (displacement-controlled interference; the tissue's own stiffness then sets the pressure).
The output holds one *STEP per --step, each ending with *EL PRINT, ELSET=SOCKET / S, E (as the C++ reader expects).

usage: submodel_bc.py --template model_template.inp --field fields.npz --offset ox oy oz --sockets sockets.json
                      --step ... [--step ...] --out bc.inp
"""
import argparse, json
import numpy as np

p = argparse.ArgumentParser()
p.add_argument("--template", required=True); p.add_argument("--field", required=True)
p.add_argument("--offset", type=float, nargs=3, default=[0, 0, 0]); p.add_argument("--sockets", required=True)
p.add_argument("--step", action="append", required=True); p.add_argument("--out", required=True)
p.add_argument("--crest-depth", type=float, default=1.5, help="pressure faces within this depth (mm) below the crest")
a = p.parse_args()

nodes, elems, cur = {}, {}, None
for line in open(a.template):
    if line.startswith("*"):
        u = line.upper().replace(" ", "")
        cur = "N" if u.startswith("*NODE,") or u == "*NODE\n" else ("E" + u.split("ELSET=")[1].split(",")[0].strip()
                                                                     if u.startswith("*ELEMENT") else None)
        continue
    if cur == "N":
        q = line.split(","); nodes[int(q[0])] = [float(x) for x in q[1:4]]
    elif cur and cur.startswith("E"):
        q = [int(x) for x in line.replace(",", " ").split()]
        elems[q[0]] = (cur[1:], q[1:])
ids = np.array(sorted(nodes)); X = np.array([nodes[i] for i in ids]); pos = {n: k for k, n in enumerate(ids)}
lo, hi = X.min(0), X.max(0); tol = 1e-6
cut = np.any((np.abs(X - lo) < tol) | (np.abs(X - hi) < tol), axis=1)
print(f"{len(ids)} nodes, {len(elems)} elements, {int(cut.sum())} nodes on the block's cut faces")

F = np.load(a.field); org, h = F["origin"], float(F["h"]); G = F["node_grid"]; names = [str(x) for x in F["names"]]; Ucases = F["u"]
gl = G.min(0); gs = G.max(0) - gl + 1
lut = np.full(gs, -1, np.int64); lut[tuple((G - gl).T)] = np.arange(len(G))
def interp(P):
    """trilinear interpolation weights over the field's existing nodes -> (idx (n, 8), w (n, 8))"""
    g = (P + np.array(a.offset) - org) / h - gl
    b = np.floor(g).astype(int); f = g - b
    idx = np.full((len(P), 8), -1); w = np.zeros((len(P), 8))
    for c, o in enumerate(np.array([[i, j, k] for i in (0, 1) for j in (0, 1) for k in (0, 1)])):
        q = b + o; ok = np.all((q >= 0) & (q < gs), 1)
        idx[ok, c] = lut[tuple(q[ok].T)]
        w[:, c] = np.prod(np.where(o == 1, f, 1 - f), 1)
    w[idx < 0] = 0; sw = w.sum(1)
    bad = sw < 1e-9
    if bad.any():   # no field node around (e.g. soft tissue that the larger model leaves out): nearest field node
        from scipy.spatial import cKDTree
        dd, nn_ = cKDTree(G - gl).query(g[bad])
        if dd.max() * h > 2.0: raise SystemExit(f"{int(bad.sum())} nodes lie outside the field (up to {dd.max() * h:.2f} mm)")
        idx[bad] = -1; idx[bad, 0] = nn_; w[bad] = 0; w[bad, 0] = 1; sw[bad] = 1
        print(f"  {int(bad.sum())} nodes outside the field's elements: nearest field node (up to {dd.max() * h:.2f} mm)")
    return idx, w / sw[:, None]
def disp(case_w, P):
    idx, w = interp(P); u = np.zeros((len(P), 3))
    for name, wt in case_w:
        Uc = Ucases[names.index(name)]
        u += wt * np.einsum("nk,nkd->nd", w, Uc[np.maximum(idx, 0)])
    return u
Pc = X[cut]

# coronal free faces of SOCKET elements near the crest (C3D10 faces by corner nodes: CalculiX numbering)
S = json.load(open(a.sockets))["sockets"]
FACES = [(0, 1, 2), (0, 3, 1), (1, 3, 2), (2, 3, 0)]
count = {}
for e, (es, cn) in elems.items():
    for fi, fc in enumerate(FACES):
        key = tuple(sorted(cn[i] for i in fc)); count[key] = count.get(key, 0) + 1
press = []; press_nodes = {}
FACE_NODES = [(0, 1, 2, 4, 5, 6), (0, 3, 1, 7, 8, 4), (1, 3, 2, 8, 9, 5), (2, 3, 0, 9, 7, 6)]   # corners + midsides
nonsock = set()
for e, (es, cn) in elems.items():
    if es != "SOCKET": nonsock.update(cn)
for e, (es, cn) in elems.items():
    if es != "SOCKET": continue
    P4 = np.array([nodes[n] for n in cn[:4]]); ce = P4.mean(0)
    for fi, fc in enumerate(FACES):
        if count[tuple(sorted(cn[i] for i in fc))] != 1: continue
        tri = P4[list(fc)]; nrm = np.cross(tri[1] - tri[0], tri[2] - tri[0]); nrm /= np.linalg.norm(nrm)
        fcen = tri.mean(0)
        if nrm @ (fcen - ce) < 0: nrm = -nrm
        best = None
        for s_ in S:
            cr, ap = np.array(s_["crest"]), np.array(s_["apex"]); axv = (ap - cr) / np.linalg.norm(ap - cr)
            t = (fcen - cr) @ axv; r = np.linalg.norm((fcen - cr) - t * axv)
            if t <= a.crest_depth and r <= 6.0 and nrm @ (-axv) > 0.5: best = (s_["name"], axv)
        if best:
            press.append((e, fi + 1))
            for k_ in FACE_NODES[fi]:
                n_ = cn[k_]
                if n_ not in nonsock: press_nodes[n_] = best[1]
print(f"{len(press)} coronal socket faces for pressure loads, {len(press_nodes)} of their nodes free of bone and tooth")
pn_ids = np.array(sorted(press_nodes)); pn_ax = np.array([press_nodes[n] for n in pn_ids]) if len(pn_ids) else np.zeros((0, 3))
pn_cut = np.isin(pn_ids, ids[cut]); pn_ids, pn_ax = pn_ids[~pn_cut], pn_ax[~pn_cut]

with open(a.out, "w") as f:
    f.write("** load steps from a larger model (dental/tools/submodel_bc.py)\n")
    for st in a.step:
        name, rest = st.split("=", 1)
        pr = 0.0; dl = 0.0
        if "@" in rest:
            rest, prs = rest.split("@")
            if prs.startswith("d="): dl = float(prs[2:])
            else: pr = float(prs)
        cw = []
        for term in rest.split("+"):
            n_, wt = (term.split("*") + ["1"])[:2]
            if n_.strip(): cw.append((n_.strip(), float(wt)))
        u = disp(cw, Pc)
        f.write(f"** STEP {name}: {' + '.join(f'{w_}*{n_}' for n_, w_ in cw) or 'no field'}" + (f", coronal socket pressure {pr} MPa" if pr else "")
                + (f", coronal socket surface moved {dl} mm apically" if dl else "") + "\n")
        f.write("*STEP\n*STATIC\n1., 1., 1e-05, 1.\n*BOUNDARY\n")
        for nid_, uu in zip(ids[cut], u):
            for d in range(3): f.write(f"{nid_}, {d + 1}, {d + 1}, {uu[d]:.6e}\n")
        if dl:
            ud = disp(cw, np.array([nodes[n] for n in pn_ids])) + dl * pn_ax
            for nid_, uu in zip(pn_ids, ud):
                for d in range(3): f.write(f"{nid_}, {d + 1}, {d + 1}, {uu[d]:.6e}\n")
        if pr:
            f.write("*DLOAD\n")
            for e, fi in press: f.write(f"{e}, P{fi}, {pr:.6e}\n")
        f.write("*EL PRINT, ELSET=SOCKET\nS, E\n*END STEP\n")
        print(f"step {name}: max |u| on the cut faces {np.linalg.norm(u, axis=1).max():.3e} mm" + (f", pressure {pr} MPa on {len(press)} faces" if pr else "")
              + (f", {len(pn_ids)} coronal nodes moved {dl} mm" if dl else ""))
