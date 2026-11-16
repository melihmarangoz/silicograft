"""Tissue fractions of SG-Bone dental socket runs, per third and in total, on the central mesio-distal
section and in the socket volume, compared with Hong et al. 2014 (empty sockets).

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

Usage:
  python3 analyze_socket.py --out OUTDIR --hong hong2014_empty_socket.csv \
      --case baseline=run_a,run_b,run_c --case zero_load=run_z [--maps baseline]

A case is a label and one or more run folders (seeds); cases with several runs are shown as mean +/- SD.
Each run folder needs model_info.h, mesh_summary.json, lattice_element.bin and lattice_<iteration>.raw.

Definitions (Hong 2014): the socket is cut into apical, middle and coronal thirds of equal height between
the crest (z = 0) and the fundus. Day d is the lattice after d daily iterations (file lattice_<d-1>.raw).
NB = osteoblasts (lattice 2); CART = chondrocytes (4); RB = beta-TCP granule points (12); FCT = every other socket
point: fibroblasts (5), MSCs (1) and empty points (0, clot / granulation tissue). The section is the lattice plane y = 0.
With the beta-TCP Hong file the RB columns and points are added.

Outputs in OUTDIR: daily.csv (every run, day, region, zone), summary.csv (case means at days 14/28/56),
comparison.md (markdown table vs Hong), cases_total.png, and for each --maps case nb_time_<case>.png and
section maps (sections_<case>.png).
"""
import argparse, csv, json, os, re
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap

ZONES = ["apical", "middle", "coronal", "total"]
DAYS = [14, 28, 56]
CODES = {"empty": 0, "MSC": 1, "NB": 2, "CART": 4, "FIB": 5, "RB": 12}

p = argparse.ArgumentParser()
p.add_argument("--out", required=True)
p.add_argument("--hong", required=True)
p.add_argument("--case", action="append", required=True, help="label=dir1,dir2,...")
p.add_argument("--maps", action="append", default=[], help="case label(s) whose first run gets section maps")
a = p.parse_args()
os.makedirs(a.out, exist_ok=True)


def model_info(run):
    txt = open(os.path.join(run, "model_info.h")).read()
    get = lambda k: float(re.search(rf"{k}\s*=\s*([-0-9.e]+)", txt).group(1))
    return dict(LX=int(get("LATTICE_X")), LY=int(get("LATTICE_Y")), LZ=int(get("LATTICE_Z")),
                ox=get("LATTICE_ORIGIN_X"), oy=get("LATTICE_ORIGIN_Y"), oz=get("LATTICE_ORIGIN_Z"))


def analyse_run(run):
    mi = model_info(run)
    shape = (mi["LX"], mi["LY"], mi["LZ"])
    summ = json.load(open(os.path.join(run, "mesh_summary.json")))
    z_apex = summ["socket"]["z_apex"]
    elem = np.fromfile(os.path.join(run, "lattice_element.bin"), dtype=np.int32).reshape(shape)
    sock = elem != 0
    z = mi["oz"] + 0.1 * np.arange(mi["LZ"])
    h = -z_apex / 3
    zone_of_k = np.where(z < z_apex + h, 0, np.where(z < z_apex + 2 * h, 1, 2))
    j0 = int(round(-mi["oy"] / 0.1))
    masks = {}
    for region in ["section", "volume"]:
        base = sock.copy()
        if region == "section":
            base[:, :j0, :] = False; base[:, j0 + 1:, :] = False
        for zi, zone in enumerate(ZONES):
            m = base if zone == "total" else base & (zone_of_k[None, None, :] == zi)
            masks[(region, zone)] = m
    rows, lattices = [], {}
    it = 0
    while os.path.exists(os.path.join(run, f"lattice_{it}.raw")):
        lat = np.fromfile(os.path.join(run, f"lattice_{it}.raw"), dtype=np.uint8).reshape(shape)
        day = it + 1
        if day in DAYS:
            lattices[day] = lat
        for (region, zone), m in masks.items():
            v = lat[m]; n = v.size
            frac = {k: 100.0 * np.count_nonzero(v == c) / n for k, c in CODES.items()}
            frac["FCT"] = 100.0 - frac["NB"] - frac["CART"] - frac["RB"]
            rows.append(dict(day=day, region=region, zone=zone, points=n, **{k: round(x, 3) for k, x in frac.items()}))
        it += 1
    return rows, lattices, dict(mi=mi, sock=sock, j0=j0, z=z, z_apex=z_apex)


