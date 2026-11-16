# Socket-healing parameters for the Hong 2014 calibration: literature check

Prepared 2026-11-16 for SilicoGraft dental (calibration on Hong et al. 2014, Clin Oral Implants Res, doi:10.1111/clr.12041). It answers five open questions about the parameters the model currently fits or assumes: woven-bone remodelling, the Cerasorb variant and granule packing, β-TCP resorption, the early delay of bone formation under β-TCP, and Hong's Table S1. It builds on `GAPS_SEARCH.md` (section 6) and does not repeat it.

**How the numbers were obtained.**
* Primary papers were read in full where a legitimate copy was available. "Abstract" means only the abstract was available and the number comes from it.
* New search: Histamin-Paper-Search on a phoenix hardware-pool lease, project `~/Histamin-Paper-Search/runs/socket_params_2026-11-16/` (17 targeted queries in PubMed, Europe PMC and OpenAlex, 590 records, 61 candidates selected by hand). Open PDFs that the scanner could not fetch were opened with Camoufox (headed) on the lease. No Sci-Hub, no logins, no Parallel Search. Full texts: `15_Dental_Implant_BTCP/literature/fulltext/socket_params_2026-11-16/` (with `INDEX.tsv`).
* Values I computed are marked DERIVED; the formula is given next to them.
* **The most important new source** is Ji-Youn Hong's 2010 PhD thesis (Yonsei University, supervisor C.-K. Kim). It reports the same experiment as Hong 2014 (same 8 beagles, same 4 groups and materials) with its own histomorphometry: whole-socket means with SDs, a definition of each tissue class, and the decalcification protocol. It is open in the Yonsei repository (handle 22282913/133409) and was downloaded with Camoufox.

---

## 0. Summary

| Q | Model now | Recommended | Range | Confidence | Main basis |
|---|---|---|---|---|---|
| Q1 woven-bone removal | 0.03 /day of osteoblast points from day 14 (fitted) | **0.03 /day net, starting around day 28**, falling to ≤ 0.005 /day after about day 60 | 0.02-0.045 /day; start day 21-30 | Low-medium | Dog sockets, point counting: Cardaropoli 2003 (abstract), Kim 2017 (Table 1). Conflicts with Hong's own 8-week bone fraction (Section 1.3) |
| Q2 granule envelope fraction at t = 0 | 0.42 | **0.55** | 0.50-0.62 | Medium | Hong's own dense-HA arm (non-resorbing): 52.7 % (paper) and 64.5 % (thesis) of the socket; in vitro beds 0.50-0.57 |
| Q2 solid β-TCP fraction at t = 0 | 0.20 | **0.19** if Cerasorb M; **0.36** if round Cerasorb (classic) | 0.17-0.22 (M); 0.32-0.40 (classic) | Medium for the formula, low for the variant | Envelope × (1 − intragranular porosity 0.65 or 0.35) |
| Q2 which product | – | "Cerasorb®", 500-1000 µm, variant not named in paper or thesis. Histology (resorption tracks through the granules, bone inside them) favours the multiporous **Cerasorb M**, without proof | – | Low | Hong 2014 p. 2, p. 4; Hong 2010 thesis p. 4, p. 10 |
| Q2 what Hong's "residual biomaterial" measures | – | **Granule outline (envelope) in decalcified sections**, minus macropores filled with tissue. Compare it with the model's envelope, not with the solid fraction | – | Medium-high | Thesis p. 6-7: formic acid 14 days, H&E, area tracing at ×20 |
| Q3 β-TCP resorption, dog socket | k = 0.031 /day | **k = 0.031 /day** on the envelope, from f0 = 0.52-0.60, with a 0-4 day lag | 0.027-0.034 /day | Medium-high | Hong paper 0.031, Hong thesis 0.027 (weeks 2-8); predicts 4.4 % at 12 weeks vs 3.7 ± 2.5 % measured by Koga 2020 |
| Q3 β-TCP resorption, human | – | **k ≈ 0.005-0.016 /day** (2-6 times slower than dog sockets; slowest far from host bone) | – | Low | Human sinus, Cerasorb M, 6 months (Bednarek 2011, Table VI) |
| Q4 early delay under β-TCP | – | **Yes.** New bone with β-TCP / empty socket = **0.19-0.46 at 2 wk, 0.23-0.37 at 4 wk, 0.69-0.78 at 8 wk**; equal or higher at 12-24 wk | – | Medium | Hong paper and thesis; Araújo 2010; Koga 2020; Lee 2020; Leventis 2018 |
| Q5 Table S1 | – | **Not obtained.** The Wiley supplement link shows a Cloudflare "Verify you are human" check, so it was skipped. The thesis has no zone table | – | – | Section 5 |

