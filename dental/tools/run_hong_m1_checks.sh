#!/bin/bash
# Milestone-1 checks: mesh sensitivity (0.6 mm socket elements) and rerun reproducibility.
# Usage: dental/tools/run_hong_m1_checks.sh <mesh_dir_0.8> <mesh_dir_0.6> <runs_dir>
set -e
TOOLS="$(cd "$(dirname "$0")" && pwd)"
M08="$1"; M06="$2"; OUT="$3"
mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"
CASES=$(cat <<LIST
mesh06_baseline_s1|1|$M06|
mesh06_biology_only_s1|1|$M06|-DFORCE_STIMULUS=2
rerun_baseline_s1|1|$M08|
LIST
)
echo "case,seed,flags,exit,wall_s,max_rss_kb" > "$OUT/timing.csv"
while IFS='|' read -r name seed mesh flags; do
  [ -z "$name" ] && continue
  "$TOOLS/prepare_run.sh" "$mesh" "$OUT/$name" $flags > /dev/null
  ( cd "$OUT/$name"; export SG_CCX_THREADS=1
    /usr/bin/time -f "%e,%M" -o time.txt ./mechanobio "$seed" > log.txt 2>&1; ec=$?
    echo "$name,$seed,$flags,$ec,$(tail -1 time.txt)" >> "$OUT/timing.csv" ) &
done <<< "$CASES"
wait
cat "$OUT/timing.csv"
