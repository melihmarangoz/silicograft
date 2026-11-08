#!/bin/bash
# Iki 360 gunluk kosuyu sirayla calistirir (RAM ikisine birden yetmiyor). Ayni tohum: 12345.
PROJE="$(cd "$(dirname "$0")/.." && pwd)"
for ad in orijinal claes; do
  cd ~/mechanobio_calculix/kosu_$ad || exit 1
  echo "$(date '+%F %T') BASLADI $ad" >> ~/mechanobio_calculix/iki_kosu_durum.txt
  /usr/bin/time -v ./mechanobio 12345 > kosu_log.txt 2>&1
  rc=$?
  echo "$(date '+%F %T') BITTI $ad cikis=$rc" >> ~/mechanobio_calculix/iki_kosu_durum.txt
  python3 "$PROJE/araclar/gorsellestir.py" ~/mechanobio_calculix/kosu_$ad "$PROJE/sonuclar/$ad" --etiket $ad --gif >> ~/mechanobio_calculix/iki_kosu_durum.txt 2>&1
done
echo "$(date '+%F %T') HEPSI BITTI" >> ~/mechanobio_calculix/iki_kosu_durum.txt