Also needed before calibrating the β-TCP arm (Section 6): Hong's paper and thesis disagree by up to 12 points on the same animals. That spread is a better error band for the 4- and 8-week targets than the reported SDs.

---

## 1. Q1: woven-bone remodelling and marrow formation

### 1.1 Studies

| Study | Species, site | Method | Time points | Values | Source |
|---|---|---|---|---|---|
| Cardaropoli et al. 2003, J Clin Periodontol 30:809 | 9 mongrel dogs, mandibular P4 distal root socket | EDTA-decalcified, paraffin, point counting in marginal, central and apical compartments | 1, 3, 7, 14, 30, 60, 90, 120, 180 d | Mineralized bone **88 % of the socket at day 30, 15 % at day 180**. Bone marrow **about 75 % at day 60, 85 % at day 180**. Day 14: provisional matrix + woven bone | Abstract (full text paywalled) |
| Kim et al. 2017, J Periodontal Implant Sci 47:143 | Beagle, mandibular P4, healthy control sockets, n = 2 per time | Resin, H&E, central section | 1, 7, 30, 60, 90 d | Bone trabeculae / bone marrow / fibrous tissue: **d30 43.3 ± 2.4 / 29.4 ± 26.5 / 27.4 ± 24.1**; **d60 21.4 ± 5.2 / 78.6 ± 5.2 / 0**; **d90 21.1 ± 3.8 / 78.9 ± 3.8 / 0**. "Day 30 saw the initiation of tissue remodeling" | Table 1, Results |
| Hong et al. 2014 (control) | 8 beagles, P3 root sockets, all 4 quadrants | Formic acid, H&E, most central section, ×40 | 2, 4, 8 wk | New bone 26.0 ± 2.9 / 47.7 ± 3.6 / 62.0 ± 17.1 %. At 8 wk "filled with NB and bone marrow" | p. 3 (histology), p. 5 (numbers) |
| Hong 2010 thesis (same experiment, control) | as above, n = 4 / 4 / 5 specimens | Formic acid 14 d, H&E, 4 central sections, ×20 | 2, 4, 8 wk | New bone **26.0 ± 2.6 / 54.6 ± 4.3 / 74.5 ± 4.3 %**; provisional matrix + marrow **74.0 / 45.4 / 25.5 %**. At 4 wk primitive marrow "limitedly found", osteoclasts in resorption lacunae on woven bone facing primitive marrow; at 8 wk "mature lamellar bone and bone marrow" | Tables 1 and 3 (p. 15-16); p. 10-13 |
| Araújo et al. 2010, Clin Oral Implants Res 21:445 (statement on their untreated sockets) | Beagle, Gothenburg socket model | – | 1, 4 wk | Woven bone starts after 1 wk; after 4 wk the socket is "more or less filled with woven bone (about 90 % of the socket)" | p. 453 (Discussion) |
| Cardaropoli et al. 2005, J Clin Periodontol 32:435 | Dog, P4 distal socket; surgical defects | Point counting | 3 months | Socket apical to the new bone bridge "dominated by bone marrow", few lamellar trabeculae. Non-grafted 3.5 × 8 mm defect: marrow 61 %, mineralized bone 39 % | Abstract |
| Scala et al. 2014, Clin Oral Implants Res 25:288 | 12 monkeys, mandibular P3, open sockets | Morphometry | 4, 10, 20, 30, 90, 180 d | Day 30 mainly immature mineralized bone; at 90 and 180 d mineralized bone decreases and is replaced by trabecular bone and marrow | Abstract (numbers paywalled) |
| Araújo et al. 2015 (e-pub 2014), Clin Oral Implants Res (doi:10.1111/clr.12170) | Human, 25 sockets, control (no graft) | Biopsy at about 6 months, point counting | 6 mo | Mineralized bone 57.4 ± 12.4, osteoid 7.3 ± 4.9, **bone marrow 7.1 ± 6.1**, fibrous tissue 23.1 ± 16.3 % | Abstract |
| Trombelli et al. 2008, J Clin Periodontol 35:630 | Human, 27 biopsies | Semi-quantitative | 2-4, 6-8, 12-24 wk | Large variability; woven bone 34.0 ± 24.6 % over all specimens (as quoted by Udeabor 2023) | Abstract; Udeabor 2023 p. 4 |
| Vieira et al. 2015, PLoS One 10:e0128021 | Mouse, upper incisor socket | Point counting, µCT | 0, 7, 14, 21 d | Woven bone from day 7, sockets bony by day 21 (mouse is much faster; context only) | Fig. 3 |

