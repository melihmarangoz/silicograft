# Literature report: mechanobiological model of a β-TCP-grafted jumping gap around an immediate implant in the posterior mandible

BME303 group project. Prepared 2026-10-27. Base model: `mechanobio_bone_2` (Checa group; 3D lattice ABM at 100 µm + linear-elastic FE, Claes & Heigele rule).

**Scope (updated during the search):** immediate implant placed in a fresh extraction socket (ITI Type 1), with the jumping gap between implant and socket walls filled with β-TCP. Loading is swept over magnitude (50/100/200 N) and timing (immediate, early, conventional).

**Verification rules followed.** Every reference was retrieved by PMID (PubMed E-utilities) or DOI (Crossref), and every DOI in `references.bib` resolves in Crossref (three items, chou2012, richter1995 and morneburg2002, have no registered DOI and carry their PMID instead). Numbers come from the abstract unless the entry says "full text checked". "Full text not checked" means the paper is paywalled or the site blocks automated access, and no workaround was tried. Values derived by me (fits, unit conversions) are labelled DERIVED. Values without a source are labelled ASSUMPTION.

Files: `LITERATURE_REPORT.md` (this file), `references.bib` (70 entries, keys used below in square brackets), `parameters.csv` (82 rows).

---

## 1. Executive summary

1. **No study was found that combines pure β-TCP in the jumping gap of an immediate implant with a histomorphometric time course.** The best fully specified analogue is a canine study with immediate implants in mandibular premolar sockets and a CaP-grafted (BCP 60/40) gap versus an empty gap [boix2004]. Its open full text gives every design value needed to copy it into the model.
2. **Human anchor with pure β-TCP in the posterior mandible:** an RCT of immediate implants in lower premolars, with gaps packed with multiporous β-TCP or left empty, and CT density at 3 and 6 months after loading [daif2013] (abstract only). Two open-access RCTs give the product names and clinical time courses: R.T.R β-TCP [elsheikh2023] and an injectable β-TCP putty [salem2026], both in the maxilla.
3. **Time-course anchors exist for the empty case:** canine socket healing [cardaropoli2003] and immediate implants in sockets without graft [mainetti2016; vignoletti2009]. For β-TCP kinetics in sockets and peri-implant gaps the anchors are [hong2014; araujo2010; choo2013; jensen2006].
4. **Consistent biological signal:** β-TCP granules *delay* early bone formation (2-4 weeks) compared with empty or autograft sites and catch up by about 8 weeks [hong2014; jensen2006; choo2013]. In a buccal dehiscence, a BCP-filled defect had much less new bone at 4 months than a clot-filled one [desantis2016]. The model should therefore **not** give β-TCP an osteoinductive boost in the baseline.
5. **Closest computational comparators:** Chou & Müftü's immediate-loading dental model [chou2013] and its open-access successor [irandoust2020]; the bone-chamber models validated against loaded-implant histology [geris2008jb; geris2010; khayyeri2009]; and the only direct immediate-versus-delayed simulation [babayi2023]. None of them represents a granular, resorbing graft in the gap.
6. **Loading:** chewing forces on single posterior implants are 120-150 N peak [richter1995], with a mean of 129 N and a maximum of 314 N per posterior abutment [morneburg2002]. A 50/100/200 N sweep is well justified. The ITI defines immediate loading as < 1 week, early as 1 week to 2 months and conventional as > 2 months [gallucci2018]. Tolerated micromotion is 50-150 µm [szmuklermoncler1998].
7. **Biggest parameter gaps:** the stiffness of an unconsolidated, blood-filled granule bed; the β-TCP resorption rate in a human jumping gap; whether β-TCP stimulates cells at all; cell seeding on socket walls and PDL remnants; and a way to turn model output into ISQ or CT density.
8. **Publication angle:** a 3D agent-based + FE model that resolves individual β-TCP granules and their resorption in an immediate-implant gap, maps the "safe" immediate-load window against load magnitude, gap width and graft properties, and is validated against canine immediate-implant histology. This has not been done. Target journals: *Biomech Model Mechanobiol*, *Front Bioeng Biotechnol*, *J Mech Behav Biomed Mater*.

---

## 2. Reference study for model design and validation

### 2.1 What was searched and what was found

PubMed and Europe PMC searches combined immediate implant / fresh extraction socket / jumping gap / buccal gap with β-TCP / Cerasorb / chronOS / R.T.R / BoneCeramic / BCP and with animal or histomorphometry terms. Two systematic reviews were mined for primary studies [ahamed2025; rocamillan2022]. Result:

* **Human, pure β-TCP, immediate implants:** [daif2013] (mandibular premolars), [samy2024] (mandibular molars), [elsheikh2023], [salem2026] (maxilla), [harel2013] (retrospective, Cerasorb). None has histology.
* **Animal, immediate implant in a socket with CaP in the gap, histomorphometry:** [boix2004] (BCP, dog mandible, open full text), [desantis2016] (BoneCeramic, dog, buccal dehiscence), [xu2016] (β-TCP ± PDGF/BMSC, dog mandible, mesial defects; full text not checked, so it is unclear whether a β-TCP-only arm exists), and [antunes2013] (BoneCeramic in drilled circumferential defects of healed ridges, not sockets).
* **Pure β-TCP with a quantitative time course, but no immediate implant in a socket:** [hong2014] (dog sockets, 2/4/8 weeks), [choo2013] (sheep ilium, dental implants in a 3.25 mm circumferential gap, 2/4 weeks), [jensen2006] (minipig mandible, 1/2/4/8 weeks).

### 2.2 Primary reference (design + histological validation): Boix et al. 2004 [boix2004]

Open full text (PMC4710785) checked.

| Item | Value in the study |
|---|---|
| Species, site | 3 beagle dogs (4-year-old females), mandibular P3 and P4, both sides |
| Socket and defect | Roots extracted after hemisection; implant placed in the **distal socket**; the inter-radicular septum resected to create a **mesial defect 6 mm high × 4 mm bucco-lingual × 5 mm mesio-distal**, adjacent to the implant |
| Implant | ITI (Straumann) solid cylindrical screw, **Ø3.3 × 8 mm**, TPS surface, 1.5 mm closure screw, flaps sutured (submerged) |
| Graft (test, left side) | Injectable bone substitute: **BCP 60/40 HA/β-TCP granules, 40-80 µm**, sintered at 1150 °C, mixed 50/50 by weight with 3% hydroxypropyl-methylcellulose gel, injected from the bottom of the defect up, in contact with the implant. No membrane. Laboratory-made injectable bone substitute (Nantes group); no commercial brand is stated |
| Control (right side) | Same defect left empty (blood clot) |
| Loading | None (submerged; soft diet until sutures were removed on day 21; closure screws exposed through healed mucosa at 1 month) |
| Healing time | Single endpoint: **day 91 (3 months)** |
| BIC, endosseous height | 54.54 ± 1.29% (BCP) vs 46.67 ± 1.08% (empty), mean ± SEM, p < 0.01 |
| BIC, 3 mm defect height | **48.86 ± 1.97% vs 37.60 ± 1.58%** |
| Bone density in the defect height, zones 0-0.5 / 0.5-1 / 1-1.5 mm from the implant | **58.68 / 60.1 / 61.71% (BCP) vs 44.5 / 48.46 / 48.21% (empty)** |
| Threads in contact | 98.44 ± 1.52% vs 92.78 ± 2.98% |
| Residual graft | **None visible** by light microscopy or SEM at 3 months |
| Other | Filled defects did not differ from the no-defect distal sites. Unfilled defects showed unmineralized areas and exposure of the first or second thread in 5 sites |

