#!/bin/bash
# Usage: dental/tools/prepare_run.sh <mesh_dir> <run_dir> [extra g++ flags...]
# Builds the socket model against the mesh's model_info.h and copies what a run needs into <run_dir>.
# Useful flags: -DFARFIELD_STRAIN=3e-4 (default), -DFORCE_STIMULUS=2 (biology-only baseline),
# -DSG_UPSTREAM_COUNTING (upstream integer truncation), -DSG_COVER_GUIDES, -DCLAES_HEIGELE_BASMA_POZITIF,
# -DNUMBER_ITERATIONS_OVERRIDE=N.
set -e
DENTAL="$(cd "$(dirname "$0")/.." && pwd)"
MESH="$(cd "$1" && pwd)"; RUN="$2"; shift 2
[ -e "$RUN" ] && { echo "STOP: $RUN already exists"; exit 1; }
mkdir -p "$RUN"; RUN="$(cd "$RUN" && pwd)"
g++ -O2 -std=c++17 -w -I"$MESH" "$@" "$DENTAL"/src/*.cpp -o "$RUN/mechanobio"
cp "$MESH"/model_template.inp "$MESH"/node_file.txt "$MESH"/element_file.txt "$MESH"/model_info.h \
   "$MESH"/lattice_init.raw "$MESH"/mesh_summary.json "$RUN"/
cp "$DENTAL"/tools/run.sh "$RUN"/
{ echo "flags: $*"; echo "mesh: $MESH"; echo "source: ${SG_SOURCE:-$(cd "$DENTAL" && git rev-parse --short HEAD 2>/dev/null || echo unknown)}"; } > "$RUN/build_info.txt"
echo "Ready: $RUN ($*)"
