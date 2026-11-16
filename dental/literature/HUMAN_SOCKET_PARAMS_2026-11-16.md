# Human socket parameters for the 32 (empty) / 33 (β-TCP) case: literature check

Prepared 2026-11-16, second round after `SOCKET_PARAMS_2026-11-16.md` (dog / Hong 2014). The case: lower-left lateral incisor socket (32) left empty and canine socket (33) grafted with β-TCP (assumed Cerasorb M), both extracted the same day, healing closed or partly open under a bridge pontic, no implant.

**Method.**
* The existing corpus was searched first: the implant/β-TCP run with its corpus-review extraction table (`15_Dental_Implant_BTCP/literature/corpus_review/PARAMETERS_EXTRACTED.tsv`, plus the full texts behind it).
* Then Histamin-Paper-Search ran on a new phoenix lease (`xws5`): 15 targeted queries, 887 records, 58 hand-picked candidates.
* Camoufox (headed, on the lease display) was used for papers the scanner could not fetch. No Sci-Hub, no logins, no Parallel Search.
* Full texts: `15_Dental_Implant_BTCP/literature/fulltext/human_socket_2026-11-16/` (`INDEX.tsv`). Scanner project: `~/Histamin-Paper-Search/runs/human_socket_2026-11-16/`.

**Labels.**
* "Abstract": only the abstract was read.
* "Secondary": the number is quoted by another paper; the original was not available.
* "Corpus review": the number comes from the earlier extraction table and was not re-read in this session.
* DERIVED: computed here; the formula is given.

**Caveat for every human number below.** Human histomorphometry comes from trephine cores (≈2-3 mm wide, 6-10 mm long) taken from the centre of the healing socket at implant placement. The centre is the region that heals last. Dog data (Hong) are whole central sections. To compare the model with human data, it should output a **virtual core**: a central cylinder ≈2.3 mm × 6 mm, starting 1-2 mm below the crest. Whole-socket fractions would be biased high.

---

## 0. Summary of recommended human values

| Quantity | Recommended | Range | Confidence | Basis |
|---|---|---|---|---|
| Dog → human time scaling, formation phase (clot → provisional matrix → woven bone) | **×3.5** | ×2.5-5 | Medium-low | Milestones and new-bone levels: human NB reaches the dog 2-week level (26 %) at ≈7.4 wk (§1.3) |
| Dog → human time scaling, remodelling (woven bone → marrow) | **≥ ×6**; human marrow conversion is not under way by 6 months | – | Low | Dog marrow 75-79 % at day 60; human marrow 7-19 % at 6 months (§1.3) |
| β-TCP resorption, human socket (k on granule outline, f0 ≈ 0.5) | **0.010 /day** (≈ dog 0.031 / 3.1) | 0.004-0.025 /day; sinus 0.003-0.016 | Low-medium | 6 wk socket cores 0.021-0.028; 4 mo 0.011; 9 mo 0.004; sinus 6 mo 0.003 (§2.2) |
| Early-delay factor under β-TCP (NB graft / NB empty), human | **0.6**, applied over the first ≈8-12 wk (dog 2-4 wk × 3.5) | 0.35-1.0 (one 6-wk data set gives 1.4) | Low | The same 6-wk biopsies, analysed twice: 0.35 (Wei 2025) vs 1.42 (Sun 2023); later time points 0.6-0.9 (§2.3) |
| Expected NB, empty socket (32), central core | **≈ 35 % at 3 mo; ≈ 50 % at 6 mo** | 25-45 % (3 mo); 40-60 % (6 mo) | Medium | Castro 2021 34.7 % at ≥3 mo; Bienz 2023 34-37 % at 8 wk; Gabay 2022 51 % and Araújo 2015 57 % at 6 mo |
| Expected NB, β-TCP socket (33), central core | **≈ 22 % at 3-4 mo; ≈ 35 % at 6 mo** | 15-30 %; 25-45 % | Low-medium | Leventis 2016 24.4 % at 4 mo; El-Chaar 2016 40 % and Alfonsi 2020 29 % at 6 mo (composites) |
| Expected residual β-TCP (33), central core | **≈ 18 % at 3 mo; ≈ 10 % at 6 mo** | 8-30 %; 2-20 % | Low-medium | k = 0.01 /day from f0 0.5 gives 20 / 8 %; measured 12.9 % at 4 mo (Leventis), 16.3 % at 9 mo (Brkovic, secondary); sinus about 30 % at 6 mo |
| Expected soft tissue + marrow | Empty ≈ 65 % (3 mo), ≈ 45 % (6 mo); grafted ≈ 60 % and ≈ 55 % | – | Low | Complement of the above; Gabay 2022 marrow 18.7 %, connective tissue 30.1 % at 6 mo |
| Buccal plate thickness (CBCT, not sockets) | Mandibular incisors **0.77 / 0.94 mm**; canines **0.79 / 1.08 mm** (crest / 4 mm below) | SD 0.36-0.86 | Medium | López-Jarana 2018 Table 2 |

