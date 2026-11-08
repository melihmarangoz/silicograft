# PhysiCell + PhysiCell Studio source study

Clones (shallow, read only):
- PhysiCell engine, C++, VERSION 1.14.2: commit `69a23dbe7eaac4f41dc9548ad85072eff7921a03` (2025-01-31).
- PhysiCell-Studio GUI, Python/PyQt5, VERSION 2.48.0: commit `50ba014ef6ec3f39e6e12493a0abe255298b2b30` (2026-10-11).

Citations: `bin/...` paths are Studio. `core/`, `modules/`, `BioFVM/`, `povray/`, `licenses/`, `sample_projects/` are the engine.

Hands-on note (`simulator_arayuzleri/physicell.md`) against the code: frame buttons, colour-by with fixed cmin/cmax, filter dialog,
no picking, no mouse zoom, per-frame range rescaling, slow redraws and the modal error on a half-written SVG are all confirmed.
New from the code: PNG per frame is real; the population plot also counts by phase, cycle model, motility and death state;
Make Movie drops the last frame; the all-zero default colour variable comes from a list reversal. Marked "Hands-on" below.

## A. Architecture map

- Engine and GUI talk only through files. No socket, no shared memory.
- Per output step the engine writes `outputNNNNNNNN.xml` (MultiCellDS), `..._cells.mat`, `..._microenvironment0.mat`, three graph
  text files and `snapshotNNNNNNNN.svg` (modules/PhysiCell_MultiCellDS.cpp:735, 1094, 1143, 1191; SVG: modules/PhysiCell_pathology.cpp:405).
- `bin/studio.py`: one QWidget with tabs. The `-3` flag imports `vis3D_tab.Vis` (VTK) instead of `vis_tab.Vis` (matplotlib)
  (bin/studio.py:156-169, 1627). That class becomes the "Plot" tab (bin/studio.py:424-436). A session is 2D or 3D, never both.
- `bin/vis_base.py` (3481 lines, `VisBase` at line 309): shared controls and logic (frames, colour-by, cmin/cmax, population plot,
  legend, filter, movie). `bin/vis_tab.py` (2D): matplotlib Figure in `FigureCanvasQTAgg`, 2x2 gridspec for plot and colour bars
  (bin/vis_tab.py:333-355). `bin/vis3D_tab.py` (3D): VTK in `QVTKRenderWindowInteractor` (bin/vis3D_tab.py:1226-1270).
  `bin/filters2D.py`, `bin/filters3D.py`: the "Plot options" windows. ECM variants (`bin/vis_tab_ecm.py`) not studied.
- `bin/pyMCDS.py` (BSD) reads one frame: ElementTree for the XML, `scipy.io.loadmat` for the .mat (bin/pyMCDS.py:1288).
  `bin/run_tab.py` starts the executable with QProcess and streams stdout (bin/run_tab.py:247-249).
- Caching and threads: none for plotting. Each redraw builds a new pyMCDS and re-reads XML and .mat (bin/vis_tab.py:720) or re-parses
  the SVG (bin/vis_tab.py:451). With the graph overlay on, the frame is read twice (bin/vis_tab.py:283, 322-330). All of it runs on
  the Qt main thread. Hands-on "2-3 s per frame": this is why.
- One hook: a per-folder "frame loader" can replace file reading (bin/pyMCDS.py:58-75), used by the UQ import (bin/uq_physicell_db.py:572).

## B. Cell drawing

2D has two modes, radio buttons ".svg" and ".mat" (bin/vis_base.py:748-751).

- .svg (default): Studio parses the engine's snapshot SVG and redraws its circles (bin/vis_tab.py:428-583). The colour is the RGB(A)
  string the engine wrote, so the model's own colouring. Alpha is doubled (bin/vis_tab.py:516). The second circle is the nucleus,
  drawn only when "nucleus" is ticked (bin/vis_tab.py:548).
- The SVG is already a cross-section. The engine writes a cell only if |z - z_slice| < r, with radius sqrt(r^2 - dz^2), nucleus
  likewise (modules/PhysiCell_pathology.cpp:625, 773-783).
