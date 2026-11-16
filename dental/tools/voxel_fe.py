"""Linear-elastic finite elements on a voxel grid (8-node bricks), for jaw-scale models built from segmentations.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

Every voxel with a material (E > 0) is one 8-node brick with full 2x2x2 Gauss integration, i.e. the CalculiX C3D8
element. Each voxel has its own E and nu (nu is binned to 0.001 so that bricks share element matrices). The stiffness
matrix is assembled in 3x3 node blocks over the 27-node stencil of the grid and solved with conjugate gradients,
preconditioned by smoothed-aggregation algebraic multigrid (pyamg; rigid-body modes as near null space). Fixed
degrees of freedom are removed by zeroing their rows and columns (unit diagonal), which keeps the matrix symmetric.

write_ccx() writes the same model as a CalculiX deck (C3D8, one material per (E, nu) pair), so that the solver can be
checked against CalculiX on a coarse grid. Strains and stresses are evaluated at the brick centres; shear strains in
the 6-vectors are tensor components (as CalculiX prints them): order xx, yy, zz, xy, xz, yz.
"""
import numpy as np
import scipy.sparse as sp

OFF = np.array([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]])  # C3D8 order
SIGN = 2 * OFF - 1


def _dN(xi):
    """derivatives of the 8 trilinear shape functions w.r.t. natural coordinates at xi (3,) -> (8, 3)"""
    t = 1 + SIGN * np.asarray(xi)[None, :]
    d = np.empty((8, 3))
    d[:, 0] = SIGN[:, 0] * t[:, 1] * t[:, 2] / 8
    d[:, 1] = SIGN[:, 1] * t[:, 0] * t[:, 2] / 8
    d[:, 2] = SIGN[:, 2] * t[:, 0] * t[:, 1] / 8
    return d


def B_matrix(xi, h):
    """6x24 strain-displacement matrix (engineering shears) of a cube with edge h at natural coordinates xi"""
    dN = _dN(xi) * 2.0 / h
    B = np.zeros((6, 24))
    for a in range(8):
        x, y, z = dN[a]
        c = 3 * a
        B[0, c] = x; B[1, c + 1] = y; B[2, c + 2] = z
        B[3, c] = y; B[3, c + 1] = x          # gamma_xy
        B[4, c] = z; B[4, c + 2] = x          # gamma_xz
        B[5, c + 1] = z; B[5, c + 2] = y      # gamma_yz
    return B


def D_matrix(E, nu):
    lam = E * nu / ((1 + nu) * (1 - 2 * nu)); mu = E / (2 * (1 + nu))
    D = np.zeros((6, 6)); D[:3, :3] = lam; D[[0, 1, 2], [0, 1, 2]] += 2 * mu; D[[3, 4, 5], [3, 4, 5]] = mu
    return D


def brick_K(nu, h):
    """24x24 stiffness of a cube with edge h for E = 1 (2x2x2 Gauss)"""
    g = 1 / np.sqrt(3); D = D_matrix(1.0, nu); K = np.zeros((24, 24))
    for xi in SIGN * g:
        B = B_matrix(xi, h); K += B.T @ D @ B * (h / 2) ** 3
    return K