### 1.2 Derived rates (DERIVED, first order, k = ln(x1/x2)/Δt)

| Interval | Cardaropoli 2003 (mineralized bone) | Kim 2017 (bone trabeculae) |
|---|---|---|
| Peak | day 30 (88 %) | day 30 (43 %) |
| Day 30 → 60 | 88 → ≤ 25 % (marrow 75 % at day 60): **≥ 0.042 /day** | 43.3 → 21.4 %: **0.023 /day** |
| Day 60 → 90/180 | ≤ 25 → 15 % (day 180): ≈ **0.004 /day** | 21.4 → 21.1 % (day 90): ≈ 0 |

These are **net** rates (removal minus new deposition). The gross removal in the model, where removed points can fill again, must be at least as large.

### 1.3 Comparison and conflicts

* **Timing.** In both dog studies with point counting, woven bone peaks around day 30 and is turned into marrow mostly between day 30 and day 60, then plateaus at 15-25 % mineralized bone. The model removes from day 14. Hong's thesis does show early signs (osteoclasts on woven bone at 2 weeks, "occasionally", p. 10; remodelling lacunae at 4 weeks, p. 12), so an onset between day 21 and day 30 is defensible.
* **Magnitude.** The fitted 0.03 /day lies inside the dog range (0.023-0.042 /day net). The literature does not contradict the size of the rate, only its start and its constancy.
* **Conflict with Hong's own data (important).** Hong's empty sockets hold 62 % (paper) or 74.5 % (thesis) new bone at 8 weeks, while Cardaropoli and Kim find 21-25 % mineralized bone and 75-79 % marrow at day 60. The difference is the metric. Hong traced "woven bone (finger-like projections of immature bone embedded in a primary spongiosa), lamellar bone" at ×20-×40 (thesis p. 7), and counted marrow with the soft tissue. Point counting at high magnification counts only mineralized matrix. Hong's NB therefore behaves like a "bone region" fraction, not a bone volume fraction. Calibrating on Hong, the model needs little net removal before day 56. Calibrating on point-count data, it would need 75-80 % marrow by day 60.
* **Species.** Human sockets turn woven bone into marrow much more slowly: only 7 % marrow and 57 % mineralized bone after 6 months (Araújo 2015). The dog rate must not be carried over to the Daif (human) prediction.

### 1.4 Recommendation

* For the Hong calibration: keep `remodel_rate` as a fitted parameter. Move `remodel_day` from 14 to **28** (test 21-30) and keep 0.03 /day (test 0.02-0.045). Hong's data could not identify this parameter anyway (`hong/README.md`, milestone 2), so the literature onset is the better constraint.
* A second phase is optional: after about day 60, reduce the rate to ≤ 0.005 /day (plateau in both dog studies).
* Human model: a much lower rate. No usable human number was found; Araújo 2015 only bounds it (marrow 7 % at 6 months).
* Confidence: low-medium. Only one of the two dog sources was read in full (Kim 2017, n = 2 per time). Cardaropoli's compartment table is paywalled.

---

## 2. Q2: Cerasorb variant, porosity and packing

### 2.1 Product properties

| Property | Cerasorb (round / "classic") | Cerasorb M (multiporous) | Source |
|---|---|---|---|
| Phase | > 99 % β-TCP | > 99 % β-TCP | FDA 510(k) (GAPS_SEARCH §4) |
| Intragranular porosity | ≈ 35 % | **65 ± 5 vol %**: 51 % pores ≤ 100 µm, 14 % pores 100-500 µm; pores 0.1-500 µm; primary particles 63 µm | GAPS_SEARCH §4; Bednarek 2011 thesis p. 17 (manufacturer data) |
| Pore size | 0.1-50 µm | 0.1-500 µm (5-500 µm in Koga 2020 §2.2) | Barbeck 2021 Table 4 (GAPS_SEARCH) |
| Bed envelope fraction, dry poured, 500-1000 µm (DERIVED) | 0.65 (solid 0.42) | 0.57 (solid 0.20) | Barbeck 2021 Table 4 via GAPS_SEARCH §6.2 |

### 2.2 Packing of granule beds

