"""Live panel for the milestone-2 calibration: replays finished socket runs day by day on a display.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

  DISPLAY=:1 python3 live_panel.py --root ~/sg/m2 --hong hong2014_empty_socket.csv

It only reads files. Every ~2 s it looks for runs that have finished (time.txt) under ROOT/*/*, scores them
against Hong 2014 (score_hong.py) and replays the newest one day by day (0.3 s per day) from its
section_daily.bin (central mesio-distal section, written by the C++ model) and zones.csv. Runs without daily
sections show their day-14/28/56 lattices. When nothing new comes, it replays the best-fitting run.
Panels: the section with the tissue colours of the report figures; % new bone vs day (section and volume, total)
with Hong's means and SDs; the same per third on the section; the cost J of every run tried so far.
"""
import argparse, glob, os, re, sys, time
import numpy as np
import matplotlib
matplotlib.use("TkAgg")
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if "--patient" in sys.argv:  # models from masks: live_panel_patient.py runs the panel and exits
    import live_panel_patient  # noqa: F401
    sys.exit(0)
import score_hong as sh

p = argparse.ArgumentParser()
p.add_argument("--root", required=True)
p.add_argument("--hong", required=True, help="Hong file for empty sockets")
p.add_argument("--hong-btcp", help="Hong file for grafted runs (granule_fraction > 0); default: --hong")
p.add_argument("--day-seconds", type=float, default=0.3)
p.add_argument("--patient", action="store_true", help="models from masks: per-socket curves from zones.csv, no Hong data")
a = p.parse_args()
HONG_E, SD_E = sh.load_hong(a.hong)
HONG_B, SD_B = sh.load_hong(a.hong_btcp or a.hong)
HRB, SDRB = sh.load_hong(a.hong_btcp or a.hong, "RB")  # beta-TCP arm only
HONG, SD = (HONG_B, SD_B) if a.hong_btcp is None and HRB else (HONG_E, SD_E)

INK, MUTED, GRID, BLUE, ORANGE = "#0b0b0b", "#52514e", "#e4e2dc", "#2a78d6", "#eb6834"
CODES = [(0, "empty (clot)", "#ece9e2"), (1, "MSC", "#eda100"), (5, "fibroblast", "#1baf7a"), (4, "chondrocyte", "#6250d6"),
         (2, "new bone", BLUE), (11, "native bone", "#8a8880"), (14, "soft-tissue cover", "#f3c7d7"), (12, "β-TCP granule", "#e34948")]
LUT = np.zeros(256, dtype=int)
for idx, (c, _, _) in enumerate(CODES):
    LUT[c] = idx
CMAP = ListedColormap([c for _, _, c in CODES])
KEYS = ["force_stimulus", "stimulus_mode", "lower_window", "farfield_strain", "activity_days", "late_factor",
        "remodel_rate", "matrix_day", "cover_source", "seed_fraction", "lining_voxels"]


def info(run):
    txt = open(os.path.join(run, "model_info.h")).read()
    g = lambda k: float(re.search(rf"{k}\s*=\s*([-0-9.e]+)", txt).group(1))
    return int(g("LATTICE_X")), int(g("LATTICE_Y")), int(g("LATTICE_Z")), g("LATTICE_ORIGIN_X"), g("LATTICE_ORIGIN_Z"), int(g("SECTION_J"))


def daily_nb(run):
    out = {}
    for line in open(os.path.join(run, "zones.csv")).read().splitlines()[1:]:
        f = line.split(",")
        day, region, zone, pts, bone = f[0], f[1], f[2], int(f[3]), int(f[6])
        out[(region, zone, int(day))] = 100.0 * bone / pts
        out[(region, zone, int(day), "rb")] = 100.0 * int(f[9]) / pts if len(f) > 9 else 0.0
    return out


def frames(run):
    LX, LY, LZ, ox, oz, J0 = info(run)
    f = os.path.join(run, "section_daily.bin")
    if os.path.exists(f):
        b = np.fromfile(f, dtype=np.uint8)
        n = b.size // (LX * LZ)
        return [(d + 1, b[d * LX * LZ:(d + 1) * LX * LZ].reshape(LX, LZ)) for d in range(n)]
    fr = []
    for it in (13, 27, 55):
        g = os.path.join(run, f"lattice_{it}.raw")
        if os.path.exists(g):
            fr.append((it + 1, np.fromfile(g, dtype=np.uint8).reshape(LX, LY, LZ)[:, J0, :]))
    return fr


