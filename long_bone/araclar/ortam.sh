#!/bin/sh
# CalculiX ve gmsh icin ortam (sudo'suz yerel kurulum: ~/opt/calculix)
# Kullanim:  . araclar/ortam.sh
CCX_ROOT="$HOME/opt/calculix/root"
export LD_LIBRARY_PATH="$CCX_ROOT/usr/lib/x86_64-linux-gnu:$CCX_ROOT/usr/lib/x86_64-linux-gnu/blas:$CCX_ROOT/usr/lib/x86_64-linux-gnu/lapack:${LD_LIBRARY_PATH:-}"
export PATH="$CCX_ROOT/usr/bin:$PATH"
export OMP_NUM_THREADS="${OMP_NUM_THREADS:-4}"
