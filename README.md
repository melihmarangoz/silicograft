# SilicoGraft

**Bone graft healing, simulated in silico.**

SilicoGraft is an open-source platform for testing grafts in a computer before they reach the clinic. It couples an agent-based model of cells with finite-element mechanics and follows how a graft resorbs and turns into tissue. The aim is to help design better grafts in the physical world.

| Model | What it covers | Status |
|---|---|---|
| **SG-Bone** | Bone grafts and bone regeneration | |
| · long bone | Sheep tibia, empty 30 mm defect, validated against Perier-Metz 2022 | done |
| · dental | Immediate implant in an extraction socket, β-TCP in the jumping gap | in progress |
| SG-Skin | Skin grafts | planned |

SG-Bone runs on the open-source finite-element solver [CalculiX](http://www.calculix.de/) instead of Abaqus.

This repository is built on **[camille-PM/mechanobio_bone_2](https://github.com/camille-PM/mechanobio_bone_2)** by Camille Perier-Metz (Apache License 2.0; those files keep that licence, see [Licence](#licence)). Its commit history is kept here. That code implements the model published in:

> Perier-Metz C, Cipitria A, Hutmacher DW, Duda GN, Checa S. An in silico model predicts the impact of scaffold design in large bone defect regeneration. *Acta Biomaterialia* 145 (2022) 329–341.

Please cite that paper when you use the model.

## What the model does
An agent-based model on a 0.1 mm lattice tracks four cell types (mesenchymal stem cells, fibroblasts, chondrocytes, osteoblasts). Each cell can migrate, proliferate, differentiate and die.

Every 3 days a linear-elastic finite-element analysis of the healing region gives the local mechanical signals: minimum principal strain and hydrostatic pressure. These signals decide which tissue forms (Claes and Heigele type rules). Tissue stiffness is updated with a rule of mixtures. The cell rules are unchanged from the original code. Only the coupling to the FE solver was rewritten (see [NOTICE](NOTICE)).

## Contents
| Path | What it holds |
|---|---|
| `long_bone/src/` | C++ model. Upstream sources with the CalculiX port; changes are marked `[CCX]` |
| `long_bone/geometri/` | gmsh script that builds the sheep tibia model (bone ends, marrow, callus, plate, screws) |
| `long_bone/araclar/` | Environment, build, run, plotting and comparison scripts |
| `long_bone/sonuclar/` | Figures and GIFs of the validation runs |
| `long_bone/web3d_uygulama/` | three.js viewer that replays a run day by day |
| `long_bone/docs/` | Comparison with Perier-Metz 2022 (in Turkish for now) |
| `dental/` | Immediate implant with β-TCP in the jumping gap: design and literature review (work in progress) |

Folder and script names are still Turkish. They will be renamed in a later commit.

## Validation (long bone, empty 30 mm defect)
The model reproduces the empty-defect case of Perier-Metz 2022 with the plate unbonded from the callus, as in the paper. Mean ± SD over three seeds:

| | Bone at day 90 (mm³) | Bone at day 359 (mm³) | Bridge along the plate (% of defect slices) |
|---|---|---|---|
| This port, original sign convention | 106 ± 1 | 479 ± 51 | 98 |
| This port, Claes sign convention | 109 ± 5 | 445 ± 12 | 98 |
| Perier-Metz 2022, month 3 | ~170 (experiment), ~150 (simulation) | | |

There is no union, bone grows sparsely from the cortices and the marrow does not close. A nearly continuous bone bridge forms along the plate by 12 months, as the paper reports.

## Running it (Linux or WSL)
You need:
- CalculiX `ccx` 2.17 or later
- Python 3 with `gmsh`, `meshio`, `numpy` and `matplotlib`
- a C++17 compiler

```bash
cd long_bone
. araclar/ortam.sh                      # CalculiX and gmsh paths
# 1. mesh (about 1 minute)
python3 geometri/uzun_kemik_geometri.py --kallus-boyu 1.7 --cikti ~/runs/mesh_h1.7
# 2. run folder and build ("orijinal" or "claes" sign convention)
araclar/kosu_hazirla.sh ~/runs/mesh_h1.7 ~/runs/run_orig orijinal
# 3. a 360-day run with seed 12345 (a few hours, 8 GB RAM or more)
cd ~/runs/run_orig && ./mechanobio 12345 > run_log.txt 2>&1
# 4. figures
python3 ~/path/to/long_bone/araclar/gorsellestir.py ~/runs/run_orig sonuclar --etiket orijinal --gif
```

For a short test, add `-DNUMBER_ITERATIONS_OVERRIDE=10 -DRAW_WRITE_INTERVAL=3` at the end of step 2.

## Status
- Long-bone port: done and validated.
- Dental model (immediate implant with β-TCP): literature review done, model under construction.

## Licence
- SilicoGraft as a whole, and all its additions and modifications, is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0), copyright 2026 Melih Marangoz: see [LICENSE](LICENSE).
- Files from [camille-PM/mechanobio_bone_2](https://github.com/camille-PM/mechanobio_bone_2) (the upstream sources in `long_bone/src`) remain under the **Apache License 2.0**, copyright their authors: see [LICENSE-APACHE-2.0](LICENSE-APACHE-2.0). Several of them were modified for the CalculiX port; [NOTICE](NOTICE) lists the changes.
- The Apache-2.0 code is combined with the AGPL-3.0 code as the licences permit (Apache-2.0 is compatible with the GPLv3 family).