**Why this one:** it is the only immediate-implant, fresh-socket, CaP-in-the-gap study in the mandible whose methods are fully accessible. It also has an internal empty-gap control, which tests the graft effect independently of absolute calibration.
**Limits:** BCP rather than β-TCP; 40-80 µm granules (smaller than the 100 µm lattice, so the graft must be modelled as a homogeneous "graft-filled" region); one time point; unloaded; n = 3 dogs.

**Secondary canine reference** [desantis2016] (abstract only): 8 Labrador dogs; implants placed immediately in the distal alveolus of P3; standardized buccal dehiscence 8 mm deep, 4 mm wide coronally and 2 mm apically; Straumann BoneCeramic (HA 60% / β-TCP 40%) + collagen membrane vs clot + membrane; non-submerged; 4 months. New bone in the defect was 16.8 ± 11.3% (BCP) vs 65.7 ± 11.7% (clot), connective tissue 48.9 ± 29.5% vs 2.5 ± 3.3%, and BIC 37-42% in both groups. Useful as a "graft can slow healing" counter-case. Granule size and residual graft were not checked (paywalled).

### 2.3 Clinical anchor (human, pure β-TCP)

| Study | Site, design | Graft product | Gap, implant | Times | Quantitative outcomes |
|---|---|---|---|---|---|
| [daif2013] Daif 2013, J Oral Implantol 39:339 (abstract only) | **Lower premolars**, immediate implants, RCT 14 + 14 patients | "Pure-phase multiporous β-TCP" packed into the gaps; brand and granule size not checked | Not in abstract | 3 and 6 months **after loading** | CT density: β-TCP 1280 ± 320 → 1490 ± 358; empty 1150 ± 205 → 1245 ± 165 (units not stated, probably HU). Rise from 3 to 6 months significant only with β-TCP; groups differ at 6 months |
| [samy2024] Samy 2024, Alex Dent J (full text blocked by bot protection; values from the table in [ahamed2025]) | **Mandibular molars**, RCT 8 vs 8, MPM vs β-TCP | β-TCP, product not checked | Not checked | 0 and 6 months | β-TCP arm: ISQ 62.5 → 70; marginal bone loss 0.35 mm; density 735 (pre-op), 745 (post-op), 815 (6 months) |
| [elsheikh2023] Elsheikh 2023, BMC Oral Health (full text checked) | Maxillary incisors, canines, first premolars; RCT 3 × 12 implants (PRF / xenograft / β-TCP) | **R.T.R Syringe, β-TCP granules (Septodont)** + collagen membrane | Buccal gap > 2 mm; implants 2-3 mm beyond apex, 1-2 mm subcrestal; second stage at 6 months (**conventional loading**) | 0, 6, 18 months | β-TCP: ISQ 66.33 ± 2.57 → 73.83 ± 3.16 → 74.92 ± 1.38; buccal vertical bone loss 0.433 ± 0.12 (6 mo), 0.802 ± 0.10 mm (18 mo); buccal thickness loss 0.69 ± 0.32 mm (18 mo) |
| [salem2026] Salem 2026, BMC Oral Health (full text checked) | Maxillary anterior/premolar; RCT 8 + 8 patients, 39 implants | **Injectable β-TCP in a ready-to-use putty carrier (Bonegraft Biomaterials, Daegu)**; granule size not given | Gap 3.15 ± 0.94 mm (β-TCP) and 2.94 ± 0.85 mm (control), buccal at crest; tapered SLA implants; healing abutment at 3 months | 0, 3, 6 months | ISQ β-TCP 50.88 → 61.00 → 65.00; control 55.00 → 63.13 → 70.88 (n.s.); 6-month CBCT gray value 1224 ± 237 vs 931.9 ± 100.4 (arbitrary units; may include residual graft). Trial registered retrospectively |
| [harel2013] Harel 2013, J Oral Maxillofac Surg | Retrospective, 58 patients, 254 implants | **Cerasorb (Curasan)**, no membrane, gaps > 1.5 mm | — | up to 10 years | No bone loss in 72.1% of grafted immediate implants; no association of timing or graft with bone loss |

**Recommendation.** Copy the **design** from [boix2004] for a canine validation model. Use [daif2013] as the clinical target for the human posterior-mandible prediction model, because it matches site, graft type and comparison. Use [elsheikh2023] and [salem2026] for product details, gap widths and ISQ trends. A surrogate is needed to compare with CT density and ISQ (Section 8, gap G8).

### 2.4 Supporting time-course datasets (to constrain dynamics)

