"""Parameter sets of milestone 3b (refit of both Hong 2014 arms with the 2026-11-16 literature values).

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

  python3 make_sets_m3b.py empty > empty_grid.csv
      Empty socket, biology-only: remodelling starts on day 21-30 at 0.02-0.045 /day (literature ranges; it slows to
      0.005 /day from day 60), activity period and late factor refitted. 3 seeds.
  python3 make_sets_m3b.py btcp EMPTY_FIT_JSON > btcp_grid.csv
      beta-TCP arm with the refitted biology, granule envelope 0.52, k 0.031: resorption lag, and three delay rules:
      pause (tcp_delay), pause with wall elements exempt, graded activity factor (tcp_diff_mult x tcp_inhibit_days).
  python3 make_sets_m3b.py final EMPTY_FIT_JSON BTCP_FIT_JSON > final.csv
      Fitted points with 5 seeds and daily output, the rule comparison, and the soft-phase stimulus check.
"""
import itertools, json, sys

COLS = ["name", "seed", "force_stimulus", "raw_daily", "stimulus_mode", "lower_window", "farfield_strain",
        "late_factor", "activity_days", "remodel_rate", "remodel_day", "remodel_rate2", "remodel_day2",
        "granule_fraction", "tcp_k", "tcp_lag", "tcp_delay", "tcp_delay_all", "tcp_delay_activity", "tcp_wall_exempt",
        "tcp_diff_mult", "tcp_inhibit_days", "tcp_inhibit_graded", "tcp_inhibit_prolif", "tcp_late_mult"]


def out(rows):
    print(",".join(COLS))
    for r in rows:
        print(",".join(str(r.get(c, "")) for c in COLS))


def tag(d):
    return "_".join(f"{k.replace('tcp_', '').replace('remodel_', 'rm')[:6]}{v}" for k, v in d.items())


mode = sys.argv[1]
if mode == "empty":
    grid = dict(remodel_day=[21, 24, 28, 30], remodel_rate=[0.02, 0.03, 0.045], activity_days=[15, 18, 21, 25],
                late_factor=[0.2, 0.25, 0.3, 0.4, 0.5])
    rows = []
    for vals in itertools.product(*grid.values()):
        d = dict(zip(grid.keys(), vals))
        for s in (1, 2, 3):
            rows.append(dict(name=f"e_{tag(d)}_s{s}", seed=s, force_stimulus=2, raw_daily=0, remodel_rate2=0.005,
                             remodel_day2=60, **d))
    out(rows)
elif mode == "btcp":
    bio = json.load(open(sys.argv[2]))
    base = dict(force_stimulus=2, raw_daily=0, remodel_rate2=0.005, remodel_day2=60, granule_fraction=0.52, tcp_k=0.031,
                **bio)
    rows = []
    def add(d):
        for s in (1, 2, 3):
            rows.append(dict(name=f"b_{tag(d)}_s{s}", seed=s, **base, **d))
    for lag in [0, 2, 4, 6, 8]:
        for delay in [6, 8, 10, 12, 14]:  # R1 pause; R2 pause with wall elements exempt
            for wall in [0, 1]:
                add(dict(tcp_lag=lag, tcp_delay=delay, tcp_delay_all=1, tcp_delay_activity=0, tcp_wall_exempt=wall))
        for mult in [0.2, 0.3, 0.4, 0.5, 0.7]:  # R3 graded activity factor for the first 3-4 weeks
            for days in [21, 28]:
                add(dict(tcp_lag=lag, tcp_diff_mult=mult, tcp_inhibit_days=days, tcp_inhibit_graded=1, tcp_inhibit_prolif=1))
    out(rows)
elif mode == "final":
    bio = json.load(open(sys.argv[2]))
    tcp = json.load(open(sys.argv[3]))  # {"rules": {name: {params}}, "chosen": name}
    common = dict(remodel_rate2=0.005, remodel_day2=60, **bio)
    rows = []
    for s in range(1, 6):
        rows.append(dict(name=f"E_fitted_s{s}", seed=s, force_stimulus=2, raw_daily=1, **common))
        for rname, rp in tcp["rules"].items():
            rows.append(dict(name=f"T_{rname}_s{s}", seed=s, force_stimulus=2, raw_daily=1, **common, **rp))
    chosen = tcp["rules"][tcp["chosen"]]
    for s in range(1, 4):  # mechanics back on: soft-tissue phase, no lower window
        for eps, lab in [(1.5e-4, "150"), (3e-4, "300"), (1e-3, "1000")]:
            rows.append(dict(name=f"B_empty_{lab}_s{s}", seed=s, raw_daily=1, stimulus_mode=1, lower_window=0, farfield_strain=eps, **common))
            rows.append(dict(name=f"B_btcp_{lab}_s{s}", seed=s, raw_daily=1, stimulus_mode=1, lower_window=0, farfield_strain=eps, **common, **chosen))
    out(rows)
