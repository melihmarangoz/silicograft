"""Results of socket models built from masks (socket_from_masks.py): tables, sections and a virtual CBCT.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE). Contains no patient data; write
the outputs of a real case outside the repository.

Usage:
  python3 analyze_mask_model.py --mesh MESH --sockets sockets.json --out OUT [--cbct cbct.nii.gz] [--labels L.nii.gz]
      --case NAME=run1,run2,... [--case ...] [--days 14,28,56] [--vct-days 90,180] [--maps NAME]
MESH holds model_info.h, socket_map.raw, zone_names.txt (from socket_from_masks.py). Runs need zones.csv,
params_used.txt and, for sections, lattice_<iteration>.raw (day = (iteration + 1) x time_scale).

Outputs
  table.csv / table.md : per case, day, socket, region (volume; virtual core = central cylinder 2.3 mm x 6 mm from the
                         crest along the axis, as a trephine biopsy; central mesio-distal and bucco-lingual sections through
                         the socket axis), zone (apical, middle, coronal, total): % new bone (osteoblast points), residual
                         graft (granule envelope), soft tissue (MSC, fibroblast, empty clot / marrow), cartilage,
                         mineralised (new bone + graft, the CBCT "socket fill");
                         mean and SD over the runs of a case
  core_daily.csv       : virtual-core fractions for every stored lattice (real days); core_info.json
  time_<case>.png      : new bone and residual graft per socket (volume) over real days
  sections_<case>.png  : tissue maps on the two central planes of each socket, at --days
  vct_<case>.png       : virtual CBCT of mineralised tissue on the same planes: the pre-operative scan outside the
                         sockets, inside them native-like grey values for new bone and graft (see VCT_* below),
                         blurred to CBCT sharpness; pre-operative scan and day 0 for comparison
"""
import argparse, csv, json, os, re, statistics as st
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
from scipy import ndimage

p = argparse.ArgumentParser()
p.add_argument("--mesh", required=True); p.add_argument("--sockets", required=True); p.add_argument("--out", required=True)
p.add_argument("--cbct"); p.add_argument("--labels")
p.add_argument("--case", action="append", required=True)
p.add_argument("--days", default="14,28,56"); p.add_argument("--vct-days", default="")
p.add_argument("--maps", action="append", default=[])
a = p.parse_args()
os.makedirs(a.out, exist_ok=True)
DAYS = [int(x) for x in a.days.split(",") if x]
VDAYS = [int(x) for x in a.vct_days.split(",") if x]

txt = open(os.path.join(a.mesh, "model_info.h")).read()
g = lambda k: float(re.search(rf"{k}\s*=\s*([-0-9.e]+)", txt).group(1))
LN = np.array([int(g("LATTICE_X")), int(g("LATTICE_Y")), int(g("LATTICE_Z"))])
ORG = np.array([g("LATTICE_ORIGIN_X"), g("LATTICE_ORIGIN_Y"), g("LATTICE_ORIGIN_Z")]); CELL = 0.1
SMAP = np.fromfile(os.path.join(a.mesh, "socket_map.raw"), np.uint8).reshape(LN)
SO = json.load(open(a.sockets))["sockets"]
cases = {}
for spec in a.case:
    k, v = spec.split("=", 1); cases[k] = [d for d in v.split(",") if d]
LBL = CB = None
if a.labels:
    import nibabel as nib
    im = nib.load(a.labels); LBL = np.asarray(im.dataobj).astype(np.uint8); SP = float(im.header.get_zooms()[0])
if a.cbct:
    import nibabel as nib
    im = nib.load(a.cbct); CB = np.asarray(im.dataobj).astype(np.float32); SP = float(im.header.get_zooms()[0])

def params(run):
    return {l.split()[0]: l.split()[1] for l in open(os.path.join(run, "params_used.txt"))}
def it_of(run, day):
    """iteration whose end is closest to the real day (time_scale real days per iteration)"""
    ts = float(params(run).get("time_scale", 1)); return max(int(round(day / ts)) - 1, 0), ts
def lattice(run, day):
    it, ts = it_of(run, day)
    f = os.path.join(run, f"lattice_{it}.raw")
    return np.fromfile(f, np.uint8).reshape(LN) if os.path.exists(f) else None
def zones_of(run):
    Z = {}
    for line in open(os.path.join(run, "zones.csv")).read().splitlines()[1:]:
        f = line.split(",")
        if f[1] == "volume": Z.setdefault(round(float(f[0]), 3), {})[f[2]] = [int(x) for x in f[3:10]]
    return Z
def zday(Z, run, day):
    it, ts = it_of(run, day); d = round((it + 1) * ts, 3)
    return d if d in Z else None