| Measurement | Value | Source |
|---|---|---|
| **Dense HA (Calcitite 2040, 420-840 µm, non-resorbing) in Hong's own sockets**, % of socket at 2 / 4 / 8 wk | **52.7 ± 1.1 / 51.9 ± 1.2 / 48.1 ± 7.4** (paper); **64.5 ± 3.6 / 62.1 ± 4.8 / 60.7 ± 1.9** (thesis) | Hong 2014 p. 5; Hong 2010 Table 2 p. 15 |
| BCP (60:40, 500-1000 µm) at 2 wk, same sockets | 48.2 ± 2.4 (paper); 45.2 ± 2.2 (thesis); part of it resorbs early | same |
| Packing protocol | "filled (and packed) with graft material to the marginal bony crest" (paper); "packed and overfilled ... to fully cover the marginal portion of the crest" and "tight compaction force" (thesis) | Hong 2014 p. 2; thesis p. 6, p. 18-19 |
| In vitro β-TCP 200-1000 µm bed | f = 0.50 ± 0.04 | Martinez 2010 (GAPS_SEARCH §6.2) |
| In vitro granule stacks (total porosity incl. intragranular) | 58.9 ± 1.3 % (dense granules), 75.3 ± 0.4 % (porous) | Chappard 2015 Table 1 |
| Cerasorb sold in Japan, dry bulk density | 0.72 ± 0.03 g/cm³, overall porosity 76.4 % | Ishikawa 2018 Table 1 |

The dense HA arm is the best in-situ estimate of the packed envelope fraction: Calcitite does not resorb (its residual changes little over 8 weeks in both analyses) and has no intragranular porosity, so its area fraction is the packing fraction. Hong's two analyses give **0.53 and 0.65**.

### 2.3 Which product did Hong use?

* Both the paper (p. 2: "β-tricalcium phosphate (β-TCP; mean particle size of 500-1000 µm) (Cerasorb®; Curasan, Kleinostheim, Germany)") and the thesis (p. 4: "absorbable pure phase β-TCP (Cerasorb®, Curasan ...) with mean particle size of 500~1000 µm") say only "Cerasorb". Neither names "M", and neither gives porosity.
* The histology points to granules with interconnected macropores:
  * thesis p. 10: "active resorption both inside and outside the material, which made multiple tracks of provisional matrix penetrating the material";
  * paper p. 4: bone formed "on the surface or the internal side of the β-TCP particles"; multinucleated cells on "the outer and inner surface" (Fig. 4d legend).

  Cerasorb M has 14 vol % pores of 100-500 µm. Round Cerasorb has pores ≤ 50 µm, where cells and bone hardly enter. The tracks could also come from disintegration, so this is a hint, not proof.
* Context: other groups describe the dog-socket product the same way. Lee 2020 writes "Cerasorb"; Koga 2020 writes "Cerasorb M, 500-1000 µm". In Germany the Charité group used Cerasorb M until mid-2006 (Bednarek 2011 p. 16).
* **Verdict:** not determinable from the publications. Cerasorb M is somewhat more likely. If it matters, the corresponding author (C.-K. Kim, Yonsei) or Curasan Korea would know.

### 2.4 What Hong's residual biomaterial (RB) measures

* The blocks were decalcified in 5 % formic acid for 14 days, embedded in paraffin and stained with H&E. RB areas were traced by hand at ×20 (thesis) or ×40 (paper): thesis p. 6-7; paper p. 2-3. The β-TCP mineral is dissolved; what is traced is the granule ghost outline.
* Micropores (≤ 50-100 µm) cannot be resolved at that magnification and fall inside the outline. Macropores filled with matrix or bone are counted as FCT or NB (thesis p. 10).
* So **RB ≈ envelope × (0.86-1.0)**: 0.86 if all of Cerasorb M's 100-500 µm pores are excluded, 1.0 for round Cerasorb.
* **The model's residual-graft output for the Hong comparison should be the granule envelope, not the solid ceramic.**

### 2.5 Recommendation

* **Initial envelope fraction f0 = 0.55** (range 0.50-0.62). The current 0.42 is below every estimate: Hong's dense HA 0.53/0.65, BCP 0.45-0.48 already after 2 weeks of partial resorption, in vitro 0.50-0.57.
* Consistency check (DERIVED): f0 = 0.42 with k = 0.031 /day gives 27 % at day 14 instead of 38 %. Reaching 38 % from 0.42 would need k ≈ 0.007 /day over the first two weeks. f0 = 0.52-0.60 fits (Section 3.2).
* **Solid fraction** (for stiffness, not for the RB comparison) = f0 × (1 − p_intra):
  * Cerasorb M: 0.55 × 0.35 = **0.19** (0.17-0.22). The current 0.2 fits.
  * Round Cerasorb: 0.55 × 0.65 = **0.36** (0.32-0.40).

