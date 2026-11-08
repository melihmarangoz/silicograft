#!/bin/bash
# Ek 3 kosu: tohum 3 (iki isaret) + yeni plakla bagli kallus (bag etkisini plak boyundan ayirmak icin)
P=~/mechanobio; K=~/kosular; D=$K/durum.txt
for k in "bagsiz orijinal 3" "bagsiz claes 3" "bagli orijinal 12345"; do
  set -- $k; ad=${1}_${2}_t$3
  [ -d $K/$ad ] || $P/araclar/kosu_hazirla.sh $K/ag_h1.7_$1 $K/$ad $2 >> $D 2>&1
  ( cd $K/$ad && echo "$(date '+%F %T') BASLADI $ad" >> $D
    OMP_NUM_THREADS=4 /usr/bin/time -v ./mechanobio $3 > kosu_log.txt 2>&1
    echo "$(date '+%F %T') BITTI $ad cikis=$?" >> $D
    python3 $P/araclar/gorsellestir.py $K/$ad $K/sonuclar/$ad --etiket $ad --gif >> $K/gorsel_log.txt 2>&1 ) &
done
wait
echo "$(date '+%F %T') EK KOSULAR BITTI" >> $D