- .mat: positions and `total_volume`, radius r = (V / (4/3 pi))^(1/3) (bin/vis_tab.py:750-753). No slicing: every cell gets its full
  radius whatever its z, so a 3D run becomes a projection.
- Both modes call `circles()` (bin/vis_base.py:3070-3150): one matplotlib `Circle` patch per cell in a `PatchCollection`, radius in
  data units, scalar through `set_array` and `set_clim`. No instancing, LOD or decimation. Each frame clears the axes
  (bin/vis_tab.py:266) and rebuilds every patch.

3D (bin/vis3D_tab.py:178-251, 1540-1797):
- Points in a `vtkUnstructuredGrid` with one 2-component array "cell_data" = (radius, scalar) (bin/vis3D_tab.py:195-206).
- `vtkGlyph3D` with a unit `vtkSphereSource`: scale by component 0, colour by component 1 (`ColorByArrayComponent("cell_data", 1)`)
  (bin/vis3D_tab.py:212-249). Same radius formula, (V * 0.2387)^(1/3) (bin/vis3D_tab.py:1661). Points are filled one by one in a
  Python loop (bin/vis3D_tab.py:1648-1678).
- Sphere resolution 8 by default, 3-42 allowed (bin/vis3D_tab.py:79; bin/filters3D.py:216-219). `vtkGlyph3D` copies the sphere
  polygons per cell on the CPU, no GPU instancing. `--tensor` uses `vtkTensorGlyph` with a diagonal tensor from custom variables
  axis_a/b/c (bin/vis3D_tab.py:1687, 1715): axis-aligned ellipsoids, no orientation.
- No cell limit in the code, capacity unverified (my estimate: ~100 triangles per sphere, so 100k cells = ~10M CPU-built triangles).
  Our InstancedMesh per type is already the faster design. Nothing to take for speed.

## C. Colour by property

How the list of 100+ variables is built (bin/vis_base.py:2755-2965):
- Only from frame 0, the `<labels>` of `output00000000.xml` (bin/vis_base.py:2757-2775). "full list": every expanded label, minus
  ID, sorted (bin/vis_base.py:2776-2778).
- Readable names: prefixes of per-substrate and per-cell-type vectors become text such as "chemotactic response to oxygen", using the
  substrate IDs in the XML and the cell-definition IDs (bin/vis_base.py:2805-2848, 3461-3481). A dict maps the shown name back to
  the column (bin/vis_base.py:2780, 2847).
- "partial": drops about 70 built-in label prefixes and reverses the rest, so custom variables come first. Six preferred ones follow a
  separator: cell_type, current_phase, cycle_model, damage, elapsed_time_in_phase, pressure (bin/vis_base.py:2850-2961). The first
  switch to ".mat" calls it once (bin/vis_base.py:1923-1927). Hands-on "the default colour variable was meaningless (all zero)":
  after the reverse, entry one is the last custom variable (bin/vis_base.py:2952).
- The combobox is editable with a `QSortFilterProxyModel` and a `QCompleter`, so typing filters the list (bin/vis_base.py:76-110).
  In 2D the colour widgets stay disabled until ".mat" is chosen (bin/vis_base.py:802, 1928-1942).

Colour maps and legends:
- Continuous: viridis, viridis_r, YlOrRd, YlOrRd_r, turbo, plasma, jet, coolwarm, handed to matplotlib (bin/vis_base.py:829-836).
  3D handles only jet, viridis and YlOrRd (and _r). Other names keep the previous lookup table (bin/vis3D_tab.py:903-922).
- Discrete variables are a fixed list: cell_type, cycle_model, current_phase, is_motile, current_death_model, dead
  (bin/vis_base.py:341). 2D gives them a 13-colour palette (bin/cmaps.py:11-14), clim -0.5..n-0.5, and a legend of the categories
  seen so far. The seen set grows across frames until the variable changes (bin/vis_tab.py:760, 856-866; reset at
  bin/vis_base.py:1805-1807). Colours and legend therefore stay stable during playback.
- 3D discrete table: 13 `vtkNamedColors`, then random colours with seed 42, built once and kept (bin/vis3D_tab.py:1432-1501,
  1600-1602). So a cell type can change colour between .svg, .mat and 3D modes.

