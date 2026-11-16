# Bridge biomechanics parameters for the 34-43 zirconia bridge: literature check

Prepared 2026-11-16 for the SilicoGraft dental finite-element model of a 7-unit zirconia bridge in the lower anterior jaw: abutments 34, 31, 41, 42, 43; pontics 33 and 32 over two healing extraction sockets (32 empty, 33 grafted). It answers nine questions about loads, duty cycle, PDL, materials, physiological limits, abutment adequacy, connectors, ovate pontics and clot stiffness. It builds on `SOCKET_PARAMS_2026-11-16.md` and `HUMAN_SOCKET_PARAMS_2026-11-16.md` and does not repeat them.

**Method.**
* The existing corpus was checked first. `15_Dental_Implant_BTCP/literature/corpus_review/PARAMETERS_EXTRACTED.tsv` holds almost no mechanics (3 `bone_mechanics` rows, all CT numbers). `parameters.csv` in this folder already has cortical/trabecular/granulation moduli and posterior chewing forces (Richter 1995, Morneburg 2002); these are reused, not repeated.
* New search: Histamin-Paper-Search on phoenix lease `77sz` (released), project `~/Histamin-Paper-Search/runs/bridge_2026-11-16/`. 18 PubMed, 6 Europe PMC and 12 OpenAlex queries plus one PMID list of classic papers gave 3,463 records; 108 candidates were picked by hand, full-text routes tried in open-access-first order. 18 open full texts came through the scanner.
* Camoufox (headed, lease display) for papers the scanner could not fetch: 6 more PDFs (J-STAGE x5, KoreaScience x1). Two Angle Orthodontist downloads returned the journal's front matter instead of the article (Hohmann 2007, Keilig/Angle 2011) and were rejected after an identity check (kept under `camoufox/rejected/` in the run folder). Wiley (even open-access `pdfdirect`), SAGE, Taylor & Francis, ScienceDirect ("Are you a robot" page) and ZORA (request-a-copy only) gave nothing. No logins, no Sci-Hub, no Parallel Search. PubMed metadata (abstracts, DOIs) came through the PubMed connector.
* Full texts: `15_Dental_Implant_BTCP/literature/fulltext/bridge_2026-11-16/` with `INDEX.tsv` (24 papers, 31 files).

**Labels.**
* "Full text": number read in the paper (page/table given).
* "Abstract": only the abstract was read.
* "Secondary": quoted by another paper that I read; the original was not read.
* "Unverified": a widely quoted value I could not trace to a read source in this session. Treat as provisional.
* DERIVED: computed here; formula given. ASSUMPTION: no source, my proposal.

---

## 0. Summary