# --- plane geometry per socket: u along the axis (0 = crest), v across (mesio-distal or bucco-lingual)
PL = {}
for n_, s_ in enumerate(SO):
    cr, apx = np.array(s_["crest"]), np.array(s_["apex"]); Lax = np.linalg.norm(apx - cr); ax = (apx - cr) / Lax
    md = np.array(s_["mesial"]); md = md - (md @ ax) * ax; md /= np.linalg.norm(md)
    bl = np.array(s_["buccal"]); bl = bl - (bl @ ax) * ax - (bl @ md) * md; bl /= np.linalg.norm(bl)
    u = np.arange(-3.0, Lax + 3.0, 0.1); v = np.arange(-7.0, 7.0, 0.1)
    for nm, dv in [("mesio-distal", md), ("bucco-lingual", bl)]:
        P = cr[None, None, :] + u[:, None, None] * ax[None, None, :] + v[None, :, None] * dv[None, None, :]
        PL[(s_["name"], nm)] = dict(P=P, u=u, v=v, L=Lax, id=n_ + 1)
def on_lattice(P):
    idx = np.rint((P - ORG) / CELL).astype(int); ok = np.all((idx >= 0) & (idx < LN), axis=-1)
    return idx.clip(0, LN - 1), ok
def on_volume(vol, P):
    return ndimage.map_coordinates(vol, (P / SP).reshape(-1, 3).T, order=1 if vol.dtype == np.float32 else 0, cval=0).reshape(P.shape[:2])
def plane_codes(lat, key):
    P = PL[key]["P"]; idx, ok = on_lattice(P)
    code = lat[idx[..., 0], idx[..., 1], idx[..., 2]]
    sid = SMAP[idx[..., 0], idx[..., 1], idx[..., 2]] * ok
    if LBL is not None:
        host = np.where(on_volume(LBL, P) == 0, 14, 11).astype(np.uint8)
        code = np.where(ok, code, host)
    return code, sid

FRAC = {"NB": [2], "RB": [12], "CART": [4], "SOFT": [0, 1, 5]}
# virtual core: central cylinder of CORE_D mm diameter and CORE_L mm length along each socket axis from the crest,
# as a trephine biopsy at implant placement (human histology comes from such cores)
CORE_D, CORE_L = 2.3, 6.0
gx = [ORG[d] + CELL * np.arange(LN[d]) for d in range(3)]
GP = np.stack(np.meshgrid(*gx, indexing="ij"), -1)
CORE = {}
for n_, s_ in enumerate(SO):
    cr, apx = np.array(s_["crest"]), np.array(s_["apex"]); ax = (apx - cr) / np.linalg.norm(apx - cr)
    rel = GP - cr; t = rel @ ax; rr = np.linalg.norm(rel - t[..., None] * ax, axis=-1)
    cyl = (t >= 0) & (t <= CORE_L) & (rr <= CORE_D / 2)
    CORE[s_["name"]] = dict(mask=cyl & (SMAP == n_ + 1), outside_pct=round(100 * float((cyl & (SMAP != n_ + 1)).sum()) / max(int(cyl.sum()), 1), 1))
del GP
def core_fracs(lat, name):
    m = CORE[name]["mask"]; c = lat[m]; n = max(c.size, 1)
    return {k: 100 * float(np.isin(c, v).sum()) / n for k, v in FRAC.items()}
rows = []
core_daily = []
for case, runs in cases.items():
    for run in runs:
        Z = zones_of(run)
        it_all = sorted(int(f[8:-4]) for f in os.listdir(run) if f.startswith("lattice_") and f != "lattice_999.raw")
        ts = float(params(run).get("time_scale", 1))
        for it in it_all:   # core over time (every stored lattice)
            lat = np.fromfile(os.path.join(run, f"lattice_{it}.raw"), np.uint8).reshape(LN)
            for s_ in SO:
                core_daily.append(dict(case=case, run=run, day=round((it + 1) * ts, 2), socket=s_["name"], **core_fracs(lat, s_["name"])))
        for day in sorted(set(DAYS + VDAYS)):
            zd = zday(Z, run, day)
            if zd is None: continue
            for s_ in SO:
                parts = {t: Z[zd][f"{s_['name']}_{t}"] for t in ("apical", "middle", "coronal")}
                parts["total"] = [sum(c) for c in zip(*parts.values())]
                for zone, c in parts.items():   # points, empty, MSC, bone, cartilage, fibrous, granule
                    n = max(c[0], 1)
                    rows.append(dict(case=case, run=run, day=day, socket=s_["name"], region="volume", zone=zone,
                                     NB=100 * c[3] / n, RB=100 * c[6] / n, CART=100 * c[4] / n, SOFT=100 * (c[1] + c[2] + c[5]) / n))
            lat = lattice(run, day)
            if lat is None: continue
            for s_ in SO:
                rows.append(dict(case=case, run=run, day=day, socket=s_["name"], region="core", zone="total", **core_fracs(lat, s_["name"])))
            for (sname, pl), d in PL.items():
                code, sid = plane_codes(lat, (sname, pl))
                t = d["u"][:, None] / d["L"] * np.ones_like(d["v"])[None, :]
                zone_of = np.where(t >= 2 / 3, "apical", np.where(t >= 1 / 3, "middle", "coronal"))
                m_s = (sid == d["id"]) & np.isin(code, [0, 1, 2, 4, 5, 12])
                for zone in ["apical", "middle", "coronal", "total"]:
                    m = m_s if zone == "total" else m_s & (zone_of == zone)
                    n = max(int(m.sum()), 1)
                    rows.append(dict(case=case, run=run, day=day, socket=sname, region=pl, zone=zone,
                                     **{k: 100 * float(np.isin(code[m], v).sum()) / n for k, v in FRAC.items()}))
