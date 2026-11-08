# Corpus review: all downloaded papers (2026-10-31)

This review screens every full text collected by the `Histamin-Paper-Search` run `implant_btcp_imaging_2026-10-27`. It serves two purposes:
- **A.** Find serial 3D imaging (CT, CBCT, micro-CT or MRI) to validate the simulation against.
- **B.** Find parameters for the model.

The simulation scenario is an immediate implant in a fresh extraction socket, with the jumping gap filled with pure β-TCP granules (see `../../DESIGN.md`).

## Method and files
- **Corpus:** 1,073 full texts.
  - 804 papers already read by the search tool (222 included and 582 excluded for imaging).
  - 263 PDFs that were downloaded later but never read (text extracted with pypdf).
  - 6 renamed copies.
- **Screening:** 8 parallel agents read a compact card for every paper (title, start of the text, keyword snippets). They opened the full text when a card was unclear.
  - Scores: imaging score 3 for 14 papers, 2 for 161, 1 for 248, 0 for 650.
  - 222 papers were flagged for a deep read.
- **Deep read:** 8 parallel agents extracted the numbers from those 222 papers, using tables, results and figure captions.
- **Output files** (this folder):
  - `SCREENING_ALL.tsv`: every paper, with score, categories, notes and a provenance flag.
  - `IMAGING_SERIES.tsv`: 188 papers with serial 3D imaging. For each: modality, time points, measures at each time point, figures, raw data, whether graft and bone were separated.
  - `PARAMETERS_EXTRACTED.tsv`: 2,557 values from 221 papers, one row per arm and time point, each with its source location.
    - socket geometry 1,080
    - histology time course 537
    - β-TCP resorption 399
    - granule properties 158
    - loading 152
    - growth factors and cells 133
    - early healing 94
  - `PAPER_NOTES.md`: notes and caveats for each of the 222 papers.
- **Working files** (scripts, cards, per-batch outputs): `~/dental_corpus_review/` on the Linux side.

Numbers were copied as printed. Values shown only in graphs are marked "graph only". Spot checks against the source texts (Elsheikh 2023, Hong 2014, Daif 2013) matched. The extracted rows have not all been checked by hand. Re-read the source before using any number in a publication.

## A. Validation imaging

**No raw 3D data (DICOM, micro-CT stacks) was found for any study.** About 30 papers with serial imaging state that data are available "on request" (`raw_data` column of `IMAGING_SERIES.tsv`). Elsheikh 2023, the strongest direct candidate, is one of them.

### Direct candidates: immediate implant with β-TCP in the gap (imaging score 3)

| Study | Graft | Imaging | What is measured | Notes |
|---|---|---|---|---|
| Elsheikh 2023, BMC Oral Health, 10.1186/s12903-023-03678-5 | pure β-TCP granules (R.T.R), buccal gap > 2 mm | CBCT 0, 6, 18 mo, same patients. Post-op and 18-mo slices published (Fig. 6) | buccal crest loss 0.43 → 0.80 mm; buccal thickness change −0.69 mm at 18 mo; ISQ | Longest pure β-TCP series. Maxillary anterior and first premolar. Implant size and granule size not given. Raw data on request |
| EthOss cohort 2025, 10.1055/s-0045-1801849 (+ preprint 10.20944/preprints202309.1890) | 65% β-TCP / 35% CaSO4 | CBCT pre-op, post-op, ≥ 12 mo (up to 20) | labial bone 0.7 → 2.3 mm, with per-implant values | Not pure β-TCP. A co-author is the manufacturer's clinical director |
| Daif 2013, J Oral Implantol | Cerasorb M 500–1000 µm, mandibular premolars | helical CT 3 and 6 mo after loading | HU 1280 → 1490 with β-TCP, 1150 → 1245 without graft | No post-op scan |
| Sharroud 2024, Open J Stomatol | β-TCP putty vs granules, mandibular molars | CBCT 0 and 6 mo | grafted-volume loss: granules 27.9%, putty 14.5%; MBL; density | Weak methods: volume units unclear, device not given |
| Gürlek 2019, 10.5505/eudfd.2019.26213 | SynthoGraft β-TCP, maxillary premolar, ~2 mm gap | CBCT 1 wk and 6 mo | buccal thickness change | Graph only |
| Salem 2026, 10.1186/s12903-026-09810-5 | injectable β-TCP putty, gap > 2 mm | CBCT pre-op and 6 mo | radiodensity (uncalibrated) 1224 vs 932; ISQ | Endpoint check only |
| Egyptian Dental J 2017/2018, 10.21608/edj.2017.76098 and .2018.78524 | β-TCP + PRF (MPM) | CBCT 0/2 wk, 3 mo, 6 mo; 0.125 mm voxel | HU 871 → 1156 → 714 | **The two papers report identical numbers.** Data likely reused, so do not use for calibration |
| Others: 10.1186/s12903-026-07683-2 (β-TCP/CaSO4, 12 mo), 10.61841/3mdvt475 (β-TCP cement, poor data), 10.21203/rs.3.rs-8492555 (Ecobone, ISQ only), 10.3390/medicina58111555 (HA/β-TCP cases, 12–29 mo), 10.5005/jp-journals-10024-3158 (HA/β-TCP 30:70, 6 mo) | | | | |