Fixed versus auto range:
- Auto: per-frame min and max (bin/vis_tab.py:745-747; bin/vis3D_tab.py:1627-1665, 1737).
- Fixed: a "fix" checkbox and typed cmin/cmax (defaults 0 and 1), applied on Enter (bin/vis_base.py:850-890, 2041-2048, 2700-2712;
  used at bin/vis_tab.py:741-744 and bin/vis3D_tab.py:1734-1735). There is no "lock the current range" button. One cmin/cmax
  pair serves all variables.
- 3D scans all frames for a global min/max when the variable changes (bin/vis3D_tab.py:886-899). `plot_cells3D` then resets and
  recomputes per frame before use (bin/vis3D_tab.py:1627), so the global range is lost. Hands-on "range rescales every frame unless
  fix is set": true in 2D and 3D.
- Substrates have their own fix/cmin/cmax (bin/vis_tab.py:986-994). Their per-substrate memory `field_min_max` stores the QLineEdit
  method, not its value, and nothing reads it (bin/vis_base.py:2740-2747).
- Colour bar: matplotlib colorbar under the plot, reused with `update_normal` (bin/vis_tab.py:868-883). 3D: `vtkScalarBarActor`
  (bin/vis3D_tab.py:392, 1797).

## D. Slices, clipping, cross-sections

- 2D .svg is the engine's z-slice (section B), 2D .mat a projection. ROI zoom: typed centre and radius set the axis limits
  (bin/vis_tab.py:249-256; bin/filters2D.py:138-180). Grids: substrate voxels, and a "mech" grid of typed spacing (default 30 µm,
  not read from the run) (bin/vis_tab.py:407-425; bin/filters2D.py:194-204).
- 3D substrate: XY, YZ, XZ slices are `vtkCutter` on a `vtkStructuredPoints` with cell data, at typed positions
  (bin/vis3D_tab.py:277-330, 1961-1975). Isosurface: `vtkCellDataToPointData` + `vtkContourFilter` (bin/vis3D_tab.py:335-350).
  Hands-on "faint lines in the 2D model": the substrate grid is one voxel thick, so YZ and XZ cuts are thin strips (my reading).
- 3D cells: three axis-aligned planes, each a `vtkExtractPoints` with a `vtkPlane`, chained, with a "flip" that negates the normal
  (bin/vis3D_tab.py:1749-1789). A cell is kept or dropped whole by its centre. Cut cells get no caps (the POV-Ray path has them, H).

## E. Time

- Frame index = the 8-digit file number. Time from the XML metadata (bin/vis3D_tab.py:1565; bin/vis_tab.py:722).
- Controls: `|< < [n] > >|` and Play (bin/vis_base.py:690-729). The frame box applies on Enter (bin/vis_base.py:1072, 2029-2039).
  No slider. Last frame: glob `output*.xml`, sort, read the number (in .svg mode the smaller of last SVG and last XML)
  (bin/vis_base.py:2361-2421).
- Play: a QTimer at 1 ms, one frame per tick, stops when the next file is missing (bin/vis_base.py:2459-2495, 2967-2985; 3D
  bin/vis3D_tab.py:1124-1147). Real speed = redraw time. No preloading, no cache, no interpolation. Nothing watches the folder during
  a run, which fits Hands-on "the Plot tab stays empty until you press a frame button".

## F. Picking and inspection

- None in the Plot tabs: no `mpl_connect` in bin/vis_tab.py, no picker or observer in bin/vis3D_tab.py (grep). Hands-on confirmed.
  The ICs tab does use matplotlib mouse events, to place cells (bin/ics_tab.py:1221-1226).
- 3D uses VTK's default interactor, Studio sets no style (bin/vis3D_tab.py:1233-1270). The j/t/r keys come from VTK's default style
  switch (unverified, standard VTK behaviour).
- Where it would go: 2D, a `button_press_event` handler plus nearest-centre search in the frame's DataFrame. 3D, a point picker on
  the glyph output mapped back through the glyph's input point ids. We already have picking with history. Nothing to port.

## G. Plots linked to the view

