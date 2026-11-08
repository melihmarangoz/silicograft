#!/bin/bash
# Re-run the three viewer runs (seed 12345) with a full-resolution lattice saved EVERY day,
# so that each cell agent can be drawn individually (cell-level viewer, hucre3b).
# Each daily lattice_N.raw (52 MB) is compressed to lattice_N.raw.zst as soon as the next one appears.
# Usage (in the lease): araclar/gunluk_kosu.sh   -> status in ~/kosular_gunluk/durum.txt
P=~/mechanobio; K=~/kosular_gunluk; D=$K/durum.txt
mkdir -p $K
sikistir() {  # $1 = run folder; compress every lattice file except the most recently written one
  local d=$1
  while true; do
    local son=$(ls -1t $d/lattice_*.raw 2>/dev/null | head -1)
    for f in $d/lattice_*.raw; do
      [ -e "$f" ] || continue
      if [ "$f" != "$son" ] || [ -e $d/BITTI ]; then
        zstd -q -3 --rm -f "$f" -o "$f.zst" || echo "$(date '+%F %T') zstd HATA $f" >> $D
      fi
    done
    [ -e $d/BITTI ] && ! ls $d/lattice_*.raw >/dev/null 2>&1 && break
    sleep 5
  done
}
for k in "bagsiz orijinal 12345" "bagsiz claes 12345" "bagli orijinal 12345"; do
  set -- $k; ad=${1}_${2}_t$3
  [ -d $K/$ad ] || $P/araclar/kosu_hazirla.sh $K/ag_h1.7_$1 $K/$ad $2 -DRAW_WRITE_INTERVAL=1 >> $D 2>&1
  ( cd $K/$ad && echo "$(date '+%F %T') BASLADI $ad" >> $D
    sikistir $K/$ad &
    OMP_NUM_THREADS=5 /usr/bin/time -v ./mechanobio $3 > kosu_log.txt 2>&1
    echo "$(date '+%F %T') BITTI $ad cikis=$?" >> $D
    touch BITTI; wait ) &
done
wait
echo "$(date '+%F %T') HEPSI BITTI" >> $D