### Long series in close scenarios (imaging score 2)
- **Zone-wise buccal bone volume.** Immediate implant, gap grafted with xenograft, CBCT 0 and 6 mo (10.1002/jper.11381). Loss is −27% in the coronal third and −11% in the middle and apical thirds. Baseline buccal plate 0.64 mm, gap 2.2–2.4 mm.
- **Buccal crest over a year.** 81 patients, gap ≥ 2 mm grafted with Bio-Oss, superimposed CBCT (10.1111/cid.13060). Buccal crest thickness 3.3 → 2.4 mm and crest height 3.1 → 1.7 mm over 1 year.
- **Gap-width test.** Gaps > 2 mm (grafted) keep about 2 mm of buccal bone and lose 8.5% of the ridge cross-section at 6 ± 4 years. Gaps ≤ 2 mm keep 0.5 mm and lose 41% (10.1111/clr.70106). The model should reproduce this difference.
- **Depth profile of buccal loss.** Measured at 0, 1, 5 and 9 mm below the platform at 6 mo (10.3390/molecules27030608).
- **Long follow-up.**
  - Immediate implant with a tuberosity block, 5 and 10 yr (Groningen; 10.1002/jper.20-0845 and jper.24-0251, same cohort).
  - Socket preservation, 10 yr (Crespi 2021).
  - Ungrafted immediate implant, 3 yr (10.3390/ijerph17186790).
- **β-TCP volume over years.**
  - Pure β-TCP in the sinus, CBCT 0 to 2.5 yr: graft volume 75.6% at 6 mo, 54.9% at 2.5 yr (Okada 2016).
  - β-TCP plate: 52% resorbed at 2 yr, 83% at 5 yr (10.1186/s40729-023-00501-2).
  - β-TCP + BMSC + PRP: volume 75% at 1 yr, 62% at 2 yr and about 40% at about 8 yr (Asahina 2021, jcm10225231).
- **β-TCP socket preservation in humans.**
  - CBCT 0/6/12 mo, n = 60, 0.125 mm voxel (10.3389/fsurg.2026.1771200). Width 3 mm below the crest 5.8 → 5.2 → 4.7 mm with β-TCP, 5.7 → 4.7 → 4.0 mm without.
  - R.T.R cone, superimposed CBCT, buccal wall at 1–9 mm levels (10.3390/jfb16090345).
  - β-TCP vs empty socket, same patients, 4 mo: height loss 1.72 vs 2.60 mm (Joshi 2016).
- **Empty-socket calibration in humans.**
  - Socket volume fill 54.6% at 3 mo and 70% at 6 mo, per socket (Agbaje).
  - CBCT density by socket third over 16 wk (10.1186/s12903-024-04576-0).

### Implications for the comparison
1. **No study separates β-TCP from new bone on CBCT.** Micro-CT can overestimate bone in CaP-grafted sites: in a rat cleft model the β-TCP/HA arm had the highest micro-CT BV/TV and the lowest histological new bone (10.1038/s41598-021-93033-x). In human sinus biopsies, residual β-TCP was 29.6% by histology and 10.6% by micro-CT (10.5966/sctm.2015-0369).
   - **Recommendation: a "virtual CBCT" output.** Treat bone plus residual graft as mineralized tissue. Then measure what the clinical papers measure, on the same slices: buccal thickness at fixed depths, crest height, zone-wise (coronal/middle/apical) volume, and a density proxy.
2. **Primary human validation target: Elsheikh 2023** (0/6/18 mo). Secondary targets:
   - Daif 2013 for density.
   - jper.11381 for zone-wise loss.
   - clr.70106 for the gap-width test.
   - cid.13060 for the 1-year buccal crest.

## B. Model parameters

### β-TCP resorption (residual graft area fraction, histology unless stated)