* Empty socket, dog mandibular P4 distal root [cardaropoli2003]: clot on days 1-3, provisional matrix on day 7, provisional matrix + woven bone on day 14, **mineralized bone 88% of the socket on day 30, 15% on day 180** (remodelled into marrow).
* Immediate implants in dog sockets, no graft, no function [mainetti2016]: new bone on the implant surface **4.1% at 1 week → 65.3% at 3 months**; old bone 21.9% → 2.0%; coronal level of osseointegration 2.6 → 1.2 mm. The 2-week and 1-month values are in the paywalled full text.
* Immediate implants in dog P3/P4 distal sockets [vignoletti2009]: coagulum → provisional matrix at 1 week; woven bone at 2 weeks; lamellar at 4-8 weeks; BIC at 4 h, 1, 2, 4 and 8 weeks (values in full text, not checked).
* Gap of 1-1.25 mm × 5 mm around SLA implants in dogs heals with bone and high BIC by 4 months, membrane or not [botticelli2003].
* β-TCP in fresh dog sockets [hong2014]: %new bone lowest with β-TCP at 2 and 4 weeks and rising by 8 weeks; residual β-TCP lower than HA and BCP at every time point; more multinucleated cells with β-TCP and BCP. Numbers in full text (not checked). **High-value full text to obtain.**
* β-TCP in dog sockets, days 1 to 4 weeks [araujo2010]: granule pores first fill with erythrocytes, then bone; some granules disintegrate; woven bone forms ridges around partly modified particles. Qualitative; supports surface-guided deposition.
* Dental implants in a 3.25 mm circumferential gap, sheep ilium [choo2013]: β-TCP alone gave the least bone fill at 2 and 4 weeks and degraded faster than β-TCP + rhPDGF-BB; the clot-only gap collapsed while β-TCP kept the space.
* Minipig mandibular defects [jensen2006]: β-TCP slower than autograft at 2 weeks, equal at 4 weeks, more bone than bovine bone at 8 weeks, and "**resorbed almost completely over 8 weeks**".
* Human socket biopsies [trombelli2008]: granulation tissue at 2-4 weeks, provisional matrix and woven bone between the early and intermediate (6-8 weeks) phases, osteoblasts peaking at 6-8 weeks, and wide variability between patients.
* Human immediate implants without graft [botticelli2004]: 4-month re-entry; marginal defects > 3 mm fell from 52 to 8; horizontal buccal bone resorption ≈ 56% and lingual ≈ 30%.

### 2.5 Extraction-socket geometry and cell sources

* **Mandibular first molar socket** [shi2024] (CBCT, n = 140): 8.74 ± 0.76 mm mesio-distal × 8.26 ± 0.72 mm bucco-lingual at the crest. Buccal bone 1.01 ± 0.40 mm (mesial root) and 1.14 ± 0.50 mm (distal root), below 1 mm at 51% of mesial roots. Lingual bone 2.71 and 3.09 mm. Crest to inferior alveolar nerve 15.68 ± 2.13 mm.
* **Premolar region cortex** [katranji2007] (cadavers): buccal cortical thickness 1.20 mm (premolar) and 1.98 mm (molar) in the dentate mandible; lingual 1.92 and 2.51 mm. **No verified CBCT source for mandibular premolar socket diameter was found** (gap G7).
* **Gap widths in practice:** > 2 mm in the β-TCP RCTs, mean ≈ 3 mm [salem2026; elsheikh2023]; grafting above 1.5 mm in [harel2013].
* **Cell sources in a fresh socket:**
  * PDL remnants attached to the bundle bone: Wnt-responsive PDL cells proliferate, migrate into the socket and form its bone [yuan2018] (mouse).
  * Socket walls and marrow spaces: gaps fill "from the inside of the defects" [botticelli2004]. Models start migration from the socket boundary [kung2020] or from surrounding marrow [irandoust2020].
  * Blood clot: a matrix with platelets but no osteoprogenitors at time zero; it is replaced by a provisional matrix within 7 days [cardaropoli2003].
  * Periosteum: plays a role only when a flap is raised (assumption; no socket-specific data found).

### 2.6 How to copy the design into the model

**A. Canine validation model ("Boix model").**
* Geometry: implant Ø3.3 × 8 mm in the distal socket plus the adjacent 6 × 4 × 5 mm mesial defect, in cortical and trabecular dog-mandible bone.
* Two runs: graft-filled vs clot-filled defect. Use the same seeding, no load (or a small sensitivity load) and 91 days.
* Compare BIC within the 3 mm defect height and bone area in the 0-0.5, 0.5-1 and 1-1.5 mm zones. The graft must be fully resorbed by day 91.
* Calibrate only the graft-specific parameters, i.e. resorption and surface guidance. Then check, without re-fitting, against the empty-gap time courses of [mainetti2016] and [cardaropoli2003].

**B. Human prediction model (posterior mandible).**
* Geometry: single-rooted premolar-type socket (matches [daif2013]) with an implant of about Ø4 × 10 mm. Buccal gap 3 mm at the crest tapering to 0 at 5 mm depth. Buccal wall 1.0-1.2 mm. Run the molar geometry of [shi2024] as a variant.
* Graft: explicit porous β-TCP granules, 0.5-1 mm (resolved on the 100 µm lattice).
* Sweep: load magnitude 50/100/200 N, axial and oblique, combined with immediate (day 1-3), early (day 42) and conventional (day 90) loading.
* Outputs: bone fraction in the gap, BIC within the gap height, fibrous fraction, residual graft and mean modulus in the gap at 3 and 6 months.

### 2.7 Full texts worth retrieving (institutional access, e.g. the `vetis-proxy` skill)

Priority order:
1. [hong2014]: %NB, %RB and %FCT time course of β-TCP in dog sockets.
2. [xu2016]: whether a β-TCP-only arm exists in canine immediate-implant mesial defects.
3. [daif2013]: brand, granule size, implant size, loading time, CT units.
4. [desantis2016]: granule size and residual graft.
5. [choo2013]: % new bone and residual β-TCP at 2/4 weeks.
6. [jensen2006]: residual β-TCP % per week.
7. [mainetti2016] and [vignoletti2009]: values at every time point.

---

## 3. Comparable computational models

★ = core comparator. "Code" refers to public code or full parameter tables in the paper. ABM = agent-based model; GF = growth factors; MSC = mesenchymal stem cells.

### 3.1 Peri-implant and dental models