---

## 1. H1: human socket healing time course

### 1.1 Studies (unassisted / natural-healing sockets)

| Study | Sites, n | Method | Time | New bone (NB) | Other tissue | Source |
|---|---|---|---|---|---|---|
| Wei et al. 2025, J Clin Periodontol (doi:10.1111/jcpe.14084) | Single-rooted, EDS-1/2; natural healing under a double collagen membrane; 8 biopsies | Core 2.3 × 6 mm from the socket centre; volume density on cross-sections | 6 wk | **8.37 ± 6.31 %** | Unmineralized 91.63 ± 6.31 % | Results 3.2, Fig. 2g-i |
| Sun et al. 2023, Int J Implant Dent (doi:10.1186/s40729-023-00491-1); **same trial and same biopsies as Wei 2025** (8/14/14) | as above | Core, area fraction (McNeal tetrachrome) | 6 wk | **9.49 ± 0.08 %** (SD as printed; median 12.21, range 0.28-18.58) | Unmineralized 90.38 ± 7.50 % | Table 6 |
| Bienz et al. 2023, J Periodontal Implant Sci (doi:10.5051/jpis.2300460023) | Single-rooted, incisor to premolar; spontaneous healing, 7 biopsies | Core, ×100, regions of interest | 8 wk | **Central 34 ± 17 %, superficial 37 ± 29 %** | Soft tissue 51 ± 28 % (central), 61 ± 30 % (superficial) | Table 2 |
| Castro et al. 2021, J Clin Periodontol (doi:10.1111/jcpe.13463), split-mouth in the premaxilla (25 central incisors, 16 lateral incisors, 19 canines) | Unassisted control sockets; 5 biopsies | Core, histology %BV/TV | ≥ 3 mo (at implant surgery) | **34.7 ± 6.9 %** | Socket fill (CBCT) **67.9 ± 19.2 %** at 3 mo | Results, Fig. 4; Table 3 |
| Canellas et al. 2020, J Craniomaxillofac Surg (control) | – | Histomorphometry | ≈3 mo | 36.7 ± 11.1 % | – | Secondary (quoted by Castro 2021, Discussion) |
| Gabay et al. 2022, Clin Implant Dent Relat Res (doi:10.1111/cid.13085) | Non-molar, spontaneous healing (2 canines, 7 first and 6 second premolars), 14 biopsies | EDTA-decalcified core | 6 mo | **51.14 ± 23.04 %** | Connective tissue 30.12 ± 18.32 %, marrow **18.74 ± 17.15 %** | Abstract and Results; Table 1 (sites) |
| Araújo et al. 2015, Clin Oral Implants Res (doi:10.1111/clr.12170) | Human, 25 subjects in total (grafted + control arms) | Point counting, decalcified core | ≈ 6 mo | Mineralized bone **57.4 ± 12.4 %** | Osteoid 7.3 %, marrow **7.1 %**, fibrous tissue 23.1 % | Abstract (round 1) |
| Ahn & Shin 2008, Int J Oral Maxillofac Implants 23:1133 (PMID 19216285) | Human sockets, healthy vs advanced periodontitis | Histomorphometry over time | 2-16 wk | Connective tissue dominates up to 4 wk; **> 50 % NB after week 8** in healthy sockets, healing "largely complete" by about week 10; periodontally diseased sockets only by about week 16 | – | Secondary: Çetinbaş 2026 review, §3.2-3.4 and Table 1 (paywalled) |
| Trombelli et al. 2008, J Clin Periodontol 35:630 | 27 biopsies: 2-4 wk (n = 10), 6-8 wk (n = 6), 12-24 wk (n = 11) | Semi-quantitative | – | Provisional matrix and woven bone replace granulation tissue between the early and intermediate phase. Osteoblasts peak at 6-8 wk. Mineralization timing "much less predictable" than in dogs. Woven bone 34.0 ± 24.6 % over all specimens | – | Abstract; woven-bone value secondary (Udeabor 2023 p. 4) |
| Amler 1969, Oral Surg Oral Med Oral Pathol 27:309 | Human extraction wounds | Serial biopsies | days | Osteoid from day 7, calcifying around day 20; at day 40 the socket holds bone, connective tissue and epithelium; epithelium closes at days 24-35 | – | Secondary (Block 2015 JOMS p. 1; Gubler 2015 thesis §1.4) |
| Çetinbaş 2026, Vitalis Health Sci J 2:96 (narrative review) | – | Synthesis | – | 2-4 wk granulation tissue / provisional matrix; 6-8 wk provisional tissue with variable woven bone; 8-12 wk increasing woven and mineralized bone; 12-24 wk woven and lamellar bone with developing marrow; > 24 wk lamellar bone and marrow | – | Table 1 |
| JFB 2025 (doi:10.3390/jfb17010006), split-mouth (4 sockets per patient, anterior maxilla, 15 patients) | Empty control | H&E core, ImageJ "particle" area | 8 wk | 62.4 ± 18.6 % (method unclear, see §5) | – | Table 1 |

