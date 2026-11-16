"""Live panel for socket models built from masks (several sockets, zone_map): replays finished runs day by day.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

Started through live_panel.py --patient (same --root). Reads only files: zones.csv (per zone and day; zone names
<socket>_<third>), section_daily.bin (lattice plane SECTION_J), params_used.txt. Left: the section, with the tissue
colours of the report figures. Right: new bone and residual graft per socket (volume, % of the socket) against
real days, and new bone per third on the current day.
"""
import glob, os, re, sys, time
import numpy as np
import matplotlib
matplotlib.use("TkAgg")
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap

root = sys.argv[sys.argv.index("--root") + 1]
day_s = float(sys.argv[sys.argv.index("--day-seconds") + 1]) if "--day-seconds" in sys.argv else 0.3
INK, GRID, BLUE, RED = "#0b0b0b", "#e4e2dc", "#2a78d6", "#e34948"
CODES = [(0, "empty (clot)", "#ece9e2"), (1, "MSC", "#eda100"), (5, "fibroblast", "#1baf7a"), (4, "chondrocyte", "#6250d6"),
         (2, "new bone", BLUE), (11, "native bone / teeth", "#8a8880"), (14, "soft tissue", "#f3c7d7"), (12, "β-TCP granule", RED)]
LUT = np.zeros(256, int)
for i_, (c, _, _) in enumerate(CODES): LUT[c] = i_
CMAP = ListedColormap([c for _, _, c in CODES])


def minfo(run):
    t = open(os.path.join(run, "model_info.h")).read()
    g = lambda k: float(re.search(rf"{k}\s*=\s*([-0-9.e]+)", t).group(1))
    return int(g("LATTICE_X")), int(g("LATTICE_Z")), g("LATTICE_ORIGIN_X"), g("LATTICE_ORIGIN_Z")


def zones(run):
    out = {}
    for line in open(os.path.join(run, "zones.csv")).read().splitlines()[1:]:
        f = line.split(",")
        if f[1] != "volume": continue
        out.setdefault(float(f[0]), {})[f[2]] = np.array([int(x) for x in f[3:10]])  # points, empty, MSC, bone, cart, fib, granule
    return out


def params(run):
    d = {}
    for line in open(os.path.join(run, "params_used.txt")):
        k, v = line.split(); d[k] = v
    return d


fig = plt.figure(figsize=(19.2, 10.4), dpi=100)
try: fig.canvas.manager.window.attributes("-zoomed", True)
except Exception: pass
gs = fig.add_gridspec(2, 2, width_ratios=[1.1, 1.4], left=0.05, right=0.98, top=0.88, bottom=0.12, wspace=0.2, hspace=0.35)
ax_s = fig.add_subplot(gs[:, 0]); ax_t = fig.add_subplot(gs[0, 1]); ax_b = fig.add_subplot(gs[1, 1])
title = fig.suptitle("waiting for runs ...", x=0.01, ha="left", fontsize=13)
ax_s.legend([plt.Rectangle((0, 0), 1, 1, color=c) for _, _, c in CODES], [n for _, n, _ in CODES],
            loc="upper center", bbox_to_anchor=(0.5, -0.05), ncol=3, frameon=False, fontsize=10)
plt.show(block=False)
seen, img = set(), None


def show(run):
    global img
    LX, LZ, ox, oz = minfo(run)
    b = np.fromfile(os.path.join(run, "section_daily.bin"), np.uint8)
    nd = b.size // (LX * LZ)
    Z = zones(run); days = sorted(Z)
    sockets = sorted({n.rsplit("_", 1)[0] for n in Z[days[0]] if n != "total"})
    pr = params(run)
    title.set_text(f"Patient case, run {os.path.relpath(run, root)}: time scale x{pr.get('time_scale')} "
                   f"(day = real days), β-TCP k {pr.get('tcp_k')} /day, far-field strain {pr.get('farfield_strain')}")
    ext = [ox - 0.05, ox + 0.1 * (LX - 1) + 0.05, oz - 0.05, oz + 0.1 * (LZ - 1) + 0.05]
    for d_ in range(nd):
        day = days[min(d_, len(days) - 1)]
        sl = b[d_ * LX * LZ:(d_ + 1) * LX * LZ].reshape(LX, LZ)
        if img is None:
            img = ax_s.imshow(LUT[sl].T[::-1], cmap=CMAP, vmin=-0.5, vmax=len(CODES) - 0.5, extent=ext, interpolation="nearest")
            ax_s.set_xlabel("x (mm)"); ax_s.set_ylabel("z (mm)")
        img.set_data(LUT[sl].T[::-1]); ax_s.set_title(f"Section through both sockets, day {day}", loc="left", fontsize=13)
        ax_t.clear(); ax_b.clear()
        dd = [d for d in days if d <= day]
        for si, sk in enumerate(sockets):
            tot = [sum(Z[d][f"{sk}_{t}"] for t in ("apical", "middle", "coronal")) for d in dd]
            ls = ["-", "--", ":"][si % 3]
            ax_t.plot(dd, [100 * v[3] / v[0] for v in tot], ls, color=BLUE, lw=2.5, label=f"{sk} new bone")
            if any(v[6] for v in tot):
                ax_t.plot(dd, [100 * v[6] / v[0] for v in tot], ls, color=RED, lw=2.5, label=f"{sk} residual graft")
            vals = [100 * Z[day][f"{sk}_{t}"][3] / max(1, Z[day][f"{sk}_{t}"][0]) for t in ("apical", "middle", "coronal")]
            ax_b.bar(np.arange(3) + 0.38 * si, vals, width=0.36, color=[BLUE, "#7fb0ea", "#bcd5f4"][si % 3], label=sk)
        ax_t.set_xlim(0, days[-1] + 1); ax_t.set_ylim(0, 100); ax_t.set_xlabel("Day"); ax_t.set_ylabel("% of socket volume")
        ax_t.grid(axis="y", color=GRID); ax_t.legend(loc="upper left", frameon=False); ax_t.set_title("Per socket", loc="left")
        ax_b.set_xticks(np.arange(3) + 0.19); ax_b.set_xticklabels(["apical", "middle", "coronal"]); ax_b.set_ylim(0, 100)
        ax_b.set_ylabel("New bone, % of the third"); ax_b.grid(axis="y", color=GRID); ax_b.legend(frameon=False)
        ax_b.set_title(f"New bone per third, day {day}", loc="left")
        fig.canvas.draw_idle(); plt.pause(day_s)
        if not plt.fignum_exists(fig.number): sys.exit(0)


latest = None
while plt.fignum_exists(fig.number):
    runs = sorted((os.path.getmtime(t), os.path.dirname(t)) for t in glob.glob(os.path.join(root, "*", "*", "time.txt")))
    new = [r for _, r in runs if r not in seen]
    try:
        if new:
            latest = new[-1]; seen.update(new); show(latest)
        elif latest:
            show(latest)
    except Exception as e:
        print("panel:", e, flush=True)
    plt.pause(2.0)
