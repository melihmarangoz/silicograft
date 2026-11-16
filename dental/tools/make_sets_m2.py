"""Parameter sets of milestone 2 (Hong 2014 empty-socket calibration), as CSV files for run_sets.py.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

  python3 make_sets_m2.py grid  > grid.csv     stage A1: coarse grid, biology-only, seed 1
  python3 make_sets_m2.py local BEST_JSON > local.csv   stage A2: one-at-a-time steps around a point, 5 seeds
  python3 make_sets_m2.py final BEST_JSON > final.csv   stage A3 + B: the fitted point (5 seeds, daily lattice),
                                                        and the soft-phase stimulus check under 150/300/1000 µε
BEST_JSON holds the fitted values, e.g. {"late_factor": 0.4, "activity_days": 15, ...}.
"""
import itertools, json, sys

COLS = ["name", "seed", "force_stimulus", "raw_daily", "stimulus_mode", "lower_window", "farfield_strain",
        "late_factor", "activity_days", "remodel_rate", "matrix_day", "cover_source", "seed_fraction", "lining_voxels"]


def out(rows):
    print(",".join(COLS))
    for r in rows:
        print(",".join(str(r.get(c, "")) for c in COLS))


def tag(d):
    return "_".join(f"{k[:3]}{v}" for k, v in d.items())


mode = sys.argv[1]
if mode == "grid":
    grid = dict(late_factor=[0.2, 0.3, 0.4, 0.5, 0.7, 1.0], activity_days=[10, 15, 21],
                remodel_rate=[0, 0.01, 0.02, 0.03, 0.05], matrix_day=[-1, 3, 7], cover_source=[0, 1])
    rows = []
    for vals in itertools.product(*grid.values()):
        d = dict(zip(grid.keys(), vals))
        rows.append(dict(name="g_" + tag(d), seed=1, force_stimulus=2, raw_daily=0, **d))
    out(rows)
elif mode == "local":
    best = json.load(open(sys.argv[2]))
    steps = dict(late_factor=[-0.1, 0.1], activity_days=[-3, 3], remodel_rate=[-0.005, 0.005],
                 seed_fraction=[-0.1, 0.1], lining_voxels=[-1, 1], matrix_day=None, cover_source=None)
    base = dict(seed_fraction=0.3, lining_voxels=2, **best)
    points = [("centre", base)]
    for k, st in steps.items():
        if st is None:  # structural switches: flip them
            alt = dict(base)
            alt[k] = {"matrix_day": (-1 if base[k] >= 0 else 7), "cover_source": 1 - base[k]}[k]
            points.append((f"{k}_flip", alt))
            continue
        for s in st:
            alt = dict(base)
            alt[k] = round(base[k] + s, 4)
            if alt[k] < 0:
                continue
            points.append((f"{k}_{'m' if s < 0 else 'p'}", alt))
    rows = [dict(name=f"l_{n}_s{seed}", seed=seed, force_stimulus=2, raw_daily=0, **d)
            for n, d in points for seed in range(1, 6)]
    out(rows)
elif mode == "final":
    best = json.load(open(sys.argv[2]))
    rows = [dict(name=f"A_fitted_s{s}", seed=s, force_stimulus=2, raw_daily=1, **best) for s in range(1, 6)]
    for eps, lab in [(1.5e-4, "150"), (3e-4, "300"), (1e-3, "1000")]:
        for s in range(1, 4):
            rows.append(dict(name=f"B_soft_lw1_{lab}_s{s}", seed=s, stimulus_mode=1, lower_window=1, farfield_strain=eps, raw_daily=1, **best))
            rows.append(dict(name=f"B_soft_lw0_{lab}_s{s}", seed=s, stimulus_mode=1, lower_window=0, farfield_strain=eps, raw_daily=1, **best))
    for s in range(1, 4):  # contrast: fitted biology with the upstream element-average stimulus
        rows.append(dict(name=f"B_elem_lw1_300_s{s}", seed=s, stimulus_mode=0, lower_window=1, farfield_strain=3e-4, raw_daily=1, **best))
    out(rows)