| Quantity | Model default | Recommended | Range | Confidence | Main source |
|---|---|---|---|---|---|
| Incisal bite, functional (biting food), on the 31+41 pair | – | **50 N on the pair (25 N per tooth)** | 5-55 N | Medium | EMG estimate 29-54 N for incising foods (doi:10.1016/0003-9969(94)90105-8, abstract); bench 4.6-36 N (doi:10.1002/hed.70031, full text) |
| Incisal bite, maximum, on the incisor pair | – | **150 N on the pair (75 N per tooth)** | 100-240 N | Medium | Helkimo 1977: 176 N men, 108 N women (doi:10.3109/00016357709064128, abstract); Regalo 2008 ≈ 194 N (doi:10.1016/j.archoralbio.2007.10.003, abstract) |
| Incisal force direction (lower incisors) | – | On the labial incisal third, **lingual-apical, 30° to the long axis** | 0-45° | Low-medium | FE practice 30° (Amid 2018) and 45° (Agrawal 2021); incisal bite direction tilts with jaw opening (Paphangkorakit & Osborn 1997, abstract) |
| Canine guidance force on 43 (and pontic 33) | – | **25 N functional glide; 100 N parafunctional/clench** | 15-50 N; 100-200 N | **Low** | Relative force at lateral disclusion 2.5-3.8 % of maximum (Lee 2013, full text, Table II); FE convention 100 N at 15-30° (doi:10.15171/joddd.2019.014, full text) |
| Canine guidance direction | – | Labial face of the lower canine, incisal third, **lingual-apical, 45° to the long axis** | 30-60° | Low | DERIVED from guidance geometry; FE practice 15-45° |
| Vertical chewing force on 34 | – | **120 N axial** (buccal cusp) | 90-150 N | Medium | Morneburg 2002: 129 N mean per posterior abutment, max 314 N (abstract) |
| Maximum force on 34 | – | **300 N** | 250-400 N | Medium-low | Morneburg 2002 max 314 N; Fontijn: 250-400 N posterior (secondary, Takuma 2013) |
| Clench in intercuspal position, share per lower tooth | – | central 4.1 %, lateral 4.0 %, canine 4.8 %, PM1 9.0 % of total | – | Low | Hejne 2003 T-Scan (PMID 15552853, abstract) |
| Chewing pace | – | **1.6 Hz**, episodes 13 s | 0.9-2.2 Hz; 2.7-35 s | Medium | Po 2011 (doi:10.1177/0022034511416669, abstract) |
| Chewing cycles per day | – | **1,500 /day** (≈ 750 per side) | 700-3,000 | **Low** | No primary daily count obtained; 250,000 cycles/year (≈ 700/day) is the chewing-simulator convention (unverified) |
| Incisal bites, lateral excursions per day | – | ASSUMPTION: 100 incisal bites/day; one low-force canine glide per working-side chewing cycle | – | Very low | No data found |
| PDL E for bite-load cases | 0.68 MPa | **50 MPa, ν 0.45** as baseline; run 8 MPa and 0.68 MPa as sensitivity | 0.04-1750 MPa | Medium (that the choice matters), low (exact value) | Rees & Jacobsen 1997 fit 50 MPa (abstract); Fill 2011 Table 1 (full text) |
| Origin of "0.68 MPa / 0.45" | – | Hybrid of Tanne 1987 (0.69 MPa, **ν 0.49**) and the 68.9 MPa / 0.45 family (Weinstein 1980) | – | High | Fill 2011 Table 1 (full text) |
| PDL thickness, lower incisors/canines/premolars | 0.2-0.25 mm | **0.20 mm** uniform | 0.15-0.28 mm | Medium | Micro-CT 0.16-0.28 mm (Tayman 2020, abstract); 0.15-0.38 mm (Berkovitz, secondary); 0.2 mm in FE (Agrawal 2021) |
| Cortical bone | 13.7 GPa | **13.7 GPa, ν 0.3** (isotropic); orthotropic option E3 20-30 GPa along the arch | 10-30 GPa | Medium | Schwartz-Dabney & Dechow 2003 (abstract); parameters.csv |
| Trabecular bone | 1.37 GPa | **1.37 GPa as FE convention, but run 0.3 GPa** | 0.06-1.4 GPa | Low | Misch 1999: 25-240 MPa (abstract; also Lakatos 2014 full text); Lakatos 2014: 6.9-199.5 MPa |
| Dentin | 18.6 GPa | **18.6 GPa, ν 0.31** | 18-25 GPa | Medium-high | FE convention (Assaf 2021 Table 1); Kinney 2003 review: 20-25 GPa (abstract) |
| Zirconia (3Y-TZP) | 210 GPa, ν 0.3 | **210 GPa, ν 0.30** | 200-210; ν 0.30-0.35 | High | Assaf 2021 (200/0.31), Robati Anaraki 2019 (200/0.35) |
| Resin cement | – | **8 GPa, ν 0.30**, 50-100 µm | 6-12 GPa | Medium | Variolink II 8.3 GPa / 0.24; Panavia F2.0 12 GPa / 0.33 (Assaf 2021 Table 1) |
| Capillary / root-resorption threshold, sustained PDL pressure | 2-5 kPa | **4.7 kPa** (hydrostatic) | 2.5-4.7 kPa | Medium-high for orthodontic loads | Hohmann 2007 (abstract); Kuc 2024 (full text) |
| PDL stress under a normal bite in FE | – | 0.4-4 MPa von Mises for 100-240 N on one anterior tooth | up to 9 MPa | Medium | Amid 2018, Agrawal 2021 (full text); Wang 2018 (abstract) |
| Bone strain windows | – | Frost: < 50-100 µε disuse, ≈ 1,000-1,500 µε modelling threshold, ≈ 3,000 µε microdamage, ≈ 25,000 µε fracture | – | Low (numbers unverified) | Frost 2003 (abstract only); no human alveolar in vivo strain value obtained |
| Root surface area | – | 31/41 **154**, 32/42 **168**, 33/43 **268-276**, 34 **180-251 mm²** | – | Medium (Mowry), low (Jepsen numbers) | Mowry 2002 (abstract); Jepsen 1963 (unverified textbook values) |
| Ante ratio, whole bridge | – | **2.1-2.3** (passes); **0.77-0.91** for the 34-31 span alone (fails) | – | DERIVED | Section 6 |
| Connector, anterior | 9 mm² | **9 mm²**, never below 7 mm²; height ≥ 3 mm, triangular with a gingival base | 7-12 mm² | Medium | Murase 2014, Ogino 2016, Takuma 2013 (full text); long-span clinical series used ≈ 9 mm² |
| Connector, 34-33 (premolar to canine pontic) | 12 mm² | **12 mm²**; also consider 12 mm² at 33-32 and 32-31 if crown height allows | 9-16 mm² | Medium-low | Larsson 2007 (≥ 4 mm diameter ≈ 12.6 mm² for long spans, abstract) |
| Ovate pontic interference into healing socket soft tissue | – | **0 to 1 mm** contact ("tight but non-compressive"); 2-2.5 mm only at immediate provisionals, unverified | 0-2.5 mm | Low | Zitzmann 2002 (abstract); depth values unverified |
| Ridge change under immediate ovate pontics | – | Width −0.9 to −1.4 mm, height −0.9 to −1.6 mm at 3-6 months | – | Medium | Bakshi 2018, Song 2022, Kim 2025, Yang 2019 (abstracts) |
| Blood clot E (Young's) | – | **5 kPa** at hours, **25 kPa** at 2 weeks | 1-30 kPa | Medium-low (rabbit vein) | Mfoumou 2014 (doi:10.1016/j.thromres.2013.11.001, abstract) |
| Granulation tissue E | 0.2-2 MPa (parameters.csv) | **1 MPa** (indentation, rat callus) | 0.6-1.3 MPa | Medium-low | Leong & Morgan 2008 (abstract) |

**Shaky values** (low or very low confidence): canine guidance force and direction, daily duty cycle, PDL modulus choice for bite loads, trabecular modulus, ovate pontic interference depth, bone strain windows, Jepsen root areas.

---

## 1. Q1: Bite and contact forces

### 1.1 Data

| Study | Subjects / setup | Site | Value | Source |
|---|---|---|---|---|
| Helkimo et al. 1977, Acta Odontol Scand (doi:10.3109/00016357709064128) | 125 Skolt Lapps, 15-65 y, biting fork | Between incisors | **176 N men, 108 N women** (molars 382 / 216 N) | Abstract |
| Regalo et al. 2008, Arch Oral Biol (doi:10.1016/j.archoralbio.2007.10.003) | 82 young Brazilians, dynamometer | Central incisor region | **≈ 194 N** (molars 410-429 N) | Abstract |
| Ferrario et al. 2004, J Oral Rehabil (doi:10.1046/j.0305-182x.2003.01179.x) | 52 young adults, single-tooth strain gauge | Each tooth | Incisors **40-48 % of the maximum single-tooth force** (first molar highest); forces rise monotonically from incisors to M1/M2 | Abstract (tooth-by-tooth newtons are in the paywalled table) |
| Hejne 2003 (PMID 15552853) | 20 normal occlusions, T-Scan, intercuspal clench | Lower half arch | **central 4.1 %, lateral 4.0 %, canine 4.8 %, PM1 9.0 %**, PM2 15.1 %, M1 27.3 %, M2 29.7 % of the half-arch total | Abstract (Polish paper) |
| Hattori et al. 2009, J Biomech (doi:10.1016/j.jbiomech.2009.03.040) | 30 young adults, pressure film, forceful intercuspal clench | Whole arch | Resultant **247-2,092 N**; single contacts 1.2-218 N, anterior contacts small; resultant slightly inclined anteriorly from the normal to the mandibular occlusal plane | Abstract |
| Paphangkorakit & Osborn 1997, J Dent Res (doi:10.1177/00220345970760010601) | 10 subjects, 3-D transducer | Incisors | Maximum bite force plateaus at **14-28 mm** incisal opening; bite direction points forward relative to the mandibular occlusal plane at small openings and turns backward as the jaw opens | Abstract |
| Gay et al. 1994, Arch Oral Biol (doi:10.1016/0003-9969(94)90105-8) | 10 adults | Incisors | Incising foods needs an estimated **3.0-5.5 kg (29-54 N)**, independent of the subject's maximum (2.5-40 kg) | Abstract |
| Clark et al. 2025, Head Neck (doi:10.1002/hed.70031) | Bench force meter on a tooth replica, 79 foods | Incisor / molar | Incisor forces from **4.6 N** (IDDSI 5) up to ≈ 36 N; molars up to 45.4 N; quotes healthy incisor maximum 108-228 N | Full text, Results 3.2 |
| Gibbs et al. 1981, J Prosthet Dent (doi:10.1016/0022-3913(81)90455-8) | Sound transmission | Whole dentition | Force at occlusal contact in chewing **36.2 %**, swallowing **41 %** of maximum; "steep anterior guidance does not appear to expose the teeth to extreme lateral forces"; gliding contacts short and low | Abstract |
| Morneburg & Pröschel 2002, Int J Prosthodont (PMID 11887595) | 9 patients, strain-gauged implant abutments, 3-unit mandibular FPD, chewing winegum | Posterior | Total **220 N mean, 450 N max**; per abutment **91 N (anterior), 129 N (posterior), max 314 N** | Abstract |
| Lee 2013, J Dent Rehabil Appl Sci (doi:10.14368/jdras.2013.29.1.059) | 33 young Korean men, T-Scan III, lateral excursion | Working side at disclusion | Canine in contact on **87.9 %** of sides, pure canine guidance only **3 %**, group-function variants the rest; canine force ratio at disclusion 0.90-1.03; total relative force at lateral disclusion **2.5-3.8 % of maximum** (large SD) | Full text, Tables I-II |
| Kikuchi, Korioth & Hannam 1997, J Dent Res (doi:10.1177/00220345970760061201) | 4 subjects, strain-gauge splint | Canine, PM2, M1, M2 | Forces increase posteriorly; anterior (especially canine) forces rise **up to 10 times** when clenching on unilateral contacts | Abstract |
| Murase 2014 (doi:10.2209/tdcpublication.55.149) | – | Incisor region | Quotes "**311 N**, the average occlusal force in the incisor region" | Secondary (full text, p. 149) |
| Ogino 2016 (doi:10.2209/tdcpublication.2015-0034) | – | Upper anterior | Quotes maximal occlusal force in the upper anterior region **148-290 N** (Japanese) | Secondary (full text, p. 71) |
| Agrawal et al. 2021, JPBS, FE (doi:10.4103/jpbs.jpbs_785_20) | – | Upper central incisor | Uses **100 N** ("standard masticatory force") and **235.9 N** ("average maximum bite force on a central incisor") at 45° on the lingual surface | Full text, Methods |

### 1.2 Forces used in FE studies of anterior bridges and teeth

| Study | Structure | Load |
|---|---|---|
| Amid et al. 2018, JAPID (doi:10.15171/japid.2018.007) | 6 mandibular anterior teeth, 7 mm bone loss, splinted vs not | **100 and 200 N at 0° and 30°** |
| Agrawal et al. 2021, JPBS (doi:10.4103/jpbs.jpbs_785_20) | Upper central incisor | **100 N and 235.9 N at 45°** |
| Wang, Sun & Yu 2018, Chin J Stomatol (doi:10.3760/cma.j.issn.1002-0098.2018.07.004) | Incisors to molars | **Half of the maximum occlusal force at 45°** | 
| Robati Anaraki 2019 (doi:10.15171/joddd.2019.014) | 3-unit zirconia FPD 13-15 (implants) | Canine guidance: **100 N on the canine at 15° and 30°**; centric/group function: **100 N canine + 200 N on each premolar**, axial (Table 2) |
| Ogino 2016 | 3-unit upper anterior zirconia frameworks (fracture test) | Load at **135° to the abutment axis** (45° off-axis), overjet 2.75 mm |
| Murase 2014 | 3-unit framework replacing a lower central incisor | Vertical load on the pontic centre |

### 1.3 Recommended load cases for the 34-43 bridge

| Case | Where | Functional | Maximum / parafunction | Direction |
|---|---|---|---|---|
| L1 incisal bite | Incisal edges of 31 and 41 (and 42, 32p if in contact) | 50 N on the pair | 150 N on the pair | Labial incisal third, lingual-apical, 30° to the long axis (0° and 45° as sensitivity) |
| L2 left canine guidance | Labial face of pontic 33, incisal third | 25 N | 100 N | Lingual-apical, 45° to the 33 axis |
| L3 right canine guidance | Labial face of 43, incisal third | 25 N | 100 N | Lingual-apical, 45° |
| L4 premolar chewing | Buccal cusp of 34 | 120 N | 300 N | Axial (0-15°) |
| L5 intercuspal clench | All units | Total arch force × Hejne shares (lower central 4.1 %, lateral 4.0 %, canine 4.8 %, PM1 9.0 %) | Same with a 600-1,000 N bilateral total | Axial, slightly anterior |

Notes:
* "Per pair": a biting fork between the incisors (Helkimo, Regalo) measures the force of both upper central incisors on the lower incisors, so the maximum belongs to the pair, not to one tooth. Waltimo & Könönen 1994 (doi:10.1111/j.1600-0722.1994.tb01486.x, abstract) found a single tooth produces markedly less force than the whole front segment.
* Direction (DERIVED): during incision the upper incisors meet the lower labial incisal third. With the forward-pointing bite vector at small openings (Paphangkorakit & Osborn 1997), the force on the lower incisor points lingually and apically. 30° is the middle of what FE studies use (0-45°).
* In canine guidance the lower canine's labial face slides along the upper canine's palatal face, so the upper canine pushes the lower canine lingually and apically. The guidance slope sets the angle; 45° is an assumption.
* Pontic 33 carries the left canine guidance. That load reaches 34 and 31 through two pontics. L2 at 100 N is probably the worst case for the 34-33 and 32-31 connectors and for abutment 34.
* Canine force is the weakest number here. Gibbs 1981 and the T-Scan data say that excursive glides carry little force. Clenching on unilateral contacts raises canine force up to tenfold (Kikuchi 1997). I found no absolute in vivo newtons for a lower canine.

---

## 2. Q2: Daily duty cycle

| Quantity | Value | Source | Label |
|---|---|---|---|
| Chewing frequency | 1.57 Hz mean (5th-95th percentile 0.94-2.17 Hz) | Po et al. 2011 (doi:10.1177/0022034511416669) | Abstract (full text SAGE, restricted) |
| Chewing episode length | 13.0 s mean (2.7-34.9 s) | Po 2011 | Abstract |
| Chewing-simulator equivalence | 250,000 cycles ≈ 1 year; 1.2 million cycles ≈ 5 years | DeLong & Douglas 1983 (doi:10.1177/00220345830620010801) and later chewing-simulator papers | Unverified (the DeLong abstract does not give it) |
| Total tooth contact time in chewing and swallowing | ≈ 17.5 min / 24 h | Graf 1969, Dent Clin North Am 13:659 (PMID 5256151) | Unverified (no abstract) |
| Cycles used in a remodelling model | 112 cycles/day at 100 N | Irandoust 2020 (parameters.csv) | Secondary |

**Recommendation.** 1,500 chewing cycles per day (range 700-3,000), split between sides, at 1.6 Hz; about 750 loaded cycles per side per day. With L4 at 120 N on 34 for the left-side cycles. For bone adaptation the count matters little once it exceeds a few dozen cycles per day (Rubin & Lanyon 1984, unverified, not searched). Incisal bites: no data; ASSUMPTION 100 per day. Canine glides: if the patient has canine guidance, each working-side chewing stroke can end with a low-force glide (L2/L3 at 25 N); clench and grinding events at 100 N are unknown in number.

Confidence: low. No paper gave a measured daily chewing count or chewing time per day in modern adults.

---

## 3. Q3: Periodontal ligament

### 3.1 Elastic modulus

| Source | E (MPa) | ν | Method | Label |
|---|---|---|---|---|
| Fill et al. 2011, review (doi:10.4061/2011/312980), Table 1 | **0.01-1,750** | 0.28-0.49 | Collected values | Full text |
| Weinstein 1980; Wider 1976; Ko 1992; Cook 1982 | **68.9** | **0.45** | 2D/3D FE, lower premolar, incisor, molar | Secondary (Fill Table 1) |
| Tanne, Sakuda & Burstone 1987 (doi:10.1016/0889-5406(87)90232-0) | **0.69** | **0.49** | 3D FE, lower premolar | Secondary (Fill Table 1); Tanne 1998: 0.667 / 0.49 |
| Rees & Jacobsen 1997 (doi:10.1016/s0142-9612(97)00021-5) | **50** | 0.49 | 2D FE fitted to measured displacement of a lower first premolar | Abstract (+ Fill Table 1) |
| Poppe, Bourauel & Jäger 2002 (doi:10.1007/s00056-002-0067-8) | Bilinear **E1 0.05, E2 0.28**, switch at 7.5 % strain | 0.30 | Human autopsy jaws, single-rooted teeth, specimen-specific FE | Abstract |
| Angle Orthod 2011 (doi:10.2319/060710-311.1) | Bilinear **E1 0.04, E2 0.16**, switch at 7.3 % | – | Human maxillary central incisors, ESPI + FE | Abstract (the downloaded PDF was the wrong document) |
| Borák et al. 2011 (doi:10.4012/dmj.2010-170) | Bilinear **E1 0.05, E2 8.0**, switch at 7.5 % | – | Mandible FE fitted to in vivo premolar movement | Abstract (PDF obtained) |
| Assaf et al. 2021, Polymers (doi:10.3390/polym13223863) | 69 (0.069 GPa) | 0.45 | FE convention | Full text, Table 1 |
| Mehari Abraha 2019 (doi:10.3389/fbioe.2019.00269) | 0.07-1,750 tested | – | Macaque mandible FE: PDL modulus has little effect on strains away from the alveoli | Full text |

**Where 0.68 MPa / 0.45 comes from.** No primary paper in Fill's table gives that pair. The two families are 0.69 MPa with ν 0.49 (Tanne 1987, orthodontic) and 68.9 MPa with ν 0.45 (Weinstein 1980 and later prosthodontic FE). "0.68 MPa / 0.45" mixes the two, or misplaces the decimal of 68.9 MPa by 100×.

**Does it matter here? (DERIVED.)** A simple shear estimate of axial tooth displacement, δ = F t / (G A) with G = E / (2(1 + ν)), F = 100 N, t = 0.2 mm, A = 154 mm² (lower central incisor), gives 554 µm for E = 0.68 MPa, 47 µm for 8 MPa, 7.5 µm for 50 MPa and 5.5 µm for 68.9 MPa. Real teeth move a few tens of µm under bite loads, so 0.68 MPa is far too soft for 50-300 N. The estimate ignores the near-incompressibility of a confined PDL, which stiffens it, so treat the numbers as an order of magnitude. In this bridge the PDL stiffness sets how load is shared between the five abutments and whatever the ovate pontics touch. With a very soft PDL the pontics would press much harder on the sockets.

**Recommendation.** Baseline linear E = 50 MPa, ν = 0.45 for the bite-load cases (between the Rees & Jacobsen fit and the 68.9 MPa convention). Sensitivity runs at 8 MPa (Borák E2) and 0.68 MPa (lower bound, worst case for pontic-tissue load). If the solver allows, a bilinear PDL (0.05 MPa up to 7.5 % strain, then 8 MPa) is closer to the measured behaviour. Confidence: medium that the choice matters, low for the exact value.

### 3.2 Thickness

| Source | Value | Label |
|---|---|---|
| Tayman et al. 2020, Aust Endod J (doi:10.1111/aej.12416) | PDL space **0.16-0.28 mm** (micro-CT, 36 premolars and 59 molars, dry mandibles) | Abstract |
| Berkovitz 1990, quoted by Mehari Abraha 2019 | **0.15-0.38 mm**, non-uniform | Secondary |
| Coolidge 1937, JADA (doi:10.14219/jada.archive.1937.0229) | Commonly quoted means ≈ 0.21 mm (age 11-16), 0.18 mm (32-50), 0.15 mm (51-67); narrowest mid-root | Unverified (paper not obtained) |
| Agrawal 2021 FE | 0.2 mm normal, 0.4 mm widened | Full text |

**Recommendation.** 0.20 mm uniform for 31, 41, 42, 43 and 34 (range 0.15-0.25 mm). No tooth-specific value for lower incisors was found. In a periodontally reduced abutment, a widened PDL (0.3-0.4 mm) is a reasonable variant.

---

## 4. Q4: Bone, dentin, zirconia, cement

| Material | Recommended | Range / notes | Source |
|---|---|---|---|
| Cortical bone, anterior mandible | **13.7 GPa, ν 0.3** | Orthotropic: E3 20-30 GPa along the cortex, 50-100 % stiffer than E1/E2; cortex 3.7 mm thick anteriorly, 1.4 mm posteriorly | Schwartz-Dabney & Dechow 2003 (doi:10.1002/ajpa.10121, abstract); parameters.csv |
| Trabecular bone | **1.37 GPa (FE convention) + 0.3 GPa sensitivity** | Measured apparent moduli: 24.9-240 MPa (mean 96 MPa) with cortical plates, 3.5-125.6 MPa (mean 56 MPa) without (Misch 1999, elderly, includes anterior sections); 6.9-199.5 MPa (Lakatos 2014); 114-907 MPa directional (O'Mahony 2000, parameters.csv) | Misch 1999 (doi:10.1016/s0278-2391(99)90437-8, abstract; numbers confirmed in Lakatos 2014 full text); Lakatos 2014 (doi:10.1155/2014/470539, full text) |
| Dentin | **18.6 GPa, ν 0.31** | Kinney 2003 review: Young's modulus 20-25 GPa, shear 7-10 GPa | Assaf 2021 Table 1 (full text); Kinney 2003 (doi:10.1177/154411130301400103, abstract seen on the publisher page) |
| Enamel (if modelled) | 84.1 GPa, ν 0.33 | – | Assaf 2021 Table 1 |
| Zirconia 3Y-TZP | **210 GPa, ν 0.30** | 200 GPa with ν 0.31 or 0.35 in FE papers | Assaf 2021; Robati Anaraki 2019 Table 1 |
| Resin cement | **8 GPa, ν 0.30**, film 50-100 µm | Variolink II 8.3 GPa / 0.24; Panavia F2.0 12 GPa / 0.33 | Assaf 2021 Table 1 |

Comment on trabecular bone: 1.37 GPa (cortical / 10) is a modelling convention, not a measurement. Measured apparent moduli of mandibular cancellous bone are 5-25 times lower. In the anterior mandible the alveolar process around the roots is mostly cortical, so the effect on PDL and crestal bone results is probably modest, but it should be tested. Confidence: low.

---

## 5. Q5: Physiological ranges to judge abutments

### 5.1 PDL pressure

| Quantity | Value | Source |
|---|---|---|
| Hydrostatic pressure linked to root resorption | **> 4.7 kPa (0.0047 MPa)**, described as typical human capillary blood pressure in the PDL; resorption lacunae matched these regions | Hohmann et al. 2007 (doi:10.2319/060806-234, abstract); Hohmann 2009 (doi:10.1016/j.cmpb.2008.09.004, abstract): with 0.5 N intrusion the apical third already exceeds it |
| Orthodontic "optimal" range | Optimal en-masse retraction (180-200 g per side) gives **0.37-2.5 kPa**, about half of 4.7 kPa; 600-650 g exceeds it | Kuc et al. 2024, Materials (doi:10.3390/ma17071661, full text) |
| Evidence for an optimal force | None conclusive | Ren et al. 2003 systematic review (doi:10.1043/0003-3219(2003)073<0086:OFMFOT>2.0.CO;2, abstract) |
| Hyalinization | Appears with excessive sustained pressure; no meta-analysis possible | von Böhl & Kuijpers-Jagtman 2009 (doi:10.1093/ejo/cjn080, abstract) |
| PDL von Mises under bite loads (FE) | Mandibular anteriors, 7 mm bone loss: **0.43-0.48 MPa** (100 N, 0°), **1.15-1.28 MPa** (100 N, 30°), **2.2-2.6 MPa** (200 N, 30°) | Amid 2018 Table 3 (full text) |
| | Upper central incisor: **1.68 MPa** (100 N, 45°), **3.97 MPa** (236 N); 6.97 MPa with reduced bone and widened PDL | Agrawal 2021 (full text) |
| | Half of maximum force at 45°: incisors **2.88**, canines **2.31**, premolars **8.67**, molars **7.53 MPa** | Wang 2018 (abstract) |
| Mean PDL stress, DERIVED | 100 N / 154 mm² root area ≈ **0.65 MPa** | – |

**How to use this (interpretation).** A normal bite puts 0.4-4 MPa into the PDL, about 100-1,000 times the 4.7 kPa capillary threshold, but only for 0.1-0.5 s per cycle. The 4.7 kPa threshold comes from sustained orthodontic loading over hours to weeks. It is the right yardstick for **sustained** loads only: a pontic pressing on tissue, a bridge seated with tension, a constant clench. For the cyclic bite cases I suggest comparing each abutment with the same tooth in an unrestored, healthy model under the same load (ASSUMPTION: flag an abutment if its peak PDL hydrostatic pressure exceeds the intact-tooth value by more than about 50 %). No published threshold for cyclic bite loads was found.

### 5.2 Bone strain

| Quantity | Value | Source | Label |
|---|---|---|---|
| Frost's mechanostat windows | Disuse below ≈ 50-100 µε; adapted up to ≈ 1,000-1,500 µε (modelling threshold); mild overload to ≈ 3,000 µε (microdamage threshold); fracture ≈ 25,000 µε | Frost 2003 (doi:10.1002/ar.a.10119) | Abstract only; numbers unverified |
| In vivo human bone strain | 24 studies, 7 sites including "dental alveolar"; tibia peak 9,096 µε | Al Nazer et al. 2012 (doi:10.1016/j.jbiomech.2011.08.004) | Abstract (alveolar values not in the abstract) |
| Primate alveolar bone | FE suggests unusually large strains in alveolar bone; in vivo gauges show masticatory strains in alveolar bone and in the corpus | Daegling & Hylander 1997 (doi:10.1006/jhev.1997.0164) | Abstract |
| PDL inclusion in FE | Changes strains by ≈ 200-300 µε away from the alveoli; locally much more | Mehari Abraha 2019 (full text) | Full text |

Confidence: low. Use the Frost windows as a rough guide. No measured human alveolar strain was obtained.

---

## 6. Q6: Abutment adequacy

### 6.1 Root surface area

| Tooth | Jepsen 1963 (unverified textbook values) | Mowry et al. 2002 (abstract) |
|---|---|---|
| 31, 41 (mand. central incisor) | 154 mm² | – |
| 32, 42 (mand. lateral incisor) | 168 mm² | – |
| 33, 43 (mand. canine) | 268 mm² | **275.9 mm²** |
| 34 (mand. first premolar) | 180 mm² | **251.5 mm²** |
| 35 (mand. second premolar) | 207 mm² | 271.8 mm² |

Jepsen 1963 (doi:10.3109/00016356309019777): Taylor & Francis page, full text not available. The Jepsen numbers above are the values reproduced in prosthodontic textbooks; I could not check them against the original. Mowry 2002 (doi:10.1902/jop.2002.73.10.1095): 150 extracted teeth, computerized image analysis; they note their values are larger than most earlier studies and that attachment area falls non-proportionally with bone loss.

### 6.2 Ante's law for this bridge (DERIVED)

* Whole bridge: abutments 34 + 31 + 41 + 42 + 43 = 180 + 154 + 154 + 168 + 268 = **924 mm²**; pontics 33 + 32 = 268 + 168 = **436 mm²**; ratio **2.1** (2.3 with Mowry's canine and PM1). Ante's law (abutment area ≥ area of replaced teeth) is met.
* The span between 34 and 31 alone: 334 mm² against 436 mm², ratio **0.77** (0.91 with Mowry). The left span depends on cross-arch splinting through 41-43.
* Pontic 33 lies on the arch curve, in front of the straight line from 34 to 31, so loads on it twist the bridge about that line. The model should show this torsion; it is the usual argument in prosthodontic texts for extra abutments when a canine is replaced (unverified, textbook).
* Both extraction sites border abutments: bone remodelling after extraction may lower the crest on the distal of 31 and the mesial of 34. The model's bone level at these two abutments should follow the socket-healing prediction.

### 6.3 Clinical evidence on Ante's law and reduced support

| Study | Finding | Label |
|---|---|---|
| Lulic et al. 2007, "Ante's (1926) law revisited", Clin Oral Implants Res (doi:10.1111/j.1600-0501.2007.01438.x) | 6 studies, 579 FDPs on **severely reduced but healthy** periodontal support: survival **96.4 % at 5 y, 92.9 % at 10 y**, comparable to FDPs in non-compromised dentitions | Abstract |
| Laurell et al. 1985, J Clin Periodontol (doi:10.1111/j.1600-051x.1985.tb01362.x) | Cross-arch bridges in 12 periodontally treated patients: Ante's index (abutment PDL area / replaced teeth area) **17-118 %**, abutment PDL area as % of the full dentition **10-44 %**, with functioning bridges | Abstract |
| Nyman, Lindhe & Lundgren 1975 (doi:10.1111/j.1600-051x.1975.tb01726.x); Nyman & Lindhe 1979 (doi:10.1902/jop.1979.50.4.163) | Stable cross-arch bridgework on minimal periodontal support and hypermobile abutments, given healthy periodontium and stable intercuspal occlusion | Abstract (1975); 1979 no abstract |
| Solá-Ruíz et al. 2015 and 12-year follow-up 2022, anterior zirconia FDPs, 3-6 units, n = 27 (doi:10.1016/j.prosdent.2014.12.015; doi:10.1016/j.prosdent.2020.09.046) | Success 88.8 % at 7 y; all veneer fractures in 6-unit FDPs; at 12 y chipping increased with span length | Abstracts |
| Schmitter et al. 2012, long-span zirconia FDPs, 4-7 units, 36-46 mm, connectors ≈ 9 mm², 11 of 30 including anterior teeth (doi:10.1111/j.1365-2842.2012.02311.x) | 5-y survival **82 %**; 2 framework fractures; length and location were risk factors | Abstract |

**Answer.** Ante's law is met for the bridge as a whole and fails for the 34-31 span alone. The clinical literature does not treat Ante's law as a limit: bridges on far less support survive when the periodontium is healthy and the occlusion is controlled. Lower central incisors are the weakest abutments (154 mm², thin labial plate 0.77-0.94 mm, see HUMAN_SOCKET_PARAMS). The real risks for a 7-unit anterior zirconia bridge are veneer chipping, decementation, caries and the abutments' periodontal status, more than framework fracture. Confidence: medium.

---

## 7. Q7: Zirconia connectors

| Study | Design | Result | Label |
|---|---|---|---|
| Murase 2014 (doi:10.2209/tdcpublication.55.149) | 3-unit 5Y-TZP framework (Aadva) replacing a **lower central incisor**; connector 9 / 7 / 5 mm², three shapes | Mean fracture load **2,416 / 1,772 / 1,120 N**; all far above 311 N; triangle with a wide base and equal height and width strongest; "9.0 mm² or greater has been reported to be desirable", hard to reach in the lower incisor region | Full text pp. 149-152 |
| Ogino 2016 (doi:10.2209/tdcpublication.2015-0034) | 3-unit upper anterior zirconia frameworks, load at 135° | **9.0 mm²: 1,152 ± 164 N; 7.0: 904 ± 93 N; 5.0: 558-618 N; 3.0: 324-373 N**; recommend > 5.0 mm², triangle with a gingival base; manufacturer (GC GN-1) recommends 9.0 mm² anteriorly | Full text, Table 1, pp. 68-71 |
| Takuma 2013 (doi:10.2209/tdcpublication.54.149) | 4-unit Y-TZP frameworks, all 3 connectors 9 or 7 mm² | **621 ± 63 N (9 mm²) vs 530 ± 51 N (7 mm²)**; fractures at the central or distal connector; quotes Lüthy: > 7.3 mm² | Full text, Table 2 |
| Onodera 2011 (doi:10.2209/tdcpublication.52.61) | 3-unit molar frameworks, 5 / 7 / 9 mm² | All 7 and 9 mm² frameworks > 880 N; 7 mm² judged clinically possible (posterior 3-unit) | Abstract (PDF obtained) |
| Larsson et al. 2007 (doi:10.1111/j.1365-2842.2007.01770.x) | 4-unit Y-TZP cores, 2 pontics, connector diameter 2.0-4.0 mm | Strength rose with each step; 2.0 and 2.5 mm broke in preload; **≥ 4.0 mm diameter (≈ 12.6 mm²) recommended for long spans or molars** | Abstract |
| Hajaj et al. 2025, JFB (doi:10.3390/jfb16040116) | Monolithic zirconia, 3-unit (12 mm²) vs 4-unit with 2 pontics (17 mm²) | **3,703 N vs 1,713 N**: the second pontic halved the fracture load despite larger connectors | Full text |
| Studart et al. 2007 (doi:10.1016/j.dental.2005.12.008) | Cyclic fatigue of 3Y-TZP in water | Subcritical crack growth at ≈ 50 % of K_IC; posterior zirconia bridges can last > 20 y if the connector diameter is designed for it (diameters in the paywalled text) | Abstract |
| Sax et al. 2011 (PMID 22141229) | 57 posterior 3-5-unit FDPs, 10 y | Framework survival **91.5 %** (3 fractures); chipping 32 %, 4.9× more likely in 4-5-unit than 3-unit FDPs | Abstract |
| Ordoñez Balladares et al. 2026, Dent J, systematic review (doi:10.3390/dj14080500) | 11 in vitro / FE studies | Larger cross-section helps but not linearly; span length strongly lowers resistance; no numeric guideline | Full text |

**Recommendation.** Keep 9 mm² for the anterior connectors (minimum 7 mm²), shaped as a triangle with a gingival base and at least 3 mm high in the loading direction. Keep 12 mm² at 34-33. Because 33 and 32 form a two-pontic span that also carries canine guidance, use 12 mm² at 33-32 and 32-31 too if the crown height allows, or test 9 vs 12 mm² there in the model. Static fracture loads of 9 mm² anterior frameworks (1,150-2,400 N) are far above incisal forces (≤ 300 N); fatigue in water, the second pontic and veneer chipping are the real limits. Confidence: medium for anterior 3-unit data, low for a 7-unit bridge (no test of that length found).

---

## 8. Q8: Ovate pontics over fresh or healing sockets

| Study | Design | Finding | Label |
|---|---|---|---|
| Zitzmann, Marinello & Berglundh 2002 (doi:10.1067/mpr.2002.128758) | 12 patients, ovate pontics (premolar/molar), **"tight but noncompressive contact"**, biopsies at 12 months | 3 sites mild clinical inflammation; thinner keratin layer (8 vs 22 µm), more inflammatory cells under the epithelium | Abstract |
| Orsini et al. 2006 (doi:10.1016/j.prosdent.2006.08.009) | 3 patients, provisional ovate pontics, biopsies at 2 weeks | Partial healing; ulcerations, deeper under acrylic than under ceramic | Abstract |
| Bakshi, Tarnow & Bittner 2018 (doi:10.11607/prd.3496) | Immediate ovate pontic in intact sockets, **no graft** | Bucco-lingual change **0.51 mm (1 mo), 0.93 mm (3 mo)**; incisoapical **0.68 / 1.64 mm**; compared with 3-5 mm width and 1-4 mm height loss reported for untreated ridges | Abstract |
| Song et al. 2022 (doi:10.11607/prd.5352) | Immediate ovate pontic + allograft ARP, 11 sites | 6 mo: height **−0.9 ± 0.6 mm**, width **−1.4 ± 0.6 mm**, volume −32 mm³; no difference from pontic alone (pilot) | Abstract |
| Kim et al. 2025 (doi:10.1111/jopr.14050) | Ovate pontic + ARP, sockets with / without buccal plate, 23 patients | 6 mo width −1.07 to −1.43 mm, height −0.98 to −1.19 mm in all groups | Abstract |
| Yang et al. 2019 (doi:10.3290/j.cjdr.a43112) | 11 maxillary incisors, ovate provisional | Bone loss at 1 / 3 / 5 mm below the crest **2.28 / 1.51 / 1.46 mm** at 6 mo; papilla recession 0.47-0.88 mm | Abstract |
| Atsuta et al. 2021, Materials (doi:10.3390/ma14143997) | Rat model: pontic base pressed on a fresh extraction wound | Pressure on the bleeding wound right after extraction led to an epithelial seal at the pontic base | Full text (rat) |
| Bouquot & LaMarche 1999 (doi:10.1016/s0022-3913(99)70242-8) | 38 chronic facial-pain patients with subpontic bone biopsies | ≈ 90 % ischemic osteonecrosis and/or osteomyelitis under pontics | Abstract (selected patients; shows the risk exists, not its frequency) |
| Spear 1999 (PMID 10218048); Dylina 1999 (doi:10.1016/s0022-3913(99)70146-0) | Technique papers | Commonly quoted: the immediate provisional ovate pontic extends **≈ 2-2.5 mm into the socket**, the final one **≈ 1-1.5 mm** below the facial gingival margin; blanching should fade within minutes | Unverified (abstracts give no numbers) |

**Tissue pressure (DERIVED, crude 1-D estimate).** Contact pressure p ≈ E · d / h for an interference d into a layer of thickness h. With a clot (E ≈ 5 kPa, Section 9), d = 1 mm and h = 5 mm, p ≈ 1 kPa, below the 4.7 kPa capillary threshold. With granulation tissue (E ≈ 1 MPa) the same interference gives ≈ 200 kPa, far above it. So an ovate pontic shapes the socket without ischemia only in the first days; once granulation tissue and epithelium form (1-3 weeks), the same interference compresses the tissue. Blanching after seating means the pressure is above capillary closure; clinicians accept it only if it fades within minutes.

**Recommendation.** Model the pontic-tissue contact with 0 mm interference as baseline ("tight but non-compressive"), 0.5 mm and 1 mm as sensitivity. Report the contact pressure on the socket tissue and compare it with 4.7 kPa as a sustained-load threshold. Clinical evidence (pilot studies, ≤ 23 patients) suggests immediate ovate pontics limit ridge loss to about 1-1.5 mm in width and height at 3-6 months, against 3-5 mm for untreated sockets. No study measured whether pontic pressure speeds or slows bone fill inside the socket. Confidence: low for depth and pressure, medium for ridge outcomes.

---

## 9. Q9: Blood clot and granulation tissue stiffness

| Tissue | Value | Source | Label |
|---|---|---|---|
| Venous blood clot, in vivo (rabbit jugular vein), shear-wave ultrasound | Young's modulus **1.0 ± 0.6 kPa** (10 min), **5.3 ± 1.6 kPa** (2 h), **25.0 ± 6.8 kPa** (14 days); ex vivo 6.2 and 29.0 kPa | Mfoumou et al. 2014 (doi:10.1016/j.thromres.2013.11.001) | Abstract |
| Whole blood clot, Hemodyne | Clot elastic modulus rises with fibrinogen; no threshold | Dempfle et al. 2008 (doi:10.1097/mbc.0b013e32830f1b68) | Abstract (no numbers) |
| Granulation tissue, rat fracture callus, nanoindentation | **0.61-1.27 MPa (median 0.99)**; chondroid 1.39-4.42 MPa; woven bone 27-1,010 MPa (median 132) | Leong & Morgan 2008 (doi:10.1016/j.actbio.2008.02.030) | Abstract |
| FE conventions for granulation tissue | 0.2-2 MPa, ν 0.17 | parameters.csv (Perier-Metz 2020, Kung 2020, Irandoust 2020) | Secondary |

**Recommendation.** Fresh clot (days 0-3): E ≈ 5 kPa (range 1-30 kPa), nearly incompressible (ν ≈ 0.45-0.49 if a solid element is needed). Granulation tissue (from about day 7): 1 MPa (0.2-2 MPa). The jump of more than two orders of magnitude between clot and granulation tissue matters for Q8. Confidence: medium-low (animal data, different sites and methods; indentation moduli of soft tissue run higher than bulk moduli).

---

## 10. Conflicts and caveats

* **PDL modulus spans five orders of magnitude.** Orthodontic FE (forces of a few newtons) uses 0.05-0.7 MPa; prosthodontic FE (bite forces) uses 50-70 MPa. Results such as load sharing between abutments and pontic contact pressure depend on this choice; PDL stresses under a force-controlled single-tooth load depend on it much less.
* **Thresholds from orthodontics are for sustained loads.** Bite loads exceed 4.7 kPa by two to three orders of magnitude in every FE study; this is normal function, not overload.
* **Canine force is assumed, not measured.** The T-Scan gives only relative forces; FE studies use 100 N by convention.
* **Incisal "maximum" depends on method.** A biting fork between incisors measures the pair; a single-tooth transducer gives less; clenching in the intercuspal position puts only about 4 % of the total on each lower incisor.
* **Bone moduli.** 1.37 GPa trabecular is a convention 5-25 times above measured apparent moduli; cortical bone is orthotropic.
* **Connector data are for 3- and 4-unit frameworks.** No fracture or fatigue test of a 7-unit anterior zirconia bridge was found. The 4-unit data show that a second pontic roughly halves fracture load (Hajaj 2025; Takuma 2013 vs Murase 2014).
* **Ovate-pontic studies are small** (3-23 patients), mostly maxillary, and none reports tissue pressure.
* **Root surface areas**: Jepsen's numbers are unverified; Mowry's are 10-40 % larger.

---

## 11. Papers not obtained

| DOI / ID | Paper | What it would add |
|---|---|---|
| 10.1046/j.0305-182x.2003.01179.x | Ferrario 2004, single-tooth bite forces | Maximum newtons for each tooth (incisor, canine, premolar), by sex |
| 10.1016/j.jbiomech.2009.03.040 | Hattori 2009 | Per-tooth bite force distribution and direction in clenching |
| 10.1177/0022034511416669 | Po 2011 | Episodes and chewing time per day (only 3 h per day recorded) |
| 10.14219/jada.archive.1937.0229 | Coolidge 1937 | PDL width by tooth and age |
| 10.3109/00016356309019777 | Jepsen 1963 | Original root surface areas |
| 10.1902/jop.2002.73.10.1095 | Mowry 2002 | Full RSA table with attachment loss |
| 10.1111/j.1600-051x.1985.tb01362.x | Laurell 1985 | Chewing forces vs PDL area in cross-arch bridges |
| 10.1111/j.1600-0501.2007.01438.x | Lulic 2007 | Details of FDPs on reduced support |
| 10.1016/j.dental.2005.12.008 | Studart 2007 | Connector diameters for a 20-year fatigue life |
| 10.1111/j.1365-2842.2007.01770.x | Larsson 2007 | Fracture loads by connector diameter (4-unit) |
| 10.1111/j.1365-2842.2012.02311.x | Schmitter 2012, long-span zirconia 5 y | Connector sizes and failures of anterior long spans |
| 10.2319/060806-234 | Hohmann 2007 | Derivation of the 4.7 kPa threshold (the download was the journal's front matter) |
| 10.2319/060710-311.1 | Angle Orthod 2011 PDL modulus | Bilinear PDL fit details (wrong document downloaded) |
| 10.1002/ar.a.10119 | Frost 2003 | Mechanostat numbers |
| 10.1016/j.jbiomech.2011.08.004 | Al Nazer 2012 | Measured human alveolar bone strains |
| 10.1006/jhev.1997.0164 | Daegling & Hylander 1997 | Primate alveolar strain magnitudes |
| 10.1067/mpr.2002.128758 | Zitzmann 2002 | How "non-compressive" contact was checked |
| 10.1016/s0022-3913(99)70146-0; PMID 10218048 | Dylina 1999; Spear 1999 | Ovate pontic depth into the socket |
| 10.11607/prd.3496; 10.11607/prd.5352 | Bakshi 2018; Song 2022 | Pontic depth and seating protocol |
| 10.1016/j.prosdent.2006.08.009 | Orsini 2006 | Histology of healing under ovate pontics |
| 10.1177/154411130301400103 | Kinney 2003 | Dentin elastic constants (free on SAGE, but the PDF did not download) |
| 10.1016/j.actbio.2008.02.030 | Leong & Morgan 2008 | Full granulation-tissue data (PMC author manuscript; abstract used) |
| 10.1016/j.thromres.2013.11.001 | Mfoumou 2014 | Clot stiffness time course |
| 10.1016/j.prosdent.2022.01.020 | Canine guidance FE, JPD 2022 | Canine load magnitudes (ScienceDirect robot check) |
| 10.1043/0003-3219(2004)074<0003:auobpa>2.0.co;2 | Frost 2004, Angle Orthod | Mechanostat for clinicians (DOI does not resolve) |

---

## 12. Files

* Full texts: `~/Projects/claude çalışma/15_Dental_Implant_BTCP/literature/fulltext/bridge_2026-11-16/` (`INDEX.tsv`: file, DOI, title, how obtained, decision).
* Scanner project: `~/Histamin-Paper-Search/runs/bridge_2026-11-16/` (queries, candidates, `decisions.tsv`, `CHECKPOINT.md` with notes, `camoufox/` with the fetch script, logs and rejected PDFs). The archive pulled from the lease matched its sha256 (41ec0735…c563) before the lease was released. `research_complete` is false: 10 OpenAlex/PubMed searches were capped and the 4,184 unscoped records were not reviewed.