### 1.2 The human empty-socket curve (DERIVED from the table, central core metric)

| Time | NB, central core | Basis |
|---|---|---|
| 2-4 wk | ≈ 0-5 % (connective tissue dominates) | Ahn & Shin (secondary), Trombelli (abstract), Amler (secondary) |
| 6 wk | **8-10 %** (median up to 12) | Wei 2025, Sun 2023 |
| 8 wk | **34-37 %** (SD 17-29), > 50 % per Ahn & Shin | Bienz 2023; Ahn & Shin (secondary) |
| 12 wk | **35-37 %** | Castro 2021, Canellas 2020 |
| 16 wk | ≈ 40-45 % (interpolated) | – |
| 24 wk | **51-57 %**, marrow 7-19 % | Gabay 2022, Araújo 2015 |

### 1.3 Dog → human time scaling (DERIVED)

| Milestone | Dog | Human | Factor |
|---|---|---|---|
| Woven bone first seen | 7-14 d (Araújo 2010 p. 453; Cardaropoli 2003 abstract) | Osteoid 7 d, calcifying ≈20 d (Amler, secondary); woven bone variable at 6-8 wk (Trombelli abstract) | ≈ 2-4 |
| NB ≈ 26 % of the section/core | 14 d (Hong 2014) | ≈ 51 d: linear interpolation 8.4-9.5 % at 42 d → 34 % at 56 d | **3.7** |
| NB ≈ 48-55 % | 28 d (Hong paper / thesis) | 8-10 wk (Ahn & Shin, secondary) to 24 wk (Gabay, Araújo) | 2.5-6 |
| Woven bone → marrow (marrow ≥ 75 %) | 60 d (Cardaropoli abstract; Kim 2017 Table 1) | Marrow still 7-19 % at 180 d (Araújo 2015, Gabay 2022) | > 3, probably ≥ 6 |