| Model | Ref (DOI) | Geometry | Loading | Rule | Cells / GF | Outputs | Code / params | Relevance |
|---|---|---|---|---|---|---|---|---|
| ★ Chou & Müftü 2013 | J Biomech 46:871 (10.1016/j.jbiomech.2012.12.023) [chou2013] | 2D axisymmetric dental implant, healing callus, host bone | Immediate loading as micromotion; callus size and thread design varied | Prendergast (shear strain + fluid velocity), poroelastic | MSC diffusion | BIC length, bone volume in callus; soft-tissue layer along faces parallel to load; threads lower distortional stimulus; soft tissue under the apex | No public code; parameters partly reused in [li2020; kung2020] | Direct immediate-loading comparator |
| ★ Irandoust & Müftü 2020 | Sci Rep 10:4335 (10.1038/s41598-020-60735-7) [irandoust2020] | Axisymmetric, implant r = 1.75/1.95 mm, 9 mm long, 200 µm gap, cortical + cancellous bone | Micromotion 5/10/20 µm at 1 Hz during healing (30 days); 100 N, 112 cycles/day in remodelling (to 15,000 days) | Prendergast; then Carter remodelling | MSC diffusion D = 0.023 mm²/day; rule of mixtures with smoothing α = 0.2 | Tissue volume and tissue-implant contact. At 20 µm, bone TV 45.7% and cartilage TV 45.8% at day 30 | Full parameter table in OA paper; no code statement | Best documented dental comparator; code-to-code check |
| ★ Babayi 2023 | Arch Oral Biol 151:105702 (10.1016/j.archoralbio.2023.105702) [babayi2023] | 2D mandible with implant between two teeth | Immediate vs delayed loading | Distortional/dilatational strain based (abstract) | Callus filled with MSCs at t = 0 | Ossified callus at 8 weeks: **61% delayed vs 35% immediate**; osteoblast colonies at thread bases with immediate loading | Not checked (paywalled) | Only direct immediate-vs-delayed simulation |
| Martinello 2024 | Eur J Oral Sci 132:e12992 (10.1111/eos.12992) [martinello2024] | 3D implant in an alveolar socket | 100 N axial and oblique | Rule of mixtures by healing phase; principal strains vs Frost mechanostat (no differentiation algorithm) | Cell-type concentrations from in vivo data | Bone overload higher with immediate loading | Not checked | Socket geometry + immediate load, simple biology |
| Li 2020 | Int J Mol Sci 21:9205 (10.3390/ijms21239205) [li2020] | 2D axisymmetric, 8 thread / healing-chamber designs | 8 µm ≈ 100 N bite force in beagle | Prendergast (a = 0.0375, b = 3 µm/s) | MSC diffusion; D tuned to fill callus by day 35 | BIC 58-85%, bone area at day 35; reproduced [chou2013]; compared with beagle data of Marin et al. | OA, full parameters | Thread design; dog validation |
| Kung 2020 | Materials 13:2858 (10.3390/ma13122858) [kung2020] | 3D mandibular second-molar extraction socket (CT section extruded), implant + crown | 10.5 µm ≈ 100 N bite | Prendergast with 10-iteration averaging; 70 days healing then remodelling | MSC diffusion from the socket boundary, D = 8.85e-14 m²/s | Tissue fractions over time; compared with a conventional remodelling model that assumes a homogeneous 2 GPa "graft-filled" socket | OA, full parameters | Socket geometry; graft-as-homogeneous assumption |
| Kim 2026 | J Mech Behav Biomed Mater 181:107501 (10.1016/j.jmbbm.2026.107501) [kim2026] | 2D axisymmetric implant, cortical/cancellous bone, callus | Axial displacement varied | Modified mechano-regulation with BMD-dependent properties | Not stated in abstract | Validated against published week-8 BIC: 22.4% → 58.3% as BMD goes 0.35 → 0.65 g/cm³; gap size and displacement matter most at low BMD | Not checked | Recent; gap-size sensitivity |
| Chou 2012 | Int J Oral Maxillofac Implants 27:e39 (no DOI; PMID 22848899) [chou2012] | Implant in an extraction socket | Occlusal load | Bone remodelling (not healing) | — | Bone maintenance around a socket implant; source of the "bone graft 2 GPa" value | Not checked | Socket remodelling |
| Amor 2009 | Comput Methods Biomech Biomed Engin 12:459 (10.1080/10255840802687392) [amor2009] | Unloaded screw-shaped oral implant | None | Bioregulatory (Geris fracture model) | MSC migration, proliferation, differentiation driven by GFs | Bone density evolution; agreement only after **lower proliferation and higher osteoblast differentiation and osteogenic GF synthesis** than in fracture healing | Not checked | Shows that dental parameters differ from fracture parameters |
| Moreo 2009 | J Theor Biol 260:1 (10.1016/j.jtbi.2008.07.040) [moreo2009] | 2D FE around a dental implant | Not in abstract | Reaction-diffusion (platelets, GFs, osteogenic cells) | Explicit GFs | Contact vs distance osteogenesis depending on surface | Not checked | Surface/GF biology |
| Vanegas-Acosta 2011 | Comput Methods Programs Biomed 101:297 (10.1016/j.cmpb.2010.11.007) [vanegasacosta2011] | Bone-dental implant interface | Not in abstract | Mechanobiological, FE | Blood clotting, osteogenic cell migration, granulation tissue, osteoid | Spatio-temporal interface patterns | Not checked | Clot phase |
| Ambard & Swider 2006 | Eur J Mech A/Solids 25:927 (10.1016/j.euromechsol.2006.02.006) [ambard2006] | Bone-implant healing (periprosthetic gap) | — | Mechano-biological | Not checked | Not checked (title verified only) | Not checked | Lead confirmed to exist |
| Hernandez-Rodriguez & Lekszycki 2021 | Continuum Mech Thermodyn 35:991 (10.1007/s00161-021-01024-0) [hernandezrodriguez2021] | Mandible tissue / bone-substitute interface after tooth implant | — | Finite-memory continuum remodelling | — | Moving bone/substitute interface (title verified only) | Not checked | Only dental model found with a bone substitute |
| ★ Geris 2008 | J Biomech 41:145 (10.1016/j.jbiomech.2007.07.008) [geris2008jb] | Rabbit tibia bone chamber, cylindrical vs screw implant | Controlled implant loading | Several mechano-regulation rules compared | MSC diffusion | Screw: more BIC (matches histology); cartilage predicted but not seen | Not checked | Validation against loaded-implant histology |
| ★ Geris 2010 | Tissue Eng Part A 16:3353 (10.1089/ten.TEA.2010.0130) [geris2010] | Same bone chamber | Several axial displacement magnitudes | Bioregulatory angiogenesis + osteogenesis, fluid-flow modulated | Bioregulatory cell/GF model (details not checked) | Bone amount, radial/longitudinal distribution and BIC agree with experiments when loading acts on both angiogenesis and osteogenesis | Not checked | Loaded-implant validation incl. vascular effects (data: [duyck2006]) |
| ★ Khayyeri 2009 | J Orthop Res 27:1659 (10.1002/jor.20926) [khayyeri2009] | Rat bone chamber (mechanically controlled) | Controlled loads | Prendergast, **lattice ABM** (same family as ours) | Stochastic migration/proliferation | Load-dependent tissue type; between-animal variability not reproduced | Not checked | Same model family |
| Checa & Prendergast 2009 | Ann Biomed Eng 37:129 (10.1007/s10439-008-9594-9) [checa2009] | Bone/implant gap under shear | Shear loading | Lattice + mechano-regulated angiogenesis | Cells + capillaries | Higher loads slow vascularization and delay bone | Not checked | Origin of the lattice approach |
| Prendergast 1997 | J Biomech 30:539 (10.1016/s0021-9290(96)00140-6) [prendergast1997] | Implant interface tissue (details not re-checked) | Micromotion | Shear strain + fluid velocity (biphasic) | — | Tissue type at implant interfaces | — | Origin of the Prendergast rule |
| Nayak & Al-Nawas 2025 (review) | Int J Implant Dent 11:69 (10.1186/s40729-025-00659-x) [nayak2025] | — | — | — | — | Lists dental in silico healing and remodelling models | OA | Cross-check of the model landscape |

