"""Best fit of each structural sub-model in a grid score table (milestone 2). Copyright 2026 Melih Marangoz; AGPL-3.0.
Usage: python3 submodels.py GRID_SCORES.csv"""
import csv, sys
rows = list(csv.DictReader(open(sys.argv[1])))
def best(filt):
    c = [r for r in rows if filt(r)]
    b = min(c, key=lambda r: float(r["J"]))
    return b, len(c)
specs = [
 ("M0 rates only (no remodel, no matrix, no cover)", lambda r: float(r["remodel_rate"])==0 and r["matrix_day"]=="-1" and r["cover_source"]=="0", 2),
 ("M1 + remodelling", lambda r: r["matrix_day"]=="-1" and r["cover_source"]=="0", 3),
 ("M2 + clot entry (matrix)", lambda r: float(r["remodel_rate"])==0 and r["cover_source"]=="0", 3),
 ("M3 + coronal cover source", lambda r: float(r["remodel_rate"])==0 and r["matrix_day"]=="-1", 3),
 ("M4 all", lambda r: True, 5),
 ("upstream (lat 0.2, act 15, nothing else)", lambda r: r["late_factor"]=="0.2" and r["activity_days"]=="15" and float(r["remodel_rate"])==0 and r["matrix_day"]=="-1" and r["cover_source"]=="0", 0),
]
for name, f, k in specs:
    b, n = best(f)
    print(f"{name:48s} k={k} n={n:3d} J={float(b['J']):6.2f} (tot {float(b['J_totals']):.2f}, thirds {float(b['J_thirds']):.2f}) AIC~{float(b['J'])+2*k:6.2f}  "
          f"lat {b['late_factor']} act {b['activity_days']} rem {b['remodel_rate']} mat {b['matrix_day']} cov {b['cover_source']} | "
          f"tot {b['sec_tot_14']}/{b['sec_tot_28']}/{b['sec_tot_56']} | thirds14 {b['sec_api_14']}/{b['sec_mid_14']}/{b['sec_cor_14']} 28 {b['sec_api_28']}/{b['sec_mid_28']}/{b['sec_cor_28']} 56 {b['sec_api_56']}/{b['sec_mid_56']}/{b['sec_cor_56']}")
