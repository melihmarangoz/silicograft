"""Score SG-Bone dental runs against Hong et al. 2014 (empty sockets) from their zones.csv.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

Usage: python3 score_hong.py --hong hong2014_empty_socket.csv --out scores.csv RUNS_DIR [RUNS_DIR ...]

Objective (central mesio-distal section, as Hong measured):
  J = sum_w ((NB_total - Hong_total) / SD_w)^2  +  (1/6) sum_w sum_thirds ((NB_third - Hong_third) / SD_w)^2
with w = weeks 2, 4, 8 (days 14, 28, 56). SD_w is the column NB_sigma when the Hong file has it (from 2026-11-16:
max of the paper's SD and the paper-thesis difference), else the paper's SD of the total. Hong gives no SD for the
thirds (digitized from Fig. 8), so they borrow the week's value and together weigh half as much as the totals.
J_thesis: the same objective against the thesis totals (no thirds).
With the beta-TCP file (columns RB_mean, RB_sd) the residual graft (RB, granule points) enters J the same way,
with Hong's RB SDs. One row per run: its parameters (params_used.txt), seed, the section and volume values, J and its parts.
"""
import argparse, csv, glob, os

DAYS = [14, 28, 56]
ZONES = ["apical", "middle", "coronal", "total"]
W_THIRDS = 1.0 / 6.0


def load_hong(path, measure="NB", source="paper"):
    """Hong means per (day, zone) and the uncertainty of the total per day, for NB or RB (RB only in the beta-TCP
    file). The uncertainty is the column <measure>_sigma when present (max of the paper's SD and the paper-thesis
    difference), else the paper's SD. source="thesis" gives the thesis totals (no thirds) with the same sigma."""
    rows = [r for r in csv.DictReader(l for l in open(path) if not l.startswith("#"))]
    if f"{measure}_mean" not in rows[0]:
        return None, None
    tot = [r for r in rows if r["zone"] == "total"]
    sig = f"{measure}_sigma" if f"{measure}_sigma" in rows[0] else f"{measure}_sd"
    sd = {int(r["day"]): float(r[sig]) for r in tot}
    if source == "thesis":
        if f"{measure}_thesis" not in rows[0]:
            return None, None
        return {(int(r["day"]), "total"): float(r[f"{measure}_thesis"]) for r in tot}, sd
    h = {(int(r["day"]), r["zone"]): float(r[f"{measure}_mean"]) for r in rows}
    return h, sd


def run_values(d):
    z = os.path.join(d, "zones.csv")
    if not os.path.exists(z):
        return None
    v = {}
    for r in csv.DictReader(open(z)):
        day = int(r["day"])
        if day in DAYS:
            v[(r["region"], day, r["zone"])] = 100.0 * int(r["bone"]) / int(r["points"])
            v[(r["region"], day, r["zone"], "cart")] = 100.0 * int(r["cartilage"]) / int(r["points"])
            v[(r["region"], day, r["zone"], "rb")] = 100.0 * int(r.get("granule") or 0) / int(r["points"])
    return v if len(v) == 3 * 2 * len(DAYS) * len(ZONES) else None


def objective(v, h, sd, region="section", hr=None, sdr=None):
    """J for new bone; with hr/sdr (beta-TCP arm) the residual-graft terms are added the same way."""
    thirds = (DAYS[0], "apical") in h  # the thesis has totals only
    jt = sum(((v[(region, d, "total")] - h[(d, "total")]) / sd[d]) ** 2 for d in DAYS)
    jz = W_THIRDS * sum(((v[(region, d, z)] - h[(d, z)]) / sd[d]) ** 2 for d in DAYS for z in ZONES[:3]) if thirds else 0.0
    if hr is not None:
        jt += sum(((v[(region, d, "total", "rb")] - hr[(d, "total")]) / sdr[d]) ** 2 for d in DAYS)
        if thirds:
            jz += W_THIRDS * sum(((v[(region, d, z, "rb")] - hr[(d, z)]) / sdr[d]) ** 2 for d in DAYS for z in ZONES[:3])
    return jt + jz, jt, jz


def params(d):
    out = {}
    f = os.path.join(d, "params_used.txt")
    if os.path.exists(f):
        for line in open(f):
            k, val = line.split()
            out[k] = val
    return out


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--hong", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("dirs", nargs="+")
    a = p.parse_args()
    h, sd = load_hong(a.hong)
    hr, sdr = load_hong(a.hong, "RB")  # None for the empty-socket file
    ht, sdt = load_hong(a.hong, "NB", "thesis")
    hrt, sdrt = load_hong(a.hong, "RB", "thesis")
    rows = []
    for top in a.dirs:
        for d in sorted(glob.glob(os.path.join(top, "*"))):
            v = run_values(d)
            if v is None:
                continue
            J, jt, jz = objective(v, h, sd, hr=hr, sdr=sdr)
            seed = open(os.path.join(d, "log.txt")).readline().split()[-1] if os.path.exists(os.path.join(d, "log.txt")) else ""
            r = dict(run=os.path.relpath(d), seed=seed, **params(d), J=round(J, 4), J_totals=round(jt, 4), J_thirds=round(jz, 4))
            if ht is not None:  # fit against the thesis totals (same sigma band)
                r["J_thesis"] = round(objective(v, ht, sdt, hr=hrt, sdr=sdrt)[0], 4)
            for region in ["section", "volume"]:
                for day in DAYS:
                    for z in ZONES:
                        r[f"{region[:3]}_{z[:3]}_{day}"] = round(v[(region, day, z)], 2)
                r[f"{region[:3]}_cart_56"] = round(v[(region, 56, "total", "cart")], 2)
                if hr is not None:
                    for day in DAYS:
                        for z in ZONES:
                            r[f"{region[:3]}_rb_{z[:3]}_{day}"] = round(v[(region, day, z, "rb")], 2)
            rows.append(r)
    keys = list(rows[0].keys())
    with open(a.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys); w.writeheader(); w.writerows(rows)
    rows.sort(key=lambda r: r["J"])
    print(f"{len(rows)} runs scored; best:")
    for r in rows[:8]:
        print(f"  J={r['J']:.2f} (totals {r['J_totals']:.2f}, thirds {r['J_thirds']:.2f}) {r['run']}  "
              f"sec tot {r['sec_tot_14']:.0f}/{r['sec_tot_28']:.0f}/{r['sec_tot_56']:.0f}  "
              f"d28 thirds {r['sec_api_28']:.0f}/{r['sec_mid_28']:.0f}/{r['sec_cor_28']:.0f}"
              + (f"  RB tot {r['sec_rb_tot_14']:.0f}/{r['sec_rb_tot_28']:.0f}/{r['sec_rb_tot_56']:.0f}" if hr is not None else ""))