### 3.2 Graft, scaffold and calcium-phosphate models

| Model | Ref (DOI) | Geometry | Loading | Rule | Cells / GF / material | Outputs | Code / params | Relevance |
|---|---|---|---|---|---|---|---|---|
| ★ Perier-Metz 2022 | Acta Biomater 145:329 (10.1016/j.actbio.2022.04.008) [periermetz2022] | Sheep tibia 3 cm defect, empty or mPCL-TCP scaffold | As in the sheep experiment (full text not checked) | Claes & Heigele-type ABM (`mechanobio_bone_2`) | Scaffold surface guidance; stimulation of progenitor activity by scaffold material | Lower surface-to-volume ratio and, less strongly, lower scaffold modulus favour bone | Code on GitHub (user's base model) | Parent model and TCP effect |
| ★ Perier-Metz 2020 | Front Bioeng Biotechnol 8:585799 (10.3389/fbioe.2020.585799) [periermetz2020] | Sheep 4 cm defect, titanium scaffold ± graft | 1372 N axial + 17.1 Nm bending | Prendergast, 100 µm lattice ABM | Rates in Table 2; graft osteoconductive/osteoinductive/cell-source options; 15-day latency | X-ray-like and histology-like images; central-ROI bone 41% vs 35% experimental | OA, full parameter tables | Source of cell rates and tissue moduli |
| Byrne 2007 | Biomaterials 28:5544 (10.1016/j.biomaterials.2007.09.003) [byrne2007] | Regular 3D scaffold | Low and high load | Prendergast; random-walk cells | Scaffold porosity, modulus, **dissolution rate** | Low load: high porosity, high stiffness, medium dissolution best; high load: slower dissolution needed or the scaffold collapses | Not checked | Resorption vs load trade-off |
| Sandino 2010 | Biomaterials 31:2446 (10.1016/j.biomaterials.2009.11.063) [sandino2010] | Micro-CT CaP-glass scaffold, irregular pores | 0.5% and 1% compressive strain | Prendergast, lattice + angiogenesis | In vitro vs in vivo seeding | At 0.5% strain, 70% of pore volume had a bone-favourable stimulus; vessels blocked by walls | Not checked | Lattice in CaP; vascular limit |
| Carlier 2011 | Acta Biomater 7:3573 (10.1016/j.actbio.2011.06.021) [carlier2011] | Ectopic CaP scaffold + MSCs | None | Bioregulatory | **Ca²⁺ release** from CaP drives osteogenic activity | Bone amount matched experiments; predicted impairment with low seeding or decalcified scaffolds | Not checked | Mechanistic way to model β-TCP "bioactivity" |
| Bailón-Plaza & van der Meulen 2003 | J Biomech 36:1069 (10.1016/s0021-9290(03)00117-9) [bailonplaza2003] | Fracture callus (continuum) | Timed and graded loading | GF model + dilatational/deviatoric strain | GFs | **Moderate early loading beneficial; delayed or excessive loading harmful** | Not checked | Loading-timing argument |
| Geris 2008 (bioregulatory) | J Theor Biol 251:137 (10.1016/j.jtbi.2007.11.008) [geris2008jtb] | Fracture callus | None | Bioregulatory | Cells, ECM, GFs, angiogenesis (chemotaxis, haptotaxis) | Healing stages | Parameters in paper (not checked) | GF option |
| Moore 2014 | PLoS Comput Biol 10:e1003604 (10.1371/journal.pcbi.1003604) [moore2014] | Long-bone defect bounded by periosteum, stabilized by an intramedullary nail (species not re-checked) | Periosteal strain → BMP-2 | Mechanistic BMP-2 mediation | BMP-2 D = 0.013 cm²/day; cell motility 1.3e-3 cm²/day | Tissue genesis dynamics | OA, parameters | GF parameter source |
| Boccaccio 2008 | Med Biol Eng Comput 46:283 (10.1007/s11517-007-0247-1) [boccaccio2008] | 3D CT mandible, osteotomy callus | Mastication during a 15-day latency | Prendergast, poroelastic | — | Masticatory forces support osteogenesis in parts of the callus during latency | Not checked | Mandibular loading in early healing |
| Claes & Heigele 1999 | J Biomech 32:255 (10.1016/s0021-9290(98)00153-5) [claes1999] | Sheep fracture callus | — | **Intramembranous: \|ε\| < 5%, \|p\| < 0.15 MPa; endochondral: \|ε\| < 15%, p < −0.15 MPa** | — | Tissue type | — | The rule in our model |

---

## 4. Validation data table

NB = new bone, RG = residual graft, BIC = bone-to-implant contact, FT = full text.

| Study | Species, site | Defect / gap | Graft | Implant / loading | Time points | Quantitative data available | Access |
|---|---|---|---|---|---|---|---|
| ★ [boix2004] | Dog, mandibular P3/P4 sockets | Mesial defect 6 × 4 × 5 mm next to the implant | BCP 60/40, 40-80 µm in HPMC vs empty | ITI 3.3 × 8, submerged, unloaded | 3 mo | BIC (endosseous, defect height), bone density in 3 zones, threads; no RG | OA FT checked |
| [desantis2016] | Dog, P3 distal alveolus | Buccal dehiscence 8 × 4/2 mm | BoneCeramic + membrane vs clot + membrane | Immediate, non-submerged | 4 mo | NB 16.8 vs 65.7%; connective tissue 48.9 vs 2.5%; BIC 37-42%; vertical gain | Abstract |
| [xu2016] | Dog, mandible, immediate post-extraction implants | Mesial-implant defects | β-TCP ± rhPDGF-BB ± BMSCs | Immediate | Not checked | "Enhanced bone formation and osseointegration" | Abstract; FT needed |
| [antunes2013] | Dog, mandible (healed ridge) | Drilled circumferential defects 6 mm wide / 4 mm long | BoneCeramic, Bio-Oss, autograft, clot | Osseospeed; immediate vs staged | 8 wk | BIC, bone area, crest levels, RFA; clot best | Abstract |
| [choo2013] | Sheep ilium | 3.25 mm circumferential gap around dental implants | β-TCP, β-TCP + rhPDGF-BB, clot; membrane | Unloaded | 2, 4 wk | % new bone, % residual β-TCP (values in FT) | Abstract |
| ★ [hong2014] | Dog, P3 sockets (no implant) | Fresh socket | HA, BCP, **β-TCP**, empty | — | 2, 4, 8 wk | %NB, %RB, %FCT by zone; osteoclast counts | Abstract; FT needed |
| [araujo2010] | Dog, maxillary premolar distal sockets | Fresh socket | β-TCP | — | 1, 3 d; 1, 2, 4 wk | Tissue composition, TRAP/ALP/OPN | Abstract |
| [jensen2006] | Minipig mandibular angle | Standardized defects | Autograft, bovine bone, **β-TCP** | — | 1, 2, 4, 8 wk | NB, RG; β-TCP almost fully resorbed by 8 wk | Abstract |
| [wiltfang2002] | Minipig tibial head | 3.5-4.7 mL defects | α- and β-TCP | ITI 3.2 × 12 inserted into the ceramic | 4-86 wk | 95-97% resorbed at 86 wk; BIC < 25% at 46 wk | Abstract |
| ★ [mainetti2016] | Dog mandible P4 sockets | Immediate implant, no graft | — | Non-submerged, no function | 1, 2 wk; 1, 3 mo | NB on implant 4.1 → 65.3%; old bone 21.9 → 2.0% | Abstract |
| [vignoletti2009] | Dog P3/P4 distal sockets | Immediate implant, no graft | — | 2 surfaces | 4 h; 1, 2, 4, 8 wk | BIC, bone area (FT) | Abstract |
| [cardaropoli2003] | Dog mandibular P4 socket | Empty socket | — | — | 1, 3, 7, 14, 30, 60, 90, 120, 180 d | Tissue fractions; 88% bone at day 30 | Abstract |
| [botticelli2003] | Dog mandible | Gap 1-1.25 × 5 mm | None ± membrane | SLA | 4 mo | Defect fill, BIC | Abstract |
| [duyck2006] | Rabbit bone chamber | Chamber around implant | — | 0/30/60/90 µm, 800 cycles/day, 1 Hz, twice a week, 6 wk | 6 wk | Bone volume fraction, density, BIC vs micromotion | Abstract |
| ★ [daif2013] | Human lower premolars | Immediate-implant gaps | Multiporous β-TCP vs empty | Immediate placement; loading time not checked | 3, 6 mo after loading | CT density (Section 2.3) | Abstract |
| [samy2024] | Human mandibular molars | Immediate-implant gaps | β-TCP vs MPM | Not checked | 0, 6 mo | ISQ, MBL, density (secondary) | Blocked |
| ★ [elsheikh2023] | Human maxilla anterior | Buccal gap > 2 mm | R.T.R β-TCP + membrane | Conventional (6 mo) | 0, 6, 18 mo | ISQ, buccal/palatal bone loss, buccal thickness | OA FT checked |
| [salem2026] | Human maxilla anterior/premolar | Gap ≈ 3 mm | Injectable β-TCP putty | Conventional (3 mo) | 0, 3, 6 mo | ISQ, periapical gray value, CBCT gray value | OA FT checked |
| [harel2013] | Human | Gaps > 1.5 mm | Cerasorb | — | ≤ 10 yr | Crestal bone loss | Abstract |
| [botticelli2004] | Human | Marginal defects, no graft | — | 4 mo re-entry | 4 mo | Gap closure; buccal −56%, lingual −30% | Abstract |
| [trombelli2008] | Human sockets | Empty | — | — | 2-24 wk | Semi-quantitative tissue/cell phases | Abstract |
| [zerbo2004] | Human sinus | — | Cerasorb 1-2 mm | — | 6 mo | BV 17% (β-TCP) vs 41% (autograft) | Abstract |
| [knabe2008] | Human sinus | — | β-TCP 35% vs 65% porosity (+ 20% autograft) | — | 6 mo | NB and particle fraction; more degradation with 65% | Abstract |
| [horch2006] | Human jaw defects (152 pts) | — | Cerasorb | — | 4, 12, 52 wk | Radiological replacement ≈ 12 months | Abstract |

---

## 5. Parameter table (summary)

The full table with ranges and notes is in `parameters.csv`. Confidence: H = high, M = medium, L = low.

| Parameter | Value | Unit | Range | Source | Conf. |
|---|---|---|---|---|---|
| Implant diameter × length (human) | 4.0 × 10 | mm | 3.3-4.8 × 8-12 | ASSUMPTION; [irandoust2020; shi2024] | M |
| Jumping gap width, buccal at crest | 3.0 | mm | 1.5-4 | [salem2026; elsheikh2023; harel2013] | H |
| Gap depth | 5 | mm | 4-6 | [botticelli2003; boix2004] (dog); human ASSUMPTION | L-M |
| Molar socket MD × BL at crest | 8.74 × 8.26 | mm | SD 0.76 / 0.72 | [shi2024] | H |
| Buccal wall, mandibular first molar | 1.0-1.1 | mm | 0.6-1.6 | [shi2024] | H |
| Buccal / lingual cortex, dentate mandible PM | 1.20 / 1.92 | mm | M: 1.98 / 2.51 | [katranji2007] | M |
| Titanium E, ν | 110, 0.34 | GPa, – | 104-113.8 | [kung2020; periermetz2020] | H |
| Cortical bone E, ν | 13.7, 0.3 | GPa | 13.7-17 | [kung2020; irandoust2020; periermetz2020] | M-H |
| Trabecular bone E (apparent) | 1.0 | GPa | 0.06-2.0 | [misch1999; omahony2000; kung2020]; baseline ASSUMPTION | L |
| Granulation tissue / clot E, ν | 0.2, 0.167 | MPa | 0.2-2 | [periermetz2020; kung2020; irandoust2020] | M |
| Fibrous / cartilage / immature / mature bone / marrow E | 2 / 10 / 1000 / 17000 / 2 | MPa | mature 6000-17000 | [periermetz2020; kung2020] | M |
| β-TCP dense E | 21 | GPa | extrapolated | [metsger1999] | M |
| β-TCP at 50% porosity E | 1.6 | GPa | — | [metsger1999] | M |
| Porous granule E (65% porosity) | 0.74 | GPa | 0.3-1.6 | DERIVED from [metsger1999], porosity [knabe2008] | L |
| Granule bed effective E (day 0) | emergent | MPa | no source | GAP | — |
| Granule packing fraction | 0.5 | – | 0.4-0.64 | ASSUMPTION | L |
| Granule size (human model) | 500-1000 | µm | 40-2000 | ASSUMPTION; [zerbo2004] 1-2 mm; [boix2004] 40-80 µm | L |
| Granule porosity | 65 | % | 35-65 | [knabe2008] | H |
| β-TCP resorption half-life, human | 12 | weeks | 8-26 | DERIVED from [horch2006]; [zerbo2004; knabe2008] | L |
| β-TCP resorption half-life, small animal defect | 2.5 | weeks | 2-4 | DERIVED from [jensen2006]; [hong2014] | L |
| MSC migration | 30 | µm/h | — | [periermetz2020; appeddu1994] | M |
| Progenitor prolif. / apopt. / diff. | 0.6 / 0.05 / 0.3 | 1/day | diff. 0.3-0.5 | [periermetz2020] | M |
| Fibroblast / chondrocyte / osteoblast prolif.-apopt. | 0.55-0.05 / 0.2-0.1 / 0.3-0.16 | 1/day | — | [periermetz2020] | M |
| Initial seeding on socket walls and marrow | 30 | % of free positions | 10-50 | [periermetz2020]; socket use ASSUMPTION | L |
| Latency | 0 | days | 0-3 (clot phase) | [cardaropoli2003; vignoletti2009] | M |
| β-TCP stimulation multiplier | 1.0 | × | 1.0-1.67 | [hong2014; jensen2006; choo2013; periermetz2020; periermetz2022] | L |
| Claes & Heigele thresholds | 5% / 15%; ±0.15 MPa | – | — | [claes1999] | H |
| Occlusal force (sweep) | 100 | N | 50 / 100 / 200 | [richter1995; morneburg2002] | H |
| Oblique component | 20 N bucco-lingual with 100 N vertical | N | 0-30% | [omahony2001; martinello2024] | M |
| Micromotion threshold | 50-150 | µm | — | [szmuklermoncler1998] | M |
| Model micromotion for 100 N | 8-10.5 | µm | 5-20 | [li2020; kung2020; irandoust2020] | M |
| Immediate / early / conventional start | day 1-3 / 42 / 90 | day | ITI: < 7 / 7-60 / > 60 | [gallucci2018; morton2018] | H |
| "Immediate restoration" load factor | 30 | % | 20-50 | ASSUMPTION | L |
| BMP-2 diffusivity (optional) | 0.013 | cm²/day | — | [moore2014] | M |

---

## 6. Recommended baseline parameter set

Keep everything that `mechanobio_bone_2` already validated: lattice 100 µm, 1 iteration = 1 day, FE every 3 days, rule of mixtures, 10-day averaging and the Claes & Heigele rule. Change only what the dental case requires.

**Geometry (human baseline).**
* Posterior mandible segment with a premolar-type socket; buccal cortex 1.2 mm, lingual cortex 1.9 mm [katranji2007]; trabecular core.
* Implant Ø4.0 × 10 mm, threaded (pitch 0.8 mm, ASSUMPTION), placed at the crest to 1-2 mm subcrestal and engaging 2-4 mm of bone beyond the socket apex; both RCTs describe this placement [salem2026; elsheikh2023].
* Buccal gap 3 mm at the crest tapering to 0 at 5 mm depth; mesial, distal and lingual gaps ≈ 1-1.5 mm (molar data: [shi2024]). Buccal wall 1.0 mm.
* Variant: mandibular first molar socket 8.7 × 8.3 mm [shi2024].

**Materials.**
* Ti 110 GPa / 0.34; cortical bone 13.7 GPa / 0.3; trabecular bone 1 GPa / 0.3 (sensitivity 0.1-2 GPa).
* Clot 0.2 MPa / 0.167.
* Tissue moduli as in the base model.
* β-TCP granules: 0.74 GPa / 0.3 (65% porous), diameter 0.5-1.0 mm, packing 0.5, placed randomly in the gap with clot in between.

**Cells.**
* Progenitors seeded at 30% of free positions on the socket walls (bundle bone with PDL remnants) and in trabecular marrow spaces; none in the clot, the granules or on the implant.
* Rates as in [periermetz2020]. No latency.
* β-TCP effect: **surface-guided migration and deposition only (osteoconduction), stimulation multiplier 1.0**. Test 1.67 as an upper bound.

**Graft resorption.**
* Cell-mediated: a granule lattice point can be removed only when a neighbouring point holds tissue (or osteoblast-type cells).
* Rate calibrated to t½ ≈ 12 weeks for human runs and ≈ 2.5 weeks for the canine Boix model. Boix requires zero residual at day 91.

**Loading.**
* 50 / 100 / 200 N at the abutment, axial plus an oblique case (100 N + 20 N bucco-lingual).
* Start day: immediate = day 1 (sensitivity: day 3); early = day 42; conventional = day 90. "Immediate restoration" = 30% of the nominal load until day 90.
* Before loading starts, apply 0 N (submerged) or a small soft-tissue load, which is an assumption.

**Run plan.**
* Canine Boix model: graft vs empty, unloaded, 91 days (validation).
* Human: {no graft, β-TCP} × {3 loads} × {3 timings} × {axial, oblique}, 180 days.
* Sensitivity: gap width 1.5-4 mm, granule size, resorption rate, trabecular modulus, stimulation multiplier.

**Outputs.** Bone, fibrous and cartilage fractions in the gap over time; BIC within the gap height; residual graft %; mean E in the gap and peri-implant ring (candidate surrogate for ISQ and CT density); bone area in the 0-0.5 / 0.5-1 / 1-1.5 mm zones (as in Boix).

---

## 7. Loading: definitions and magnitudes used in clinical studies and models

* **Definitions (ITI)** [gallucci2018; morton2018]: immediate placement = same day as extraction (Type 1). Immediate loading = prosthesis in occlusion within 1 week. Immediate restoration = prosthesis out of occlusion within 1 week [morton2018]. Early loading = 1 week to 2 months. Conventional = > 2 months. Protocols are labelled Type 1A, 1B and 1C.
* **Clinical forces:** peak vertical chewing force on single molar/premolar implants 120-150 N; molar implants splinted to a premolar 60-120 N; clenching ≈ 50 N [richter1995]. Posterior abutments: mean 129 N, maximum 314 N; whole mandibular chewing centre: mean 220 N, maximum 450 N [morneburg2002]. A 50/100/200 N sweep spans clenching, typical chewing and a heavy chewer.
* **Model conventions:**
  * 100 N vertical + 20 N bucco-lingual in the posterior mandible [omahony2001].
  * 100 N axial and oblique for an immediate implant in a socket [martinello2024].
  * 100 N converted to an implant displacement of 10.5 µm (human molar socket [kung2020]) or 8 µm (beagle [li2020]).
  * Displacement-controlled 5/10/20 µm at 1 Hz [irandoust2020].
* **Micromotion thresholds:** tolerated micromotion lies between 50 and 150 µm [szmuklermoncler1998]. In rabbit bone chambers, 30-90 µm of controlled displacement did not stop bone formation, and bone density rose with displacement [duyck2006].
* **Important for our model:** the strain in the gap scales with micromotion divided by gap width. For a 2-3 mm grafted gap, 50-150 µm corresponds to an average strain of about 2-7%, which straddles the 5% intramembranous limit of [claes1999]. For the 200 µm gap of [irandoust2020], 20 µm is already 10%. The β-TCP granule bed may therefore help mainly as a mechanical stabilizer under immediate load, even though it slows early bone formation biologically ([hong2014; jensen2006]). That trade-off is the central testable hypothesis.

---

## 8. Gaps: where no source was found and we must assume

| # | Gap | What we assume now | How to close it |
|---|---|---|---|
| G1 | **No histomorphometric time course for pure β-TCP in an immediate-implant jumping gap** | Use Boix (BCP, 3 mo) + empty-socket time courses + β-TCP socket kinetics | Get FT of [xu2016], [hong2014], [daif2013]; ask an animal lab for data |
| G2 | Effective stiffness of an unconsolidated, blood-filled granule bed at day 0 | Explicit granules (0.74 GPa) in a clot matrix; report the emergent bed stiffness; test bonded vs softened interfaces | Bench test: confined compression of granules + blood or fibrin gel |
| G3 | β-TCP resorption rate in a human jumping gap | t½ ≈ 12 weeks, cell-mediated surface resorption; ranges from 8 weeks (minipig) to ~12 months (human radiology) | Calibrate on Boix (canine) and on residual-graft data from [hong2014] FT |
| G4 | Whether β-TCP stimulates progenitors (osteoinduction) in a socket | No stimulation; surface guidance only | Sensitivity 1.0-1.67; mechanistic Ca²⁺ option following [carlier2011] |
| G5 | Progenitor density on socket walls and PDL remnants; contribution of a raised periosteal flap | 30% of free positions on walls and marrow; periosteum only if a flap is raised | Sensitivity analysis; check against the [mainetti2016] early time points |
| G6 | Real load on an immediately placed single posterior implant in weeks 0-8 (soft diet, out-of-occlusion provisional) | 30% of nominal for "immediate restoration"; 100% for "immediate loading" | No measurement found; state as a scenario parameter |
| G7 | Human mandibular premolar socket dimensions | Idealized socket; molar values from [shi2024] | Measure on patient CBCT (the project has access) |
| G8 | Turning model output into ISQ or CT density (the clinical end points of [daif2013; salem2026; elsheikh2023]) | Mean E or bone + graft mineral fraction in the peri-implant ring as a surrogate; compare trends only | Use FE-predicted implant stiffness as an ISQ proxy; compare only relative differences between groups |
| G9 | Validity of Claes & Heigele thresholds (sheep fracture callus) for intramembranous healing in a jumping gap | Keep thresholds; run the Prendergast rule as a check | Compare predictions with Boix and Mainetti patterns |
| G10 | Buccal wall resorption (56% horizontal in [botticelli2004]) is a remodelling process not modelled by the ABM | Fixed walls; report buccal-wall strain only | Future: add a resorption zone on the buccal wall or couple a remodelling rule as in [irandoust2020; kung2020] |
| G11 | Dog cortical/trabecular properties and geometry for the Boix model | Use human values scaled to dog dimensions | Literature on beagle mandible properties (not searched) |
| G12 | Brand, granule size and implant size in [daif2013] and [samy2024] | Unknown | Full texts |

---

## 9. Publication angle

**What has been done.**
* Mechano-regulation of dental implant healing under immediate loading or micromotion, mostly 2D axisymmetric or with homogeneous continuum cells [chou2013; irandoust2020; li2020; kung2020; kim2026].
* An immediate-vs-delayed comparison in 2D [babayi2023] and a 3D socket model with rule-of-mixtures biology [martinello2024].
* Bone-chamber models validated against loaded-implant histology [geris2008jb; geris2010; khayyeri2009].
* CaP scaffold mechanobiology with dissolution and lattice cells [byrne2007; sandino2010] and the TCP-scaffold ABM that is our base [periermetz2022].
* In dental socket models, the bone graft is either ignored or treated as a homogeneous 2 GPa material [kung2020; chou2012]. The only dental model with a bone substitute found is a continuum interface model [hernandezrodriguez2021].

**What is new in our project.**
1. The first 3D agent-based + FE model of an **immediate implant in a fresh extraction socket** with a **granular, resorbing β-TCP graft** resolved at granule scale (≥ 0.5 mm granules on a 100 µm lattice).
2. A direct test of the **mechanical-stabilizer versus biological-delay trade-off** of the graft under immediate load. The result is a map of the "safe immediate-loading window" over load magnitude (50-200 N), timing (ITI Types 1A, 1B, 1C), gap width and graft properties (granule size, porosity, resorption rate).
3. **Validation against canine immediate-implant histology** with an internal graft-vs-empty contrast [boix2004], checks against empty-socket time courses [mainetti2016; cardaropoli2003] and β-TCP kinetics [hong2014; jensen2006], and **clinical trend checks** [daif2013; elsheikh2023; salem2026].
4. Transfer of a validated long-bone model (`mechanobio_bone_2`, [periermetz2022]) to a small, well-vascularized dental defect without the 15-day latency. This shows which biological assumptions must change, in the spirit of [amor2009].

**Target journals** (in order):
1. **Biomechanics and Modeling in Mechanobiology**: the natural home for the Checa-group model family and validation-type computational studies.
2. **Frontiers in Bioengineering and Biotechnology**: open access; published the base-model papers [periermetz2020].
3. **Journal of the Mechanical Behavior of Biomedical Materials**: publishes dental mechano-regulation studies [kim2026].

*Clinical Oral Implants Research* would fit only if the paper also includes new animal or clinical data.

---

## 10. Notes on method and limits of this report

* Databases: PubMed (E-utilities and the PubMed tool), Europe PMC REST (search, fullTextXML), NCBI efetch (PMC), Crossref REST, web search for leads. Open full texts read: [boix2004], [elsheikh2023], [salem2026], [irandoust2020], [periermetz2020], [li2020], [kung2020], [shi2024], [moore2014], [ahamed2025], [nayak2025]. Everything else is abstract-level.
* Leads from the brief that were confirmed to exist: Prendergast & Huiskes, Geris, Isaksson, Ambard & Swider, Vanegas-Acosta, Chou & Müftü, Boccaccio, Checa & Prendergast, Bailón-Plaza & van der Meulen, Moore, Carlier. [isaksson2008] and [checa2011] are the original sources of the cell rates; they are used here through the [periermetz2020] table. No specific Mukherjee/Gupta dental-implant healing model was found; their work found by the searches is acetabular or periprosthetic, so it was not included.
* The reference list (70 entries) is larger than the 25-45 target because the scope update added reference-study, socket-geometry and loading items. The ★ items (about 15) are the core set.
