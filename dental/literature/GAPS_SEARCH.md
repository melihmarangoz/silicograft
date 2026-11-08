# Parameter gap search: socket geometry, bone, β-TCP, PDGF/BMSC, zone data

Prepared 2026-10-27, as a follow-up to `LITERATURE_REPORT.md` (it does not repeat that report's content). It covers six gaps for the agent-based lattice + FE (Claes-Heigele) model of extraction-socket healing with β-TCP granules (Cerasorb / Cerasorb M, 500-1000 µm), with or without an immediate implant.

Files changed: this file (new), `parameters.csv` (new rows with the prefix `gap.`), `references.bib` (new entries appended).

**Verification rules.**
* Every journal source has a PMID checked in PubMed (MCP tool or E-utilities) or Europe PMC, and a DOI that resolves in Crossref. The exceptions carry their PMID only: covani2010 and suba2004, which have no registered DOI.
* long2005 is not in PubMed and was checked in Crossref only.
* Manufacturer and regulatory data come from FDA 510(k)/PMA documents on accessdata.fda.gov and the GEM 21S IFU.
* "OA FT" means the number was read in the open full text (Europe PMC / PMC). "abs" means abstract only.
* Values I computed are labelled DERIVED. Values without a source are labelled ASSUMPTION.
* No paywall was bypassed. Papers whose numbers matter but are paywalled are listed in Section 8.

---

## 0. Summary

| Gap | Status | Baseline proposal (detail in each section) |
|---|---|---|
| 1. Dog P3/P4 socket geometry | **Partly filled.** Depth, crest diameter and buccal-wall profile come from fresh-socket measurements (beagle n = 24, Labrador profile). Lingual wall, taper, septum and root length were not found in open sources | Depth 8.5 mm, crest 3.9 (BL) × 4.25 (MD) mm for mesial sockets and 3.2 mm for P3 distal. Buccal wall 0.6 → 1.55 mm from crest to 5 mm depth. Lingual wall 1.5 mm (ASSUMPTION) |
| 2. Human mandibular premolar socket | **Filled** (root widths every 2 mm as a socket proxy, CBCT depth, wall thickness, socket volume) | Elliptical frustum 12 mm deep, 7.3 × 4.8 mm at the crest. Buccal wall 0.86 / 1.18 / ~3 mm (crest / mid-root / apex) |
| 3. Dog mandible bone | **Partly filled.** Cortical E, density, trabecular BV/TV and alveolar BV/TV found. No measured dog trabecular apparent modulus | Cortical 13.7 GPa (7.5-16). Trabecular BV/TV 0.25. Trabecular apparent E 0.375 GPa (DERIVED from human data; range 0.06-0.9) |
| 4. Cerasorb / Cerasorb M / GEM 21S material | **Filled** for porosity, pore size, phase purity, particle size, dissolution and clinical resorption. **Partly filled** for mechanics (block strength and single-granule crush force only; no granule modulus) | Cerasorb M: 65 vol% intragranular porosity, pores 0.1-500 µm. GEM 21S: 250-1000 µm, pores 1-500 µm. Granule E 0.74 GPa, sensitivity widened to 0.1-1.6 GPa |
| 5. rhPDGF-BB and BMSC rates | **Partly filled.** Fold changes and release kinetics come from separate in vitro / rodent studies. The translation to ABM rates is DERIVED, and no ABM with a PDGF multiplier exists | Proliferation ×1.2, progenitor migration ×2.0, effect decays at 0.77 /day (over by ~day 7). BMSC seeding 0.5 of graft sites, death 0.12 /day |
| 6. Zone data and packing fraction | **Zone data: not found** for β-TCP at 2/4/8 weeks outside Hong 2014. **Packing: filled** (DERIVED from bulk density and from packing experiments) | Granule envelope packing 0.55 (0.45-0.65). Solid β-TCP fraction of the bed 0.20 (Cerasorb M) or 0.42 (round Cerasorb) |

**Important finding for model setup (Gap 2).** A Ø4 mm implant in a mandibular premolar socket is about as wide as the socket in the mesio-distal direction. The jumping gap is therefore mainly buccal (and lingual if the implant is centred), not circumferential. With the implant against the lingual wall, the buccal gap falls from ≈3.3 mm at the crest to ≈1 mm at 8 mm depth.

**Important finding for calibration (Gap 6).** The β-TCP solid fraction right after grafting depends strongly on the Cerasorb variant: about 0.20 for Cerasorb M (65% porous) and about 0.42 for round Cerasorb (35% porous). Hong 2014's residual graft of 38.3% at week 2 is only reachable with the denser variant, or if residual graft was measured as granule envelope rather than solid. **Check in a legitimate copy of Hong 2014 which Cerasorb product was used and how residual graft was measured.**

---

## 1. Gap 1: dog mandibular premolar socket geometry

### 1.1 Findings

* **Beagle mesial sockets of P3 and P4, measured right after hemisection and extraction** [nakajima2026] (6 dogs, about 6 years old, 11.5 kg, n = 24 sockets; OA FT Table 1, UNC probe and Iwanson caliper):
  * Depth from the buccal crest 8.2-8.3 ± 0.7-0.8 mm; from the lingual crest 8.5-8.7 ± 0.6-0.8 mm.
  * BL diameter 3.8-4.0 ± 0.3 mm; MD diameter 4.2-4.3 ± 0.3 mm.
  * Buccal wall 1 mm below the crest 0.7-0.8 ± 0.1 mm.
  * The lingual crest lies 0.3-0.4 mm above the buccal crest.
  * The same paper gives mandible height (lingual crest to base) as 14.8 ± 1.8 mm after 3 months of healing.
* **Beagle P3 distal socket** [fan2021] (n = 2 dogs, probe; OA FT): width 3.2 ± 0.1 mm (direction not stated) and depth 8.5 ± 0.2 mm.
* **Buccal wall profile of fresh mandibular premolar sockets in Labradors** [zhang2021atm] (6 dogs, all premolar roots, intra-operative; OA FT Table 2), four groups:
  * Crest: 0.53-0.71 mm.
  * 1 mm below: 0.77-0.93 mm.
  * 3 mm below: 1.20-1.29 mm.
  * 5 mm below: 1.50-1.58 mm (SD 0.13-0.55).
  * This is the only Labrador source and the only one that gives the taper of the wall. Xu 2016 used Labradors.
* **Beagle buccal plate at immediate implant placement** in P3/P4 distal sockets: mean 0.69 mm [hong2025] (OA FT; group values only in a figure).
* **Bucco-lingual crest width at extraction**, beagle P3/P4 distal sockets: 4.5 ± 0.5 mm [covani2010] (abs).
* **Healed ridge, for context only:**
  * Width 2 mm below the crest: 5.32 / 5.81 / 6.39 mm at P2 / P3 / P4. Crest to mandibular canal: 7.22 / 8.21 / 9.17 mm. Beagle, CBCT ≈ caliper [xie2018].
  * Width at 1 / 3 / 5 mm below the lingual crest: 3.7 / 6.2 / 7.0 mm after 4 months [fickl2008] (abs).
* **Qualitative:**
  * The lingual crest stands 0.45 mm above the buccal crest at baseline [discepoli2013] (abs; wall widths at three levels are in the paywalled FT).
  * The P3 socket is narrower than the P4 socket, and buccal crest loss after 8 weeks was 1.1 mm at P3 vs 0.3 mm at P4 [vignoletti2009ii] (abs).
* **Not found in open sources:**
  * Separately measured root length (use the probe depth of ~8.5 mm).
  * P4 distal socket diameter.
  * Mid-depth diameter and taper.
  * Interradicular septum width.
  * Lingual wall thickness.
  * Labrador socket depth and diameters.
  The wall widths of [araujo2005] (Table 1) and the P3/P4 distal socket diameters cited in later Vignoletti papers were seen only in search snippets of third-party copies, so they are **not** used. They need the library full texts (Section 8).

### 1.2 Values

| Parameter | Value | Unit | Range | Source | Conf. |
|---|---|---|---|---|---|
| Socket depth, P3/P4 mesial (beagle) | 8.5 | mm | 8.2-8.7, SD 0.6-0.8 | [nakajima2026] | H |
| Socket depth, P3 distal (beagle) | 8.5 | mm | SD 0.2 | [fan2021] | M |
| Socket BL × MD at crest, P3/P4 mesial | 3.9 × 4.25 | mm | SD 0.3 | [nakajima2026] | H |
| Socket width, P3 distal | 3.2 | mm | SD 0.1 | [fan2021] | M |
| BL crest width at extraction, P3/P4 distal | 4.5 | mm | ±0.5 | [covani2010] | M |
| Buccal wall at crest / 1 / 3 / 5 mm (Labrador) | 0.6 / 0.85 / 1.25 / 1.55 | mm | 0.53-0.71 / 0.77-0.93 / 1.20-1.29 / 1.50-1.58 | [zhang2021atm] | M-H |
| Buccal wall at 1 mm (beagle) | 0.75 | mm | 0.7-0.8; 0.69 at placement | [nakajima2026; hong2025] | H |
| Lingual over buccal crest height | 0.3-0.45 | mm | — | [nakajima2026; discepoli2013] | M |
| Mandible height, P3/P4 region | 14.8 | mm | ±1.8 | [nakajima2026] | M |
| Lingual wall thickness | 1.5 | mm | 1.0-2.0 | ASSUMPTION (full text needed) | L |
| Taper, septum width | — | — | — | not found | — |

### 1.3 Recommendation (canine models: Hong socket, Boix and Xu defects)

* **Hong 2014 calibration socket (beagle P3 root socket):**
  * Truncated cone 8.5 mm deep; crest 3.9 × 4.25 mm (mesial root) or 3.2 mm round (distal root); apex diameter 50% of crest (ASSUMPTION).
  * Buccal wall 0.6 mm at the crest, rising linearly to 1.55 mm at 5 mm depth and kept constant below. Lingual wall 1.5 mm.
  * Sensitivity: depth 8.0-9.0 mm, crest ±0.3 mm, lingual wall 1.0-2.0 mm, apex diameter 30-70% of crest.
* **Boix and Xu defects:** the defect height of 6 mm fits within an 8.5 mm socket. A beagle distal socket of 3.2-3.9 mm is about as wide as the Boix Ø3.3 implant, so in that model the gap comes only from the surgically created 6 × 4 × 5 mm mesial defect, not from the socket. Use the Zhang 2021 buccal-wall profile for the Labrador (Xu) geometry.

---

## 2. Gap 2: human mandibular premolar socket geometry

**Status: filled.** Root widths serve as the socket proxy, with CBCT for depth, wall thickness and volume. No open study gives the socket orifice of mandibular premolars directly. [cousoqueiruga2021] does (420 extracted teeth, socket orifice BL and MD at the buccal CEJ plane), but its abstract reports only the molar and incisor extremes, so it is under "full text needed". Root dimensions are used as a proxy for the socket. The periodontal ligament (about 0.2 mm per side, ASSUMPTION, not searched) makes the real socket slightly wider.

### 2.1 Findings

**Root widths along the root** [sun2018]. Extracted Chinese teeth, measured with calipers at the cervical line and every 2 mm below it. Values come from appendix tables 9, 10, 13 and 14, read from the publisher's openly served table images. Means in mm (SD 0.3-0.8):

| Tooth (n) | Root length | BL at CEJ / 2 / 4 / 6 / 8 / 10 mm | MD at CEJ / 2 / 4 / 6 / 8 / 10 mm |
|---|---|---|---|
| PM1 male (61) | 14.84 ± 2.01 | 7.75 / 7.58 / 7.34 / 6.95 / 6.43 / 5.68 | 5.31 / 4.95 / 4.47 / 3.98 / 3.66 / 3.29 |
| PM1 female (72) | 14.60 ± 1.71 | 7.36 / 7.09 / 6.82 / 6.38 / 5.77 / 5.01 | 5.01 / 4.54 / 4.02 / 3.59 / 3.23 / 2.85 |
| PM2 male (60) | 14.71 ± 1.77 | 7.79 / 7.37 / 6.88 / 6.22 / 5.53 / 4.91 | 5.32 / 4.85 / 4.30 / 3.83 / 3.49 / 3.18 |
| PM2 female (68) | 14.13 ± 1.48 | 7.34 / 6.94 / 6.46 / 5.91 / 5.26 / 4.56 | 5.21 / 4.77 / 4.27 / 3.81 / 3.45 / 3.08 |

The male PM2 table (13) was identified by position: tables 11-12 are maxillary second premolars (n = 40/44, matching the text), and n = 72 and n = 68 match the text for the female PM1 and PM2.

**Pre-extraction CBCT of immediate-implant candidates** [hamzani2021] (Israel, 175 mandibular second premolars; OA FT):
* MD width 5.41 ± 0.68 mm at the alveolar crest and 3.64 ± 0.51 mm at 5 mm coronal to the apex.
* BL width about 7.0 mm at the crest and about 4.3 mm at 5 mm from the apex (the text gives only the lowest root-type mean, left PM2).
* Crest-to-apex distance 13.87 ± 1.87 mm.
These agree with [sun2018] at the 2 mm level.

**Root length on CBCT** [hamdulay2025] (India, n = 300 each; OA FT): CEJ to apex 12.9 ± 1.02 mm (PM1) and 13.3 ± 1.39 mm (PM2). That is 1.1-1.2 mm shorter than the Wheeler textbook values of 14.0 and 14.5 mm quoted in the same paper.

**Socket volume** [su2026] (Beijing, CBCT + Mimics, n = 100, validated ex vivo within 3%; OA FT): intrabony root volume of the lower first premolar, median 183.75 mm³ (Q1-Q3 162.57-222.78). Male median 206.69 mm³; female mean 169.39 ± 29.97 mm³. PM2 was not measured.

**Buccal wall.** Pooled meta-analysis [heimes2021] (45 CT/CBCT studies; OA FT Table 2), mandibular premolars:
* 1-3 mm below the crest: 0.86 ± 0.51 mm, with 66.3% of sites below 1 mm.
* 4-9 mm (mid-root): 1.18 ± 0.70 mm.
* Apex: 2.97 ± 1.56 mm.
Single studies agree. At 3 mm from the apex, [saber2021] (Egypt, 170 CBCT; OA FT) gives 1.49-1.73 mm for PM1 and 1.85-1.93 mm for PM2. At the apex, [porto2020] (Brazil, n = 100 per tooth; OA FT) gives 3.27 ± 1.04 mm for PM1 and 3.65 ± 1.35 mm for PM2. [temple2016] (934 roots) and [park2014] report the 1/3/5 mm levels, but their numbers are paywalled.

**Lingual wall.**
* At 3 mm from the apex: 3.98-4.18 mm (PM1) and 4.60-4.97 mm (PM2) [saber2021].
* At the apex: 5.58 ± 1.66 mm (PM1) and 5.46 ± 1.84 mm (PM2) [porto2020].
* **No open source gives the lingual thickness at the crest.** [park2014] has it at 3 and 5 mm below the CEJ (full text needed). The cadaver lingual cortex of 1.92 mm [katranji2007] (already in `parameters.csv`) is the best crest-level proxy.

### 2.2 Derived geometry (DERIVED from [sun2018])

* **Taper:** between 2 and 10 mm below the CEJ, the half-angle is 6.8-8.7° in the BL plane and 5.9-6.0° in the MD plane. The cross-section is an ellipse with BL/MD ≈ 1.5 at the crest that becomes rounder toward the apex.
* **Volume check:** integrating the elliptical sections from the crest (taken 2 mm below the CEJ) to the apex gives 162-200 mm³ for PM1 and 159-174 mm³ for PM2. The PM1 range brackets the CBCT median of 183.75 mm³ [su2026], so the idealized socket below is volumetrically consistent.
* **Socket depth:** root length minus the CEJ-to-crest distance (about 2 mm in health, ASSUMPTION; no source specific to mandibular premolars was found) gives 11-13 mm. The CBCT crest-to-apex value of 13.87 ± 1.87 mm [hamzani2021] supports this. [daif2013] (Ø3.75-4 × 14-16 mm implants, 3 mm beyond the apex) implies 11-13 mm.
* **Gap profile:** a Ø4.0 mm cylindrical implant against the lingual wall leaves a buccal gap of BL − 4.0 mm. Averaged over sexes:
  * Crest: ≈3.3 mm.
  * 4 mm depth: 2.1-2.7 mm.
  * 6 mm depth: 1.4-2.1 mm.
  * 8 mm depth: 0.7-1.4 mm.
  * Near the apex: ≈0.
  In the MD direction the socket is 4.5-4.95 mm at the crest and 4.0-4.5 mm 2 mm deeper, so a Ø4 implant engages mesial and distal bone from about 2-4 mm below the crest. The current assumption ("buccal gap 3 mm at the crest tapering to 0 at 5 mm depth") is right at the crest, but the real taper is slower.

### 2.3 Values

| Parameter | Value | Unit | Range | Source | Conf. |
|---|---|---|---|---|---|
| Root length PM1 / PM2 (extracted, caliper) | 14.6-14.8 / 14.1-14.7 | mm | SD 1.5-2.0 | [sun2018] | H |
| Root length PM1 / PM2 (CBCT) | 12.9 / 13.3 | mm | SD 1.0 / 1.4 | [hamdulay2025] | H |
| Crest-to-apex, PM2 (CBCT) | 13.87 | mm | SD 1.87 | [hamzani2021] | H |
| Socket depth (baseline) | 12 | mm | 11-14 | DERIVED | M |
| Socket BL at crest (≈ root 2 mm below CEJ) | 7.3 | mm | 6.9-7.6 (means); ~7.0 CBCT | [sun2018; hamzani2021] | H |
| Socket MD at crest | 4.8 | mm | 4.5-5.4 | [sun2018; hamzani2021] | H |
| Socket BL / MD at 6 mm depth (8 mm below CEJ) | 5.8 / 3.4 | mm | BL 5.3-6.4, MD 3.2-3.7 | [sun2018] | H |
| Socket BL / MD 5 mm above apex (PM2, CBCT) | ~4.3 / 3.64 | mm | MD SD 0.51 | [hamzani2021] | M |
| Taper half-angle BL / MD | 7-9 / 6 | ° | — | DERIVED [sun2018] | M |
| Intrabony root (socket) volume, PM1 | 184 | mm³ | IQR 163-223 | [su2026] | H |
| Buccal wall, 1-3 mm below crest | 0.86 | mm | SD 0.51; 66% < 1 mm | [heimes2021] | H |
| Buccal wall, mid-root (4-9 mm) | 1.18 | mm | SD 0.70 | [heimes2021] | H |
| Buccal bone at apex | 2.97 | mm | SD 1.56 | [heimes2021; porto2020] | H |
| Buccal / lingual bone 3 mm from apex, PM1 | 1.5-1.7 / 4.0-4.2 | mm | SD 0.9-1.2 | [saber2021] | M |
| Lingual bone at apex, PM1 / PM2 | 5.58 / 5.46 | mm | SD 1.66 / 1.84 | [porto2020] | M |
| Lingual wall at crest | 1.9 (proxy) | mm | — | [katranji2007] cortex | L |

### 2.4 Recommendation (human prediction model, Daif scenario)

* **Socket:** single-rooted elliptical frustum, 12 mm deep. 7.3 mm (BL) × 4.8 mm (MD) at the crest, linear taper to 5.3 × 3.1 mm at 8 mm depth, then a cone to the apex over the last 4 mm. This is the PM1 male/female mean of [sun2018] and matches the [su2026] volume.
* **Walls:**
  * Buccal: 0.9 mm in the coronal 3 mm, 1.2 mm at mid-depth, 3 mm at the apex.
  * Lingual: 2 mm at the crest (proxy), 4 mm at mid-depth, 5.5 mm at the apex.
* **Implant:** Ø4.0 × 14 mm (as in [daif2013]), against the lingual wall and 3 mm beyond the apex. The buccal gap then emerges from the geometry (≈3.3 mm at the crest, matching the > 2 mm gap of Daif).
* **Sensitivity:**
  * Ø3.75 implant.
  * Centred implant (≈1.6 mm buccal and lingual gaps).
  * Buccal wall 0.5 / 1.0 / 1.5 mm.
  * Socket widths ±1 SD (±0.6 mm BL, ±0.3 mm MD).
  * Depth 11-14 mm.

---

## 3. Gap 3: dog mandible bone properties near the premolars

### 3.1 Findings

* **Cortical tissue modulus, dog mandible:**
  * Ultrasound, orthotropic, foxhound control mandible: E1 / E2 / E3 = 12.6 ± 2.2 / 15.7 ± 2.4 / 31.4 ± 3.1 GPa (alveolar region E3 29.2, basal 33.2 GPa), ν12 0.42, density 1.92-2.02 g/cm³ [zapata2011] (OA FT Tables 2-3). E3 is unusually high for an ultrasonic measurement.
  * Ultrasound, isotropic: 7.5 GPa, ν 0.4 [ashman1985] (abs).
  * The existing baseline of 13.7 GPa sits inside this spread.
* **Trabecular structure:**
  * Adult foxhound, contralateral premolar region (premolars had been extracted and control implants placed weeks earlier), micro-CT at 20 µm [kontogiorgos2011] (OA FT Table 1): Tb.BV/TV 25 ± 7-9%, Tb.Th 0.17-0.18 mm, Tb.Sp 0.53-0.57 mm, Tb.N ≈1.4 /mm. Total BV/TV including cortex is 63-72%.
  * Beagle alveolar process: almost compact, BV/TV 97.9 ± 2.3%, MAR 1.5 µm/day, BFR ≈37%/year [huja2006] (PMC Table 1b).
  * So in the dog the bone right around the premolar roots is compact, and trabecular bone sits deeper in the mandibular body.
* **Cortical thickness:**
  * Anterior mandible of adult beagles: 1.14 ± 0.11 mm [wang2010] (abs; wrong region, proxy).
  * CT of 36 dogs: buccal cortex < 2.0 mm at most sites 3 mm below the alveolar margin, thinnest over the P4 roots and the mesial root of M1 [snyder2016] (abs).
  * Alveolar bone 0.27-4.1 mm in small breeds [kyllar2013] (abs).
  * For the socket wall itself, use the Gap 1 profile (0.6-1.6 mm buccal).
* **Trabecular apparent modulus:**
  * **No measured value for dogs.** A beagle FE model uses 0.48 GPa (ν 0.225) taken from the literature [liao2016].
  * Human fallback: molar-region trabecular E 6.9-199.5 MPa across 10 fresh specimens [lakatos2014] (OA FT). Mandibular trabecular BMD 571 mg/mL at the premolars (633 anterior, 518 molar) [kido2011] (abs).
  * Values already in the bib: [misch1999] 56/96 MPa; [omahony2000] 114/511/907 MPa (inferior-superior / bucco-lingual / mesio-distal) with BV/TV 0.33.

### 3.2 Values

| Parameter | Value | Unit | Range | Source | Conf. |
|---|---|---|---|---|---|
| Cortical tissue E (dog) | 13.7 (keep) | GPa | 7.5-15.7 (31.4 axial, ultrasonic) | [zapata2011; ashman1985] | M |
| Cortical density (dog) | 1.97 | g/cm³ | 1.92-2.02 | [zapata2011] | M |
| Trabecular BV/TV (dog premolar region) | 0.25 | – | 0.15-0.35 | [kontogiorgos2011] | M-L |
| Alveolar process BV/TV (beagle) | 0.98 | – | ±0.023 | [huja2006] | H |
| Buccal cortex near P4 (dog) | < 2.0 | mm | — | [snyder2016] | L-M |
| Trabecular apparent E, mandible (isotropic) | 0.375 | GPa | 0.06-0.9 | DERIVED: geometric mean of [omahony2000]; [lakatos2014; misch1999; liao2016] | L |
| Human trabecular BMD, premolar region | 571 | mg/mL | 518-633 (molar-anterior) | [kido2011] | M |

### 3.3 Recommendation

* **Canine models:**
  * Socket walls and the alveolar process: compact bone at 13.7 GPa.
  * Mandibular body below the root apices: trabecular region with apparent E 0.375 GPa (BV/TV ≈0.25), sensitivity 0.1-0.9 GPa.
  * Buccal cortex 0.6-1.6 mm (Gap 1 profile). Lingual cortex 1.5 mm (ASSUMPTION).
* **Human model:** **lower the trabecular baseline from 1.0 GPa (current `mat.trabecular_bone_E_apparent`) to about 0.4 GPa.** Every measured mandibular trabecular value lies below 1 GPa. Keep 0.06-1.0 GPa as the sensitivity range. The tissue-level moduli for new bone in the ABM (immature 1 GPa, mature 17 GPa) are not affected.

---

## 4. Gap 4: Cerasorb, Cerasorb M and GEM 21S β-TCP

### 4.1 Findings

* **Phase purity and porosity (manufacturer, regulatory)**, from the 510(k) summaries K051443 (2005) and K113282 (2012) ([fdaK051443; fdaK113282]):
  * Pure-phase β-TCP, purity ≥ 99% (2005) and > 99% (2012), ASTM F1088-04.
  * Total porosity: Cerasorb (Classic) ≈35%, Cerasorb M ≈65 vol%, Cerasorb Perio ≈25 vol%.
  * This confirms the 35/65% of [knabe2008] with a primary manufacturer source. These are intragranular porosities.
* **Pore size:**
  * Cerasorb M: 0.1-500 µm; round Cerasorb: 0.1-50 µm [barbeck2021] (OA FT Table 4). Cerasorb M 0.2-500 µm by SEM [roth2019] (OA FT).
  * Hg porosimetry on a cast Cerasorb M cylinder (block, not granules): mean pore radius 18.5 µm (3-80) and porosity 61.8 ± 0.9% [zoller2024] (OA FT).
* **Mechanics:**
  * Cerasorb M block compressive strength: 1.4 ± 0.2 MPa (20 mm high) and 1.1 ± 0.3 MPa (6 mm high). After 60 days in Tris buffer at pH 7.4 it falls to 0.07 ± 0.05 MPa [zoller2024].
  * Single-granule crushing strength of Cerasorb M: 1.97 N, method and size not stated. Source: the comparison table of the Cytrans 510(k) K192597 [fdaK192597].
  * **No measured granule modulus was found.**
  * DERIVED cross-check: a strength of about 1.2 MPa at about 62% porosity is roughly 10× below the Metsger value of 13 MPa at 50% porosity. The existing DERIVED granule E of 0.74 GPa may therefore be high.
* **Dissolution and resorption:**
  * In vitro dissolution after 30 min: 7.3 mg/L at pH 5.5 and 0.42 mg/L at pH 7.3 [fdaK192597].
  * Clinical resorption claims: 6-24 months for Cerasorb M [fdaK192597]; "completely replaced within 6 to 12 months" in ~1000 sites of 267 patients [palti2002]; ≈12 months [horch2006] (already in the bib).
  * Mechanism in human sinus biopsies: mainly chemical dissolution, no multinucleated TRAP+ osteoclasts at 6 months, and about 95% of cells inside the particles Runx2+ [zerbo2005] (abs).
  * Large load-bearing defect (sheep tibial head): residual β-TCP stalls at 36 ± 12.2% between 6 and 12 months [koepp2004] (abs).
  * Dog sockets with chronic pathology and dehiscence, Cerasorb + collagen membrane: residual graft 8.28 ± 2.07% at 4 weeks and 0% at 12 weeks [lee2020] (OA FT).
* **Bed properties:** a Cerasorb product sold in Japan (variant not stated) has bulk density 0.72 ± 0.03 g/cm³, overall porosity 76.4 ± 0.8%, specific surface area 0.06 m²/g and crystallite size 78.5 nm [ishikawa2018] (OA FT Table 1; the abstract gives a specific surface area of 1.0 m²/g, which contradicts the table).
* **Granule sizes sold:** Cerasorb M in 150-500, 500-1000 and 1000-2000 µm [fdaK192597].
* **GEM 21S** (Lynch Biologics, previously Osteohealth / BioMimetic), from the PMA P040013 SSED, the package insert and the 2023 IFU ([fdaP040013; gem21sIFU2023]):
  * β-TCP particles 250-1000 µm, pore diameters 1-500 µm.
  * Kit: 0.5 cc β-TCP + 0.5 mL rhPDGF-BB at 0.3 mg/mL in 20 mM sodium acetate (150 µg). Saturate for 10 min and place with moderate pressure without crushing.
  * The SSED identifies the β-TCP component as the separately marketed VitOss. **The porosity (%) of the GEM 21S β-TCP was not found** in an open, verifiable source.

### 4.2 Values

| Parameter | Value | Unit | Range | Source | Conf. |
|---|---|---|---|---|---|
| Phase purity, Cerasorb family | > 99 | % β-TCP | ≥ 99 | [fdaK051443; fdaK113282] | H |
| Intragranular porosity Classic / M / Perio | 35 / 65 / 25 | vol% | — | [fdaK051443; fdaK113282; knabe2008] | H |
| Pore size, Cerasorb M | 0.1-500 | µm | 5-500 (distributor) | [barbeck2021; roth2019] | M |
| Pore size, round Cerasorb | 0.1-50 | µm | — | [barbeck2021] | M |
| Hg pore radius, Cerasorb M (block) | 18.5 | µm | 3-80 | [zoller2024] | M |
| Compressive strength, Cerasorb M (block) | 1.1-1.4 | MPa | 0.07 after 60 d in buffer | [zoller2024] | M |
| Single-granule crushing strength, Cerasorb M | 1.97 | N | size not stated | [fdaK192597] | L-M |
| Dissolution at 30 min, pH 5.5 / 7.3 | 7.3 / 0.42 | mg/L | — | [fdaK192597] | M |
| Bed bulk density / overall porosity | 0.72 / 76.4 | g/cm³ / % | ±0.03 / ±0.8 | [ishikawa2018] | M |
| Clinical resorption time | 6-24 | months | 6-12 [palti2002]; ~12 [horch2006] | [fdaK192597; palti2002] | M |
| Residual Cerasorb, dog socket + membrane | 8.3 (4 wk), 0 (12 wk) | % area | SD 2.1 | [lee2020] | M |
| Residual β-TCP, large sheep defect | 36 | % | ±12.2 (6-12 mo) | [koepp2004] | M |
| GEM 21S particle size / pore diameter | 250-1000 / 1-500 | µm | — | [fdaP040013] | H |
| GEM 21S rhPDGF-BB loading | 0.3 mg/mL, 0.5 mL per 0.5 cc | — | 150 µg per kit | [fdaP040013; gem21sIFU2023] | H |
| GEM 21S β-TCP porosity | not found | % | — | — | — |

### 4.3 Recommendation

* **Granules (Cerasorb M, Daif):** 65% intragranular porosity, pores 0.1-500 µm. Their inner pores are ≥ 100 µm only in part, so on a 100 µm lattice a granule is best represented as solid with a porosity-reduced modulus plus a surface for cell attachment.
* **Granule modulus:** keep 0.74 GPa (DERIVED), but widen the sensitivity range to **0.1-1.6 GPa**. The mechanical result will hardly depend on it, because a granule at 0.1 GPa is still 500× stiffer than clot (0.2 MPa). The bed stiffness is set by the clot matrix and the granule contacts (gap G2, still open).
* **Resorption:** keep the cell-mediated surface rule. Add a slow, cell-independent dissolution term as an option, since human biopsies show dissolution with few osteoclasts [zerbo2005], while dog sockets show many multinucleated cells (Hong 2014). Canine calibration: residual close to 0 at 12 weeks [lee2020], consistent with the 2.5-week half-life already in `parameters.csv`. Human: 6-24 months.
* **Xu (GEM 21S):** use 250-1000 µm granules, pores 1-500 µm, porosity unknown. Run 35% and 65% porosity as bounds.

---

## 5. Gap 5: rhPDGF-BB and seeded BMSCs as model rates

### 5.1 Findings

**Proliferation.**
* PDGF-BB shortens the culture doubling time of human MSCs from 2.4 to 2.0 days (rate ×1.20) and of rat MSCs from 3.25 to 2.95 days (×1.10) [lennon2018] (abs).
* No effect on human mandibular BMSCs at 20 ng/mL [oura2025] (abs).
* No effect on hMSCs on PDGF-coated scaffolds [phipps2012] (OA FT).
* Goat BMSCs in a collagen gel [niu2021] (OA FT): little effect at 20-200 ng/mL; at 2 µg/mL ×1.67 at day 4 and ×4-5 at day 7.
* Peak mitogenesis at 100 ng/mL in human PDL cells [boyan1994] and at 10 ng/mL in rat PDL cells [matsuda1992] (abs, no fold values).
* PDGF-BB/PDGFRβ drives proliferation and migration but **inhibits** osteogenic differentiation of mouse MSCs [tokunaga2008] (abs). The Xu 2016 abstract says the opposite for canine BMSCs (numbers only in its full text).

**Migration.**
* Chemotactic index up to 22× for human mesenchymal progenitors, against 2.2-2.4× for differentiated cells [fiedler2002] (abs). The response falls with osteogenic differentiation [fiedler2004] (abs).
* Single-cell speed ≈3× for MSCs and ≈2× for fibroblasts at 10 ng/mL (time-lapse) [tyurinkuzmin2016] (OA FT; absolute µm/h only in figures).
* Invasion into gel [niu2021]: ×2-2.3 more migrated cells. The front advances about 2 mm vs 1 mm in 7 days, i.e. ≈12 vs ≈6 µm/h net front speed (DERIVED).
* PDGF-BB is the most potent MSC chemoattractant of 26 factors, with a peak at 10 ng/mL [ozaki2007; ponte2007] (abs).
* No absolute MSC speed in µm/h under PDGF was found.

**Release and lifetime.**
* GEM 21S-type β-TCP releases ≈100% of rhPDGF-BB in vitro within 90 min. In rat calvarial defects ≈90% has left the site within 72 h, with full potency retained [young2009] (abs).
* About 45% is released over 10 days in vitro when PDGF is adsorbed, and release is faster in vivo [bateman2005] (abs). There is an early peak and minimal release after day 3 [fahimipour2026] (abs).
* Half-life: 2 min in plasma (IV, baboon) [bowenpope1984]; about 4 h when applied topically in wounds and periodontal defects (SSED, [fdaP040013]).
* Model constants used elsewhere: t½ 30 min and D = 8.63 × 10⁻² cm²/day [siewe2025] (OA FT, wound model).
* In vivo effect size:
  * Dog lateral ridge, BCP + rhPDGF-BB: mineralized tissue 2.7 vs 1.7 mm² (×1.6) at 3 weeks [schwarz2009] (abs).
  * Human RCT with GEM 21S: bone fill 57% vs 18% [nevins2005] (abs).

**Seeded BMSCs.**
* Survival by bioluminescence (all xenogeneic cells in immunodeficient rodents):
  * Ectopic, nude mouse: −30% at day 1, −50% by 48 h, < 5% at 2 months [giannoni2010] (abs).
  * hMSC on coral in a femoral defect: −85% in 2 weeks, < 2% at 4 weeks, < 1% at 8 weeks [manassero2016] (abs).
  * hBMSC on BCP granules: **54.7 ± 12.7% at day 8 and 1.57 ± 0.63% at day 37** (8.9% at day 8 without a scaffold) [brennan2014] (OA FT, checked).
  * Goat MSC in the rat spine: signal until day 14 [geuze2010] (abs).
* Contribution to bone: some donor cells along the granules and in osteocyte lacunae at 8 weeks, but the explants were mainly host-derived [brennan2014]. The clinical seeding dose in that study was 100 × 10⁶ BMSCs per 5 cm³ BCP.
* Dog: autologous BMSCs on HA/TCP around implants gave new bone of 34.99 vs 23.13% at 8 weeks (×1.51) and 40.17 vs 28.36% at 16 weeks, with labelled cells next to the graft [kim2009] (abs). GFP-labelled canine BMSCs (Xu's group) survived 4 weeks on CPC in nude mice [zhang2013] (abs).
* **The Xu 2016 seeding density is not in its abstract.**

**Computational models.**
* [geris2010pcb] (OA FT): an MSC injection into a rat non-union, modelled as 1 mL at 10⁶ cells/mL at week 3. The injection site mattered. The growth factors are generic, and the Text S1 parameters could not be retrieved (server error).
* [carlier2014] (OA FT):
  * Initial MSC density 2 × 10⁴ cells/mL (2 × 10³ when compromised); injected cells 2 × 10⁵ cells/mL.
  * Growth factor 100 ng/mL (10 ng/mL when compromised; 10³ ng/mL injected).
  * Above 2 × 10⁵ cells/mL the extra cells become harmful through hypoxia. Growth factor alone beat cells plus growth factor.
* [ribeiro2015] (OA FT): a template for carrier release (BMP-2). Release rate 0.217 /day, D = 8.64 mm²/day, Michaelis-Menten consumption, and bell-shaped fold-change functions for chemotaxis and proliferation.
* Abstract only: [bailonplaza2001] (the duration of the initial growth-factor release is the key parameter), [amor2011] (platelet growth factors at a dental implant, validated in dogs), [zhange2023] (explicit PDGF), [checa2010] (lattice model; more homogeneous seeding gave slower vascularization and less bone).
* **No bone or dental ABM with an explicit PDGF multiplier on proliferation or migration was found.**

### 5.2 Values and model translation

| Parameter | Value | Unit | Range | Source | Conf. |
|---|---|---|---|---|---|
| PDGF multiplier on progenitor proliferation | 1.2 | × | 1.0-1.5 | DERIVED [lennon2018; niu2021; oura2025; phipps2012] | L-M |
| PDGF multiplier on progenitor migration speed | 2.0 (→ 60 µm/h) | × | 1.5-3 | DERIVED [tyurinkuzmin2016; niu2021; fiedler2002] | M |
| PDGF multiplier on osteoblast-lineage migration | 1.0-1.5 | × | — | [fiedler2004] | M |
| PDGF multiplier on differentiation | 1.0 | × | 0.7-1.2 | ASSUMPTION [tokunaga2008] vs Xu 2016 | L |
| rhPDGF-BB cleared from the site | ≈90% in 72 h | — | in vitro 100% in 90 min | [young2009] | H |
| Decay rate of the PDGF effect | 0.77 | /day | 0.33-2.3 (duration 3-14 d) | DERIVED from [young2009] | L-M |
| PDGF half-life | 2 min (plasma); ~4 h (topical) | — | — | [bowenpope1984; fdaP040013] | H |
| In vivo bone ratio, PDGF (dog, 3 wk) | 1.6 | × | — | [schwarz2009] | M |
| Seeded-BMSC fraction of free graft sites | 0.5 | – | 0.2-1.0 | ASSUMPTION; dose refs [brennan2014; carlier2014; geris2010pcb] | L |
| Seeded-BMSC death rate | 0.12 | /day | 0.04-0.35 | DERIVED [manassero2016; brennan2014; giannoni2010] | L-M |
| BMSC survival at day 8 / day 37 | 54.7 / 1.57 | % | ±12.7 / ±0.63 | [brennan2014] | M |
| In vivo bone ratio, BMSC on HA/TCP (dog, 8 wk) | 1.51 | × | 1.42 at 16 wk | [kim2009] | M |

**Translation (DERIVED or ASSUMPTION):**
* PDGF effect over time: M(t) = 1 + (M_max − 1)·e^(−0.77·t), with t in days from grafting. This applies to progenitor proliferation (M_max 1.2) and migration (M_max 2.0). The effect is essentially over by day 7. Run 3 and 14 days as sensitivity. Free PDGF decays in minutes to hours, so the effect follows the release depot. If the code supports directed migration, add a bias toward the graft.
* BMSC arm: seed progenitors on 50% of free lattice sites inside the graft at t = 0. Give them a death rate of 0.12 /day (native progenitors: 0.05 /day), which leaves 15-25% at 2 weeks and < 2% at 5-6 weeks. Otherwise they behave as normal progenitors. The survival data come from xenogeneic cells in immunodeficient rodents, and autologous dog cells (Xu) may live longer.
* **Calibration test:** the model must reproduce Xu's arm ratios at 12 weeks (BIC 46.3 / 50.9 / 72.5 vs 31.95%; new bone 32.5 / 35.7 / 48.7 vs 19.1%, as recorded in `DESIGN.md`; the abstract has no numbers, so these must be re-checked against the publisher version), from a PDGF pulse that lasts about one week. If it cannot, early recruitment must be amplified (larger M_max for migration) rather than prolonging the pulse beyond what [young2009] supports.

---

## 6. Gap 6: zone-wise β-TCP socket data in dogs and initial packing fraction

### 6.1 Zone data (coronal / middle / apical)

**No source other than Hong 2014 reports β-TCP socket healing by zone at 2, 4 and 8 weeks.** The closest data:
* **Cerasorb + collagen membrane, beagle, compromised sockets with dehiscence** [lee2020] (OA FT):
  * Micro-CT ridge dimension relative to the reference root, coronal / middle / apical:
    * 4 weeks: 77.4 ± 10.0 / 93.6 ± 3.7 / 98.4 ± 6.5%.
    * 12 weeks: 57.7 ± 7.3 / 89.9 ± 5.9 / 94.8 ± 6.7%.
  * Whole-socket histomorphometry: bone 51.6 ± 4.9% (4 weeks) and 59.1 ± 4.8% (12 weeks). BV/TV 33.2% and 46.4%.
  * These are ridge dimensions, not tissue composition per zone. Bone at 4 weeks is far above Hong's 11.1%, a difference in site and protocol that has to be explained before these data are combined.
* **BCP 60/40 compacted at 10 / 50 / 200 g, dog sockets, 2 months, by thirds** [delgadoruiz2018] (abs):
  * Residual graft 35 ± 1.9 / 45 ± 3.1 / 53 ± 1.4%.
  * More new bone coronally and apically; the most connective tissue in the middle third.
  * Particles reached the apical third only at 200 g.
  * The per-zone numbers are in the paywalled full text.
* **Cerasorb in beagle premolar sockets, whole socket** [suba2004] (abs): bone area 30.8% (6 weeks), 49.4% (12 weeks), 61.9% (24 weeks). These fill the gap between Hong's 4 weeks (11.1%) and 8 weeks (48.6%).
* **Bio-Oss Collagen, beagle, 2 weeks** [araujo2009] (abs, qualitative): bone forms first apically and along the lateral walls, while the centre and margin hold connective tissue with particles. This gives a qualitative spatial check for the model.
* [araujo2010] (β-TCP, dog, days 1 and 3, weeks 1, 2 and 4) has tissue fractions only in its full text.

### 6.2 Initial packing fraction of the granule bed

| Value | Basis | Source | Conf. |
|---|---|---|---|
| **Envelope packing f = 0.57** for Cerasorb M 500-1000 µm. Solid β-TCP = 0.20 of the bed; intergranular voids 0.43 | DERIVED: f = (1 − overall porosity 0.80) / (1 − intragranular porosity 0.65). The overall porosity comes from bulk density and crystal density (dry, poured) | [barbeck2021] Table 4, checked | M |
| f = 0.69 (M 150-500), 0.65 (round 500-1000; solid 0.42), 0.51 (round 50-150) | Same derivation (overall 76 / 58 / 67%) | [barbeck2021] | M |
| f = 0.50 ± 0.04 (interparticle macroporosity 49.9 ± 4.3 vol%) | β-TCP 200-1000 µm poured into a 5 mm tube, resin-infiltrated, image analysis; mean interparticle distance 382 µm | [martinez2010] (author manuscript, FT) | M-H |
| Stack porosity 58.9 ± 1.3% (dense granules) and 75.3 ± 0.4% (porous granules); mean pore diameter 359 and 321 µm; confined stiffness 65.4 and 14.4 N/mm | β-TCP granules settled in a 10 mm tube. Stack height not given, so no modulus can be derived | [chappard2015] (OA FT) | M |
| Bulk density 0.72 g/cm³ (overall porosity 76.4%) → f ≈ 0.36 if Classic, ≈0.67 if M | DERIVED; variant unknown | [ishikawa2018] | L |
| Residual BCP 35 / 45 / 53% at 2 months for 10 / 50 / 200 g compaction | Slowly resorbing BCP, so close to the packed fraction | [delgadoruiz2018] | M |

Caveat: in [barbeck2021] Table 4 the column headed "Intergranular Porosity" holds the manufacturer's intragranular values (65/65/25/35/35%), and the caption calls them intragranular. The header is probably wrong. The derivation above assumes the caption is correct.

### 6.3 Recommendation

* **Granule envelope packing:** baseline 0.55, sensitivity 0.45-0.65 (hand packing raises it). The existing ASSUMPTION of 0.5 in `mat.granule_packing_fraction` is supported.
* **β-TCP solid fraction of the bed** (needed if residual graft is compared as solid area):
  * Cerasorb M 500-1000 µm: about 0.20 at t = 0.
  * Round Cerasorb: about 0.42.
* **Hong 2014 check:**
  * If Hong counted residual graft as solid ceramic area, the 38.3% at week 2 only fits a dense (≈35% porous) Cerasorb granule.
  * If Hong counted the granule outline (envelope), it fits f ≈ 0.5-0.6 minus two weeks of resorption.
  * This decides how the model's residual-graft output is defined. Check in a legitimate copy of Hong 2014, and use the same definition when comparing with Daif (Cerasorb M).
* **Zone validation:** with no other quantitative zone data, use Hong Fig. 8 as the only zone target. Use [araujo2009] (apical and lateral first) and [delgadoruiz2018] (middle third slowest) as qualitative checks of the predicted pattern.

---

## 7. Suggested changes to existing `parameters.csv` rows

The existing rows were not edited. These are proposals:

1. `mat.trabecular_bone_E_apparent`: lower the baseline from 1.0 to ≈0.4 GPa (Section 3).
2. `mat.betaTCP_granule_E_65pct_porosity`: widen the range to 0.1-1.6 GPa (Section 4).
3. `geom.buccal_wall_thickness_premolar` and `geom.premolar_socket_dimensions_human`: these gaps are now closed by the `gap.human_*` rows (Section 2).
4. `geom.jumping_gap_width_buccal` / `geom.jumping_gap_depth`: in the human model, derive the gap from socket geometry and implant position rather than prescribing it (Section 2.2).
5. `mat.granule_packing_fraction`: keep 0.5 or use 0.55. Add the solid-fraction distinction (Section 6).

---

## 8. Full text needed (paywalled; download through the university library)

In order of value to the model:

| # | Paper | DOI | Publisher | What it would give |
|---|---|---|---|---|
| 1 | Xu 2016, Clin Implant Dent Relat Res | 10.1111/cid.12259 | Wiley | BMSC seeding density, in vitro PDGF dose and fold changes, cell labelling. |
| 2 | Araújo 2010, Clin Oral Implants Res 21:445 | 10.1111/j.1600-0501.2009.01876.x | Wiley | β-TCP volume fraction at days 1-3 in a dog socket (in situ packing) and early tissue fractions |
| 3 | Araújo & Lindhe 2005, J Clin Periodontol 32:212 | 10.1111/j.1600-051X.2005.00642.x | Wiley | Buccal and lingual wall widths at three levels, dog P3/P4 |
| 4 | Couso-Queiruga 2021, Int J Periodontics Restorative Dent 41:141 | 10.11607/prd.4969 | Quintessence | Human socket orifice BL/MD and volume for every tooth type, including mandibular premolars |
| 5 | Delgado-Ruiz 2018, Clin Oral Implants Res 29:792 | 10.1111/clr.12942 | Wiley | New bone, residual graft and connective tissue by thirds versus compaction |
| 6 | Discepoli 2013, J Clin Periodontol 40:638 | 10.1111/jcpe.12074 | Wiley | Baseline buccal and lingual widths at three levels, beagle |
| 7 | Park 2014, J Craniofac Surg 25:1115 | 10.1097/SCS.0000000000000767 | Wolters Kluwer | Human mandibular premolar buccal and lingual bone at 3 and 5 mm below the CEJ |
| 8 | Young 2009, J Control Release 140:250 | 10.1016/j.jconrel.2009.06.030 | Elsevier | In vivo rhPDGF-BB retention curve over 0-72 h |
| 9 | Suba 2004, Int J Oral Maxillofac Implants 19:832 (PMID 15623058, no DOI) | — | Quintessence | Residual Cerasorb in dog sockets at 6/12/24 weeks |
| 10 | Temple 2016, Clin Oral Implants Res 27:1072 | 10.1111/clr.12688 | Wiley | Human mandibular premolar buccal plate at 1/3/5 mm |
| 11 | Vignoletti 2009 (II), J Clin Periodontol 36:688 | 10.1111/j.1600-051X.2009.01439.x | Wiley | P3 vs P4 distal socket dimensions |
| 12 | Fiedler 2002, J Cell Biochem 87:305 | 10.1002/jcb.10309 | Wiley | Dose at the peak chemotactic index |
| 13 | Ghanaati 2010, Acta Biomater 6:4476 | 10.1016/j.actbio.2010.07.006 | Elsevier | Physical data of five Cerasorb variants (cross-check of Barbeck Table 4) |
| 14 | Long 2005, Key Eng Mater 284-286:361 | 10.4028/www.scientific.net/KEM.284-286.361 | Trans Tech | Confined compression of granule beds (gap G2, bed stiffness) |
| 15 | Huja 2007, J Dent Res 86:237 | 10.1177/154405910708600308 | SAGE | Indentation modulus of dog alveolar bone |
| 16 | Fahimipour 2026, J Periodontol | 10.1002/jper.70157 | Wiley | rhPDGF-BB release from β-TCP in ng/mL, 1 h to 10 days |

Also worth retrying in a browser: the open Text S1 of [geris2010pcb] (10.1371/journal.pcbi.1000915.s002), which failed with HTTP 503 during this search.

---

## 9. Method and provenance notes

* **Databases:** PubMed (MCP tool and E-utilities), Europe PMC REST (search, fullTextXML), NCBI efetch, Crossref, OpenAlex, accessdata.fda.gov. Web search was used for leads until it hit its free-tier rate limit, then dropped. Its limit was not worked around.
* **Spot checks:** these numbers were re-read in the primary source during the merge:
  * [barbeck2021] Table 4, [brennan2014] survival, [nakajima2026] Table 1, [zhang2021atm] Table 2.
  * The FDA 510(k) porosity (K051443, K113282), the Cerasorb M crushing strength, dissolution and resorption time (K192597), and the GEM 21S particle and pore size and topical half-life (P040013 SSED and package insert).
* **[sun2018]:** the appendix tables were read from the table images the publisher serves openly on the article page.
* **Pending checks:** the Hong 2014, Xu 2016 and Daif 2013 numbers in `DESIGN.md` still need a check against the publisher versions.
* **Scope limits:**
  * Human socket widths come from Chinese extracted teeth and an Israeli CBCT sample, so their transfer to the Daif population is an assumption.
  * Dog bone data mix beagle, foxhound and mixed breeds.
  * PDGF and BMSC rates are fold changes from heterogeneous in vitro and rodent systems, so treat them as calibration starting points, not measurements.
