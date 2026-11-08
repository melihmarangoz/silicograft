#!/bin/bash
# Bagsiz plak agi ile 4 paralel 360 gunluk kosu (uzak bir 16 iş parçacıklı Linux makinesi). Her kosu OMP 4 is parcacigi.
P=~/mechanobio; K=~/kosular; AG=$K/ag_h1.7_bagsiz
D=$K/durum.txt
for k in "orijinal 12345" "claes 12345" "orijinal 2" "claes 2"; do
  set -- $k; ad=bagsiz_${1}_t$2
  [ -d $K/$ad ] || $P/araclar/kosu_hazirla.sh $AG $K/$ad $1 >> $D 2>&1
  ( cd $K/$ad && echo "$(date '+%F %T') BASLADI $ad" >> $D
    OMP_NUM_THREADS=4 /usr/bin/time -v ./mechanobio $2 > kosu_log.txt 2>&1
    echo "$(date '+%F %T') BITTI $ad cikis=$?" >> $D
    python3 $P/araclar/gorsellestir.py $K/$ad $K/sonuclar/$ad --etiket $ad --gif >> $K/gorsel_log.txt 2>&1 ) &
done
wait
echo "$(date '+%F %T') HEPSI BITTI" >> $D