Recommendation:
* Scale the formation-phase kinetics by **×3.5** (×2.5-5).
* Scale the remodelling onset by **≥ ×6**. The dog remodelling start (around day 28) would land at ≥ 6 months in humans, so the human model should have essentially no woven-bone-to-marrow conversion before 6 months.

The dog-calibrated `remodel_rate` should therefore be switched off, or have its onset moved past day 180, for the 3-6 month predictions.

---

## 2. H2: β-TCP in human extraction sockets

### 2.1 Studies

| Study | Material, sites, n | Time | NB | Residual graft | Soft tissue / marrow | Source |
|---|---|---|---|---|---|---|
| Wei 2025 (same biopsies as Sun 2023) | β-TCP 0.25-1 mm (Shanghai Rebone), single-rooted, double collagen membrane, 14 | 6 wk | **2.96 ± 2.23 %** (vs 8.37 % empty; significant) | **15.73 ± 4.52 %** | Unmineralized 81.32 ± 4.70 % | Results 3.2, Fig. 2g-i |
| Sun 2023 (same 14 biopsies) | as above | 6 wk | **13.44 ± 6.03 %** (vs 9.49 % empty; n.s.) | **20.60 ± 9.54 %** | Unmineralized 65.96 ± 12.64 % | Table 6 |
| Leventis et al. 2016, Case Rep Dent (doi:10.1155/2016/5406736) | PLGA-coated β-TCP (easy-graft CLASSIC), no membrane, **open healing by secondary intention**, 10 | 4 mo | **24.4 ± 7.9 %** | **12.9 ± 7.7 %** | Connective tissue + marrow 60.5 ± 7.4 % | Results (histomorphometry) |
| Brkovic et al. 2008, J Can Dent Assoc 74:523 | β-TCP + type I collagen, maxillary socket (case) | 9 mo | Mineralized bone 62.6 % | **16.3 %** | Marrow 21.1 % | Secondary (Triveni 2012, Discussion) |
| Ponte et al. 2021, Acta Odontol Latinoam 34:271 | β-TCP + collagen membrane (control arm), n = 3 | 8 mo | 16.28 % | Not given (n.s. vs 15.75 % in the BCP arm) | Connective tissue 61.56 % | Abstract / Results |
| El-Chaar 2016, Implant Dent 25:149 | 85 % β-TCP / 15 % HA in a collagen putty (MASTERGRAFT), posterior sites, 10 cases | 6 mo | 40.25 % (25-59) | 10.38 % (3-21) | Marrow 49.25 % | Results, Table 1 |
| Alfonsi et al. 2020, Appl Sci (doi:10.3390/app10093034) | BCP 60 HA / 40 β-TCP, in-situ hardening; type II sockets incl. canines and incisors; 10 | 6 mo | 29.0 ± 9.3 % | 22.0 ± 9.7 % | 48.9 ± 11.9 % | Table 2 (corpus review) |
| Jurišić et al. 2013, Arch Biol Sci 65:429 | BCP 60/40 + PLGA (in situ hardening), 5 | 4 mo | 32.2 ± 6.8 % | 31.9 ± 8.9 % | 35.9 ± 13.5 % | Abstract and Results |
| JAPID 2026 (doi:10.34172/japid.025.3476) | HA/β-TCP, molar interdental septum | 3 / 4 mo | 20.11 ± 11.23 / 27.67 ± 17.02 % | 6.82 ± 3.50 / 7.38 ± 3.04 % | – | Table 1 (the abstract says 20.67 % at 4 mo) |
| **Bednarek 2011 thesis (round 1)** | **Cerasorb M**, human sinus, 20 | 6 mo | 33.3 % (near membrane) / 43.9 % (near host bone) | **21.1 % / 2.8 %** | – | Table VI p. 37 |
| Sinus β-TCP (corpus review) | Knabe 2017 (granules), Prins 2016 (Ceros), I.C.C. 2020 (Isios+), Bakry 2019 | 6 mo | 17-27 % | **29-33 %** (Knabe 32.9 ± 6.4; Prins 29.6 ± 8.2; Isios+ 32.25 ± 8.48; Bakry 26 ± 6.7) | – | Corpus review |
| Peruzzo 2026, Clin Oral Investig (pure β-TCP) | Sinus, 15 | 10 mo | 49.32 ± 13.41 % | 3.22 ± 8.46 % | 47.45 % | Results, Fig. 3 (corpus review) |

