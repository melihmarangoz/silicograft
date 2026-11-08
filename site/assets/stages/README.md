# Stage images of the SG-Bone loop

Six 1200 x 1200 images for the scroll story of the model section (`stage-1.jpg` to `stage-6.jpg`) and their captions (`stages.json`). Every pixel comes from the output of one model run and from that run's own CalculiX mesh. The only hand-placed marks are the two load arrows of stage 1.

Script: `long_bone/araclar/site_stages.py`. Captions, legends and counts in `stages.json` are written by the same script from the run's numbers.

## Data

Run `~/mechanobio_calculix/gunluk_2026-11-07/bagsiz_orijinal_t12345`:

- current geometry of `long_bone/geometri/uzun_kemik_geometri.py` (callus element size 1.7 mm, plate **not bonded** to the callus, 1 541 twinned interface nodes)
- original stimulus sign (`kosu_hazirla.sh ... orijinal -DRAW_WRITE_INTERVAL=1`), seed 12345, 360 days, a raw lattice every day
- run on 2026-11-07 on a remote 16-thread Linux machine, 1 h 20 min wall time with two other runs beside it, peak memory 3.7 GB

This full run replaced the short fresh run planned in the brief: it is the same configuration with more days, and a local run would need about 3.7 GB, more than the free memory on this machine. To confirm the geometry, the mesh was rebuilt locally with the current script (`~/mechanobio_calculix/ag_site`): same region volumes and the same 1 541 twinned nodes. gmsh on another machine numbered it slightly differently (93 405 instead of 93 413 nodes), so the images use the run's own mesh files.

| Stage | Day | Source |
|---|---|---|
| 1 Defect and load | - | `model_sablon.inp`, section x = 0 |
| 2 Cells arrive | 9 | `lattice_9.raw.zst`, plane i = 180 (x = 0) |
| 3 Tissue forms | 357 | `lattice_357.raw.zst` |
| 4 Stiffness | 357 | E per element rebuilt from `lattice_348` to `lattice_357` |
| 5 Strain | 357 | `without_scaffold.dat` (the last CalculiX solve) |
| 6 Decision plane | 357 | `without_scaffold.dat` |

Day 357 is the last CalculiX solve of the run (`main.cpp` solves every third day from day 6). `run.sh` deletes the old `.dat` before each solve, so the last solve is the only one whose strains are on disk.

## How the images are made

- **Frame (stages 1 to 5):** section x = 0, the plane through the bone axis that cuts the plate. 60 x 60 mm centred on the defect (y = 0, z = 20 mm), 0.05 mm per pixel, proximal end up, plate on the right. Drawn at 3x and box-filtered to 1200 px. The screws sit 25 to 55 mm beyond the gap ends, outside this frame. A 90 mm frame that includes them made the cells unreadable at 600 px.
- **Regions:** each C3D10 element of `model_sablon.inp` is split into 8 straight tetrahedra through its mid-side nodes, so the curved surfaces follow the quadratic geometry CalculiX uses. The split tetrahedra are then cut at x = -0.001 mm, just off the x = 0 faces of the callus mesh.
- **Cells (stages 2, 3):** lattice plane i = 180 (x = 0), one lattice point = 2 x 2 output pixels.
- **Stiffness (stage 4):** the program does not write E out. The script rebuilds the C++ lattice-to-element map of `Lattice_point_in_element.cpp` and the rule of mixtures with the 10-day average of `Update_model.cpp` in float32. It also copies the half-open loops of `Update_model` (`i < imax`).
- **Strain and pressure (stages 5, 6):** as `Read_stimulus.cpp`, averaged over the 4 integration points: the smallest eigenvalue of the tensor strain, and HP = -(s1+s2+s3)/3.

### Checks (the script stops if any fails)

| Check | Result |
|---|---|
| lattice-to-element map vs `kesit_eleman.bin` (3 planes) | 0 differing points, 24 862 434 callus points (same as the run log) |
| rebuilt E and nu of day 358 vs the run's `without_scaffold.inp` | all 24 698 callus elements identical as written (6 digits) |
| stimulus class of the day-357 solve vs `stimulus_358.bin` | 0 of 24 698 elements differ |

## Commands