def params(run):
    d = sh.params(run)
    return ", ".join(f"{k} {d[k]}" for k in KEYS if k in d)


scored = {}   # run -> (finish time, J)
order = []    # runs in the order they were found


def scan():
    new = []
    for t in glob.glob(os.path.join(a.root, "*", "*", "time.txt")):
        run = os.path.dirname(t)
        if run in scored:
            continue
        try:
            v = sh.run_values(run)
        except Exception:  # a run being written or removed
            continue
        if v is None:
            continue
        grafted = float(sh.params(run).get("granule_fraction", 0) or 0) > 0
        J = sh.objective(v, HONG_B, SD_B, hr=HRB, sdr=SDRB)[0] if grafted else sh.objective(v, HONG_E, SD_E)[0]
        scored[run] = (os.path.getmtime(t), J)
        order.append(run)
        new.append(run)
    new.sort(key=lambda r: scored[r][0])
    return new


plt.rcParams.update({"font.size": 11, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.edgecolor": MUTED, "xtick.color": MUTED, "ytick.color": MUTED})
fig = plt.figure(figsize=(19.2, 10.4), dpi=100)
try:
    fig.canvas.manager.window.attributes("-zoomed", True)
except Exception:
    pass
gs = fig.add_gridspec(2, 3, width_ratios=[1.0, 1.25, 1.25], height_ratios=[1, 1], wspace=0.28, hspace=0.38,
                      left=0.05, right=0.98, top=0.88, bottom=0.14)
ax_sec = fig.add_subplot(gs[:, 0])
ax_tot = fig.add_subplot(gs[0, 1])
ax_thr = fig.add_subplot(gs[0, 2])
ax_J = fig.add_subplot(gs[1, 1:])
title = fig.suptitle("waiting for runs ...", x=0.01, ha="left", fontsize=13)

img = None
lines = {}
for ax, lab in [(ax_tot, "Total"), (ax_thr, "Thirds, central section")]:
    ax.set_xlim(0, 57); ax.set_ylim(0, 100); ax.set_xticks([0, 14, 28, 42, 56]); ax.set_xlabel("Day")
    ax.set_ylabel("New bone, % of socket"); ax.grid(axis="y", color=GRID); ax.set_title(lab, loc="left")
for d in [14, 28, 56]:
    ax_tot.errorbar([d], [HONG[(d, "total")]], yerr=[SD[d]], fmt="o", ms=8, color=INK, mfc="white", mew=2, capsize=4, zorder=5)
lines["sec"], = ax_tot.plot([], [], "-", color=BLUE, lw=2.5, label="model, central section")
lines["vol"], = ax_tot.plot([], [], "--", color=BLUE, lw=2, label="model, volume")
ax_tot.plot([], [], "o", color=INK, mfc="white", mew=2, label="Hong 2014 (mean ± SD)")
if HRB:
    for d in [14, 28, 56]:
        ax_tot.errorbar([d], [HRB[(d, "total")]], yerr=[SDRB[d]], fmt="s", ms=8, color="#e34948", mfc="white", mew=2, capsize=4, zorder=5)
    lines["rb"], = ax_tot.plot([], [], "-", color="#e34948", lw=2.5, label="model residual graft, section")
    ax_tot.plot([], [], "s", color="#e34948", mfc="white", mew=2, label="Hong residual graft")
    ax_tot.set_title("Total: new bone (blue) and residual graft (red)", loc="left")
ax_tot.legend(loc="upper left", frameon=False)
ZC = {"apical": "#2a78d6", "middle": "#eb6834", "coronal": "#1baf7a"}
for z, c in ZC.items():
    lines[z], = ax_thr.plot([], [], "-", color=c, lw=2, label=f"model {z}")
    ax_thr.plot([14, 28, 56], [HONG[(d, z)] for d in [14, 28, 56]], "o", color=c, mfc="white", mew=2, ms=7)
ax_thr.plot([], [], "o", color=MUTED, mfc="white", mew=2, label="Hong 2014 (Fig. 8)")
ax_thr.legend(loc="upper left", frameon=False, ncol=2)
ax_J.set_yscale("log"); ax_J.set_xlabel("Runs scored, in order"); ax_J.set_ylabel("Cost J (vs Hong)")
ax_J.set_title("Fit cost of every run tried (lower is better)", loc="left"); ax_J.grid(axis="y", color=GRID)
sc_all = ax_J.scatter([], [], s=10, color="#b8b6ae")
sc_cur, = ax_J.plot([], [], "o", color=ORANGE, ms=10, label="shown run")
sc_best, = ax_J.plot([], [], "*", color=BLUE, ms=16, label="best so far")
ax_J.legend(loc="upper right", frameon=False)
handles = [plt.Rectangle((0, 0), 1, 1, color=c) for _, _, c in CODES]
ax_sec.legend(handles, [n for _, n, _ in CODES], loc="upper center", bbox_to_anchor=(0.5, -0.06), ncol=2, frameon=False, fontsize=10)
plt.show(block=False)


def update_J(current):
    if not order:
        return
    js = [scored[r][1] for r in order]
    sc_all.set_offsets(np.c_[np.arange(len(js)), js])
    i = order.index(current)
    sc_cur.set_data([i], [scored[current][1]])
    b = int(np.argmin(js))
    sc_best.set_data([b], [js[b]])
    ax_J.set_xlim(-1, max(10, len(js)))
    ax_J.set_ylim(max(1e-2, min(js) / 2), max(js) * 2)


def show(run, label):
    global img
    fr = frames(run)
    if not fr:
        return
    LX, LY, LZ, ox, oz, J0 = info(run)
    nb = daily_nb(run)
    ext = [ox - 0.05, ox + 0.1 * (LX - 1) + 0.05, oz - 0.05, oz + 0.1 * (LZ - 1) + 0.05]
    if img is None:
        img = ax_sec.imshow(LUT[fr[0][1]].T[::-1], cmap=CMAP, vmin=-0.5, vmax=len(CODES) - 0.5, extent=ext, interpolation="nearest")
        ax_sec.set_xlabel("Mesio-distal (mm)"); ax_sec.set_ylabel("Height (mm, crest = 0)")
        for zb in [-8.5 / 3 * 2, -8.5 / 3]:
            ax_sec.axhline(zb, color=INK, lw=0.6, ls=":")
    update_J(run)
    name = os.path.relpath(run, a.root)
    title.set_text(f"{label}: {name}   J = {scored[run][1]:.2f}\n{params(run)}")
    days = sorted({k[2] for k in nb})
    for day, sl in fr:
        img.set_data(LUT[sl].T[::-1])
        ax_sec.set_title(f"Central mesio-distal section, day {day}", loc="left", fontsize=13)
        dd = [d for d in days if d <= day]
        lines["sec"].set_data(dd, [nb[("section", "total", d)] for d in dd])
        lines["vol"].set_data(dd, [nb[("volume", "total", d)] for d in dd])
        if "rb" in lines:
            lines["rb"].set_data(dd, [nb[("section", "total", d, "rb")] for d in dd])
        for z in ZC:
            lines[z].set_data(dd, [nb[("section", z, d)] for d in dd])
        fig.canvas.draw_idle()
        plt.pause(a.day_seconds if len(fr) > 3 else 1.5)
        if not plt.fignum_exists(fig.number):
            sys.exit(0)


last_scan = 0.0
queue = []
while plt.fignum_exists(fig.number):
    queue += scan()
    for gone in [r for r in order if not os.path.isdir(r)]:  # runs moved away
        order.remove(gone); scored.pop(gone, None)
    try:
        if queue:
            run = queue.pop()   # newest first; older unseen runs are skipped when many finish together
            queue.clear()
            show(run, "Latest finished run")
        elif scored:
            best = min(scored, key=lambda r: scored[r][1])
            show(best, "Best fit so far")
    except SystemExit:
        raise
    except Exception as e:  # keep the panel alive whatever a run folder holds
        print("panel:", e, flush=True)
    plt.pause(2.0)