No human socket study with **Cerasorb or Cerasorb M** and histomorphometry was found in open sources. Brkovic 2012 (β-TCP/collagen cones, 9 months) and Horowitz 2009 (β-TCP socket graft) are paywalled (§6).

### 2.2 Resorption rate k (DERIVED: k = ln(f0 / residual) / t, with f0 = 0.50 for the granule outline)

| Data | t | Residual | k (/day) |
|---|---|---|---|
| Wei 2025 / Sun 2023, socket core | 42 d | 15.7 / 20.6 % | **0.028 / 0.021** |
| Leventis 2016, socket core, open healing | ≈120 d | 12.9 % | **0.011** |
| El-Chaar 2016 (85 % β-TCP) | 182 d | 10.4 % | 0.009 |
| Brkovic 2008 (secondary) | ≈274 d | 16.3 % | 0.004 |
| Bednarek 2011, Cerasorb M sinus, near host bone / near membrane | 182 d | 2.8 / 21.1 % | 0.016 / 0.005 |
| Sinus β-TCP pooled | 182 d | ≈30 % | 0.003 |
| Peruzzo 2026, sinus | ≈304 d | 3.2 % | 0.009 |

Recommendation:
* **k_human = 0.010 /day** for the socket (range 0.004-0.025). This is the dog 0.031 divided by ≈3, consistent with the ×3.5 time scaling.
* The early values (6 wk) are faster and the late values (9 mo, sinus) slower. That fits a fast initial disintegration and a slow tail of granules enclosed in bone. A biphasic option is k = 0.02 /day for the first ≈6 weeks, then 0.005 /day; it reproduces 6 wk ≈ 22 %, 4 mo ≈ 14 %, 9 mo ≈ 7 %.
* Predicted residual for 33 (f0 = 0.5, k = 0.01): **20 % at 3 mo, 15 % at 4 mo, 8 % at 6 mo**. With k = 0.005: 32 / 27 / 20 %. With k = 0.02: 8 / 4 / 1 %.
* The sinus data are slower (larger volume, few walls) and should be the upper bound for residual.

### 2.3 Does β-TCP delay early human bone?

| Comparison | Graft / empty NB | Per non-graft space (DERIVED: NB/(100 − residual)) | Source |
|---|---|---|---|
| 6 wk, same biopsies, volume-density analysis | 2.96 / 8.37 = **0.35** (significant) | 3.5 / 8.4 = 0.42 | Wei 2025 |
| 6 wk, same biopsies, area analysis | 13.44 / 9.49 = **1.42** (n.s.) | 16.9 / 9.5 = 1.8 | Sun 2023 |
| 8 wk, split-mouth, HA/β-TCP + L-PRF vs empty | 55.8 / 62.4 = 0.89 (metric unclear) | – | JFB 2025 Table 1 |
| 4 mo β-TCP (Leventis) vs ≥3 mo empty (Castro), different studies | 24.4 / 34.7 ≈ 0.70 | 28.0 / 34.7 ≈ 0.81 | Leventis 2016; Castro 2021 |
| 6 mo composites vs empty, different studies | 29-40 / 51-57 ≈ 0.55-0.75 | – | Alfonsi 2020, El-Chaar 2016; Gabay 2022, Araújo 2015 |

