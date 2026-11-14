# SG-Bone dental: extraction-socket model

This folder holds the dental branch of SG-Bone. The plan and the literature behind it are in [DESIGN.md](DESIGN.md) and [literature/](literature/). The first stage is a calibration on Hong et al. 2014 (beagle P3 root sockets, empty vs β-TCP); its runs and results are in [hong/](hong/README.md).

| Path | What it holds |
|---|---|
| `geometry/socket_geometry.py` | gmsh script: idealized single-root socket in a block of alveolar bone, CalculiX template and initial lattice |
| `src/` | C++ model: a copy of `long_bone/src` with the socket changes marked `[DENTAL]` |
| `tools/` | build (`prepare_run.sh`), CalculiX call (`run.sh`), the milestone-1 batch (`run_hong_m1.sh`) and the analysis (`analyze_socket.py`) |
| `hong/` | Hong 2014 calibration: reference data, results, figures |

## The socket model

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
- **Cell rules:** unchanged from the long-bone port: rates, 15-day high-activity period, surface-guided migration and differentiation, apoptosis, rule-of-mixtures stiffness averaged over 10 days, FE every 3 days from day 6.
- **Per-element counts:** with about 85 lattice points per element, upstream `int(n * rate)` is 0 whenever n·rate < 1 (for example fewer than 17 eligible MSCs at the post-day-15 differentiation rate 0.06). The fork rounds n·rate stochastically, which keeps the expected count at n·rate whatever the element size. `-DSG_UPSTREAM_COUNTING` restores the truncation.

### Mechanics
- **Mechanoregulation:** unchanged (Claes-Heigele with the resorption window: |HP| < 0.0016 MPa and |ε_min| < 0.0004 no differentiation; |HP| < 0.15 MPa and |ε_min| < 0.05 bone; HP < −0.15 MPa (original sign) cartilage; otherwise fibrous). `-DCLAES_HEIGELE_BASMA_POZITIF` gives the Claes-Heigele sign.
- **Load:** the socket is not loaded directly (closed flap, soft diet for 2 weeks in Hong). The bone block carries a nominal mesio-distal compressive strain, applied as a displacement of the distal face (mesial face fixed in x, two pins against rigid-body motion). It stands for the bending of the mandibular body during mastication. Default **300 µε** (`-DFARFIELD_STRAIN=3e-4`): assumed. In vivo corpus strains during chewing are tens to a few hundred µε in the macaque (mean 50-90, maximum about 200 µε on nuts; Panagiotopoulou 2017, PMC5792078), and peak functional strains in bone reach 2000-3500 µε. No dog value for a soft diet was found.
- Granulation tissue in the socket amplifies the far-field strain about 2.6 times: at 300 µε the day-0 socket sees |ε_min| ≈ 730-860 µε, inside the bone window. At 150 µε the day-0 strain sits on the 400 µε threshold of the resorption window (median 390 µε) and three quarters of the elements start without differentiation; with no load none differentiates.
- `-DFORCE_STIMULUS=2` gives every element the bone stimulus whatever the mechanics: a biology-only baseline.

### Outputs of a run
`statistics.csv` (daily counts), `lattice_<it>.raw` (daily lattice, uint8), `lattice_element.bin` (element of each lattice point, int32), `mech_<it>.bin` and `mechanics.csv` (element hydrostatic pressure and minimum principal strain), `stimulus_<it>.bin`, plus the upstream `proliferation.txt`, `differentiation.txt` and `migration_distribution.txt`. Day d is the lattice after d daily iterations (`lattice_<d−1>.raw`).

## Running it
Needs CalculiX `ccx`, Python 3 with `gmsh`, `meshio`, `numpy`, `matplotlib`, and a C++17 compiler. The model is small: one 56-day run takes about a minute.

```bash
cd dental
python3 geometry/socket_geometry.py --out ~/sg/meshes/m08          # mesh and initial lattice (seconds)
tools/prepare_run.sh ~/sg/meshes/m08 ~/sg/runs/baseline            # build; add -D flags here
cd ~/sg/runs/baseline && ./mechanobio 1 > log.txt 2>&1             # seed 1, 56 days
python3 tools/analyze_socket.py --out out --hong hong/data/hong2014_empty_socket.csv --case baseline=~/sg/runs/baseline --maps baseline
```
`tools/run_hong_m1.sh <mesh> <runs>` builds and runs all milestone-1 cases in parallel. `run.sh` pins CalculiX to one thread (`SG_CCX_THREADS`), since reruns are only bit-identical with the same thread count.
