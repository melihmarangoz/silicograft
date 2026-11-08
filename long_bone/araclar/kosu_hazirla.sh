#!/bin/bash
# Kullanim: araclar/kosu_hazirla.sh <ag_klasoru> <kosu_klasoru> [orijinal|claes] [ek g++ bayraklari...]
# Kosu klasorunu olusturur, programi ag klasorundeki model_bilgi.h ile derler, gerekli dosyalari kopyalar.
set -e
PROJE="$(cd "$(dirname "$0")/.." && pwd)"
AG="$(cd "$1" && pwd)"; KOSU="$2"; ISARET="${3:-orijinal}"; shift 3 || shift $#
[ -e "$KOSU" ] && { echo "DUR: $KOSU zaten var"; exit 1; }
mkdir -p "$KOSU"; KOSU="$(cd "$KOSU" && pwd)"
BAYRAK=""
[ "$ISARET" = "claes" ] && BAYRAK="-DCLAES_HEIGELE_BASMA_POZITIF"
g++ -O2 -std=c++17 -w -I"$AG" $BAYRAK "$@" "$PROJE"/src/*.cpp -o "$KOSU/mechanobio"
cp "$AG"/model_sablon.inp "$AG"/node_file.txt "$AG"/element_file.txt "$AG"/model_bilgi.h "$KOSU"/
cp "$PROJE"/araclar/run.sh "$PROJE"/araclar/ortam.sh "$KOSU"/
echo "isaret=$ISARET bayraklar=$BAYRAK $*" > "$KOSU/derleme_bilgisi.txt"
echo "Hazir: $KOSU  (isaret: $ISARET)"
