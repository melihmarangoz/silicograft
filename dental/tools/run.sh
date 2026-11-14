#!/bin/sh
# SG-Bone dental: solve socket.inp with CalculiX (called by the C++ program as FE_CMD).
# The old .dat is removed first so a failed solve can never be read as a fresh result.
# OMP_NUM_THREADS is pinned (default 1): reruns with the same seed are only bit-identical with the same
# thread count (long-bone finding, 2026-11-07).
set -e
export OMP_NUM_THREADS="${SG_CCX_THREADS:-1}"
rm -f socket.dat socket.frd
ccx socket > ccx_log.txt 2>&1 || { echo "ERROR: ccx failed, see ccx_log.txt"; tail -20 ccx_log.txt; exit 1; }
grep -q "strains (elem" socket.dat || { echo "ERROR: no strain table in socket.dat"; exit 1; }
rm -f socket.frd spooles.out socket.cvg socket.sta
exit 0