---

## 3. Q3: β-TCP resorption kinetics

### 3.1 Studies

| Study | Species, site | Material, processing | Times | Residual graft (% of socket or ROI) | Source |
|---|---|---|---|---|---|
| Hong 2014 | Beagle P3 root sockets, no membrane, flap advanced | Cerasorb 500-1000 µm; formic acid, H&E | 2 / 4 / 8 wk | **38.31 ± 2.35 / 25.80 ± 15.25 / 10.28 ± 4.14**; thirds (Fig. 8, digitized in `hong/data/hong2014_btcp.csv`): apical 36.8 / 34.9 / 10.6, middle 42.1 / 25.3 / 14.2, coronal 36.3 / 21.2 / 8.1 | p. 5, Fig. 7-8 p. 6 |
| Hong 2010 thesis (same animals) | as above, n = 4 / 4 / 5 | as above, 4 central sections | 2 / 4 / 8 wk | **33.70 ± 5.75 / 28.28 ± 4.81 / 10.81 ± 2.41** | Table 2 p. 15 |
| Koga et al. 2020, Materials 13:3452 | Beagle mandibular P3/P4 sockets, n = 6 (12 wk), 4 (24 wk) | **Cerasorb M 500-1000 µm**; undecalcified GMA resin, toluidine blue, ROI 8.64 mm² | 12 / 24 wk | **3.7 ± 2.5 / 2.1 ± 1.2** | §2.2, §3.3 |
| Lee et al. 2020, Materials 13:1452 | Beagle P2-P4 mesial sockets with induced chronic pathology and dehiscence, 6 dogs; collagen membrane | Cerasorb (variant not stated); formic acid, H&E | 4 / 12 wk | **8.28 ± 2.07 / 0.00** | Table 3 |
| Leventis et al. 2018, Dent J 6:27 | Pig sockets, n = 10 | PLGA-coated β-TCP (easy-graft CLASSIC); decalcified | 12 wk | 0.26 ± 0.38 | Table 3 |
| Araújo et al. 2010 | Beagle maxillary distal sockets | GEM 21S β-TCP 0.25-1 mm, pores 1-500 µm; EDTA | 1 d-4 wk | Not measured; particles disintegrate and osteoclasts appear from week 1 | p. 449-452 |
| Merten et al. 2001, J Craniofac Surg 12:59 | Minipig tibial marrow defects with implants | Cerasorb-type β-TCP | 4-86 wk | About 70 % resorbed after 5 months; 90-95 % degraded by 86 weeks | Abstract and Discussion (full text) |
| **Bednarek 2011 thesis (human)** | Sinus floor augmentation, 20 patients | Cerasorb M; undecalcified | 6 mo | **Region near the Schneiderian membrane 21.1 ± 17.1 %; region near the sinus floor 2.8 ± 7.3 %**; bone 33.3 ± 11.7 vs 43.9 ± 16.3 % | Table VI p. 37, §3.2.2.1 p. 38 |
| Human, secondary (quoted by Bednarek p. 8) | Alveolar (Zerbo 2001), sinus (Szabo 2005) | β-TCP | 9.5 / 6 mo | 29 % residual, 34 % bone (Zerbo); 8-26 % residual (Szabo) | Bednarek 2011 p. 8 (not read in the originals) |

### 3.2 Derived rates (DERIVED)

| Data | 2 → 4 wk | 4 → 8 wk | 2 → 8 wk |
|---|---|---|---|
| Hong paper, whole socket | 0.028 /day | 0.033 /day | **0.031 /day** |
| Hong thesis, whole socket | 0.013 /day | 0.034 /day | **0.027 /day** |
| Hong Fig. 8, apical | 0.004 | 0.043 | 0.030 |
| Hong Fig. 8, middle | 0.036 | 0.021 | 0.026 |
| Hong Fig. 8, coronal | 0.038 | 0.034 | 0.036 |

