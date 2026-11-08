#!/bin/sh
# [CCX] Abaqus "run.bat" karsiligi: CalculiX ile without_scaffold.inp'i coz.
# Bayat sonuc okumayi onlemek icin eski .dat once silinir; ccx basarisizsa ya da tablo yoksa hata doner.
set -e
. "$(dirname "$0")/ortam.sh" 2>/dev/null || true
rm -f without_scaffold.dat without_scaffold.frd
ccx without_scaffold > ccx_log.txt 2>&1 || { echo "HATA: ccx basarisiz, ccx_log.txt"; tail -20 ccx_log.txt; exit 1; }
grep -q "strains (elem" without_scaffold.dat || { echo "HATA: .dat icinde strain tablosu yok"; exit 1; }
rm -f without_scaffold.frd spooles.out
# FE cozum gecmisi: proksimal referans noktasinin eksenel yer degistirmesi
awk '/displacements/{f=1;next} f&&NF==4{print $4; exit}' without_scaffold.dat >> uz_yerdegistirme.txt
exit 0
