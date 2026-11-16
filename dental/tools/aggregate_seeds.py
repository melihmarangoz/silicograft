"""Average a score table (score_hong.py) over seeds: runs named <set>_s<seed> are grouped by <set>.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

Usage: python3 aggregate_seeds.py SCORES.csv OUT.csv [--top N]
Writes one row per set: its parameters, the number of seeds, mean and SD of J, and the mean of every output column.
"""
import csv, os, statistics as st, sys

src, dst = sys.argv[1], sys.argv[2]
top = int(sys.argv[sys.argv.index("--top") + 1]) if "--top" in sys.argv else 15
rows = list(csv.DictReader(open(src)))
groups = {}
for r in rows:
    name = os.path.basename(r["run"])
    key = name[:name.rindex("_s")] if "_s" in name else name
    groups.setdefault(key, []).append(r)
num = [k for k in rows[0] if k.startswith(("sec_", "vol_")) or k in ("J", "J_totals", "J_thirds")]
par = [k for k in rows[0] if k not in num and k not in ("run", "seed")]
out = []
for key, g in groups.items():
    o = dict(set=key, seeds=len(g), **{p: g[0][p] for p in par})
    for k in num:
        vals = [float(r[k]) for r in g]
        o[k] = round(st.mean(vals), 3)
    o["J_sd"] = round(st.stdev([float(r["J"]) for r in g]), 3) if len(g) > 1 else 0.0
    out.append(o)
out.sort(key=lambda o: o["J"])
with open(dst, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
has_rb = "sec_rb_tot_14" in out[0]
for o in out[:top]:
    print(f"J {o['J']:7.2f} ± {o['J_sd']:5.2f} (tot {o['J_totals']:6.2f}, thirds {o['J_thirds']:6.2f}) {o['set']:52s} "
          f"NB {o['sec_tot_14']:.1f}/{o['sec_tot_28']:.1f}/{o['sec_tot_56']:.1f}"
          + (f"  RB {o['sec_rb_tot_14']:.1f}/{o['sec_rb_tot_28']:.1f}/{o['sec_rb_tot_56']:.1f}" if has_rb else ""))