* **One model reproduces all three paper values:** RB(t) = 0.52 · exp(−0.031 · (t − 4 d)), giving 38.1 / 24.7 / 10.4 % against 38.3 / 25.8 / 10.3 %. Starting at day 0 without a lag fits almost as well: 0.58 gives 37.6 / 24.3 / 10.2 %, and 0.60 gives 38.9 / 25.2 / 10.6 %.
* **Out-of-sample check:** that curve predicts 4.4 % at 12 weeks, against **3.7 ± 2.5 %** in Koga 2020 (Cerasorb M, dog sockets, different lab, undecalcified). It predicts 0.3 % at 24 weeks, against 2.1 ± 1.2 %: the measured curve has a small slow tail.
* Lee 2020 is faster (8.3 % at 4 weeks, k ≈ 0.068 /day from 0.55). The sockets there were infected and had a dehiscence, and a membrane was placed, so this is a different situation.
* **Zones (Hong Fig. 8):**
  * The coronal third resorbs fastest, the middle third slowest.
  * Apical residual barely changes from week 2 to week 4, then falls fastest.
  * These are digitized means without SDs. Zone differences smaller than about 5 points are not interpretable (Table S1 is missing).
* **Human (Bednarek 2011):** from f0 = 0.50-0.57, k = ln(f0/residual)/182 d gives 0.016 /day near the host bone and 0.005 /day near the membrane. That is 2-6 times slower than in dog sockets, and strongly zone-dependent.

### 3.3 Recommendation

* Dog socket (Hong calibration): **k = 0.031 /day** (0.027-0.034), first order on the envelope, starting from f0 = 0.52-0.60 with a 0-4 day lag. Confidence medium-high: two independent analyses of the same animals, and an out-of-sample check (Koga).
* If resorption is cell-mediated in the model, it should reproduce this curve rather than take k directly. The early lag fits Araújo 2010, where osteoclasts on the particles appear from week 1.
* Human (Daif): k = 0.005-0.016 /day, with slower resorption far from host bone. Confidence low: sinus, not socket.

---

## 4. Q4: does β-TCP delay early bone formation?

### 4.1 Studies

| Study | Species, site | Graft | New bone, graft vs empty (%) | Ratio graft/empty | Source |
|---|---|---|---|---|---|
| Hong 2014 | Beagle P3 sockets | Cerasorb | 2 wk 5.02 ± 3.01 vs 26.03; 4 wk 11.07 ± 6.35 vs 47.68; 8 wk 48.55 ± 5.94 vs 62.01 | **0.19 / 0.23 / 0.78** | p. 5 |
| Hong 2010 thesis | same animals | same | 11.89 ± 2.60 vs 26.01; 20.19 ± 2.50 vs 54.61; 51.12 ± 4.50 vs 74.48 | **0.46 / 0.37 / 0.69** | Table 1 p. 15 |
| Same two, per non-graft space (DERIVED: NB/(100 − RB)) | | | paper 8.1 / 14.9 / 54.1; thesis 17.9 / 28.2 / 57.3 | paper **0.31 / 0.31 / 0.87**; thesis **0.69 / 0.52 / 0.77** | |
| Araújo 2010 | Beagle maxillary sockets | GEM 21S β-TCP | New bone (hard tissue + primitive marrow) 1.8 ± 2.5 (1 wk), 31.7 ± 0.4 (2 wk), 37.7 ± 1.7 (4 wk). Untreated sockets in the same model about 90 % woven bone at 4 wk (historical, no concurrent control) | ≈ 0.42 at 4 wk (DERIVED) | p. 452-453 |
| Koga 2020 | Beagle P3/P4 sockets | Cerasorb M | 12 wk 49.4 ± 7.6 vs 31.4 ± 6.6 (significant); 24 wk 38.0 ± 8.9 vs 30.8 ± 4.9 (n.s.) | 1.57 / 1.23 | §3.3 |
| Lee 2020 | Beagle, compromised sockets, membrane | Cerasorb | 4 wk 51.6 ± 4.9 vs 53.1 ± 6.3; 12 wk 59.1 ± 4.8 vs 51.3 ± 9.0 (n.s.) | 0.97 / 1.15 | Table 3 |
| Leventis 2018 | Pig sockets | PLGA-β-TCP | 12 wk 20.3 ± 8.1 vs 15.4 ± 3.0 (n.s.) | 1.32 | Table 3 |

Mechanism as described by the authors: in Hong, the multinucleated cells and inflammation in the granule-filled matrix "delay rather than arrest" bone formation (paper p. 7). The thesis attributes it partly to the tight compaction, which left no clot space (p. 18-19). Araújo 2010 suggests a high local Ca²⁺/PO₄³⁻ concentration (p. 453). Woven bone appears where granules have been resorbed (thesis p. 19).

### 4.2 Recommendation