- "Population plot" counts by cell_type, cycle_model, current_phase, is_motile, current_death_model or dead (bin/vis_base.py:406,
  1010-1029; Hands-on listed only cell types). Post hoc only. It loads every `output*.xml` into a list of pyMCDS objects, then counts (bin/vis_base.py:1329-1350). Memory grows
  with the frame count. Time axis = linspace(0, last time, N), which assumes even output spacing (bin/vis_base.py:1356). Dead cells
  are left out with `cycle_model < 100` (bin/vis_base.py:1390-1395).
- Each click opens a new `PopulationPlotWindow` (bin/vis_base.py:259-283, 1364). No current-frame cursor, no click-to-seek, no
  refresh during play. The only link to the view: the cell-type filter applies to the counts (bin/vis_base.py:1390, 1440-1446, 1468)
  and to the drawing (.svg by type name, .mat by index; bin/vis_tab.py:491, 312-320).
- Legend: a separate window showing the engine's `legend.svg` (bin/vis_base.py:203-251, 1304-1313). Filter: a separate non-modal
  dialog of checkboxes with Apply (bin/vis_base.py:1136-1186).
- Graph overlay: neighbours, attachments or springs from the engine's text files (bin/vis_tab.py:357-376), one `ax0.plot` per edge
  (bin/vis_tab.py:283-291). Bug: Studio skips line one as a header (bin/vis_tab.py:372) but the engine writes no header
  (modules/PhysiCell_MultiCellDS.cpp:1219-1243), so the first cell's edges are lost. pyMCDS reads all lines (bin/pyMCDS.py:43-49).

## H. Export

- "save frame*": every redraw writes `frameNNNN.png/.svg/.jpg` into the output folder with `savefig` (bin/vis_tab.py:306-310;
  bin/filters2D.py:207-216, 360-366). Tick it and press Play to dump all frames. Hands-on "PNG per frame (not verified)": the code
  does this. 3D: the same checkbox, PNG only, `vtkWindowToImageFilter` + `vtkPNGWriter` (bin/vis3D_tab.py:553-576).
- Make Movie (2D only, hidden with --galaxy; bin/vis_base.py:1038-1050): it redraws each frame, copies `canvas.buffer_rgba()` into an
  imshow artist, keeps all frames in memory, then saves an mp4 with `ArtistAnimation` and ffmpeg at 100 ms per frame (10 fps),
  dpi 200 (bin/vis_base.py:3389-3456).
- It counts SVG files minus one and `range()` drops one more (bin/vis_base.py:3406-3420), so the last frame is missing. The loop sets
  `current_svg_frame` but `update_plots` draws `current_frame`; the frames seem to advance because the Play timer started at
  bin/vis_base.py:3414 fires during `flush_events` (my reading, unverified). Do not copy this pattern.
- "Save snap.csv": x, y, 0, type name of the current frame, written to the working directory for reuse as initial cells
  (bin/vis_tab.py:221-247). Simularium export through `simulariumio` when installed (bin/studio.py:69-71; bin/vis_base.py:3270-3330).

Offline rendering with POV-Ray (engine):
- modules/PhysiCell_POV.cpp writes the scene head (camera on a sphere around the domain, one fading light), spheres with `rgbf`
  pigment and ambient/diffuse/specular finish, and (a,b,c,d) clipping planes (modules/PhysiCell_POV.cpp:71-141, 143-222, 229-243).
- Worked example: sample_projects/cancer_immune/scripts/CI_POV_writer.cpp (`CI_POV_writer.cpp` below). It reads the cells .mat
  (line 96) and cuts one octant away with three planes (lines 101-110). The look comes from three choices:
  1. Capped cuts. A cell crossing a plane is written as `intersection{ union{planes} sphere }`, so the cut face is a flat disc in the
     cell colour (CI_POV_writer.cpp:166-228). Cells wholly on the removed side are not written.
  2. A nucleus sphere inside, capped by the same planes shifted 0.1 µm so the two cut faces do not z-fight
     (CI_POV_writer.cpp:242-295). Nucleus colour = cell colour x 0.125, and it casts no shadow (CI_POV_writer.cpp:289-291, 371).
  3. Matte finish: ambient 0.025, diffuse 1, specular 0.1, white background (CI_POV_writer.cpp:321-323).