```bash
# 1. (verification only) rebuild the current mesh
cd long_bone && . araclar/ortam.sh
python3 geometri/uzun_kemik_geometri.py --kallus-boyu 1.7 --cikti ~/mechanobio_calculix/ag_site

# 2. images and captions (from the repo root; numpy, matplotlib, Pillow, zstandard)
python3 -m pip install --user zstandard          # once, to read lattice_N.raw.zst
python3 long_bone/araclar/site_stages.py \
    --run ~/mechanobio_calculix/gunluk_2026-11-07/bagsiz_orijinal_t12345 \
    --out site/assets/stages
# options: --early-day 9 (stage 2), --cache ~/mechanobio_calculix/site_stages_cache, --palette
```

First run about 50 s and 1.2 GB of memory. Later runs about 15 s, because the lattice map, the daily moduli and the section raster are cached in `--cache` (about 200 MB). The 1200 px PNGs stay in `<cache>/png`, outside the repo.

## Colours

OKLCH converted to sRGB in the script (`oklch_to_hex`, OKLab matrices, gamut checked). The paper converts to `#02071d` exactly.

| Use | OKLCH | Hex |
|---|---|---|
| background (paper) | 14% 0.048 264 | `#02071d` |
| no-data fill (paper-2) | 18.5% 0.052 264 | `#071129` |
| empty callus, low end of maps (paper-3) | 23% 0.055 264 | `#0f1c37` |
| new bone, high end of maps (ink) | 95% 0.016 250 | `#e7f0f9` |
| load arrows (ink-2) | 88% 0.05 245 | `#bddcf7` |
| key and tick text (muted) | 73% 0.04 256 | `#98a9c1` |
| plate, screws, chart rules (rule) | 40% 0.06 262 | `#364868` |
| cartilage (accent) | 80% 0.11 230 | `#6bcbf7` |
| middle of maps (accent-2) | 58% 0.10 236 | `#3483ad` |
| stem cells: accent-2 at 85% over paper-3 | - | `#2e749b` |
| fibrous tissue | 62% 0.07 285 | `#8181af` |
| intact cortical bone | 50% 0.03 260 | `#596475` |
| marrow | 31% 0.035 258 | `#253142` |
| resorption (stage 6) | 50% 0.02 256 | `#5c646f` |

Field maps: `LinearSegmentedColormap` paper-3 > accent-2 > ink. Stage 4 is log10 E from 0.2 to 17 000 MPa. Stage 5 is log10 |min principal strain| from 0.001 % to 10 %.

## Caveats for the captions

- **Stage 2 is thin.** In this run the stem cells move slowly: about 0.6 mm by day 9 and 3 mm by day 30 in this plane, so stage 2 shows a fringe, not a front crossing the gap. `--early-day 30` gives a slightly thicker fringe and more first bone.
- **Little cartilage or fibrous tissue.** With the unbonded plate almost all new tissue is bone. On day 357 the plane holds 1 602 bone, 202 cartilage and 318 fibrous lattice points. The whole callus holds 482, 13 and 59 mm³.
- **The cartilage zone is on the tension side.** The original sign in `Read_stimulus.cpp` puts cartilage at HP < -0.15 MPa, with HP positive in compression, so the zone is hydrostatic tension. Claes & Heigele (1999) put cartilage in compression. Stage 6 shows the rule the code applies.
- **The bending acts out of the plane.** The 9.78 N·m moment acts about the y axis, so it bends the bone out of the section plane. Stage 1 draws it as a moment vector (double arrow).
- **E is rebuilt, not read.** Stage 4 recomputes E from the lattices; it is not read from a file. The same code matches the run's day-358 `.inp` exactly, but day 357 itself has no `.inp` on disk.
- **No strain outside the callus.** CalculiX prints strain only for the callus set, so stage 5 draws the bone ends and the marrow as outlines.
- **Plane name.** x = 0 is named the FRONTAL (coronal) plane: it holds the bone axis and the plate direction (+y), so with the plate taken as medial and x as antero-posterior it is frontal. The owner settled the name on 2026-11-08 (not checked against the paper's plate side); older figures and code titled it "sagittal", and the tools now say "frontal" (x = 0) and "sagittal" (y = 0).