* The only direct early comparison (the same 6-week biopsies) gives opposite answers depending on the measurement (0.35 vs 1.42).
* Later comparisons across studies point to graft sites with 0.6-0.9 of the empty-socket bone at 3-6 months, partly because granules occupy space.
* **Recommendation: early-delay factor 0.6** (range 0.35-1.0) on osteogenic differentiation in granule-rich regions, for the first ≈8-12 weeks (the dog window of 2-4 weeks × 3.5). The dog value (0.2-0.45) is a lower bound. Confidence: low.

---

## 3. H3: incisor/canine vs premolar sockets; empty vs grafted in the same patient

| Finding | Values | Source |
|---|---|---|
| Buccal (labial) bone is thin in the lower anterior region | Mandibular incisors 0.767 ± 0.361 mm at the crest, 0.936 ± 0.77 mm 4 mm below, 3.19 ± 1.91 mm at the apex; canines 0.794 ± 0.407 / 1.079 ± 0.86 / 3.54 ± 1.87 mm; premolars 0.841 ± 0.402 / 1.490 ± 0.97 / 3.81 ± 1.83 mm. **< 1 mm at 4 mm: 73.5 % of incisors, 49 % of canines, 64 % of premolars** | López-Jarana 2018, BMC Oral Health 18:194, Table 2 and Abstract |
| Thin facial wall (≤ 1 mm) → large vertical loss, maxillary anterior | Median vertical loss **7.5 mm (62 % of wall height) at 8 wk** vs **1.1 mm (9 %)** for walls > 1 mm (39 patients) | Chappuis 2013, J Dent Res 92:195S; secondary (two citing texts agree) |
| Buccal plate thickness predicts volume loss in empty sockets | Unassisted: < 1 mm → > 10 % volume loss at 14 wk; with allograft + dPTFE only when < 0.6 mm. Mean volume loss **15.83 % (empty) vs 8.36 % (ARP)**; buccal height loss 1.17 vs 0.61 mm (mandibular incisors excluded) | Gubler 2015, Univ. Iowa thesis (doi:10.17077/etd.7tswx90t), Abstract and Results |
| Tooth type had no significant effect on contour change (incisor/canine/premolar) | P > 0.05 | Bienz 2023, Results (profilometry) |
| Socket fill of unassisted incisor/canine sockets | **67.9 ± 19.2 %** at 3 mo (CBCT, premaxilla) | Castro 2021 Table 3 |
| Molar vs non-molar horizontal loss | 3.61 vs 2.54 mm | Couso-Queiruga 2021 JCP, secondary (Castro 2021 Discussion) |
| **β-TCP without coverage can do worse than an empty socket in anterior sites** | 6 mo ridge width change 1 mm below the crest: **β-TCP (PLGA-coated) −6.1 ± 2.5 mm vs spontaneous −3.3 ± 2.0 mm**; buccal height −2.0 ± 2.4 vs −0.5 ± 0.9 mm (incisors, canines, premolars) | Jung et al. 2013, J Clin Periodontol 40:90; secondary (Pezzella 2026 SR Table 1) |
| Same patient, empty vs grafted | Split-mouth or within-patient designs: Castro 2021 (PRF vs empty, premaxilla); JFB 2025 (empty, autogenous bone, L-PRF and L-PRF + HA/β-TCP in each patient: NB 62.4 vs 55.8 % at 8 wk); Beltrán 2019 (9 patients, 13 grafted with easy-graft CLASSIC + 13 ungrafted anterior maxillary sites; endoscopy at 4-6 mo: residual 18.2 ± 18.7 %, mineralized surface 86.3 vs 89.5 %) | Castro 2021; JFB 2025 Table 1; Beltrán 2019 Tables 2-3 (corpus review) |

**Implications for 32/33.**
* Both sockets have a ≈0.8 mm labial wall, so expect crestal buccal loss in both. In 32 (empty) the loss can reach millimetres within 8-14 weeks.
* With partly open healing under a pontic, coronal granules in 33 can be lost or encapsulated (the Jung 2013 pattern). The model should allow a coronal zone with lower envelope fraction or delayed incorporation.
* No human study compares an empty incisor socket with an adjacent β-TCP-grafted canine socket in the same patient. JFB 2025 is the closest design, but its graft is HA/β-TCP + L-PRF in the maxilla.

