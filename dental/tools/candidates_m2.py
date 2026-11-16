"""Top single-seed candidates of the M1 sub-model (no clot entry, no cover source), rerun with seeds 1-5."""
import csv, sys
rows = []
for f in sys.argv[1:]:
    rows += [r for r in csv.DictReader(open(f)) if r["matrix_day"] == "-1" and r["cover_source"] == "0"]
seen, top = set(), []
for r in sorted(rows, key=lambda r: float(r["J"])):
    key = (float(r["late_factor"]), int(r["activity_days"]), float(r["remodel_rate"]))
    if key in seen: continue
    seen.add(key); top.append(key)
    if len(top) == 10: break
print("name,seed,force_stimulus,raw_daily,late_factor,activity_days,remodel_rate")
for lat, act, rem in top:
    for s in range(1, 6):
        print(f"c_lat{lat}_act{act}_rem{rem}_s{s},{s},2,0,{lat},{act},{rem}")