* **Yes, β-TCP delays early bone in dog sockets**, by more than the space the granules take up. With bone expressed per non-graft space, the deficit at 2-4 weeks is 0.31-0.69 of control.
* The delay is over by 8 weeks (0.7-0.9 of control). At 12-24 weeks β-TCP sites have as much bone as controls or more.
* **Calibration targets for the β-TCP arm:** NB(β-TCP)/NB(empty) = **0.2-0.45 at 2 wk, 0.25-0.4 at 4 wk, 0.7-0.8 at 8 wk**. Hong's thirds at 2 wk (10.6 / 3.6 / 2.5 % apical / middle / coronal) show the bone starting at the apical wall.
* **Model form:**
  * space occupation by granules;
  * a reduced osteogenic differentiation or proliferation factor of about 0.4 (0.3-0.7) in granule-rich regions during the first 3-4 weeks;
  * new bone allowed where granules have been resorbed.

  This is an assumption that the data support, not a measured parameter.
* Confidence: medium. Only one study compares empty and β-TCP sockets at 2-8 weeks directly (Hong, analysed twice). The later time points come from other labs and protocols.

---

## 5. Q5: Hong 2014 Table S1

* Exists as `clr12041-sup-0001-TableS1.doc` ("Results of histometric analysis at different levels of control and experimental sites"; paper p. 8). Link: `https://onlinelibrary.wiley.com/action/downloadSupplement?doi=10.1111%2Fclr.12041&file=clr12041-sup-0001-TableS1.doc`
* Requests from inside the browser session returned HTTP 403. Opening the link in Camoufox showed a Cloudflare "Performing security verification / Verify you are human" page (screenshot `camoufox/probe0.png` in the scanner project). Per the rules it was skipped. Wiley usually serves supporting information without a subscription, so Melih can most likely download it in his own Firefox after the check, without VETİS.
* The 2010 thesis has **no zone-wise table**. It reports whole-socket means and SDs (Tables 1-3) and describes the zones only qualitatively. So the thesis does not replace Table S1. The digitized Fig. 8 thirds remain the only zone data, with no SDs.

---

## 6. Conflicts and caveats

1. **Paper vs thesis, same animals.**

   | Measure | Paper (2014) | Thesis (2010) |
   |---|---|---|
   | Control NB at 4 / 8 wk | 47.7 / 62.0 % | 54.6 / 74.5 % |
   | Dense-HA residual at 2 wk | 52.7 % | 64.5 % |
   | β-TCP NB at 2 wk | 5.0 % | 11.9 % |
   | Sample | 2 / 2 / 4 dogs, one central section at ×40, zones | 4 / 4 / 5 specimens, 4 central sections at ×20 |

   Treat the 7-12 point spread as measurement uncertainty, larger than most reported SDs. The control 8-week SD of 17 % in the paper is an outlier against 4.3 % in the thesis.
2. **Metric conflict for marrow** (Section 1.3). Hong's NB (bone region, marrow counted with soft tissue) cannot be compared with point-count mineralized-bone fractions. The model's NB on the lattice should be defined the way the target defines it.
3. **Closure.** The paper says the flap was coronally advanced and sutured; the thesis says the sites were "primarily closed". Both say packed to or over the crest.
4. **Lee 2020** (compromised sockets, membrane) resorbs Cerasorb about twice as fast as Hong. Do not pool it with Hong.
5. **Human vs dog:** β-TCP resorption is 2-6 times slower in humans and woven bone remodels much more slowly. Dog-calibrated rates must be rescaled for the Daif prediction.

---

## 7. Papers: obtained, read, missing

**Read in full (already in the corpus, not downloaded again):** Hong 2014 (`runs/implant_btcp_imaging_2026-10-27/pdfs/1dfafad3aa70231e`), Araújo 2010 β-TCP (`b8b891b23438c9b8`), Koga 2020 (`208f2bf6955c1236`), Lee 2020 (`6d9c9b4d717a9b6c`).

**Downloaded on the lease and read** (now in `fulltext/socket_params_2026-11-16/`, see `INDEX.tsv`):
* Camoufox:
  * Hong 2010 PhD thesis (Yonsei repository);
  * Bednarek 2011 Dr. med. dent. thesis (Charité, doi:10.17169/refubium-8268);
  * Merten 2001 J Craniofac Surg (doi:10.1097/00001665-200101000-00010);
  * Hirota 2009 Dent Mater J (doi:10.4012/dmj.28.153; rat defects, not used).