- `povray/*.inc` are simpler fixed headers: three to five white lights and a `FinishMacro` that makes cells past a `crossPlane`
  corner transparent (povray/header.inc:1-59; povray/header_with_clipping_plane.inc:1-47). Nothing in this repo includes them
  (unverified who does). Useful for our look: the capped cut with a dark nucleus at the slab faces (K3). The rest is standard.

## I. Engine cell-cell interaction model

Overdamped, centre-based. Pair terms add to a velocity. Position update is two-step Adams-Bashforth, x += dt (1.5 v - 0.5 v_prev),
and the velocity is reset each mechanics step (core/PhysiCell_cell.cpp:846-879).

Pair term `Cell::add_potentials` (core/PhysiCell_cell.cpp:962-1068), d = centre distance:
- Repulsion for d < R = r_i + r_j: c_r (1 - d/R)^2 with c_r = sqrt(c_r,i c_r,j) (core/PhysiCell_cell.cpp:988-1019).
- Adhesion for d < S = s_i r_i + s_j r_j (s = relative_maximum_adhesion_distance, default 1.25): minus c_a (1 - d/S)^2, with
  c_a = sqrt(c_a,i A_ij c_a,j A_ji) and A the per-type adhesion affinities (core/PhysiCell_cell.cpp:1028-1052).
- v_i += (rep - adh) (x_i - x_j) / d (core/PhysiCell_cell.cpp:1060-1064). Units are velocity (µm/min), not force.
- Pressure proxy: simple_pressure += (1 - d/R)^2 / 0.02729, so 12 close-packed neighbours give about 1 (core/PhysiCell_cell.cpp:974,
  1013). "Contact" means only d < S; such cells go into `state.neighbors` (core/PhysiCell_cell.cpp:1054). No contact area, no shape.
- Defaults: c_a 0.4, c_r 10, membrane adhesion 4 and repulsion 100, at most 12 springs, spring constant 0.01, attach and detach rates 0
  (core/PhysiCell_phenotype.cpp:675-693). The velocity update adds an optional basement membrane term of the same form, the pair
  terms, then the motility vector (core/PhysiCell_standard_models.cpp:614-686).

Springs: `dynamic_spring_attachments` drops each spring with probability detachment_rate*dt and attaches to `state.neighbors` with
probability attachment_rate*dt*affinity up to the maximum (core/PhysiCell_standard_models.cpp:1466-1504). Each spring adds
v_i += k (x_j - x_i), a zero-rest-length linear spring, k = sqrt(k_i A_ij k_j A_ji) (core/PhysiCell_standard_models.cpp:980-997;
called at core/PhysiCell_cell_container.cpp:250-270). A rest-length variant, 0.952 (r_i + r_j), exists but is commented out at the
call site (core/PhysiCell_standard_models.cpp:1000-1028; core/PhysiCell_cell_container.cpp:267). User `contact_function`s run over
`state.attached_cells` (core/PhysiCell_standard_models.cpp:1033-1045).

Neighbour search:
- `Cell_Container`: a uniform Cartesian mechanics mesh and `agent_grid`, one `vector<Cell*>` per voxel
  (core/PhysiCell_cell_container.cpp:99-112), 30 µm voxels in the template (sample_projects/template/main.cpp:121-122).
- Each cell scans its own voxel and the 26 Moore neighbours (core/PhysiCell_standard_models.cpp:625-646). A neighbour voxel is
  skipped when the cell is farther from the shared face, edge or corner than its own reach plus the largest reach stored for that
  voxel (core/PhysiCell_cell.cpp:1263-1318; stored at 690-700). Moved cells change voxel lists (core/PhysiCell_cell.cpp:900-937).
  Cells leaving the domain are frozen, not deleted (core/PhysiCell_cell.cpp:880-891).
- Order every mechanics_dt, each an OpenMP loop over cells: contact functions, custom rules, velocities, springs,
  phagocytosis/attack/fusion, positions, voxel update (core/PhysiCell_cell_container.cpp:204-316).

