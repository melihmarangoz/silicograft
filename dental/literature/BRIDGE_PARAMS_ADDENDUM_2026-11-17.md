# Addendum to BRIDGE_PARAMS_2026-11-16.md: full-text check

2026-11-17. Twenty-four of the 26 papers that the first round could not obtain arrived as full texts. They are local copies outside the repository (`15_Dental_Implant_BTCP/literature/fulltext/hermes_2026-11-17_bridge/`, with INDEX.tsv), checked by first-page title. Every model input marked "abstract", "secondary" or "unverified" in the first round was re-read in them. Page numbers are journal pages.

Still missing:
- Song 2022 (doi:10.11607/prd.5352);
- the 2022 J Prosthet Dent canine-guidance FE paper (doi:10.1016/j.prosdent.2022.01.020);
- Spear 1999 (PMID 10218048).

Verdicts:
- **confirmed:** the full text supports the value used;
- **changed:** the full text gives a different number or meaning;
- **not addressed:** these papers do not measure it;
- **MATERIAL:** the change alters a model input or a model scenario.

## Summary table

| Input | Value used | Full text | Verdict |
|---|---|---|---|
| Incisal bite, functional | 25 N per lower central incisor, 30° lingual-apical | None of the papers measures it; they report maximal clench only | Not addressed |
| Incisal bite, maximum | 75 N per tooth (150 N on the pair) | Ferrario 2004, Table 1 p.20, single maxillary teeth, vertical clench, age 19-29: central incisor **93.9 ± 38.2 N (women), 146.2 ± 44.4 N (men)**; lateral 95.8 / 139.3 N | **Changed, borderline (1.95×):** one incisor alone reaches about the 150 N given to the pair. Add a single-tooth case of 150 N |
| Canine guidance | 25 N glide; 100 N clench; 45° | No excursive force measured. Ferrario Table 1, canine maximal clench: **119.7 ± 42.6 N (women), 190.3 ± 79.4 N (men)**. Hattori 2009 Fig. 4 p.1536: anterior contacts during intercuspal clench median 14.5 N, all ≤ 80 N | Glide not addressed; clench upper bound **about 190 N** (1.2-1.9×) |
| First premolar | 120 N functional; 300 N maximum | Ferrario Table 1: **178.5 ± 77.2 N (women), 254.1 ± 72.2 N (men)**; functional not measured | 300 N **confirmed** (men's mean + 0.6 SD) |
| Share of clench force per lower tooth (Hejne) | central 4.1 %, lateral 4.0 %, canine 4.8 %, PM1 9.0 % of the half arch | Hattori p.1535: 72 of 784 contacts (9.2 %) in the incisor and canine region, typically 0-2 contacts per anterior tooth (median 0); about 35-42 N per subject on all six lower anterior teeth together | **Changed:** anterior shares are about 2.5-3× lower. The first-round clench case also applied half-arch shares to the bilateral total (doubling). It errs on the safe side for the bridge and overstates anterior PDL load in clench |
| Chewing pace and episodes | 1.6 Hz; 13 s; 1,500 cycles/day (700-3,000) | Po 2011 p.1208: mean frequency 1.57 Hz; episodes 13.0 s (5th-95th percentile 2.7-34.9 s); no daily count. Studart 2007 p.111: 1,400 cycles/day assumed (secondary) | Frequency and episodes **confirmed**; daily count still indirect |
| Connectors | 9 mm² anterior, 12 mm² at the premolar | Studart 2007 Table 2 p.112: minimum area for 5 % failure in 20 years in water at 250 N per pontic is 4.9 (3-unit), 12.6 (4-unit), 18.8 mm² (5-unit), for posterior frameworks without veneer. Beam check with Studart's model: a round 9 mm² connector tolerates about 146 N per pontic for 20 years, 346 MPa being the 20-year limit. Larsson 2007 Table 2 p.706: 4-unit cores, 3.0 / 3.5 / 4.0 mm connectors fracture at 428 / 602 / 897 N; p.707: smaller dimensions "might be adequate" for anterior bridges. Schmitter 2012: 30 bridges of 4-7 units, about 9 mm², two framework fractures, neither from connector size | **Confirmed adequate.** Criterion for FE: largest principal stress at the connectors below 346 MPa under cyclic loads |
| PDL thickness | 0.20 mm | Coolidge 1937 Table 5 p.1264: whole-tooth means 0.21 (age 11-16), **0.18 (32-50), 0.15 (51-67) mm**; mid-root thinnest (0.12-0.17) | **Confirmed** (young end); adult 0.15-0.18 changes layer stiffness by 15-25 %, not material |
| PDL modulus | 50 MPa, ν 0.45 (sensitivity 8 and 0.68 MPa) | Liu 2011 (Angle Orthod 81:229) p.233, Tables 2-3: bilinear, **E1 0.04 MPa, E2 0.16 MPa**, switch at 7.3 % strain, for loads ≤ 2 N (orthodontic) on 8 maxillary incisors. At bite loads these would give about 400 % strain, so they do not apply there | **Confirmed for bite loads** (no contradiction); the 0.68 MPa run is the soft end for bite loads, not a measured lower bound. Sustained low loads would need a bilinear PDL |
| Sustained PDL pressure threshold | 4.7 kPa (2.5-4.7) | Hohmann 2007 p.653: capillary pressure 15-35 mmHg = **2.0-4.7 kPa** (literature, not measured); p.657-658: resorption only where 4.7 kPa was exceeded (2 premolars, orthodontic torque, 4 weeks) | **Confirmed**; lower bound 2.0 kPa; use only for sustained loads |
| Root surface areas | 31/41 154, 32/42 168, 33/43 268-276, 34 180-251 mm² | Jepsen 1963 Table II p.40 (CEJ to apex): **154 ± 26.5, 168 ± 21.5, 268 ± 42.2, 180 ± 27.2** (n 10/10/18/24). Mowry 2002 Table 2 p.1097 (n 50): canine 275.9 ± 29.4, first premolar 251.5 ± 39.2 | **Confirmed** (Jepsen now read) |
| Ante's law | whole bridge 2.1-2.3; 34-31 span 0.77-0.91 | Recomputed: Jepsen only 2.12 / 0.77; with Mowry's canine and premolar 2.26 / 0.91 | **Confirmed**: the left span stays below 1 |
| Reduced-support bridges | from abstracts | Laurell 1985 Table 1 p.853: Ante index of 12 cross-arch bridges 17-118 % (11 below 100 %); no survival data in that paper. Lulic 2007 p.67-68: 5-year 96.4 %, 10-year 92.9 % survival from 2 cohorts (79 bridges); p.67, Nyman & Ericsson: 55 of 60 bridges broke Ante's law and all functioned 8-11 years. All metal-ceramic, at least 4 abutments with 2 posterior | **Changed (wording):** Ante's law is not a hard limit with a healthy periodontium. The evidence is metal-ceramic with posterior abutments on both sides |
| Mechanostat thresholds | adapted to about 1,500; mild overload 1,500-3,000; MESp about 3,000; fracture about 25,000 µε | Frost 2003 Table 3 p.1085 (same in Frost 2004 Table 2 p.6): MESr 50-100 (or about 400); **MESm 1,000-1,500**; **MESp about 3,000, about bone's yield point, where woven bone begins to replace lamellar**; Fx about 25,000. Thresholds for cortical lamellar bone under typical peak voluntary loads, as gauge (principal) strains; jaws count as load-bearing bone | **Confirmed**; MESm is a range from 1,000; strains at about 3,000 are at MESp (pathologic window), not mild overload |
| Human alveolar strain in vivo | none known | Al Nazer 2012 Table 1 p.33-34 (secondary: Asundi & Kishen 2000): 50 N bite, cervical alveolar cortex tensile 135-352, compressive 42-100 µε; apical 0. Zones of Forwood & Turner: physiological 200-2,000, overload 2,000-3,000, pathological above 4,000 µε. Daegling & Hylander 1997 p.713: no human in vivo data; macaque and galago basal corpus peaks 1,550 and 2,200 µε | **Changed:** a human outer-cortex value now exists (validation target) |
| Dentin | 18.6 GPa, ν 0.31 | Kinney 2003 p.23: hydrated dentin 18-25 GPa, **"18-20 GPa … more appropriate for strain rates encountered with physiologic loading"**; ν 0.29-0.45 by method (Table 1 p.19); anisotropy about 10 % | **Confirmed** |
| Mandibular bone moduli | 13.7 / 1.37 GPa | Not in these papers | Not addressed |
| Clot stiffness | 5 kPa (hours) to 25 kPa (14 days) | Mfoumou 2014 p.268, shear-wave Young's modulus of a rabbit venous stasis clot: 1.0 (10 min), 5.3 (2 h), 7.9 (day 1), about 10 (day 3), about 15 (day 7), 25.0 ± 6.8 kPa (day 14) | **Confirmed**, with intermediate time points (venous clot, small strain) |
| Granulation tissue | 1 MPa (0.6-1.3) | Leong & Morgan 2008 Table 1 p.1572: reduced modulus 0.99 ± 0.20 MPa (0.61-1.27), one rat callus at 35 days, nanoindentation, not converted (p.1571); **E = Er(1 − ν²) ≈ 0.74-0.97 MPa** | **Changed** slightly (E about 0.75-0.95 MPa). The socket model's soft phase (0.2 MPa, from the long-bone model) is 4-5× softer than this and 20-200× stiffer than a clot of days 0-7 |
| **Ovate pontic depth** | no contact (baseline); 0.5 and 1.0 mm interference pressed into the socket tissue from day 0 | Bakshi 2018 p.544 (immediate, fresh sockets): pontic **3 mm apical to the free gingival margin**, crest at most 5 mm below it. Dylina 1999 p.138: immediate site, **3 mm from the most cervical tissue to the pontic apex**; p.137: "Cervical repair is dictated by the level of the fibrin clot". Healed ridges (Dylina p.138/141, Orsini 2006 p.253): pontic apex at least 1 mm from bone, tissue shaped by bur or laser. Contact "tight but noncompressive", floss passes (Zitzmann 2002 p.376, Orsini p.253). No paper gives a compressive overlap or a pressure | **MATERIAL / changed.** Clinically the pontic fills the socket mouth at extraction and the clot forms against it: zero prestrain. A pressed-in interference of 0.5-1 mm into a fresh socket is not clinical practice. The matching model case is a pontic cap at the socket mouth that moves with the bridge |
| **Histology under ovate pontics** | – | Zitzmann 2002 Tables II-IV p.378 (12 maxillary sites edentulous ≥ 1 year, 12 months): mucosa 2.48 vs 2.38 mm (n.s.), thinner keratin (8 vs 22 µm), more inflammatory cells within 200 µm of the epithelium only; p.380: differences "restricted to the 200-µm-wide zone". Orsini 2006 p.254-255 (3 patients, healed ridges, 2 weeks): inflamed, well vascularised mucosa, partial healing. **Neither sampled bone; neither studied fresh sockets.** Bakshi p.546: the pontic "stabilizes and protects the blood clot" (claim). Dylina p.138: excessively long pontics delayed healing up to 2 years | **Not addressed for bone.** The soft tissue under a pontic is normal-thickness mucosa, not a thick fibrous layer. Deep pontics delaying healing has qualitative support only |
| Contact pressure (DERIVED, p = E·d/h, 1-D) | – | 0.5 / 1.0 mm interference over 2.5-12 mm of tissue: clot days 0-3 0.2-4 kPa (below 4.7 kPa); granulation tissue at the soft-phase modulus 0.2 MPa 8-80 kPa; at 0.75-0.97 MPa 31-390 kPa | A compressive pontic would load granulation tissue above capillary pressure, but clinically there is no prestrain |

## Consequences for the bridge model
1. **Loads.** The functional cases are unchanged; no paper measured functional single-tooth forces. The maxima move up:
   - one incisor about 150 N (men's mean), rather than 150 N on the pair;
   - canine clench about 190 N;
   - premolar 300 N confirmed.

   Add a single-tooth maximal case on the smallest abutment (31). Anterior clench shares should follow Hattori, not Hejne.
2. **Connectors.** 9 mm² anterior and 12 mm² at the premolar connector are adequate. Check the largest principal stress at the connectors against 346 MPa (Studart's 20-year limit in water).
3. **PDL.** Keep 50 MPa for bite loads. A sustained low-load case would need a bilinear PDL (Liu 2011).
4. **Bone.** Judge principal (gauge) strains:
   - below MESm (1,000-1,500 µε): adapted;
   - up to MESp (about 3,000 µε): overload window;
   - at or above MESp: pathologic.

   Report the share of peri-radicular bone above 3,000 µε rather than single-element maxima. For validation, compare the labial cervical cortical surface strain under a 50 N bite with 135-352 µε tensile (Asundi & Kishen via Al Nazer).
5. **Ovate pontic.** Replace the pressed-in scenario by a pontic that fills the socket mouth to about the crest, joined to the tissue without prestrain and moving with the bridge. Keep the interference runs only as non-clinical upper bounds. A sustained compressive case would need a sustained-pressure rule (about 4.7 kPa), not the cyclic Claes-Heigele strain limit.
6. **Soft tissue.** The literature gives clot 5-25 kPa (days 0-14) and granulation tissue about 0.75-0.95 MPa. The socket model's soft phase (0.2 MPa) lies between the two.