| Species, site | Material | Time course | Source |
|---|---|---|---|
| dog P3 socket | Cerasorb 500–1000 µm | 38.3% (2 wk), 25.8% (4 wk), 10.3% (8 wk) | Hong 2014, clr.12041 |
| dog P3/P4 socket | Cerasorb M 500–1000 µm, ~65% porosity | 3.7% (12 wk), 2.1% (24 wk) | 10.3390/ma13163452 |
| dog P2–P4, chronically infected socket | Cerasorb | 8.3% (4 wk), 0.0% (12 wk) | 10.3390/ma13061452 |
| dog, immediate-implant mesial defect | β-TCP 250–1000 µm | (12 wk: new bone 19.1%, BIC 32%) | Xu 2016, cid.12259 |
| human socket | β-TCP 0.25–1 mm | 20.6 ± 9.5% (6 wk) | 10.1186/s40729-023-00491-1 |
| human socket | PLGA-coated β-TCP (easy-graft) | 12.9 ± 7.7% (4 mo); new bone 24.4% | 10.1155/2016/5406736 |
| human sinus | various pure β-TCP | 26–33% (6 mo); 3.2% with fine 20–600 µm granules (10 mo) | jfb8030031, ijerph17061918, edj.2019.74765, s00784-026-07081-6 |
| sheep scapula | Cerasorb M 1–2 mm | 33.8% (1 mo), 24.6% (3 mo), 23.7% (6 mo), 19.2% (12 mo), 9.5% (18 mo); new bone 75% at 12–18 mo | 10.1093/rb/rbae041 |
| goat metacarpal (micro-CT, mm³) | β-TCP ± PRF / i-PRF | 57.9 → 45.7 → 25.0 mm³ (2/5/8 wk); i-PRF 15.3 mm³ at 8 wk | 10.1007/s44445-025-00112-0 |
| minipig mandible | TCP foam | 24 ± 10% (12 wk) | 10.1016/j.jcms.2023.11.007 |

What the resorption data show:
- **Species and site matter more than any other factor.**
  - In dog sockets, β-TCP is close to gone by 12 weeks. Hong's half-life is about 22 days (k ≈ 0.031/day).
  - In human sockets and sinuses, and in sheep, 13–33% remains at 4–6 months.
  - The current plan of fitting resorption on Hong (dog) and applying it to the human case is therefore wrong. **Use species-specific resorption.** Fit the dog rate on Hong and ma13163452. Fit the human rate on the human socket points (20.6% at 6 wk, 12.9% at 4 mo) and check it against the sinus 6-mo data.
  - A rough human estimate, assuming an initial solid fraction of 0.36, gives a half-life of about 2–3 months. This is a derived estimate and still needs fitting.
- **Granule size matters.** Fine granules (20–600 µm) leave 3% at 10 months. Coarse granules (700–1400 µm) leave about 30% at 6 months.
- **The sheep series is not a single exponential.** Resorption is fast in the first month, there is a plateau from 3 to 12 months, and a second drop by 18 months. A two-phase law (early dissolution plus slower cell-mediated resorption) may be needed for a one-year run.
  - One human sinus study found no TRAP+ osteoclasts on β-TCP and attributed the loss to dissolution (jfb8030031).
- **Measurement method shifts the values 2–3 times** (histology vs micro-CT). Compare like with like.

### Granule bed
- **Bulk density** of a β-TCP granule bed is 0.60–0.65 g/cm³ and the ceramic density is 3.1 g/cm³ (jfb8030031).
  - The solid fraction is therefore 0.19–0.21.
  - With 60% intra-granular porosity, the granule packing fraction is about 0.5. This agrees with the 0.55 assumed in `../GAPS_SEARCH.md` and with the estimate of about 20% solid for Cerasorb M.
- **Granule area on day 6** was 63–70% of the defect, and intra-granular porosity 0.46 ± 0.18 (10.1371/journal.pone.0084932, rat).
- **Products:**
  - Cerasorb M: 500–1000 µm or 1–2 mm, ~65% porosity.
  - CEROS: 700–1400 µm, 60–70% porosity.
  - BCP comparators: about 74% porosity, 100–600 µm macropores (10.1055/s-0042-1753453).

### Histology time course (new bone)
- **Dog P3 socket** (Hong):
  - empty: 26.0 / 47.7 / 62.0% at 2 / 4 / 8 wk
  - β-TCP: 5.0 / 11.1 / 48.6%
