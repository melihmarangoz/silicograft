# Dental implant + β-TCP: model design (draft, 2026-10-27)

Base model: `14_Mechanabio_CalculiX` (mechanobio_bone_2 agent-based lattice + CalculiX FE). It was validated on the sheep long-bone empty defect against Perier-Metz 2022.

The user chose the clinical scenario: an immediate implant in a fresh extraction socket, with the jumping gap filled with β-TCP. The graft must match a clinical study, and the loading is studied as a sweep over load magnitude.

## Data sources (full texts are not distributed in this repository)

| Study | Role | Key data |
|---|---|---|
| Hong et al. 2014, Clin Oral Implants Res, doi:10.1111/clr.12041 | Calibration | Dog P3 sockets, no implant. Cerasorb β-TCP, 500-1000 µm, packed to the crest. Results below |
| Xu et al. 2016, Clin Implant Dent Relat Res, doi:10.1111/cid.12259 | Validation | Dog mandible, immediate implants. Details below |
| Boix et al. 2004, J Periodontol, doi:10.1902/jop.2004.75.5.663 | Secondary validation | Same 6×4×5 mm mesial defect model. Graft: BCP 60/40, 40-80 µm, in an HPMC carrier. Ø3.3×8 mm ITI implant. At 3 months, BIC at defect height 48.9% grafted vs 37.6% empty |
| Daif 2013, J Oral Implantol 39:339, doi:10.1563/AAID-JOI-D-11-00079 | Human prediction target | Details below |
| Elsheikh 2023 (PMC10704731), Salem 2026 (PMC13591874) | Product and clinical context | Maxillary immediate implants, R.T.R β-TCP and injectable β-TCP |

**Hong 2014 results**, as % of socket volume (mean ± SD):

| | Week 2 | Week 4 | Week 8 |
|---|---|---|---|
| Empty socket, new bone (NB) | 26.0 ± 2.9 | 47.7 ± 3.6 | 62.0 ± 17.1 |
| β-TCP, new bone | 5.0 ± 3.0 | 11.1 ± 6.4 | 48.6 ± 5.9 |
| β-TCP, residual graft (RB) | 38.3 ± 2.4 | 25.8 ± 15.3 | 10.3 ± 4.1 |

Results by apical, middle and coronal zone are in its Fig. 8. Multinucleated cells (per section) in the β-TCP arm: 1049 at 2 weeks, 639 at 4 weeks, 409 at 8 weeks.

**Xu 2016 details:**
- Defect: mesial, 6 mm high × 4 mm bucco-lingual × 5 mm mesio-distal (the Boix model). Implant Ø3.75×10 mm.
- Graft: GEM 21S β-TCP, 250-1000 µm.
- Results at 12 weeks:

| Arm | BIC % | New bone area % |
|---|---|---|
| A: β-TCP | 31.95 ± 6.56 | 19.1 ± 6.6 |
| B: + rhPDGF-BB (0.3 mg/mL) | 46.3 ± 9.1 | 32.5 ± 6.1 |
| C: + BMSCs | 50.9 ± 6.7 | 35.7 ± 7.2 |
| D: B + C | 72.5 ± 11.0 | 48.7 ± 9.5 |

- Fluorochrome labels were given at 3, 6 and 9 weeks.

**Daif 2013 details:**
- Human RCT, 14 + 14 patients, mandibular premolars.
- Implants: PITT-EASY, Ø3.75-4 × 14-16 mm, extending 3 mm beyond the socket apex.
- Graft: Cerasorb M (Curasan), pure-phase multiporous β-TCP, 500-1000 µm, mixed with saline and packed into the gap. The coronal gap was wider than 2 mm.
- Loading was delayed: second stage at 3 months, crown after about 2 more weeks.
- Outcome: CT density (HU) in a 3 mm region around the implant, 20 points (D1-D5 on 4 walls), at 3 and 6 months after loading.

## Derived numbers
- **β-TCP resorption in dog sockets** (Hong): residual graft falls from 38.3% to 10.3% between week 2 and week 8. This gives k = ln(38.3/10.3)/42 d = 0.031 /day, a half-life of about 22 days. The initial packing fraction is about 0.5, which is consistent with 38% at day 14.
- **Granules** of 500-1000 µm span 5-10 lattice points at 100 µm. They can be modeled as explicit, randomly packed spheres (lattice code 12, as in the scaffold branch), and each one shrinks as it resorbs.

## Plan (proposed, awaiting user confirmation)
1. **Calibration (Hong):** a dog P3 socket without an implant.
   - Fit the empty-socket biology to the new-bone time course (26/48/62%). An open question is whether a latency period is needed in a small, well-vascularized defect.
   - Fit β-TCP to its new-bone and residual-graft time courses: resorption, early delay, surface guidance.
2. **Validation (Xu, then Boix):** run the dog mesial defect with an immediate implant and β-TCP, with no further fitting.
   - Compare BIC and new bone at 12 weeks.
   - Growth-factor arms: PDGF as higher MSC proliferation and migration; BMSC as an initial MSC seeding in the graft.
3. **Prediction (Daif):** a human lower-premolar socket with an immediate implant and Cerasorb M.
   - Sweep the load magnitude (for example 50/100/150/200 N).
   - Use delayed loading (as in Daif) and/or immediate loading, depending on the user's decision.

## Corpus review (2026-10-31)
All 1,073 downloaded full texts were screened, and 222 were read in full: `literature/corpus_review/CORPUS_REVIEW_REPORT.md`.

Findings that change this design (proposed, not yet confirmed by the user):
- **Validation output: a "virtual CBCT".** No study shares raw 3D data. No CBCT study separates β-TCP from new bone. The model should therefore report mineralized tissue (bone plus residual graft), measured the way the clinical papers measure it: buccal thickness at fixed depths, crest height, zone-wise volumes and a density proxy.
- **β-TCP resorption must be species-specific.**
  - In dog sockets the graft is nearly gone by 12 weeks; Hong gives a half-life of about 22 days.
  - In human sockets and sinuses 13–33% remains at 4–6 months.
  - Resorption also depends on granule size.
  - Over a year it is not a single exponential (sheep series, rbae041).
- **Candidate primary human target: Elsheikh 2023.** Pure β-TCP, CBCT at 0, 6 and 18 months. Secondary targets:
  - Daif 2013 (density)
  - jper.11381 (zone-wise buccal loss)
  - clr.70106 (gap width > 2 mm vs ≤ 2 mm)
  - cid.13060 (buccal crest over 1 year)
- **Granule bed solid fraction** is about 0.2 (bulk density 0.60–0.65 g/cm³ against a ceramic density of 3.1 g/cm³). This agrees with the estimate above.

## Open decisions (ask the user)
- Confirm the 3-stage plan.
- Include the growth-factor arms in validation?
- Loading protocol for the sweep: delayed, immediate, or both?
