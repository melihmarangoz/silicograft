#!/bin/bash
# Build the cell-viewer data of the three daily runs (araclar/gunluk_kosu.sh) in parallel and package it
# as base64 text (artifacts do not serve .bin files): ~/www/veri/<run>/{makro,roi_*,zemin}.b64.txt + parca/ + parca.json
# + sayilar.json + manifest.json. Run the runs one after another if RAM is short (each needs ~0.7 GB).
P=~/mechanobio; K=~/kosular_gunluk; V=~/veri_cikti; W=~/www/veri
for ad in bagsiz_orijinal_t12345 bagsiz_claes_t12345 bagli_orijinal_t12345; do
  ( python3 $P/araclar/hucre3b_veri.py cikar $K/$ad $V/$ad --roi ~/bolgeler.json > $V.$ad.log 2>&1
    mkdir -p $W/$ad
    for f in $V/$ad/*.bin.gz; do base64 -w0 $f > $W/$ad/$(basename $f .bin.gz).b64.txt; done
    cp $V/$ad/sayilar.json $W/$ad/
    # whole-callus package for the free region choice (tiles, map anatomy) and the preset regions rebuilt from it
    # (same codes as the cut above, true 3D mask); check it against the raw lattices
    nice -n 15 python3 $P/araclar/hucre3b_paket.py $K/$ad $W/$ad --bolgeler ~/bolgeler.json > $V.$ad.paket.log 2>&1
    nice -n 15 python3 $P/araclar/hucre3b_paket_test.py $W/$ad $V/$ad --bolgeler ~/bolgeler.json --ham $K/$ad >> $V.$ad.paket.log 2>&1
    python3 $P/araclar/hucre3b_veri.py manifest $K/$ad $W/$ad --bolgeler ~/bolgeler.json   # names the published .b64.txt files
    echo "$ad tamam" ) &
done
wait
cp ~/bolgeler.json $W/
du -sh $W/*