Per-cell output and Studio's mapping:
- The XML `<labels>` give name, start index, size and units (modules/PhysiCell_MultiCellDS.cpp:701-725). Rows: 70 fixed (55 scalars,
  5 three-vectors: position, orientation, velocity, migration bias direction, motility vector), 8 per substrate, 7 per cell type,
  1 per death model, then custom scalars and vectors (registered at modules/PhysiCell_MultiCellDS.cpp:256-605).
- The first 17 rows are fixed for compatibility: ID, position(3), total_volume, cell_type, cycle_model, current_phase,
  elapsed_time_in_phase, nuclear and cytoplasmic volume, fluid and calcified fraction, orientation(3), polarity (lines 256-305).
  Mechanics in the output: velocity, pressure, adhesion and repulsion strengths, affinities, adhesion distance, spring settings
  (lines 820-902). Neighbour, attachment and spring lists go to the text files.
- The .mat is MATLAB v4: 20-byte header, then a double matrix "cells", one column per cell (BioFVM/BioFVM_matlab.cpp:537-574; modules/PhysiCell_MultiCellDS.cpp:760-783).
- Studio walks the labels in order. Size-3 spatial labels become `_x/_y/_z`, other vectors `_0.._n`, and row k becomes
  `data[label_k] = cells[k, :]` (bin/pyMCDS.py:1244-1298). It ignores the `index` attribute and trusts the order.
  `elapsed_time_in_phase` is registered twice (modules/PhysiCell_MultiCellDS.cpp:283, 345); the dict keeps the second, same value.

For our next step: a cheap pairwise (1 - d/R)^2 law on a uniform grid with a 26-voxel scan. Our lattice is such a grid already. To
relax drawn cell positions off the lattice, this law with a one-site cut-off would take a few lines (idea only, not tested).

## J. Licence

- Engine: BSD-3 (licenses/PhysiCell.txt; header in each source, e.g. core/PhysiCell_cell.cpp:34-36). BioFVM BSD-3, MaBoSS BSD-3,
  pugixml MIT (licenses/). CI_POV_writer.cpp is BSD-3 (sample_projects/cancer_immune/scripts/CI_POV_writer.cpp:34-36).
  `povray/*.inc` have no header, presumably the project's BSD-3 (unverified).
- Studio: GPL v3 for the whole repo (LICENSE), "due to the use and licensing of PyQt5". BSD-3 exceptions (LICENSE-BSD-3-Clause.txt):
  files matching `*.xml`, `*.yml`, `*.csv`, `pyMCDS*.py`, `.gitignore` (Studio README.md:18-28). `bin/pyMCDS.py` repeats BSD-3 in its
  header (bin/pyMCDS.py:6). The `circles()` helper is a BSD-3 gist pasted into a GPL file (bin/vis_base.py:3072, 3105-3108).
- Copy, keeping the copyright line and BSD text: engine code and formulas, the POV capping logic, pyMCDS's label expansion.
- Re-implement only, from the behaviour written here: everything in `bin/vis*.py`, `bin/filters*.py`, `bin/studio.py`,
  `bin/cmaps.py`. Ideas such as colour-by, a fixed range or a population plot are free. Their GPL code is not, not even short snippets.
- Colour maps: take viridis stops from a permissive source, not from Studio's `bin/cmaps.py` (viridis itself is CC0, from memory,
  not checked here).

## K. Port list

K1. Colour by a per-cell property with "day / whole run / locked" range. Effort M.
Scalars: days in current state, arrival day, same-type or non-bone neighbours, distance to bone. Studio's auto range flickers
(bin/vis_tab.py:745-747), its fixed range needs typed numbers (bin/vis_base.py:2041-2048), its global scan is lost
(bin/vis3D_tab.py:886-899 vs 1627). We add a run range (computed once at load, in chunks) and a Lock button that freezes the range shown.
```js
const MAP = VIRIDIS_256, C = new THREE.Color();           // Float32Array(768) from a permissive source
const lut = (t) => { const k = Math.max(0, Math.min(255, (t * 255) | 0)); return C.setRGB(MAP[3*k], MAP[3*k+1], MAP[3*k+2]); };
let rng = { mode: "run", lo: 0, hi: 1 }, cur;              // mode: "day" | "run" | "locked"
function colourBy(F, day) {                                // F.at(day): Float32Array per drawn cell; F.runLo, F.runHi
  const v = F.at(day); let { lo, hi } = rng;
  if (rng.mode === "day") { lo = Infinity; hi = -Infinity; for (const x of v) { lo = Math.min(lo, x); hi = Math.max(hi, x); } }
  if (rng.mode === "run") { lo = F.runLo; hi = F.runHi; }
  for (const K of kumeler.flat()) { for (let i = 0; i < K.n; i++) K.govde.setColorAt(i, lut((v[K.idx[i]] - lo) / ((hi - lo) || 1)));
    K.govde.instanceColor.needsUpdate = true; }
  cur = { lo, hi }; bar.style.background = cssGradient(MAP); barLo.textContent = lo.toFixed(1); barHi.textContent = hi.toFixed(1);
}
lockBtn.onclick = () => { rng = { mode: "locked", ...cur }; };
```

