#!/bin/bash
# Milestone 1 of the Hong 2014 calibration: empty-socket runs (no fitting).
# Usage: dental/tools/run_hong_m1.sh <mesh_dir> <runs_dir>
# Builds every case into <runs_dir>/<case>, runs them in parallel (ccx pinned to one thread each) and
# writes <runs_dir>/timing.csv (wall time, peak memory).
set -e
TOOLS="$(cd "$(dirname "$0")" && pwd)"
MESH="$1"; OUT="$2"
mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"
# case | seed | g++ flags
CASES=$(cat <<'LIST'
baseline_s1|1|
baseline_s2|2|
baseline_s3|3|
zero_load|1|-DFARFIELD_STRAIN=0.0
load_150|1|-DFARFIELD_STRAIN=1.5e-4
load_1000|1|-DFARFIELD_STRAIN=1.0e-3
upstream_counting|1|-DSG_UPSTREAM_COUNTING
claes_sign|1|-DCLAES_HEIGELE_BASMA_POZITIF
biology_only_s1|1|-DFORCE_STIMULUS=2
biology_only_s2|2|-DFORCE_STIMULUS=2
biology_only_s3|3|-DFORCE_STIMULUS=2
LIST
)
echo "case,seed,flags,exit,wall_s,max_rss_kb" > "$OUT/timing.csv"
while IFS='|' read -r name seed flags; do
  [ -z "$name" ] && continue
  "$TOOLS/prepare_run.sh" "$MESH" "$OUT/$name" $flags > /dev/null
  (
    cd "$OUT/$name"
    export SG_CCX_THREADS=1
    /usr/bin/time -f "%e,%M" -o time.txt ./mechanobio "$seed" > log.txt 2>&1; ec=$?
    echo "$name,$seed,$flags,$ec,$(cat time.txt | tail -1)" >> "$OUT/timing.csv"
  ) &
done <<< "$CASES"
wait
echo "done: $OUT"; cat "$OUT/timing.csv"