---

## 4. H4: socket dimensions (cross-check of the CBCT geometry)

| Quantity | Lower lateral incisor (32) | Lower canine (33) | Source |
|---|---|---|---|
| Labial bone at crest / 4 mm below / apex | 0.77 / 0.94 / 3.19 mm | 0.79 / 1.08 / 3.54 mm | López-Jarana 2018 Table 2 (measured on teeth, not sockets) |
| Root length | ≈ 14 mm | ≈ 16 mm | **UNVERIFIED**: Wheeler's Dental Anatomy table, from memory |
| Cervical diameter, MD × BL (≈ socket orifice) | ≈ 4.0 × 6.0 mm | ≈ 5.5 × 7.0 mm | **UNVERIFIED**: as above |
| Socket orifice and volume by tooth type | – | – | Couso-Queiruga 2021, Int J Periodontics Restorative Dent 41:141 (doi:10.11607/prd.4969); paywalled, not read |

The textbook values should be checked against the book or Couso-Queiruga 2021 before they are used for more than a sanity check of the CBCT segmentation.

---

## 5. Conflicts and caveats

1. **Same 6-week biopsies, two analyses (Sun 2023 vs Wei 2025)**:

   | | Sun 2023 | Wei 2025 |
   |---|---|---|
   | β-TCP NB | 13.44 % | 2.96 % |
   | Empty NB | 9.49 % | 8.37 % |
   | Residual | 20.6 % | 15.7 % |
   | β-TCP / empty | 1.42 (n.s.) | 0.35 (significant) |

   Wei 2025 refers to the trial as previously reported (Sun et al. 2023) and has the same group sizes (8/14/14). The early-delay factor for humans is therefore not pinned. Use the range.
2. **JFB 2025 (8 wk, 62 % NB in empty sockets)** is far above Bienz 2023 (34 %) at the same time. Its metric (ImageJ "particles within a size range") is unclear, so it was not used for the curve.
3. **Ahn & Shin 2008** (> 50 % NB at 8 wk; only a secondary quote) vs Bienz 2023 (34 %) and Castro 2021 (35 % at 3 mo). The scaling factor range (×2.5-5) covers this spread.
4. **JAPID 2026**: 4-month NB is 20.67 % in the abstract and 27.67 % in Table 1.
5. **Membranes and closure differ**: Sun/Wei put a double collagen membrane over all groups, Leventis left the sites open, Castro and Bienz used no graft. The 32/33 case (pontic, closed or partly open) is closest to Leventis for 33 and to Castro for 32.
6. **Product**: none of the human socket data are Cerasorb M. Cerasorb M is known only from the sinus (Bednarek: 2.8-21 % residual at 6 mo). Smaller or coated granules (0.25-1 mm, PLGA) in the socket studies may resorb faster than Cerasorb M 500-1000 µm.
7. **Downloads**: three Camoufox downloads were the wrong document (a Quintessence catalogue instead of JOMI 2014; Angle Orthodontist issue front matter twice). They were caught by an identity check and rejected (`camoufox/rejected/` in the scanner project).

---

## 6. Papers: read, downloaded, missing

**Read in full this round:**
* From the corpus: Sun 2023, Bienz 2023, Gabay 2022, Castro 2021 (author manuscript), JFB 2025, Leventis 2016, Beltrán 2019, López-Jarana 2018 (also downloaded).
* Downloaded this round:
  * Wei 2025 (JCP, open access);
  * Çetinbaş 2026 (review);
  * JAPID 2026;
  * Ponte 2021;
  * Gubler 2015 (Iowa thesis);
  * El-Chaar 2016, Jurišić 2013, Triveni 2012 (via Camoufox).

  Screened and not used: Covani 2022 (animal), Cureus/CCD 2024, Alangkar 2021, L-PRF RCT 2026, Zhang 2023, MacBeth 2022, the 2016 ARP RCT (jcpe.12623), Eraydın 2018 (NJCP, tables unreadable).

