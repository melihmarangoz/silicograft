# Interfaces of four cell-simulation tools (hands-on, 2026-11-07)

PhysiCell (+ PhysiCell Studio), CompuCell3D (Player5, Twedit++), BioDynaMo (+ ParaView) and Morpheus were
installed and run with sample models in throwaway Linux containers (software OpenGL, no GPU), to see what their
interfaces offer and what the cell viewer (`../hucre3b.html`) should take. One file of notes per tool here.

A comparison page with all 32 screenshots, a feature table and the ranked ideas was made separately; it is
not part of this repository.

Short version: none of the four lets you click a cell and see its history, and only PhysiCell Studio and
ParaView can scrub through time. Worth taking: colour by any property with a lockable range (all four),
an orthogonal slice next to the 3D view (CompuCell3D), an auto-drawn differentiation rule graph (Morpheus),
side-by-side runs, frame/movie export with a day stamp (website only).

## Source code study (`kod/`)

All four are open source, so we read the code instead of reverse engineering the binaries. Shallow clones,
read only, nothing built or run. `kod/BRIEF.md` is the shared brief (questions A-K); one note per tool, each
with commit hashes and file:line citations. PhysiCell, CompuCell3D and BioDynaMo were read by Claude
subagents, Morpheus by Codex (gpt-6.1-terra); sampled citations were checked against the source.

What the code adds to the hands-on notes:
- It explains yesterday's puzzles: PhysiCell Studio re-reads files on every redraw (slow frames) and its
  per-frame range overwrites the global one; Player5's "pixelized" preference is set on a drawer that is then
  discarded (`GraphicsFrameWidget.py:45-56`); BioDynaMo does not export `uid_` by default, so ParaView shows
  a glyph vertex id, and its default substance volume and fixed-scale arrows hide the cells.
- Corrections: CompuCell3D Player5 can replay stored `.dml` + `.vtk` frames (file list, no slider).
- Licences: PhysiCell engine BSD-3, Studio GPL-3 (except `pyMCDS*.py` and data files), CompuCell3D MIT,
  Player5 LGPL-3, BioDynaMo Apache-2.0, Morpheus BSD-3. Re-implement GUI ideas; do not copy GPL/LGPL code.
- Merged port list (comparison page, section "Kaynak koddan öğrendiklerimiz"): colour by property with a
  lockable range and colour bar; an orthogonal slice panel linked to 3D; chart-3D linking; capped cut faces at
  the slab's clipping planes (PhysiCell POV-Ray idea); a day-stamped frame shown in-page; side-by-side runs;
  a differentiation rule graph built from explicit transition metadata.
- For cell-cell interactions: our model is one agent per lattice site, so a CPM-style type-type affinity table
  summed over precomputed neighbour offsets (CompuCell3D, Morpheus) fits better than the centre-based force
  laws of PhysiCell and BioDynaMo.
