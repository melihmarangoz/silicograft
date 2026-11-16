"""Profiles of the grid objective and local identifiability around the fitted point (milestone 2).

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

  python3 identifiability.py profile GRID_SCORES.csv OUTDIR
      For each grid parameter: the lowest J over all other parameters at each of its values (profile), as a table
      (profiles.csv) and a figure (profiles.png).
  python3 identifiability.py local LOCAL_SCORES.csv OUTDIR
      Runs named l_<point>_s<seed> (make_sets_m2.py local). Outputs are averaged over seeds. For each continuous
      parameter the sensitivity of the 12 section outputs (3 totals, 9 thirds) is a central difference, scaled by
      the objective's weights (SD of the week, thirds x 1/sqrt(6)) and by the centre value (relative change). The
      Fisher-type matrix F = S^T S gives relative standard errors sqrt(diag(F^-1)), correlations and eigenvalues,
      for the three fitted parameters and for all five continuous ones. Structural switches are flipped
      and their change in J reported. Also writes the seed spread at the centre.
"""
import csv, json, os, sys
import numpy as np

DAYS = [14, 28, 56]
SD = {14: 2.94, 28: 3.60, 56: 17.11}
OUTS = [(z, d) for d in DAYS for z in ["tot", "api", "mid", "cor"]]
WEIGHT = {"tot": 1.0, "api": 1 / 6, "mid": 1 / 6, "cor": 1 / 6}

mode, src, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(outdir, exist_ok=True)
rows = list(csv.DictReader(open(src)))

if mode == "profile":
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    params = ["late_factor", "activity_days", "remodel_rate", "matrix_day", "cover_source"]
    prof = []
    fig, axs = plt.subplots(1, len(params), figsize=(13, 2.8), sharey=True)
    for ax, p in zip(axs, params):
        vals = sorted({float(r[p]) for r in rows})
        js = [min(float(r["J"]) for r in rows if float(r[p]) == v) for v in vals]
        for v, j in zip(vals, js):
            prof.append(dict(parameter=p, value=v, J_min=round(j, 3)))
        ax.plot(vals, js, "o-", color="#2a78d6", lw=2, ms=5)
        ax.set_title(p, loc="left", fontsize=9)
        ax.grid(axis="y", color="#e4e2dc")
        ax.axhline(min(float(r["J"]) for r in rows) + 1, color="#52514e", lw=0.8, ls=":")
    axs[0].set_ylabel("lowest J over the other parameters")
    axs[0].set_yscale("log")
    fig.savefig(os.path.join(outdir, "profiles.png"), dpi=150, bbox_inches="tight")
    with open(os.path.join(outdir, "profiles.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["parameter", "value", "J_min"]); w.writeheader(); w.writerows(prof)
    best = min(rows, key=lambda r: float(r["J"]))
    print("best:", {k: best[k] for k in params}, "J", best["J"])
    for r in prof:
        print(f"  {r['parameter']:14s} {r['value']:8g}  J_min {r['J_min']:.2f}")

elif mode == "local":
    groups = {}
    for r in rows:
        name = os.path.basename(r["run"])
        point = name[2:name.rindex("_s")]
        groups.setdefault(point, []).append(r)
    def mean_out(pt, key=None):
        g = groups[pt]
        return np.array([np.mean([float(r[f"sec_{z}_{d}"]) for r in g]) for z, d in OUTS])
    def J_of(y):
        return float(sum(WEIGHT[z] * ((y[i] - HONG[i]) / SD[d]) ** 2 for i, (z, d) in enumerate(OUTS)))
    HONG = np.array([{"tot": {14: 26.03, 28: 47.68, 56: 62.01}, "api": {14: 37.0, 28: 46.6, 56: 61.6},
                      "mid": {14: 27.7, 28: 46.8, 56: 60.5}, "cor": {14: 19.6, 28: 49.0, 56: 62.5}}[z][d] for z, d in OUTS])
    scale = np.array([np.sqrt(WEIGHT[z]) / SD[d] for z, d in OUTS])
    yc = mean_out("centre")
    centre_runs = groups["centre"]
    seed_sd = np.array([np.std([float(r[f"sec_{z}_{d}"]) for r in centre_runs], ddof=1) for z, d in OUTS])
    res = dict(J_centre=J_of(yc), seed_sd={f"{z}_{d}": round(float(s), 2) for (z, d), s in zip(OUTS, seed_sd)},
               centre={f"{z}_{d}": round(float(v), 2) for (z, d), v in zip(OUTS, yc)})
    cont = []
    S = []
    for p in ["late_factor", "activity_days", "remodel_rate", "seed_fraction", "lining_voxels"]:
        if f"{p}_m" not in groups or f"{p}_p" not in groups:
            continue
        vm = float(groups[f"{p}_m"][0][p]); vp = float(groups[f"{p}_p"][0][p])
        dy = (mean_out(f"{p}_p") - mean_out(f"{p}_m")) / (vp - vm)
        S.append(dy * scale)
        cont.append(p)
        res[f"dJ_{p}"] = dict(minus=round(J_of(mean_out(f"{p}_m")) - res["J_centre"], 3),
                              plus=round(J_of(mean_out(f"{p}_p")) - res["J_centre"], 3), step=[vm, vp])
    S = np.array(S).T  # outputs x params (weighted, per unit of each parameter)
    theta0 = np.array([float(groups["centre"][0][p]) for p in cont])
    Srel = S * theta0  # per relative change of each parameter, so that eigenvalues compare across parameters
    def fim_report(idx):
        names = [cont[i] for i in idx]
        F = Srel[:, idx].T @ Srel[:, idx]
        ev, evec = np.linalg.eigh(F)
        r = dict(parameters=names, eigenvalues=[round(float(x), 4) for x in ev],
                 eigenvectors_columns={n: [round(float(x), 3) for x in evec[i]] for i, n in enumerate(names)})
        try:
            C = np.linalg.inv(F)
            se = np.sqrt(np.diag(C))
            r["relative_se"] = {n: round(float(x), 3) for n, x in zip(names, se)}
            r["approx_se"] = {n: round(float(x * t), 4) for n, x, t in zip(names, se, theta0[idx])}
            r["correlation"] = {n: [round(float(x), 2) for x in (C / np.outer(se, se))[i]] for i, n in enumerate(names)}
        except np.linalg.LinAlgError:
            r["relative_se"] = "singular"
        return r
    res["fitted_parameters"] = fim_report([cont.index(p) for p in ["late_factor", "activity_days", "remodel_rate"] if p in cont])
    res["all_continuous"] = fim_report(list(range(len(cont))))
    # per-parameter sensitivity of each output (percentage points per unit), for the report
    res["sensitivity_pp_per_unit"] = {p: {f"{z}_{d}": round(float(S[i, j] / scale[i]), 2) for i, (z, d) in enumerate(OUTS)}
                                     for j, p in enumerate(cont)}
    for flip in ["matrix_day_flip", "cover_source_flip"]:
        if flip in groups:
            res[f"dJ_{flip}"] = round(J_of(mean_out(flip)) - res["J_centre"], 3)
    json.dump(res, open(os.path.join(outdir, "local_identifiability.json"), "w"), indent=1)
    print(json.dumps({k: res[k] for k in res if k not in ("sensitivity_pp_per_unit",)}, indent=1))