class VoxelModel:
    """E, nu: arrays (nx, ny, nz) on the voxel grid (E = 0: void). origin: position of node (0, 0, 0); h: edge."""

    def __init__(self, E, nu, h, origin=(0.0, 0.0, 0.0)):
        self.h = float(h); self.origin = np.asarray(origin, float)
        self.shape = np.array(E.shape)
        self.eidx = np.argwhere(E > 0)                                   # element grid indices (ne, 3)
        self.E = E[E > 0].astype(np.float64)
        self.nu = np.round(nu[E > 0].astype(np.float64), 3)
        ns = self.shape + 1
        has = np.zeros(ns, bool)
        for o in OFF:
            has[o[0]:o[0] + self.shape[0], o[1]:o[1] + self.shape[1], o[2]:o[2] + self.shape[2]] |= E > 0
        self.node_grid = np.argwhere(has)                                # (nn, 3)
        self.nid = np.full(ns, -1, np.int64); self.nid[tuple(self.node_grid.T)] = np.arange(len(self.node_grid))
        self.enodes = np.stack([self.nid[tuple((self.eidx + o).T)] for o in OFF], 1)   # (ne, 8)
        self.nn = len(self.node_grid); self.ne = len(self.eidx)
        self.xyz = self.origin + self.h * self.node_grid

    def assemble(self):
        offs = np.array([[i, j, k] for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1)])
        oidx = {tuple(o): n for n, o in enumerate(offs)}
        blocks = np.zeros((27, self.nn, 3, 3))
        for nuv in np.unique(self.nu):
            sel = self.nu == nuv; K = brick_K(nuv, self.h); Es = self.E[sel]; en = self.enodes[sel]
            for a in range(8):
                for b in range(8):
                    o = oidx[tuple(OFF[b] - OFF[a])]
                    blocks[o, en[:, a]] += Es[:, None, None] * K[3 * a:3 * a + 3, 3 * b:3 * b + 3][None]
        rows, cols, data = [], [], []
        for n, o in enumerate(offs):
            q = self.node_grid + o
            ok = np.all((q >= 0) & (q < self.shape + 1), axis=1)
            c = np.full(self.nn, -1, np.int64); c[ok] = self.nid[tuple(q[ok].T)]
            ok = (c >= 0) & np.any(blocks[n] != 0, axis=(1, 2))
            r = np.nonzero(ok)[0]; rows.append(r); cols.append(c[ok]); data.append(blocks[n][ok])
        del blocks
        rows = np.concatenate(rows); cols = np.concatenate(cols); data = np.concatenate(data)
        order = np.lexsort((cols, rows)); rows, cols, data = rows[order], cols[order], data[order]
        indptr = np.zeros(self.nn + 1, np.int64); np.add.at(indptr, rows + 1, 1); indptr = np.cumsum(indptr)
        A = sp.bsr_matrix((data, cols, indptr), shape=(3 * self.nn, 3 * self.nn), blocksize=(3, 3))
        self.A = A.tocsr(); self.A.sum_duplicates()
        return self.A

    def fix(self, fixed_nodes, keep_free_matrix=False):
        """fix all three displacements of the given node ids (keep_free_matrix: keep a copy for reactions())"""
        if keep_free_matrix: self.A0 = self.A.copy()
        self.fixed = np.zeros(3 * self.nn, bool)
        fn = np.asarray(fixed_nodes, np.int64)
        for d in range(3): self.fixed[3 * fn + d] = True
        A = self.A
        rows = np.repeat(np.arange(A.shape[0]), np.diff(A.indptr))
        kill = self.fixed[rows] | self.fixed[A.indices]
        A.data[kill] = 0.0
        diag = A.diagonal(); scale = np.median(diag[~self.fixed]) if (~self.fixed).any() else 1.0
        A.setdiag(np.where(self.fixed, scale, diag)); A.eliminate_zeros()
        self.A = A

    def solve(self, F, tol=1e-9, maxiter=2000, verbose=True):
        """F: (nn, 3) nodal forces, or a list of them; returns displacements (nn, 3) (or a list)"""
        import pyamg
        Fs = F if isinstance(F, list) else [F]
        if not hasattr(self, "ml"):
            c = self.xyz - self.xyz.mean(0)
            B = np.zeros((3 * self.nn, 6))
            for d in range(3): B[d::3, d] = 1.0
            B[1::3, 3] = -c[:, 2]; B[2::3, 3] = c[:, 1]
            B[0::3, 4] = c[:, 2]; B[2::3, 4] = -c[:, 0]
            B[0::3, 5] = -c[:, 1]; B[1::3, 5] = c[:, 0]
            if hasattr(self, "fixed"): B[self.fixed] = 0.0
            self.ml = pyamg.smoothed_aggregation_solver(self.A, B=B, symmetry="hermitian", max_coarse=2000)
            if verbose: print(self.ml)
        out = []
        for F_ in Fs:
            b = np.asarray(F_, float).reshape(-1).copy()
            if hasattr(self, "fixed"): b[self.fixed] = 0.0
            res = []
            x = self.ml.solve(b, tol=tol, accel="cg", maxiter=maxiter, residuals=res)
            if verbose: print(f"  CG+AMG: {len(res) - 1} iterations, relative residual {res[-1] / res[0]:.2e}")
            out.append(x.reshape(-1, 3))
        return out if isinstance(F, list) else out[0]

    def reactions(self, u):
        """nodal forces K u of the matrix before fix(keep_free_matrix=True): at fixed nodes, minus the reactions"""
        return (self.A0 @ u.reshape(-1)).reshape(-1, 3)

    def strains(self, u):
        """element-centre strain tensors (ne, 6): xx, yy, zz, xy, xz, yz (tensor shears)"""
        B0 = B_matrix(np.zeros(3), self.h)
        ue = u[self.enodes].reshape(self.ne, 24)
        e = ue @ B0.T
        e[:, 3:] *= 0.5
        return e

    def stresses(self, eps):
        """element stresses (ne, 6) from tensor strains"""
        E, nu = self.E, self.nu
        lam = E * nu / ((1 + nu) * (1 - 2 * nu)); mu = E / (2 * (1 + nu))
        tr = eps[:, :3].sum(1)
        s = np.empty_like(eps)
        s[:, :3] = lam[:, None] * tr[:, None] + 2 * mu[:, None] * eps[:, :3]
        s[:, 3:] = 2 * mu[:, None] * eps[:, 3:]
        return s

    def write_ccx(self, path, fixed_nodes, F, title="voxel model"):
        """the same model as a CalculiX deck (C3D8), with one load case of nodal forces F (nn, 3)"""
        with open(path, "w") as f:
            f.write(f"** {title}\n*NODE, NSET=NALL\n")
            for n, p in enumerate(self.xyz): f.write(f"{n + 1}, {p[0]:.6f}, {p[1]:.6f}, {p[2]:.6f}\n")
            f.write("*ELEMENT, TYPE=C3D8, ELSET=EALL\n")
            for e, nodes in enumerate(self.enodes): f.write(f"{e + 1}, " + ", ".join(str(int(x) + 1) for x in nodes) + "\n")
            key = np.round(self.E, 6).astype(str).astype(object) + "," + self.nu.astype(str).astype(object)
            for m, k in enumerate(np.unique(key)):
                els = np.nonzero(key == k)[0] + 1
                f.write(f"*ELSET, ELSET=M{m}\n")
                for i in range(0, len(els), 16): f.write(", ".join(map(str, els[i:i + 16])) + "\n")
                f.write(f"*MATERIAL, NAME=MAT{m}\n*ELASTIC\n{k}\n*SOLID SECTION, ELSET=M{m}, MATERIAL=MAT{m}\n")
            f.write("*NSET, NSET=FIXED\n")
            fn = np.asarray(fixed_nodes) + 1
            for i in range(0, len(fn), 16): f.write(", ".join(map(str, fn[i:i + 16])) + "\n")
            f.write("*BOUNDARY\nFIXED, 1, 3\n*STEP\n*STATIC\n*CLOAD\n")
            for n in np.nonzero(np.any(F != 0, axis=1))[0]:
                for d in range(3):
                    if F[n, d] != 0: f.write(f"{n + 1}, {d + 1}, {F[n, d]:.9e}\n")
            f.write("*NODE PRINT, NSET=NALL\nU\n*END STEP\n")


def principal(t):
    """eigenvalues (ascending) of symmetric tensors given as (n, 6): xx, yy, zz, xy, xz, yz"""
    M = np.empty((len(t), 3, 3))
    M[:, 0, 0], M[:, 1, 1], M[:, 2, 2] = t[:, 0], t[:, 1], t[:, 2]
    M[:, 0, 1] = M[:, 1, 0] = t[:, 3]; M[:, 0, 2] = M[:, 2, 0] = t[:, 4]; M[:, 1, 2] = M[:, 2, 1] = t[:, 5]
    return np.linalg.eigvalsh(M)


def read_ccx_displacements(dat_path, nn):
    """nodal displacements (nn, 3) from a CalculiX .dat with *NODE PRINT U"""
    u = np.zeros((nn, 3)); on = False
    for line in open(dat_path):
        if "displacements (vx,vy,vz)" in line: on = True; continue
        if on:
            p = line.split()
            if len(p) == 4:
                try: u[int(p[0]) - 1] = [float(x) for x in p[1:]]
                except ValueError: pass
    return u
