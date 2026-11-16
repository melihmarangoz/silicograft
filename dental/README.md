# SG-Bone dental: extraction-socket model

This folder holds the dental branch of SG-Bone. The plan and the literature behind it are in [DESIGN.md](DESIGN.md) and [literature/](literature/). The first stage is a calibration on Hong et al. 2014 (beagle P3 root sockets, empty vs β-TCP); its runs and results are in [hong/](hong/README.md).

| Path | What it holds |
|---|---|
| `geometry/socket_geometry.py` | gmsh script: idealized single-root socket in a block of alveolar bone, CalculiX template and initial lattice |
| `src/` | C++ model: a copy of `long_bone/src` with the socket changes marked `[DENTAL]` |
| `tools/` | build (`prepare_run.sh`), CalculiX call (`run.sh`), batches (`run_hong_m1.sh`, `run_sets.py`, `make_sets_m2.py`), scoring and fitting (`score_hong.py`, `identifiability.py`, `submodels.py`, `candidates_m2.py`), analysis (`analyze_socket.py`) and a live replay panel (`live_panel.py`) |
| `hong/` | Hong 2014 calibration: reference data, results, figures |

## The socket model
The model started as the validated long-bone model with only the geometry, the cell source and the load changed (milestone 1). In milestone 2 Melih allowed the dental model to depart from the long-bone rules where the socket needs it (2026-11-16). Every departure is listed in [Departures from the long-bone model](#departures-from-the-long-bone-model); all of them are runtime parameters, and the defaults reproduce milestone 1 bit for bit. The **calibrated dental setting** (Hong 2014) is in [hong/README.md](hong/README.md#milestone-3b-refit-with-the-literature-values). Milestone 3b (2026-11-16) supersedes the values of milestones 2 and 3:
- **Empty socket:** activity 15 days, late factor 0.25, and remodelling from day 28 at 0.03 /day, falling to 0.005 /day from day 60.
- **β-TCP:** granule envelope 0.52, k = 0.031 /day from day 6, and a graded activity factor of 0.1 at full packing that fades with the granule share.

### Geometry (`geometry/socket_geometry.py`)
Coordinates in mm: x mesio-distal, y bucco-lingual (buccal negative), z vertical with the alveolar crest at z = 0. The plane y = 0 is the central mesio-distal section that Hong et al. measured.

| Item | Value | Source |
|---|---|---|
| Socket depth | 8.5 mm | beagle P3/P4 mesial sockets 8.2-8.7 mm [nakajima2026]; P3 distal 8.5 mm [fan2021] |
| Crest diameter | 3.6 mm, circular | between P3 distal 3.2 mm [fan2021] and P3/P4 mesial 3.9 × 4.25 mm [nakajima2026]; circular section assumed |
| Apex | 50 % of the crest (1.8 mm), rounded fundus | assumed (GAPS_SEARCH recommendation); taper half-angle 6.8° |
| Buccal wall | 0.6 mm at the crest, 1.55 mm at 5 mm depth | Labrador premolars [zhang2021atm]; beagle 0.75 mm at 1 mm [nakajima2026] |
| Lingual wall | 1.5 mm at the crest | assumed, no open source |
| Crest | flat | assumed (in beagles the lingual crest is 0.3-0.45 mm higher) |
| Bone block | 10 mm mesio-distal, bottom 3.5 mm below the apex | assumed |
| Alveolar process | compact, E 13.7 GPa, ν 0.3 | BV/TV 0.98 around beagle premolar roots [huja2006]; E [zapata2011; ashman1985] |
| Body below z = −9 | trabecular, E 375 MPa, inside 1.2 mm buccal and lingual cortices | E derived in GAPS_SEARCH §3; shell thickness assumed |
| Neighbouring root socket | not modelled | each Hong socket is one root of P3; the other root's socket was also extracted |

Mesh: quadratic tetrahedra (C3D10) with straight edges, 0.8 mm in the socket (521 elements, about 85 lattice points each), 1.0 mm in compact and 1.5 mm in trabecular bone; 7 368 nodes. The straight edges keep the FE faces the same as the planar faces the lattice mapping uses. The faceted socket is 44.5 mm³ against 46.6 mm³ for the smooth one.

### Lattice and cells
- The 0.1 mm lattice (43 × 43 × 92 points) covers the socket plus a 0.3 mm margin. Its z planes sit half a voxel off the crest, so no plane lies on the socket opening; y = 0 is a lattice plane.
- Lattice codes besides the cells: 11 native bone, 14 soft-tissue cover above the crest. Points inside socket elements are socket points; everything else is bone, or cover above the crest.
- **Initial content:** the socket is clot / granulation tissue (empty lattice points, E 0.2 MPa), as the long-bone callus.
- **Cell source:** MSCs in 30 % of the socket points within 2 lattice points (0.2 mm) of the bony wall, with a fixed pattern seed. This stands for the periodontal-ligament remnants and wall marrow openings from which new bone starts at the socket base and walls [cardaropoli2003; Hong 2014]. 30 % is the long-bone seeding density; the 0.2 mm lining (PDL width) is assumed. There is no further supply of cells after day 0.
- **Soft-tissue cover (closed flap):** occupied, no cell source, and not a guiding surface for migration or differentiation. Hong 2014 report a closed, coronally advanced flap and a periosteum-like tissue over the socket only at 8 weeks, so a fibrous source was left out of the baseline. `-DSG_COVER_GUIDES` makes the cover a guiding surface.
- **Cell rules:** the long-bone rates, surface-guided migration and differentiation, apoptosis, rule-of-mixtures stiffness averaged over 10 days and FE every 3 days from day 6. The high-activity period (upstream 15 days) and the late reduction (upstream rates / 5) are parameters. The calibrated values (milestone 3b) are 15 days and × 0.25. Calibrated runs also use woven-bone remodelling (below).
- **Outputs as Hong measured them:** Hong's new bone (NB) is the bone region with marrow counted as soft tissue (thesis). In the model, NB is the osteoblast points. Points freed by remodelling (marrow / vascular space) are empty and count with the FCT. Residual graft (RB) is the decalcified granule outline, i.e. the envelope; the model's granule points are that envelope, since intragranular pores are below the lattice.
- **Per-element counts:** with about 85 lattice points per element, upstream `int(n * rate)` is 0 whenever n·rate < 1 (for example fewer than 17 eligible MSCs at the post-day-15 differentiation rate 0.06). The fork rounds n·rate stochastically, which keeps the expected count at n·rate whatever the element size. `-DSG_UPSTREAM_COUNTING` restores the truncation.

### Mechanics
- **Mechanoregulation thresholds:** as upstream (Claes-Heigele with the resorption window: |HP| < 0.0016 MPa and |ε_min| < 0.0004 no differentiation; |HP| < 0.15 MPa and |ε_min| < 0.05 bone; HP < −0.15 MPa (original sign) cartilage; otherwise fibrous). `-DCLAES_HEIGELE_BASMA_POZITIF` gives the Claes-Heigele sign.
- **What the cells sense** (`stimulus_mode`): 0 = the element-average hydrostatic pressure (upstream); 1 = the soft-tissue phase. Under the rule of mixtures every phase of an element has the element strain (iso-strain), so the soft phase's pressure is −K_soft·tr(ε), with K_soft from the modulus of the element's non-bone points (granulation 0.2, fibrous 2, cartilage 10 MPa; ν 0.167). For an element without bone this is the upstream value. With bone, the stiff matrix no longer sets the pressure the cells feel. The minimum principal strain is the element's either way.
- **Resorption window** (`lower_window`): 1 = upstream; 0 = no lower window (as in Claes & Heigele 1999), so low strain is permissive for bone. The recommended dental setting is soft phase without the lower window (see the check in hong/README.md).
- **Load:** the socket is not loaded directly (closed flap, soft diet for 2 weeks in Hong). The bone block carries a nominal mesio-distal compressive strain, applied as a displacement of the distal face (mesial face fixed in x, two pins against rigid-body motion). It stands for the bending of the mandibular body during mastication. Default **300 µε** (`-DFARFIELD_STRAIN=3e-4`): assumed. In vivo corpus strains during chewing are tens to a few hundred µε in the macaque (mean 50-90, maximum about 200 µε on nuts; Panagiotopoulou 2017, PMC5792078), and peak functional strains in bone reach 2000-3500 µε. No dog value for a soft diet was found.
- Granulation tissue in the socket amplifies the far-field strain about 2.6 times: at 300 µε the day-0 socket sees |ε_min| ≈ 730-860 µε, inside the bone window. At 150 µε the day-0 strain sits on the 400 µε threshold of the resorption window (median 390 µε) and three quarters of the elements start without differentiation; with no load none differentiates.
- `force_stimulus 2` (or `-DFORCE_STIMULUS=2`) gives every element the bone stimulus whatever the mechanics: the biology-only setting used for the calibration. The FE solves are then skipped (`skip_fe_when_forced`), and a run takes about 4 s instead of 30 s.

### Runtime parameters
A run folder may hold `params.txt` with `name value` lines; the values used are written to `params_used.txt`. Names and defaults (struct `Params` in `src/header.h`): `farfield_strain` 3e-4, `force_stimulus` 0, `skip_fe_when_forced` 1, `stimulus_mode` 0, `lower_window` 1, `activity_days` 15, `late_factor` 0.2, `seed_fraction` 0.3, `lining_voxels` 2, `cover_source` 0, `matrix_day` −1, `remodel_rate` 0, `remodel_day` 14, `remodel_rate2` 0.005, `remodel_day2` 60, `raw_daily` 1.

β-TCP granules (all off while `granule_fraction` is 0): `granule_fraction` 0, `granule_dmin` 0.5 and `granule_dmax` 1.0 mm, `granule_overlap` 0.1, `granule_pattern` −1 (run seed + 1000), `tcp_k` 0.031 /day, `tcp_lag` 0, `tcp_E` 3500 MPa, `tcp_nu` 0.3, `tcp_guides` 1, `tcp_guide_day` 0, `tcp_late_mult` 1, `tcp_diff_mult` 1, `tcp_inhibit_days` 0, `tcp_inhibit_graded` 1, `tcp_inhibit_prolif` 1, `tcp_delay` 0, `tcp_delay_all` 1, `tcp_delay_activity` 1, `tcp_wall_exempt` 0. The Hong-calibrated values are in [hong/README.md](hong/README.md#milestone-3b-refit-with-the-literature-values).

### β-TCP granules (`src/Granules.cpp`)
- **Packing:** random sequential addition of spheres, 0.5-1.0 mm in diameter (Cerasorb 500-1000 µm), largest first. Centres sit on free socket points. Neighbours may overlap by at most 10 % of the sum of their radii, because hard spheres jam near 0.38. Packing stops at `granule_fraction` of the socket points. The packing is cut by the wall and the crest plane. Granules are lattice code 12, solid and guiding, as the scaffold of the upstream `scaffold_presence` branch.
  - The fraction is the granule *envelope*. Pores inside a granule (35 % in Cerasorb, 65 % in Cerasorb M) are below the 0.1 mm lattice.
  - Each seed packs its own granules (pattern seed = run seed + 1000), so replicates differ as sockets do.
  - At 0.42 there are about 76 granules (42.3 % of the socket).
- **Seeding:** granules are placed before the wall lining is seeded, so they take part of the lining. The β-TCP socket starts with about 2 100 MSCs instead of 3 400.
- **Resorption:** each granule keeps its centre and loses volume first-order from `tcp_lag`: V = V0 exp(−`tcp_k` (t − `tcp_lag`)), i.e. the radius goes as exp(−k t / 3). A granule point beyond the current radius is freed (empty, open to cells).
- **FE:** granule points enter the rule of mixtures with E 3.5 GPa and ν 0.3. That is porous β-TCP at 35 % porosity, derived in literature/parameters.csv from Metsger 1999 and Knabe 2008. They are not part of the soft phase.
- **Delay of the cell biology** (`tcp_delay`): in a grafted socket the cells wait `tcp_delay` days (proliferation, migration and differentiation; with `tcp_delay_all 0` only differentiation). Their clock then starts at 0: differentiation from biological day 6, remodelling from biological day 14.
  - With `tcp_delay_activity 0` the high-activity period still ends on the real clock (day 18), so the delayed cells start at the late rates.
  - With `tcp_delay_activity 1` the whole period starts late.
  - Resorption, ageing and mechanics keep the real clock.
- **Per-element clocks:** each socket element runs its own biological clock, iteration − its start (`g_elem_start`). The start is `tcp_delay` in a grafted socket, and 0 for elements at the bony wall with `tcp_wall_exempt`. A wall element is one that holds wall-lining points; at the 0.8 mm mesh that is 412 of 521 elements.
- **Graded activity factor** (`tcp_diff_mult`, `tcp_inhibit_days`; the calibrated β-TCP rule since milestone 3b):
  - While the iteration is below `tcp_inhibit_days`, an element's differentiation rate (and, with `tcp_inhibit_prolif`, its proliferation rates) is multiplied by 1 − (1 − `tcp_diff_mult`) × min(1, its current granule share / `granule_fraction`).
  - The cells are slowed where the granules are still packed. The effect fades as the granules resorb.
  - With `tcp_inhibit_graded 0` the factor is uniform.
- **Variants:** `tcp_late_mult` multiplies the late factor in a grafted socket (2.5 reproduces upstream's "TCP stimulation": activity / 2 instead of / 5). `tcp_guides 0` or `tcp_guide_day` turn the granule guidance off or start it later.

### Departures from the long-bone model
| Rule | Long-bone model | Dental model | Why |
|---|---|---|---|
| Cell source | marrow and periosteum seeding | 30 % of a 0.2 mm lining on the socket wall (PDL remnants); optional cover source | socket anatomy (milestone 1) |
| Soft-tissue cover | none | lattice code 14, not a guiding surface | closed flap (milestone 1) |
| Per-element counts | `int(n·rate)` | stochastic rounding | small socket elements switch off low rates otherwise (milestone 1; Melih kept it as default) |
| Load | 823 N + moment on the bone | far-field strain on the block | the socket itself is not loaded |
| High-activity period, late reduction | 15 days, rates / 5 | parameters; calibrated (milestone 3b) 15 days and rates × 0.25 (milestone 2: 18 days, × 0.25) | fitted to Hong 2014 |
| Woven-bone remodelling | none (osteoblasts die only under the resorption stimulus) | `remodel_rate` of the osteoblasts per day are removed and the point becomes marrow / vascular space, which can fill again. Milestone 3b: from day 28 at 0.03 /day, 0.005 /day from day 60 (milestone 2: day 14, fitted) | dog sockets: woven bone peaks near day 30 and turns into marrow mostly by day 60 at 0.023-0.042 /day net, then plateaus (Cardaropoli 2003, Kim 2017; literature/SOCKET_PARAMS_2026-11-16.md). Hong's data cannot identify the rate, so the literature values are used |
| Clot entry | MSCs migrate only next to a guiding neighbour | option: from `matrix_day`, also into free socket points (provisional matrix); off in the calibrated setting | tested; not needed by Hong's data |
| Cover as a source | – | option `cover_source`; off in the calibrated setting | tested; not needed by Hong's data |
| Mechanical stimulus | element-average pressure, with resorption window | option: soft-tissue phase, without the lower window (recommended) | bone-containing elements no longer turn fibrous because the stiff matrix carries pressure, and the 400 µε lower limit no longer resorbs bone at physiological jaw strains (hong/README.md) |
| Differentiation target | `n·rate` eligible MSCs, picked at random | capped at the MSCs still eligible after that day's apoptosis | the upstream loop can hang when apoptosis removes the only guiding neighbour (seen with remodelling) |
| FE when the stimulus is forced | always | skipped | speed |
| β-TCP graft | scaffold branch: a fixed PCL-TCP cylinder (code 12, separate FE part, never resorbed), activity / 2 instead of / 5 | explicit random-packed granules (code 12, guiding), shrinking first-order, in the rule of mixtures at 3.5 GPa; no stimulation | Hong's Cerasorb granules resorb within 8 weeks and *delay* bone (milestone 3) |
| Grafted-socket timing | – | milestone 3b: a graded activity factor (0.1 at full packing, fading with the element's granule share) on differentiation and proliferation. Milestone 3: a 12-day pause of the cell biology (`tcp_delay`), kept as a variant | β-TCP sockets form 0.2-0.45 of the empty socket's bone at 2 weeks, 0.25-0.4 at 4 weeks and 0.7-0.8 at 8 weeks (Hong paper and thesis, Araújo 2010; literature/SOCKET_PARAMS_2026-11-16.md). The graded rule fits Hong's paper as well as the pause, fits the thesis better, and gives bone at 2 weeks |

### Outputs of a run
`statistics.csv` (daily counts), `zones.csv` (Hong's outcome per day: socket points and tissue counts per third and in total, on the central section and in the volume), `section_daily.bin` (the central section every day, 43 × 92 bytes per day), `lattice_<it>.raw` (daily lattice, uint8; with `raw_daily 0` only days 14, 28 and 56), `lattice_element.bin` (element of each lattice point, int32), `mech_<it>.bin` and `mechanics.csv` (element hydrostatic pressure and minimum principal strain), `stimulus_<it>.bin`, plus the upstream `proliferation.txt`, `differentiation.txt` and `migration_distribution.txt`. Day d is the lattice after d daily iterations (`lattice_<d−1>.raw`).

## Running it
Needs CalculiX `ccx`, Python 3 with `gmsh`, `meshio`, `numpy`, `matplotlib`, and a C++17 compiler. The model is small: one 56-day run takes about a minute.

```bash
cd dental
python3 geometry/socket_geometry.py --out ~/sg/meshes/m08          # mesh and initial lattice (seconds)
tools/prepare_run.sh ~/sg/meshes/m08 ~/sg/runs/baseline            # build; add -D flags here
cd ~/sg/runs/baseline && ./mechanobio 1 > log.txt 2>&1             # seed 1, 56 days
python3 tools/analyze_socket.py --out out --hong hong/data/hong2014_empty_socket.csv --case baseline=~/sg/runs/baseline --maps baseline
```
`tools/run_hong_m1.sh <mesh> <runs>` builds and runs all milestone-1 cases in parallel. For many parameter sets, build once and use `tools/run_sets.py --build <build> --sets <sets.csv> --out <runs>` (one folder per row of the CSV, linked to the build, with its own `params.txt`). `run.sh` pins CalculiX to one thread (`SG_CCX_THREADS`), since reruns are only bit-identical with the same thread count.