# mean / SD over runs
agg = {}
for r in rows:
    agg.setdefault((r["case"], r["day"], r["socket"], r["region"], r["zone"]), []).append(r)
out = []
for k, rs in sorted(agg.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][2], ["volume", "core", "mesio-distal", "bucco-lingual"].index(kv[0][3]), ["apical", "middle", "coronal", "total"].index(kv[0][4]))):
    o = dict(zip(["case", "day", "socket", "region", "zone"], k)); o["runs"] = len(rs)
    for r in rs: r["MIN"] = r["NB"] + r["RB"]   # mineralised: new bone + graft (socket fill on a CBCT)
    for m in ["NB", "RB", "SOFT", "CART", "MIN"]:
        vals = [r[m] for r in rs]; o[m] = round(st.mean(vals), 2); o[m + "_sd"] = round(st.stdev(vals), 2) if len(vals) > 1 else 0.0
    out.append(o)
with open(os.path.join(a.out, "table.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
with open(os.path.join(a.out, "core_daily.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(core_daily[0].keys())); w.writeheader(); w.writerows(core_daily)
json.dump({k: dict(outside_socket_pct=v["outside_pct"], points=int(v["mask"].sum())) for k, v in CORE.items()},
          open(os.path.join(a.out, "core_info.json"), "w"), indent=1)
with open(os.path.join(a.out, "table.md"), "w") as f:
    for case in cases:
        f.write(f"\n#### {case}\n\n| Day | Socket | Region | Zone | New bone % | Residual graft % | Soft tissue % | Mineralised % |\n|---|---|---|---|---|---|---|---|\n")
        for o in out:
            if o["case"] != case: continue
            fm = lambda m: f"{o[m]:.1f}" + (f" ± {o[m + '_sd']:.1f}" if o["runs"] > 1 else "")
            f.write(f"| {o['day']} | {o['socket']} | {o['region']} | {o['zone']} | {fm('NB')} | {fm('RB')} | {fm('SOFT')} | {fm('MIN')} |\n")

INK, GRID, BLUE, RED = "#0b0b0b", "#e4e2dc", "#2a78d6", "#e34948"
plt.rcParams.update({"font.size": 9, "axes.spines.top": False, "axes.spines.right": False})
for case, runs in cases.items():   # time curves
    fig, ax = plt.subplots(figsize=(7, 3.6))
    for si, s_ in enumerate(SO):
        per = []
        for run in runs:
            Z = {}
            for line in open(os.path.join(run, "zones.csv")).read().splitlines()[1:]:
                f = line.split(",")
                if f[1] == "volume" and f[2].startswith(s_["name"] + "_"):
                    c = Z.setdefault(float(f[0]), [0] * 7)
                    for q in range(7): c[q] += int(f[3 + q])
            per.append({d: c for d, c in Z.items()})
        days = sorted(per[0]); ls = ["-", "--", ":"][si % 3]
        for m, col, q in [("new bone", BLUE, 3), ("residual graft", RED, 6)]:
            arr = np.array([[100 * p_[d][q] / p_[d][0] for d in days] for p_ in per])
            if arr.max() == 0: continue
            ax.plot(days, arr.mean(0), ls, color=col, lw=2, label=f"{s_['name']} {m}")
            if len(per) > 1: ax.fill_between(days, arr.mean(0) - arr.std(0, ddof=1), arr.mean(0) + arr.std(0, ddof=1), color=col, alpha=0.15, lw=0)
    ax.set_xlabel("Day"); ax.set_ylabel("% of socket volume"); ax.set_ylim(0, 100); ax.grid(axis="y", color=GRID)
    ax.legend(frameon=False, fontsize=8, loc="upper left"); ax.set_title(f"{case} ({len(runs)} runs)", loc="left")
    fig.savefig(os.path.join(a.out, f"time_{case}.png"), dpi=150, bbox_inches="tight"); plt.close(fig)

CODES = [(0, "empty", "#ece9e2"), (1, "MSC", "#eda100"), (5, "fibroblast", "#1baf7a"), (4, "chondrocyte", "#6250d6"),
         (2, "new bone", BLUE), (11, "native bone / teeth", "#8a8880"), (14, "soft tissue", "#f3c7d7"), (12, "β-TCP granule", RED)]
LUT = np.zeros(256, int)
for i_, (c, _, _) in enumerate(CODES): LUT[c] = i_
CMAP = ListedColormap([c for _, _, c in CODES])
keys = list(PL)
for case in a.maps or list(cases)[:1]:
    run = cases[case][0]
    fig, axs = plt.subplots(len(DAYS), len(keys), figsize=(2.6 * len(keys), 3.3 * len(DAYS)), squeeze=False)
    for r_, day in enumerate(DAYS):
        lat = lattice(run, day)
        for c_, key in enumerate(keys):
            axx = axs[r_, c_]; d = PL[key]
            if lat is not None:
                code, _ = plane_codes(lat, key)
                axx.imshow(LUT[code], cmap=CMAP, vmin=-0.5, vmax=len(CODES) - 0.5, interpolation="nearest",
                           extent=[d["v"][0], d["v"][-1], d["u"][-1], d["u"][0]])
            axx.set_title(f"{key[0]} {key[1]}, day {day}", fontsize=8)
    fig.legend([plt.Rectangle((0, 0), 1, 1, color=c) for _, _, c in CODES], [n for _, n, _ in CODES], loc="lower center", ncol=4, frameon=False)
    fig.tight_layout(rect=(0, 0.04, 1, 1)); fig.savefig(os.path.join(a.out, f"sections_{case}.png"), dpi=130); plt.close(fig)

# --- virtual CBCT
if CB is not None and LBL is not None and VDAYS:
    near = ndimage.binary_dilation(np.isin(LBL, [s_["label"] for s_ in SO]), iterations=int(2.0 / SP))
    bone_ref = float(np.median(CB[near & (LBL == json.load(open(a.sockets))["labels"]["bone"])]))
    soft_ref = float(np.median(CB[near & (LBL == json.load(open(a.sockets))["labels"]["soft"])]))
    VCT = {2: 0.85 * bone_ref + 0.15 * soft_ref, 12: 1.10 * bone_ref}   # assumed grey values: woven bone, beta-TCP
    lo_w, hi_w = soft_ref - 0.5 * (bone_ref - soft_ref), bone_ref + 0.9 * (bone_ref - soft_ref)
    def vct_plane(lat, key):
        d = PL[key]; P = d["P"]; base = on_volume(CB, P)
        if lat is None: return base
        code, sid = plane_codes(lat, key)
        tissue = np.full(code.shape, soft_ref, np.float32)
        for c, val in VCT.items(): tissue[code == c] = val
        m = sid > 0
        img = np.where(m, tissue, base)
        blur = ndimage.gaussian_filter(img, 1.5)        # 0.15 mm at 0.1 mm sampling: CBCT-like sharpness
        return np.where(ndimage.binary_dilation(m, iterations=2), blur, base)
    for case in a.maps or list(cases)[:1]:
        run = cases[case][0]
        cols = ["pre-op scan", "day 0"] + [f"day {d}" for d in VDAYS]
        fig, axs = plt.subplots(len(keys), len(cols), figsize=(2.4 * len(cols), 3.2 * len(keys)), squeeze=False)
        lat0 = None
        it0 = os.path.join(run, "lattice_999.raw")
        if os.path.exists(it0): lat0 = np.fromfile(it0, np.uint8).reshape(LN)
        for r_, key in enumerate(keys):
            d = PL[key]
            ims = [on_volume(CB, d["P"]), vct_plane(lat0, key)] + [vct_plane(lattice(run, dd), key) for dd in VDAYS]
            for c_, im_ in enumerate(ims):
                axs[r_, c_].imshow(np.clip((im_ - lo_w) / (hi_w - lo_w), 0, 1), cmap="gray", vmin=0, vmax=1,
                                   extent=[d["v"][0], d["v"][-1], d["u"][-1], d["u"][0]])
                axs[r_, c_].set_title(f"{key[0]} {key[1]}\n{cols[c_]}", fontsize=8)
        fig.suptitle("Virtual CBCT of mineralised tissue (new bone and graft drawn with assumed grey values; native bone from the pre-op scan)", fontsize=9)
        fig.tight_layout(); fig.savefig(os.path.join(a.out, f"vct_{case}.png"), dpi=130); plt.close(fig)
    json.dump(dict(bone_ref=bone_ref, soft_ref=soft_ref, woven_bone=VCT[2], beta_tcp=VCT[12]), open(os.path.join(a.out, "vct_grey_values.json"), "w"), indent=1)
print(open(os.path.join(a.out, "table.md")).read()[:3000])
