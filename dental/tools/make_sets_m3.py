"""Parameter sets of milestone 3 (Hong 2014 beta-TCP arm), as CSV files for run_sets.py.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

The biology is milestone 2's calibrated setting (biology-only stimulus; activity_days 18, late_factor 0.25,
remodel_rate 0.03). Only the granule parameters vary.
  python3 make_sets_m3.py grid > grid.csv           tcp_delay x tcp_lag x tcp_k x granule fraction x TCP stimulation,
                                                    seeds 1-3 (each seed also packs its own granules), activity
                                                    period shifted with the delay (tcp_delay_activity 1)
  The follow-up scans with tcp_delay_activity 0 (var3.csv, refine3.csv) are kept in results/m3/sets.
  python3 make_sets_m3.py final FIT_JSON > final.csv  the fitted point and the variants with 5 seeds and daily
                                                    output, plus the soft-phase stimulus check under load
"""
import itertools, json, sys

BIO = dict(force_stimulus=2, late_factor=0.25, activity_days=18, remodel_rate=0.03)
COLS = ["name", "seed", "force_stimulus", "raw_daily", "stimulus_mode", "lower_window", "farfield_strain", "late_factor",
        "activity_days", "remodel_rate", "granule_fraction", "tcp_k", "tcp_lag", "tcp_delay", "tcp_delay_all",
        "tcp_delay_activity", "tcp_late_mult"]


def out(rows):
    print(",".join(COLS))
    for r in rows:
        print(",".join(str(r.get(c, "")) for c in COLS))


mode = sys.argv[1]
if mode == "grid":
    grid = dict(granule_fraction=[0.42, 0.2], tcp_late_mult=[1, 2.5], tcp_delay=[12, 14, 16, 18, 20, 22],
                tcp_lag=[6, 8, 10, 12], tcp_k=[0.025, 0.031, 0.037])
    rows = []
    for vals in itertools.product(*grid.values()):
        d = dict(zip(grid.keys(), vals))
        name = "g_" + "_".join(f"{k.split('_')[-1][:4]}{v}" for k, v in d.items())
        for s in (1, 2, 3):
            rows.append(dict(name=f"{name}_s{s}", seed=s, raw_daily=0, tcp_delay_all=1, **BIO, **d))
    out(rows)
elif mode == "final":
    fit = json.load(open(sys.argv[2]))
    rows = []
    base = dict(BIO, tcp_delay_all=1, **fit)
    for s in range(1, 6):
        rows.append(dict(name=f"A_fitted_s{s}", seed=s, raw_daily=1, **base))
        rows.append(dict(name=f"V_stim_s{s}", seed=s, raw_daily=1, **dict(base, tcp_late_mult=2.5)))
        rows.append(dict(name=f"V_frac02_s{s}", seed=s, raw_daily=1, **dict(base, granule_fraction=0.2)))
        rows.append(dict(name=f"V_nodelay_s{s}", seed=s, raw_daily=1, **dict(base, tcp_delay=0)))
        rows.append(dict(name=f"V_shiftedactivity_s{s}", seed=s, raw_daily=1, **dict(base, tcp_delay=18, tcp_delay_activity=1)))
    for s in range(1, 4):  # mechanics back on: soft-tissue phase, no lower window (milestone-2 recommendation)
        for eps, lab in [(1.5e-4, "150"), (3e-4, "300"), (1e-3, "1000")]:
            b = dict(base); b.pop("force_stimulus")
            rows.append(dict(name=f"B_soft_{lab}_s{s}", seed=s, raw_daily=1, stimulus_mode=1, lower_window=0, farfield_strain=eps, **b))
    out(rows)