* Scanner (open access):
  * used: Kim 2017 JPIS, Vieira 2015 PLoS One, Leventis 2018 Dent J, Chappard 2015 Front Endocrinol, Udeabor 2023 Bioengineering (secondary);
  * screened only, not needed: Ishikawa 2018, Kozakiewicz 2020, Ghanaati 2013, Ho 2016, Leventis 2016, Adel-Khattab 2020, Mashimo 2019.

**Missing: paywalled (Wiley/Springer/Elsevier/Quintessence), for Melih to download, in order of value.**

| # | Paper | DOI / PMID | What it would add |
|---|---|---|---|
| 1 | Hong 2014 **Table S1** (.doc) | link in Section 5 | SDs and values per third. Blocked only by the Cloudflare check |
| 2 | Cardaropoli 2003, J Clin Periodontol 30:809 | 10.1034/j.1600-051X.2003.00366.x | Tissue fractions per compartment and day (1-180 d): the woven → marrow curve for Q1 |
| 3 | Scala 2014, Clin Oral Implants Res 25:288 | 10.1111/clr.12148 | Monkey time course 4-180 d |
| 4 | Suba 2004, Int J Oral Maxillofac Implants 19:832 | PMID 15623058 | Cerasorb in beagle sockets: residual at 6/12/24 wk (bone 30.8 % at 6 wk in the abstract) |
| 5 | Araújo, Linder, Lindhe 2009, Clin Oral Implants Res 20:1 | 10.1111/j.1600-0501.2008.01606.x | Empty vs grafted socket at 2 wk, concurrent control |
| 6 | De Risi 2015, Clin Oral Implants Res 26:50 | 10.1111/clr.12288 | Pooled human histomorphometry: alloplast vs spontaneous healing (human Q4) |
| 7 | Discepoli 2013, J Clin Periodontol 40:638 | 10.1111/jcpe.12074 | Beagle early healing 4 h-8 wk |
| 8 | Trombelli 2008, J Clin Periodontol 35:630 | 10.1111/j.1600-051X.2008.01246.x | Human woven bone and marrow per phase |
| 9 | Araújo 2015, Clin Oral Implants Res | 10.1111/clr.12170 | Human 6-month tissue fractions (abstract used) |
| 10 | Araújo & Lindhe 2005; Cardaropoli 2005 (J Clin Periodontol) | 10.1111/j.1600-051X.2005.00642.x; 10.1111/j.1600-051X.2005.00692.x | Dog socket histology 1-8 wk; 3 months |
| 11 | Brkovic 2012, Clin Oral Investig; Horowitz 2009 | 10.1007/s00784-011-0531-1; PMID 19998726 | Human β-TCP sockets: residual and new bone at 6-9 months |
| 12 | Delgado-Ruiz 2018, Clin Oral Implants Res | 10.1111/clr.12942 | Residual graft by thirds vs compaction force |
| 13 | Ghanaati 2010, Acta Biomater 6:4476; Zerbo 2004, Clin Oral Implants Res 15:724 | 10.1016/j.actbio.2010.07.006; 10.1111/j.1600-0501.2004.01055.x | Cerasorb variants' physical data; human Cerasorb histomorphometry |

Also blocked: Wiley showed a bot check on the landing page of doi:10.1111/j.1600-0501.2011.02240.x (permanent grafts, dog). The scanner's per-record results are in the project's `decisions.tsv` and `camoufox/camoufox_results.jsonl`.

## 8. Method notes

* Lease: phoenix, `9cj2`, 2 GiB-8 GiB, display on. The scanner and Camoufox ran on it; Melih could follow the live log in an xterm on the lease display.
* All outputs were pulled to the PC: 73 files, every SHA-256 matched. Lease released 2026-11-16 18:17 (local).
* Scanner project: `~/Histamin-Paper-Search/runs/socket_params_2026-11-16/` (SQLite DB, `papers.json`, `queries/`, `candidates.tsv`, `decisions.tsv`, `CHECKPOINT.md` with notes, `camoufox/` with downloads, logs and probe screenshots).
* OpenAlex queries were limited to one page, so 4 searches are still "pending" by design. The 445 unscoped records were not reviewed (outside this check).
* Wiley answered every PDF request with 403 or redirected to the abstract page (not entitled). That includes articles marked open access in OpenAlex.
* Not verified here: Cardaropoli 2003, Scala 2014, Trombelli 2008, Araújo 2015, Cardaropoli 2005 and Suba 2004 numbers come from abstracts only. Zerbo 2001 and Szabo 2005 are quoted second-hand (Bednarek 2011). Hong's Fig. 8 thirds are digitized values (±1 point) from the earlier session.