K2. Orthogonal section panel next to the 3D view. Effort M.
A 2D canvas shows cells cut by a movable plane as discs of radius sqrt(r^2 - d^2) plus nucleus discs, the engine's SVG rule
(modules/PhysiCell_pathology.cpp:625, 773-783). A plane in 3D marks the cut. A click selects the cell through `bilgiGoster`. In our
slab the useful cut is across the thin axis (one of 5 layers): a 28x28 "histology" view. Non-round cells use a bounding radius.
```js
function drawSection(ctx, ax, pos, day) {                  // ax = 0|1|2, pos in mm
  ctx.clearRect(0, 0, W, H); hits.length = 0;
  for (const c of drawnCells(day)) {                       // { p: [x,y,z], r, rn, css, tur, site }
    const d = Math.abs(c.p[ax] - pos); if (d >= c.r) continue;
    const [u, v] = toPx(c.p, ax);                          // the two other axes -> pixels
    disc(ctx, u, v, Math.sqrt(c.r * c.r - d * d) * pxPerMm, c.css);
    if (d < c.rn) disc(ctx, u, v, Math.sqrt(c.rn * c.rn - d * d) * pxPerMm, NUC_CSS);
    hits.push({ u, v, c });
  }
  planeMesh.position.setComponent(ax, pos);                // semi-transparent THREE.PlaneGeometry in the 3D scene
}
sectionCanvas.onclick = (e) => { const h = nearest(hits, e.offsetX, e.offsetY); if (h) bilgiGoster(h.c.tur, h.c.site); };
```

K3. Capped cut faces with dark nuclei at the slab faces (the POV look). Effort M (exact stencil caps: L).
Cells cut by the slab's clipping planes now show open shells. POV caps the cut with a flat disc in the cell colour and a darker
nucleus disc (CI_POV_writer.cpp:166-228, 242-295, 371). In three.js: a pair of disc InstancedMeshes per slab face, clipped only by
the other planes so their own plane does not hide them.
```js
const disc = new THREE.CircleGeometry(1, 24), Z = new THREE.Vector3(0, 0, 1), M = new THREE.Matrix4(), S = new THREE.Vector3();
const capB = new THREE.InstancedMesh(disc, new THREE.MeshLambertMaterial(), MAXCAP);
const capN = new THREE.InstancedMesh(disc, new THREE.MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: -2 }), MAXCAP);
function updateCaps(cells, plane) {                        // plane: one THREE.Plane of kutuDuzlemleri
  const q = new THREE.Quaternion().setFromUnitVectors(Z, plane.normal); let n = 0;
  for (const c of cells) {                                 // c.p Vector3, c.r, c.rn, c.col THREE.Color
    const d = plane.distanceToPoint(c.p); if (Math.abs(d) >= c.r || n >= MAXCAP) continue;
    const at = c.p.clone().addScaledVector(plane.normal, -d);
    capB.setMatrixAt(n, M.compose(at, q, S.setScalar(Math.sqrt(c.r * c.r - d * d)))); capB.setColorAt(n, c.col);
    const rn = Math.abs(d) < c.rn ? Math.sqrt(c.rn * c.rn - d * d) : 1e-6;
    capN.setMatrixAt(n, M.compose(at, q, S.setScalar(rn))); capN.setColorAt(n, c.col.clone().multiplyScalar(0.125)); n++;
  }
  capB.count = capN.count = n; capB.instanceMatrix.needsUpdate = capN.instanceMatrix.needsUpdate = true;
}
```

