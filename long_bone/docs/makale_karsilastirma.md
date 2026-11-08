# Perier-Metz ve ark. 2022 (Acta Biomater 145:329–341) ile modelimizin karşılaştırması

Kaynak: `Perier-Metz et al. - 2022 - An in silico model predicts the impact of scaffold design in large bone defect regeneration.pdf` (VETİS üzerinden, 11.10.2026). Bu makale `mechanobio_bone_2` kodunun yayını.

## FE modeli: makale ve bizim model
| Öğe | Makale (boş defekt) | Bizim CalculiX modeli | Uyum |
|---|---|---|---|
| Kemik kesiti | oval silindir, eksenler 15 × 17 mm, korteks ~4 mm | elips 15 × 17 mm, ilik çapları 7.5 × 8.8 mm (korteks 3.75–4.1 mm) | ✓ |
| Defekt | 3 cm, koyun tibia | 30 mm | ✓ |
| Kallus | çember yayı döndürülmüş, orta yükseklikte en fazla 10.5 mm, kemiği 5 mm örtüyor | çember yayı, eksenden 18 mm (korteksten 9.5–10.5 mm), kemiği 5 mm örtüyor | ✓ |
| Kallus ağı | ikinci dereceden tetrahedron, ortalama 1.8 mm, her eleman ayrı kesit | C3D10, 1.7 mm, aynı (E, ν) değerleri gruplanıyor (eşdeğer) | ✓ |
| Plak | çelik 210 GPa, 155 × 13.5 × 5.6 mm | çelik 210 GPa, ~96 × 13.6 × 5.6 mm | uzunluk farklı |
| Vidalar | 6 adet, kiriş elemanı, r = 1.75 mm, plağa MPC (beam) | 6 adet, katı silindir, r = 2.0 mm, plak ve kemikle tek parça ağ | farklı |
| **Kallus ile plak bağlantısı** | **bağ yok**: tie yalnızca kallus–sağlam kemik ve kemik–vida arasında | **kallus plağa yapışık** (ortak düğümler) | **ÖNEMLİ FARK** |
| Yük ve sınır koşulları | 823 N eksenel + 9.777 N·m ön-arka eğilme, distal ankastre | aynı | ✓ |
| Malzemeler | Tablo 1 (granülasyon 0.2, fibröz 2, kıkırdak 10, kemik 17 000, ilik 2 MPa) | aynı | ✓ |
| Hücre oranları | Tablo 2 (boş defekt: 15. günden sonra çoğalma /5, farklılaşma 0.06) | koddan, aynı | ✓ |

## Sonuçlar
- **Makale, boş defekt:** deneyde ve simülasyonda kaynama yok. Kortekslerden az miktarda kemik büyüyor, ilik kapanmıyor. Simülasyon 12 ayda plak boyunca "neredeyse sürekli bir kemik köprüsü" öngörüyor (deneyde bu köprü 3. ayda görülmüş).
- **Makale, 3. ay toplam kemik hacmi** (Şekil 4a, grafikten okunan yaklaşık değerler): deney ~170 mm³ (yaklaşık 110–230), simülasyon ~150 mm³.
- **Bizim modelimiz, 90. gün:**
  - kallusun tamamında ~240 mm³ (orijinal 241.5, Claes 237.1)
  - yalnızca defekt içinde (z 5–35 mm) ~50 mm³
  - Makalenin "Total" hacim bölgesi tam tanımlanmamış; değerler aynı mertebede.
- **360. gün:** iki koşuda da kaynama yok, kemik uçlardan ilerliyor ✓. Ancak plak boyunca makalede **kemik** var; bizde orijinal işaretle **fibröz doku**, Claes işaretiyle **kıkırdak** oluşuyor.

## Değerlendirme
1. Geometri, yük, malzeme ve hücre kuralları makaleyle büyük ölçüde örtüşüyor. Boş defektte kaynamama ve uçlardan sınırlı kemik oluşumu yeniden üretildi.
2. Plak boyunca oluşan dokudaki fark büyük olasılıkla **kallusu plağa yapıştırmamızdan** kaynaklanıyor. Bu yapışma plak kenarında yüksek hidrostatik basınç üretiyor (en fazla ~11 MPa, ~2 200 eleman HP > 0.15 MPa). Makalede kallus ile plak arasında bağ yok.
3. Kıkırdak koşulunun işareti (HP < −0.15) makale metninde açıkça yazmıyor; yalnızca Claes & Heigele [53] referans gösteriliyor. Plak etkisi düzeltilince yüksek basınçlı eleman sayısı büyük olasılıkla azalacak ve işaretin sonuca etkisi küçülecek.

## Önerilen düzeltme
- Kallus ile plak arasındaki ortak düğümleri kaldırmak: plak kallusa değmeyecek ya da arayüzde ayrı düğümler olacak, plak yalnızca vidalarla kemiğe bağlanacak.
- Plak uzunluğunu 155 mm yapmak.
- Ardından orijinal işaretle yeni bir 360 günlük koşu (~2.7 saat) ve plak boyunca kemik oluşup oluşmadığını kontrol etmek.

## Düzeltme sonrası (26-27.10.2026, uzak bir 16 iş parçacıklı Linux makinesinde)
Kallus plaktan ayrıldı (arayüzde 1541 düğüm ikizlendi), plak 155 mm, vidalar r = 1.75 mm, kemik 200 mm. 7 koşu yapıldı: bağsız plak için iki işaret × üç tohum (12345, 2, 3), karşılaştırma için de yeni plakla bağlı kallus (orijinal işaret, tohum 12345).

Bağsız gruplarda değerler üç tohumun ortalaması ± standart sapmadır (mm³):

| | 90. gün kemik | 359. gün kemik | 359. gün plak yanı kemik | plak boyunca köprü (defekt dilimlerinin %'si) | 359. gün kıkırdak | 359. gün fibröz |
|---|---|---|---|---|---|---|
| Bağsız, orijinal işaret | 106 ± 1 | 479 ± 51 | 273 ± 27 | 98 | 13 ± 6 | 65 ± 3 |
| Bağsız, Claes işareti | 109 ± 5 | 445 ± 12 | 255 ± 3 | 98 | 61 ± 7 | 11 ± 2 |
| Bağlı (yeni plak), orijinal işaret | 386 | 1303 | 145 | 100 | 49 | 1543 |
| Perier-Metz 2022, 3. ay | deney ~170 (110–230), simülasyon ~150 | | | | | |

- Bağsız plakla makalenin sonucu yeniden üretiliyor: kaynama yok, kortekslerden seyrek kemik çıkıyor, ilik kapanmıyor. 12. ayda plak boyunca neredeyse sürekli bir **kemik** köprüsü oluşuyor. 3. ay kemik hacmi (~106 mm³) makaleyle aynı mertebede, deney aralığının biraz altında.
- Bağlı plakta plak boyunca **fibröz doku** baskın (1543 mm³). Önceki sonuçtaki farkın nedeni plak bağıydı, plak uzunluğu değildi.
- Bağsız modelde işaretin etkisi küçük: kemik hacimleri tohumlar arası yayılımın içinde kalıyor. İşaret yalnızca az miktardaki kıkırdak ile fibröz arasındaki payı değiştiriyor.
- Görseller: `sonuclar/plak_bagi_duzeltmesi/` (`analiz/histoloji_gun359.png`, `analiz/kemik_zaman.png`, her koşunun GIF'i). 3B sayfa: `web3d_uygulama/kallus3b.html` (sitede: /viewer/).