- **Dog Cerasorb M socket:** 49.4% at 12 wk, 38.0% at 24 wk. Empty socket about 31%.
- **Human socket:**
  - empty: 9.5% at 6 wk, 34 ± 17% at 8 wk (central area; 10.5051/jpis.2300460023)
  - β-TCP: 13.4% at 6 wk, 24.4% at 4 mo
- **Human socket at 8 wk, 60 sockets** (10.3390/jfb17010006): about 56–62% new bone across arms. The control is 62.4%.

### Socket and gap geometry
- **Human maxillary anterior and premolar immediate implants:**
  - buccal plate 0.5–0.72 mm at 0–5 mm below the platform (10.21203/rs.3.rs-1163093)
  - buccal plate 0.64 mm and gap 2.2–2.4 mm (jper.11381)
  - buccal plate 1.26–1.50 mm and gap 2.67–2.92 mm at 1 and 5 mm below the collar, premolars reported separately (10.3390/jcm13185521)
- **Human maxillary anterior labial bone** (80 Chinese adults; 10.7555/jbr.27.20130002): about 0.9–1.3 mm at 3 mm below the CEJ, about 0.6–1.0 mm at mid-root, about 2 mm at the apex.
- **Dog:**
  - beagle maxillary P4 socket 5.2 × 11.8 mm, mandibular P3 socket 3.2 × 8.5 mm (width × depth; 10.1016/j.jds.2021.03.005)
  - Xu/Boix defect 6 × 4 × 5 mm
- Mandibular premolar data are fewer. Check `PARAMETERS_EXTRACTED.tsv` (`category=socket_geometry`, `site` contains "mandibular") together with the values already in `../GAPS_SEARCH.md`.

### Growth factors and cells
- **Xu 2016:**
  - in vitro, the best proliferation was at 50 ng/mL rhPDGF-BB
  - in vivo graft: 0.3 mg/mL PDGF-BB; BMSC 2 × 10^7 cells/mL
  - new bone 19.1% (β-TCP) vs 48.7% (both added); BIC 32% vs 73%
- **Adipose SVF cells on β-TCP** in the sinus lowered residual graft (29.6 → 17.4%) and raised bone (12.0 → 16.4%) at 6 months (sctm.2015-0369).
- **i-PRF** sped up β-TCP resorption in goats: 25.0 vs 15.3 mm³ residual at 8 weeks.
- In vitro release kinetics of rhPDGF-BB from coated discs: 15–27 ng on day 1 and 35–70 ng by day 28 (10.3390/coatings8010017).

### Loading, tissue mechanics, mechanobiological models
This corpus came from an imaging search, so it holds almost no bite-force, tissue-modulus or computational-model data:
- **Loading:** 152 rows, almost all insertion torque, ISQ or loading protocol (immediate provisional at ≥ 35 Ncm, delayed at 3–6 months).
- **Bone mechanics:** 3 rows.
- **Mechanobiological models:** 1 row.

Keep using the values in `../LITERATURE_REPORT.md` and `../GAPS_SEARCH.md` for these.

## Caveats
- **Full texts** are not distributed in this repository. The Hong 2014, Xu 2016 and Daif 2013 numbers still need a check against the publisher versions before publication.
- **Duplicates and overlaps:**
  - Groningen 5- and 10-year cohorts.
  - EthOss paper and its preprint.
  - The two Egyptian Dental J MPM papers.
  - Knabe 2017 and 2023.
  - cid.70079 and clr.70099, which share the same trial number.
- **Values from reviews need checking against the primary papers:** the vet review's sheep series (superseded by rbae041), jfb17050247 and ma18235328.
- **Tables missing from the text files**, so the PDF must be read:
  - 1305-7456.178298 (β-TCP socket HU at 0 and 6 mo; worth reading)
  - jcm12206616
  - 1735-3327.245233
  - aol.34/2/119
  - the OsteoScaf thesis
  - scs.0000000000011212 (supplement)
- **Industry links** (botiss, Geistlich, Straumann, EthOss, Induce Biologics, Korea Tooth Bank) are noted per paper in `PAPER_NOTES.md`.
- **CBCT densities are uncalibrated.** They are not true HU and can only be compared within a study.

## Suggested next steps
1. Adopt the virtual-CBCT output and species-specific β-TCP resorption in the model design.
2. Decide the primary human target (proposed: Elsheikh 2023). Optionally ask its corresponding author for the CBCT data. That is an e-mail and needs the user's approval.
3. Read the PDFs whose tables are missing, starting with 1305-7456.178298.
4. Re-check the Hong and Xu numbers against the publisher versions.