K4. Frame and movie export with a day stamp. Effort M.
Studio saves one image per redraw (bin/vis_tab.py:306-310; bin/vis3D_tab.py:553-576) and builds an mp4 from canvas grabs
(bin/vis_base.py:3389-3456). We render, copy the WebGL canvas to a 2D canvas in the same task and draw the day there (our HTML
overlays are not in the WebGL image). Movie: MediaRecorder, one day per frame. With "no downloads" the result goes to an
`<img>`/`<video>` overlay for right-click saving or to the artifact runtime's file-save capability (both unverified under our CSP).
```js
function snapshot(out) {                                   // render and read back in the same task: no preserveDrawingBuffer
  render(); const g = out.getContext("2d"); g.drawImage(tuval, 0, 0);
  g.font = "600 28px system-ui"; g.fillStyle = "#fff"; g.fillText(`Gün ${Math.round(durum.gun)}`, 24, 44);
}
async function movie(d0, d1) {
  const out = Object.assign(document.createElement("canvas"), { width: tuval.width, height: tuval.height });
  const st = out.captureStream(0), rec = new MediaRecorder(st, { mimeType: "video/webm" }), parts = [];
  rec.ondataavailable = (e) => parts.push(e.data);
  rec.onstop = () => { video.src = URL.createObjectURL(new Blob(parts, { type: "video/webm" })); overlay.hidden = false; };
  rec.start();
  for (let d = d0; d <= d1; d++) { gunAyarla(d); snapshot(out); st.getVideoTracks()[0].requestFrame(); await new Promise((r) => setTimeout(r, 100)); }
  rec.stop();
}
```

K5. Same-type neighbour graph overlay. Effort S.
Studio draws neighbour and spring edges from the engine's graph files, one matplotlib line per edge (bin/vis_tab.py:283-291, 357-376).
Ours: "same type among the 26 neighbours", which shows connected tissue and an osteocyte-network look. One LineSegments buffer
between the drawn (jittered) positions, rebuilt when the day changes.
```js
const MAXE = 60000, pos = new Float32Array(MAXE * 6), geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
const edges = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x202020, transparent: true, opacity: 0.35, clippingPlanes: kutuDuzlemleri }));
function buildEdges(day, code) {
  const c = kodlar(R, day); let e = 0;
  for (let s = 0; s < c.length; s++) if (c[s] === code)
    for (const t of HALF13[s])                             // 13 of the 26 offsets, so each edge appears once
      if (c[t] === code && e < MAXE) { drawnPos(s).toArray(pos, 6 * e); drawnPos(t).toArray(pos, 6 * e + 3); e++; }
  geo.setDrawRange(0, 2 * e); geo.attributes.position.needsUpdate = true;
}
```

K6. One type filter for the 3D view and the chart, plus hover highlight. Effort S.
Studio's filter is the only link between its view and its population plot (bin/vis_base.py:1390; bin/vis_tab.py:312-320). Our legend
toggles should also hide and rescale the chart series. Hovering a series dims the other types in 3D (linked selection, absent in
Studio). Body materials are per type, but the nucleus material is shared, so per-type nucleus dimming needs one material per type.
```js
function setTypeVisible(t, on) {
  durum.gizli[t] = !on;
  for (const K of kumeler[t]) { K.govde.visible = K.cekirdek.visible = on; if (K.kapsul) K.kapsul.visible = on; }
  grafikCiz();                                             // grafikCiz drops series with durum.gizli[s.tur], y range from the rest
}
$("grafik").addEventListener("mousemove", (e) => highlight(seriesUnder(e)));   // -1 when no series is near
$("grafik").addEventListener("mouseleave", () => highlight(-1));
function highlight(t) {
  kumeler.forEach((Ks, i) => { const m = Ks[0].govde.material, dim = t >= 0 && i !== t; m.transparent = dim; m.opacity = dim ? 0.15 : 1; });
}
```

Not in Studio, so nothing to port: side-by-side runs, a time slider, click-to-seek on a chart, cell history. Our viewer has the last three.