**Missing (paywalled or bot-blocked), for Melih, in order of value:**

| # | Paper | DOI / PMID | What it would add |
|---|---|---|---|
| 1 | Trombelli 2008, J Clin Periodontol 35:630 | 10.1111/j.1600-051X.2008.01246.x | Human tissue fractions per phase (2-4, 6-8, 12-24 wk) |
| 2 | Ahn & Shin 2008, Int J Oral Maxillofac Implants 23:1133 | PMID 19216285 | Human NB time course 2-16 wk, healthy vs periodontitis |
| 3 | Brkovic 2012, Clin Oral Investig (β-TCP/collagen cones ± membrane) and Brkovic 2008, J Can Dent Assoc 74:523 | 10.1007/s00784-011-0531-1; PMID 18644238 | Human β-TCP socket NB / residual at 9 months |
| 4 | Horowitz 2009, Compend Contin Educ Dent (β-TCP socket graft) | PMID 19998726 | Human β-TCP socket histology |
| 5 | Amler 1969, Oral Surg Oral Med Oral Pathol 27:309 | 10.1016/0030-4220(69)90357-0 | Day-by-day human timeline (ScienceDirect showed "Are you a robot?": skipped) |
| 6 | De Risi 2015, Clin Oral Implants Res 26:50 | 10.1111/clr.12288 | Pooled human NB for spontaneous vs alloplast sites |
| 7 | Chappuis 2013, J Dent Res 92:195S | 10.1177/0022034513506713 | Thin-wall resorption (numbers used here are secondary) |
| 8 | Couso-Queiruga 2021 IJPRD 41:141; Couso-Queiruga 2021 JCP 48:126 | 10.11607/prd.4969; 10.1111/jcpe.13390 | Socket dimensions by tooth type; post-extraction changes by site |
| 9 | Jung 2013, J Clin Periodontol 40:90 | – | β-TCP vs spontaneous healing in anterior sites (secondary numbers used) |
| 10 | Zerbo 2001, Clin Oral Implants Res 12:379; Zerbo 2004 15:724 | 10.1034/j.1600-0501.2001.012004379.x; 10.1111/j.1600-0501.2004.01055.x | Cerasorb in human alveolar and sinus bone |
| 11 | Saito 2021, J Periodontol 92:524 | 10.1002/jper.20-0360 | PLGA-β-TCP ARP RCT |
| 12 | Heberer / Lindhe group human biopsy studies (e.g. clr.12033, j.1600-0501.2012.02535.x, j.1600-0501.2012.02462.x) | as listed | Human empty-socket histology at 6-12 wk |
| 13 | Park 2014, J Craniofac Surg (mandibular canine/premolar bone thickness); Quintessence Int 2015 (labial bone of mandibular incisors) | 10.1097/scs.0000000000000767; 10.3290/j.qi.a32919 | Lower anterior labial plate |

## 7. Method notes

* Lease: phoenix `xws5`, 2-8 GiB, display on. Melih watched an xterm with the live log and Camoufox headed beside it.
* All outputs were pulled to the PC: 73 files, every SHA-256 matched. Lease released 2026-11-16 ≈ 19:00 (local).
* Wiley answered every PDF request with 403. ScienceDirect showed a robot check. Springer and Quintessence pages had no open PDF.
* Not verified in this session:
  * secondary or abstract-only numbers: Trombelli, Ahn & Shin, Amler, Chappuis, Jung 2013, Brkovic 2008, Canellas 2020, Couso-Queiruga 2021, Araújo 2015;
  * values from the corpus-review table that were not re-read: Alfonsi 2020, the sinus β-TCP studies, Peruzzo 2026, Beltrán's residual;
  * the textbook tooth dimensions in §4.
