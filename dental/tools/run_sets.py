"""Run many parameter sets of the SG-Bone dental model in parallel.

Copyright 2026 Melih Marangoz. Part of SilicoGraft; GNU AGPL-3.0 (see LICENSE).

Usage: python3 run_sets.py --build BUILD_DIR --sets SETS.csv --out RUNS_DIR [--jobs 15]

BUILD_DIR is a folder made by prepare_run.sh (binary + mesh files). SETS.csv has a column "name", a column
"seed" and one column per runtime parameter (see struct Params in src/header.h); empty cells keep the default.
Each set gets RUNS_DIR/<name> with links to the build files and its own params.txt. Sets whose folder already
holds a finished run are skipped. CalculiX is pinned to one thread per run (run.sh, SG_CCX_THREADS).
"""
import argparse, csv, os, subprocess, time
from concurrent.futures import ThreadPoolExecutor

p = argparse.ArgumentParser()
p.add_argument("--build", required=True)
p.add_argument("--sets", required=True)
p.add_argument("--out", required=True)
p.add_argument("--jobs", type=int, default=15)
a = p.parse_args()
build = os.path.abspath(a.build)
os.makedirs(a.out, exist_ok=True)
LINK = ["mechanobio", "model_template.inp", "node_file.txt", "element_file.txt", "model_info.h",
        "lattice_init.raw", "mesh_summary.json", "run.sh", "build_info.txt",
        "zone_map.raw", "zone_names.txt", "graft_mask.raw", "socket_map.raw", "implant_mask.raw"]  # the last five only if the build has them
rows = list(csv.DictReader(open(a.sets)))


def run(row):
    d = os.path.join(a.out, row["name"])
    if os.path.exists(os.path.join(d, "time.txt")):
        return row["name"], "skipped", 0.0
    os.makedirs(d, exist_ok=True)
    for f in LINK:
        dst = os.path.join(d, f)
        if not os.path.lexists(dst) and os.path.exists(os.path.join(build, f)):
            os.symlink(os.path.join(build, f), dst)
    with open(os.path.join(d, "params.txt"), "w") as f:
        for k, v in row.items():
            if k not in ("name", "seed") and v != "":
                f.write(f"{k} {v}\n")
    t0 = time.time()
    env = dict(os.environ, SG_CCX_THREADS="1")
    with open(os.path.join(d, "log.txt"), "w") as log:
        r = subprocess.run(["./mechanobio", row["seed"]], cwd=d, stdout=log, stderr=subprocess.STDOUT, env=env)
    dt = time.time() - t0
    with open(os.path.join(d, "time.txt"), "w") as f:
        f.write(f"{dt:.2f} exit {r.returncode}\n")
    return row["name"], r.returncode, dt


t0 = time.time()
with ThreadPoolExecutor(a.jobs) as ex:
    res = list(ex.map(run, rows))
bad = [r for r in res if r[1] not in (0, "skipped")]
print(f"{len(res)} sets, {len(bad)} failed, wall {time.time() - t0:.0f} s, "
      f"mean run {sum(r[2] for r in res if r[1] == 0) / max(1, sum(1 for r in res if r[1] == 0)):.1f} s")
for r in bad:
    print("FAILED", r)