hong = [r for r in csv.DictReader(l for l in open(a.hong) if not l.startswith("#"))]
hong_nb = {(int(r["day"]), r["zone"]): (float(r["NB_mean"]), float(r["NB_sd"]) if r["NB_sd"] else None) for r in hong}
hong_rb = {(int(r["day"]), r["zone"]): (float(r["RB_mean"]), float(r["RB_sd"]) if r["RB_sd"] else None) for r in hong} if "RB_mean" in hong[0] else {}
# thesis totals (Hong 2010, same animals), drawn as grey diamonds
thesis = {(m, int(r["day"])): float(r[f"{m}_thesis"]) for r in hong for m in ("NB", "RB")
          if r["zone"] == "total" and r.get(f"{m}_thesis")}

cases = {}
for spec in a.case:
    label, dirs = spec.split("=", 1)
    cases[label] = [d for d in dirs.split(",") if d]

all_rows, case_rows, geo, maps = [], {}, None, {}
for label, dirs in cases.items():
    per_run = []
    for d in dirs:
        rows, lats, g = analyse_run(d)
        geo = geo or g
        for r in rows:
            all_rows.append(dict(case=label, run=os.path.basename(os.path.normpath(d)), **r))
        per_run.append(rows)
        if label in a.maps and label not in maps:
            maps[label] = (lats, g)
    case_rows[label] = per_run

with open(os.path.join(a.out, "daily.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(all_rows[0].keys()))
    w.writeheader(); w.writerows(all_rows)


def series(label, region, zone, key="NB"):
    """days, mean, sd over the runs of a case"""
    per = []
    for rows in case_rows[label]:
        sel = sorted((r["day"], r[key]) for r in rows if r["region"] == region and r["zone"] == zone)
        per.append([v for _, v in sel])
    days = sorted({r["day"] for r in case_rows[label][0] if r["region"] == region and r["zone"] == zone})
    n = min(len(x) for x in per)
    arr = np.array([x[:n] for x in per])
    return np.array(days[:n]), arr.mean(0), (arr.std(0, ddof=1) if len(per) > 1 else np.zeros(n))


# --- summary table
summary = []
for label in cases:
    for region in ["section", "volume"]:
        for zone in ZONES:
            for day in DAYS:
                rec = dict(case=label, runs=len(cases[label]), region=region, zone=zone, day=day)
                for key in ["NB", "RB", "FCT", "CART", "FIB", "MSC", "empty"]:
                    d, m, s = series(label, region, zone, key)
                    if day in d:
                        i = list(d).index(day); rec[key] = round(float(m[i]), 2); rec[key + "_sd"] = round(float(s[i]), 2)
                hv = hong_nb.get((day, zone))
                rec["Hong_NB"] = hv[0] if hv else None
                rec["Hong_NB_sd"] = hv[1] if hv else None
                rv = hong_rb.get((day, zone))
                rec["Hong_RB"] = rv[0] if rv else None
                rec["Hong_RB_sd"] = rv[1] if rv else None
                summary.append(rec)
with open(os.path.join(a.out, "summary.csv"), "w", newline="") as f:
    keys = sorted({k for r in summary for k in r}, key=lambda k: list(summary[0].keys()).index(k) if k in summary[0] else 99)
    w = csv.DictWriter(f, fieldnames=keys); w.writeheader(); w.writerows(summary)


def fmt(rec, key):
    if key not in rec: return "-"
    return f"{rec[key]:.1f}" + (f" ± {rec[key + '_sd']:.1f}" if rec["runs"] > 1 else "")


with open(os.path.join(a.out, "comparison.md"), "w") as f:
    for label in cases:
        f.write(f"\n#### {label} ({len(cases[label])} run{'s' if len(cases[label]) > 1 else ''})\n\n")
        f.write("| Day | Zone | Hong NB | Model NB, section | Model NB, volume | Model FCT, section | Model cartilage, section |"
                + (" Hong RB | Model RB, section | Model RB, volume |" if hong_rb else "") + "\n|---|---|---|---|---|---|---|"
                + ("---|---|---|" if hong_rb else "") + "\n")
        for day in DAYS:
            for zone in ZONES:
                rs = next(r for r in summary if r["case"] == label and r["region"] == "section" and r["zone"] == zone and r["day"] == day)
                rv = next(r for r in summary if r["case"] == label and r["region"] == "volume" and r["zone"] == zone and r["day"] == day)
                h = "-" if rs["Hong_NB"] is None else (f"{rs['Hong_NB']:.1f}" + (f" ± {rs['Hong_NB_sd']:.1f}" if rs["Hong_NB_sd"] else ""))
                line = f"| {day} | {zone} | {h} | {fmt(rs, 'NB')} | {fmt(rv, 'NB')} | {fmt(rs, 'FCT')} | {fmt(rs, 'CART')} |"
                if hong_rb:
                    hr = "-" if rs["Hong_RB"] is None else (f"{rs['Hong_RB']:.1f}" + (f" ± {rs['Hong_RB_sd']:.1f}" if rs["Hong_RB_sd"] else ""))
                    line += f" {hr} | {fmt(rs, 'RB')} | {fmt(rv, 'RB')} |"
                f.write(line + "\n")

# --- figures (light theme; NB is blue as in Hong's figures, Hong data in ink)
INK, MUTED, GRID = "#0b0b0b", "#52514e", "#e4e2dc"
BLUE, ORANGE = "#2a78d6", "#eb6834"
CAT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
plt.rcParams.update({"font.size": 9, "axes.edgecolor": MUTED, "axes.labelcolor": INK, "xtick.color": MUTED,
                     "ytick.color": MUTED, "axes.spines.top": False, "axes.spines.right": False})


RED = "#e34948"


def hong_points(ax, zone, nb=True, rb=True):
    for day in DAYS:
        hv = hong_nb.get((day, zone)) if nb else None
        if hv:
            ax.errorbar([day], [hv[0]], yerr=[hv[1]] if hv[1] else None, fmt="o", ms=6, color=INK, mfc="white",
                        mew=2, capsize=3, lw=1.5, zorder=5)
        rv = hong_rb.get((day, zone)) if rb else None
        if rv:
            ax.errorbar([day], [rv[0]], yerr=[rv[1]] if rv[1] else None, fmt="s", ms=6, color=RED, mfc="white",
                        mew=2, capsize=3, lw=1.5, zorder=5)
        if zone == "total":
            for m, ok, c in [("NB", nb, INK), ("RB", rb, RED)]:
                if ok and (m, day) in thesis:
                    ax.plot([day + 1.2], [thesis[(m, day)]], "D", ms=5, color=c, mfc="#b8b6ae", mew=1.2, zorder=6)


for first in (a.maps or [list(cases)[0]]):
    fig, axs = plt.subplots(1, 4, figsize=(11, 3.2), sharey=True)
    for ax, zone in zip(axs, ZONES):
        for region, ls in [("section", "-"), ("volume", "--")]:
            d, m, s = series(first, region, zone)
            ax.plot(d, m, ls, color=BLUE, lw=2, label=f"model NB, {'central section' if region == 'section' else 'volume'}")
            if s.any():
                ax.fill_between(d, m - s, m + s, color=BLUE, alpha=0.15, lw=0)
            if hong_rb:
                d2, m2, s2 = series(first, region, zone, "RB")
                ax.plot(d2, m2, ls, color=RED, lw=2, label=f"model residual graft, {'central section' if region == 'section' else 'volume'}")
        hong_points(ax, zone)
        ax.set_title(zone.capitalize(), color=INK, fontsize=10, loc="left")
        ax.set_xticks([0, 14, 28, 42, 56]); ax.set_xlabel("Day")
        ax.grid(axis="y", color=GRID, lw=0.8); ax.set_ylim(0, 100)
    axs[0].set_ylabel("% of socket" if hong_rb else "New bone, % of socket")
    h, l = axs[0].get_legend_handles_labels()
    h.append(plt.Line2D([], [], marker="o", ls="", color=INK, mfc="white", mew=2)); l.append("Hong 2014 NB (zones: Fig. 8, total: text ± SD)")
    if hong_rb:
        h.append(plt.Line2D([], [], marker="s", ls="", color=RED, mfc="white", mew=2)); l.append("Hong 2014 residual graft")
    if thesis:
        h.append(plt.Line2D([], [], marker="D", ls="", color=INK, mfc="#b8b6ae", mew=1.2)); l.append("Hong 2010 thesis, total")
    fig.legend(h, l, loc="upper center", ncol=3, frameon=False, bbox_to_anchor=(0.5, 1.04 + (0.06 if hong_rb else 0)))
    nr = len(cases[first])
    fig.suptitle(f"{'β-TCP socket' if hong_rb else 'Empty socket'}, case '{first}'" + (f" (mean ± SD of {nr} seeds)" if nr > 1 else ""),
                 x=0.01, y=1.10 + (0.08 if hong_rb else 0), ha="left", fontsize=11, color=INK)
    fig.savefig(os.path.join(a.out, f"nb_time_{first}.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)

for key, fname, ylab in ([("NB", "cases_total.png", "New bone, % of socket (total)")]
                         + ([("RB", "cases_rb.png", "Residual graft, % of socket (total)")] if hong_rb else [])):
    if len(cases) < 2:
        break
    fig, axs = plt.subplots(1, 2, figsize=(10, 3.4), sharey=True)
    for ax, region in zip(axs, ["section", "volume"]):
        for ci, label in enumerate(cases):
            d, m, s = series(label, region, "total", key)
            ax.plot(d, m, color=CAT[ci % len(CAT)], lw=2, label=label)
            if s.any():
                ax.fill_between(d, m - s, m + s, color=CAT[ci % len(CAT)], alpha=0.15, lw=0)
        hong_points(ax, "total", nb=(key == "NB"), rb=(key == "RB"))
        ax.set_title("Central section" if region == "section" else "Socket volume", loc="left", color=INK, fontsize=10)
        ax.set_xticks([0, 14, 28, 42, 56]); ax.set_xlabel("Day"); ax.grid(axis="y", color=GRID, lw=0.8); ax.set_ylim(0, 100)
    axs[0].set_ylabel(ylab)
    h, l = axs[0].get_legend_handles_labels()
    h.append(plt.Line2D([], [], marker="o" if key == "NB" else "s", ls="", color=INK if key == "NB" else RED, mfc="white", mew=2)); l.append("Hong 2014")
    fig.legend(h, l, loc="upper center", ncol=min(len(l), 4), frameon=False, bbox_to_anchor=(0.5, 1.12 + 0.04 * (len(l) > 8)))
    fig.savefig(os.path.join(a.out, fname), dpi=150, bbox_inches="tight")
    plt.close(fig)

# section maps: x (mesio-distal) horizontal, z vertical, crest on top
cmap_codes = [(0, "empty (clot)", "#ece9e2"), (1, "MSC", "#eda100"), (5, "fibroblast", "#1baf7a"),
              (4, "chondrocyte", "#6250d6"), (2, "new bone", BLUE), (11, "native bone", "#8a8880"), (14, "soft-tissue cover", "#f3c7d7"),
              (12, "β-TCP granule", "#e34948")]
lut = np.zeros(256, dtype=int)
for idx, (c, _, _) in enumerate(cmap_codes):
    lut[c] = idx
cmap = ListedColormap([c for _, _, c in cmap_codes])
for label, (lats, g) in maps.items():
    mi = g["mi"]
    fig, axs = plt.subplots(1, len(lats), figsize=(2.4 * len(lats) + 1.6, 4.2))
    for ax, day in zip(np.atleast_1d(axs), sorted(lats)):
        sl = lats[day][:, g["j0"], :].astype(int)
        img = lut[sl].T[::-1]
        ext = [mi["ox"] - 0.05, mi["ox"] + 0.1 * (mi["LX"] - 1) + 0.05, mi["oz"] - 0.05, mi["oz"] + 0.1 * (mi["LZ"] - 1) + 0.05]
        ax.imshow(img, cmap=cmap, vmin=-0.5, vmax=len(cmap_codes) - 0.5, extent=ext, interpolation="nearest")
        for zb in [g["z_apex"] / 3 * 2, g["z_apex"] / 3]:
            ax.axhline(zb, color=INK, lw=0.6, ls=":")
        ax.set_title(f"Day {day}", loc="left", color=INK, fontsize=10)
        ax.set_xlabel("Mesio-distal (mm)"); ax.set_aspect("equal")
    np.atleast_1d(axs)[0].set_ylabel("Height (mm, crest = 0)")
    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for _, _, c in cmap_codes]
    fig.legend(handles, [n for _, n, _ in cmap_codes], loc="center left", bbox_to_anchor=(1.0, 0.5), frameon=False)
    fig.suptitle(f"Central mesio-distal section, case '{label}' (dotted: thirds)", x=0.01, ha="left", fontsize=11, color=INK)
    fig.savefig(os.path.join(a.out, f"sections_{label}.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)

print(open(os.path.join(a.out, "comparison.md")).read())
