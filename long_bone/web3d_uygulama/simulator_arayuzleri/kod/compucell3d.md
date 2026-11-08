# CompuCell3D + Player5: how the viewer works (code study)

Clones (shallow, read only):
- `[CC3D]` = `kaynak/CompuCell3D`, commit `9720568a6066b2a459ea7f7b93596bc656cdd012` (2026-10-27).
- `[P5]` = `kaynak/cc3d-player5`, commit `4c0e16d8144423412774fd10667ca74edc689715` (2026-10-27).

Paths are from each repo's root. The hands-on note (`simulator_arayuzleri/compucell3d.md`) is confirmed
unless a point is marked **Correction**.

## A. Architecture map

- Three layers. The C++ engine (`[CC3D] CompuCell3D/core/CompuCell3D/`) holds the lattice. A C++ "field
  extractor" (`[CC3D] CompuCell3D/core/pyinterface/PlayerPythonNew/FieldExtractor*.cpp`, SWIG) copies lattice
  data into VTK arrays. Python (`[CC3D] cc3d/core/GraphicsOffScreen/`) builds the VTK pipelines. Player5
  (`[P5] cc3d/player5/`) is the PyQt5 shell.
- Python hands the raw address of an empty VTK array to C++, which fills it in place
  (`[CC3D] cc3d/core/GraphicsOffScreen/GenericDrawer.py:167-176`). No files, no copies through Python.
- `GenericDrawer` is the hub: it picks a 2D or 3D model/view pair (`GenericDrawer.py:329-346`), a draw
  function per field type (`:70-78`), then adds borders, links, box and axes (`:410-443`).
- Every MDI graphics window builds its own `GenericDrawer` and renderer
  (`[P5] cc3d/player5/Graphics/GraphicsFrameWidget.py:52-56`, `[P5] cc3d/player5/Plugins/ViewManagerPlugins/SimpleTabView.py:446-490`).
  So two windows extract the same lattice twice.
- Threads: the simulation runs in a QThread and signals "step done" only every `ScreenUpdateFrequency` MCS
  (`[P5] cc3d/player5/Simulation/main_loops.py:112-126`). The GUI thread locks `drawMutex`, draws every
  window (`SimpleTabView.py:2109-2146`) and releases a semaphore the simulation waits on (`SimpleTabView.py:1638-1639`).
- **Bug (explains the hands-on workaround).** `QGraphicsFrame.__init__` applies the "PixelizedCartesianFields"
  preference to one drawer, then throws it away and passes a fresh `GenericDrawer` to the base class
  (`[P5] cc3d/player5/Graphics/GraphicsFrameWidget.py:45-56`). The screen drawer keeps the code default
  `pixelized_cartesian_field = True` (`[CC3D] cc3d/core/GraphicsOffScreen/MVCDrawModel2D.py:59`). So the
  Preferences checkbox cannot switch the 2D mode; only editing that default works. Why pixelized quads came
  out empty on software GL is unverified.
- Steering: `add_steering_param` stores a `SteeringParam` in `persistent_globals.steering_param_dict`
  (`[CC3D] cc3d/core/PySteppables.py:1144-1175`). The panel's `setData` sets `val` (lock-protected,
  `[CC3D] cc3d/core/SteeringParam.py:64-80`) and a dirty flag (`[P5] cc3d/player5/steering/SteeringPanelModel.py:87-106`).
  After each steppable's `step()`, `process_steering_panel_data()` runs if anything is dirty; all flags are
  cleared at the end of the MCS (`[CC3D] cc3d/core/SteppableRegistry.py:160-170`, `PySteppables.py:1132-1142`).
  User code copies the value into cells (`[CC3D] CompuCell3D/core/Demos/SteeringPanel/steering_panel_demo_serialize/Simulation/steering_panel_demo_steppables.py:12-25`).
  So a slider acts at the next MCS. The XML Model Editor steers C++ modules via `updateCC3DModule` +
  `steer()` (`[P5] cc3d/player5/Simulation/SimulationThread.py:270-293`).

## B. Cell drawing (extra depth: voxel to surface)

A CC3D cell is the set of sites that point to the same `CellG` in a `Field3D<CellG*>`. Player5 has three 3D
modes (`[CC3D] cc3d/core/GraphicsOffScreen/MVCDrawModel3D.py:311-319`).

**1. Default: one surface per cell type ("borderless").**
- C++ copies the lattice into two flat arrays of (X+2)(Y+2)(Z+2): type and cell id. The outer layer is 0
  (medium), so every surface closes at the lattice edge. OpenMP over z
  (`[CC3D] CompuCell3D/core/pyinterface/PlayerPythonNew/FieldExtractor.cpp:3141-3266`, padding at `:3226`).
- The type array becomes `vtkImageData` point scalars, one point per site (`MVCDrawModel3D.py:88-93`). Per
  used type: `vtkDiscreteMarchingCubes` with that type id as its only value, `vtkSmoothPolyDataFilter`
  (VTK defaults; the iteration line is commented out), `vtkPolyDataNormals` (feature angle 45), mapper with
  scalars off (`MVCDrawModel3D.py:111-135`). One flat colour from the type LUT (`:152-154`).
- Result: all cells of a type merge into one smooth blob. The surface passes halfway between sites, so it
  keeps site membership exactly (no threshold of a blurred field).
- A face between type A and type B is built twice, once per actor. This follows from one label per filter;
  not checked on screen. The `vtkExtractVOI` at `:94-102` has hard-coded bounds and is never used.

**2. "Cell borders" on: one surface per cell.** Same pipeline on the cell-id image. Every cell id of the type
becomes one contour value of the filter, so cell-cell faces appear (`MVCDrawModel3D.py:257-282`). Medium gets
value 13 with the comment "what the??" (`:284-285`). 3D has no border lines: `prepare_border_actors` raises
`NotImplementedError` and the drawer swallows it (`MVCDrawView3D.py:112-120`, `GenericDrawer.py:411-416`).

**3. "Cell glyphs" on: one sphere per cell.** One point per cell at its centre of mass, scale
`0.62*V^(1/3)` (sphere of equal volume), type as colour index (`FieldExtractor.cpp:3355-3386`, COM `:3376`,
scale `:3381`). Python feeds `vtkGlyph3D` with a unit sphere, all cells in one actor: the fast mode
(`MVCDrawModel3D.py:163-236`). Replay has no COM, so C++ averages site coordinates per id
(`FieldExtractorCML.cpp:1916-2017`).

**Attributes that travel:** type and id only (cluster id in 2D); volume only as glyph scale. Anything else must
go through a cell-level scalar field (C).

**Per-type 3D visibility.** "Show in 3D" writes the comma list `Types3DInvisible`
(`[P5] cc3d/player5/UI/CellTypeColorMapModel.py:184-193`) and redraws the same step (`:177-179`). Medium is
forced invisible (`[P5] cc3d/player5/Utilities/utils.py:314`). An invisible type simply gets no actor
(`MVCDrawView3D.py:106-108`, `:243-247`). Its sites stay in the label image, so visible neighbours keep closed
faces toward it. Glyph and scalar modes skip invisible types in C++ (`FieldExtractor.cpp:3374`).

**Speed tricks.**
- The lattice is extracted only when the MCS changes; toggles in the same step rerun only the VTK filters
  (`GenericDrawer.py:377-392`).
- "Outer shell only" (`CellShellOptimization`): keeps only cells with medium among their neighbours
  (`FieldExtractor.cpp:3157-3186`, `:3249-3256`). **Correction:** it needs the NeighborTracker plugin in the
  model, else it does nothing, and replay ignores it (`FieldExtractorCML.cpp:1553-1599`).
- No LOD, decimation or clipping anywhere (searched for `vtkLODActor`, `vtkDecimate`, `vtkClip`, `vtkCutter`).
  No cell limit; cost = one lattice copy plus one marching-cubes pass per used type per drawn step.

**Coordinate quirk.** The padded image keeps origin 0 (no `SetOrigin` in the 3D model), so site (x,y,z) lands
at (x+1,y+1,z+1) while the bounding box starts at 0 (`MVCDrawModel3D.py:847-863`). Read from code, unverified
on screen.

**2D cells** (one lattice plane):
- Pixelized (the real default, see A): one quad per non-empty site, flat type colour via cell scalars; empty
  sites skipped (`FieldExtractor.cpp:341-415`, skip `:388`; `MVCDrawModel2D.py:1350-1405`).
- Non-pixelized: one point per site on a (W+1)x(H+1) grid through `vtkImageDataGeometryFilter`
  (`FieldExtractor.cpp:277-338`, `MVCDrawModel2D.py:1407-1459`). Colours probably blend across sites; unverified.
- Borders: per site and each of its 4 in-plane neighbours, if the neighbour is another cell (pointer compare),
  emit a unit segment on the shared edge (`FieldExtractor.cpp:494-601`, compare `:541`). Each edge comes out
  twice. Cluster borders use the same routine on `ClusterId` (`FieldExtractorCML.cpp:397-405`).

**What this means for us.** We have one agent per site, so a CC3D cell would be one site: mode 2 gives cubes,
and mode 3 is what our realistic cell meshes already do better. Mode 1 is the useful idea: a label-exact type
surface. Our matrix surfaces threshold a smoothed agent density (`hucre3b.html` `matrisGuncelle`, near line 750),
and HUCRE3B.md says this closed single-site holes over osteoblasts. A label-exact surface keeps those holes,
so surface and the site-level osteoblast/osteocyte rule agree (K3). Shell culling gains little at 5x28x28.

## C. Colour by property

- Types: `TypeColorMap` (type id to QColor), default palette in `[P5] cc3d/player5/UI/cell_type_colors.py:1`
  (0 = black = medium), built into a `vtkLookupTable` indexed by type id
  (`[CC3D] cc3d/core/GraphicsOffScreen/MVCDrawModelBase.py:142-174`). Editable in the dock (`CellTypeColorMapModel.py:34-39`).
- Scalar choice: a field combo box per window, "Cell_Field" plus every registered field
  (`[P5] cc3d/player5/Graphics/GraphicsFrameWidget.py:707-734`). Kinds: per-site concentration or scalar,
  cell-level scalar (a C++ map keyed by cell pointer, lookup at `FieldExtractor.cpp:3655-3659`), vectors.
  **Colour by a cell property = fill a cell-level scalar field from Python every step.** No built-in menu.
- One fixed rainbow LUT, 1024 colours, hue 0.67 to 0 (`MVCDrawModel3D.py:36-43`, `MVCDrawModel2D.py:84-91`).
- Range: auto = data min/max of the frame. Min and max lock separately, per field name
  (`MVCDrawModel3D.py:546-563`, `MVCDrawModelBase.py:309-341`, store `FieldParams` in
  `[P5] cc3d/player5/Configuration/__init__.py:130-150`).
- The "Min: … Max: …" text always shows the true data range, even when the colour range is locked
  (`MVCDrawModelBase.py:284-307`, called with the data range at `MVCDrawModel3D.py:584`).
- Legend: vertical `vtkScalarBarActor` sharing the mapper's LUT, only if `LegendEnable` for that field
  (`MVCDrawModelBase.py:379-418`, `MVCDrawView3D.py:155-162`).
- 3D scalars: (a) outer shell = marching cubes on a 0/1 "visible, not medium" indicator, then `vtkProbeFilter`
  samples the field onto the vertices (`MVCDrawModel3D.py:597-639`, `FieldExtractor.cpp:3400-3466`);
  (b) isosurfaces at user values plus N even levels (`MVCDrawModel3D.py:641-696`); (c) glyph spheres coloured
  by the value at the COM (`:321-449`). Vectors: cone glyphs by magnitude or one colour (`:760-828`).

## D. Slices, clipping, cross-sections (extra depth)

- No clipping and no cut plane in 3D. A slice is another graphics window set to xy, xz or yz that re-extracts
  one plane in 2D. 3D beside a slice = two MDI windows (hands-on screenshot 02).
- Window toolbar: projection combo, position spin box, field combo, "Take Screenshot"
  (`GraphicsFrameWidget.py:407-452`). **Correction:** the camera-icon button bookmarks the view for automatic
  screenshots (H); it does not move the camera (`GraphicsFrameWidget.py:655-665`).
- Position is an integer site index. Default = middle plane, max = dim-1 per axis
  (`[CC3D] cc3d/core/GraphicsUtils/GraphicsFrame.py:595-625`). The spin box allows 0..10000 (`GraphicsFrameWidget.py:694`)
  and the slot clamps (`:520-543`). Each plane remembers its last position and restores it on switch (`:476-502`).
- Axis mapping: two permutation tables turn (u, v, pos) into (x, y, z) (`[CC3D] CompuCell3D/core/pyinterface/PlayerPythonNew/FieldExtractorBase.cpp:50-108`).
  All 2D extractors (cells, fields, borders, glyphs) use them.
- Redraw: a spin change calls `_drawField()` (`GraphicsFrameWidget.py:546-548`), which redraws every window,
  the 3D one too (`SimpleTabView.py:2132-2138`). 3D reuses the cached lattice but reruns its filters.
- Not linked: 3D does not show the plane, clicks on the slice do nothing. One site thick, no slab projection.
- In 2D the field is drawn first and cell borders on top (`GenericDrawer.py:404-416`), as in hands-on screenshot 07.

## E. Time

- Live: Run, Step, Pause, Stop only. Step forces `screenUpdateFrequency = 1` (`SimpleTabView.py:1944-1945`);
  "Pause at MCS" uses `pg.pause_at` (`main_loops.py:131-137`). No going back.
- **Correction** to "LatticeDataFiles, not verified": replay exists. Opening a `.dml` switches to replay
  (`SimpleTabView.py:991-1048`). The `.dml` is an XML header (dimensions, lattice, frequency, type names,
  fields) written beside the output (`[CC3D] cc3d/core/CMLFieldHandler.py:109-157`).
- Frames = every `*.vtk` in the folder, sorted by name; index = list position; MCS = digits in the file name,
  else the index (`[CC3D] cc3d/core/CMLResultsReader.py:147-151`, `:270-319`, `:322-343`).
- Loading: one `vtkStructuredPointsReader` per frame in a `DataReader` QThread, GIL released
  (`[P5] cc3d/player5/Simulation/CMLResultReader.py:28-48`, `CMLResultsReader.py:292-310`). No cache, no prefetch.
- Scrub: clicking a row of the file table jumps to that file and steps once
  (`[P5] cc3d/player5/UI/LatticeDataModelTable.py:62-66`, `CMLResultReader.py:220-228`); the table follows the
  frame (`SimpleTabView.py:1554`). Random access, but as a list, not a slider. Play reads the next file after
  each draw (`SimpleTabView.py:1582`, `CMLResultReader.py:138-144`).

## F. Picking and inspection

- None (confirmed). The active widget `[P5] cc3d/player5/Utilities/QVTKRenderWindowInteractor.py` mentions a
  picker only in a docstring (`:146`). `PickActor` with `vtkCellPicker` lives in
  `[P5] cc3d/player5/Utilities/QVTKRenderWidget.py:444-460`, which `GraphicsFrameWidget` does not import
  (`GraphicsFrameWidget.py:19-22`). The pure-Python frame hooks the left button only to block rotation
  (`[CC3D] cc3d/core/GraphicsUtils/CC3DPyGraphicsFrame.py:316-336`).
- Where it would go: a mouse handler in `GraphicsFrameWidget`, `vtkCellPicker`, world point to site, then the
  `cell_id_array` the drawer already holds (`GenericDrawer.py:158-183`). Our viewer is ahead here.

## G. Plots

- pyqtgraph windows fed by steppables (`add_plot`, `add_data_point`, histograms, bars), live
  (`[P5] cc3d/player5/Plugins/ViewManagerPlugins/PlotWindowInterface.py:156-310`, `:494-535`, `:783-800`).
  Export PNG and text data (`:551-575`, `:642-708`).
- Not linked to the views: no click handlers (searched `sigClicked`, `sigMouseClicked`). Post-hoc plots in
  replay: none found (unverified). Nothing to port; our chart-click-to-day already goes further.

## H. Export

- "Take Screenshot" stores a scene description (field, projection, position, camera, toggles, invisible types,
  size, metadata) as JSON (`[CC3D] cc3d/core/GraphicsUtils/ScreenshotData.py:20-45`, `:120-158`).
- Every N MCS each stored scene is re-drawn in an off-screen `GenericDrawer` and saved as
  `<label>/<label>_<MCS zero-padded>.png` (`[CC3D] cc3d/core/GraphicsUtils/ScreenshotManagerCore.py:317-381`,
  writer `GenericDrawer.py:455-496`). Saved frames do not depend on the windows on screen.
- Movie: `ffmpeg` concat with per-frame `duration`, H.264, crf from the quality setting
  (`[CC3D] cc3d/core/GraphicsUtils/MovieCreator.py:62-122`). "Write MCS on each frame" is an ffmpeg `drawtext`
  overlay with the MCS read back from the file name (`:76-87`, `:118-120`). The PNGs carry no stamp.

## I. Engine: cell-cell interaction (feeds our next step)

- Lattice: dense `Field3D<CellG*>`, one pointer per site, null = medium. `CellG` holds volume, target/lambda
  volume, surface, target/lambda surface, type, COM, inertia tensor, orientation, id, cluster id, fluctuation
  amplitude and more (`[CC3D] CompuCell3D/core/CompuCell3D/Potts3D/Cell.h:25-53`).
- Update: Metropolis "pixel copy", (sites x flip2DimRatio) attempts per MCS (`.../Potts3D/Potts3D.cpp:718`).
  Pick a random site and a random neighbour index, try to copy the site's cell into that neighbour
  (`Potts3D.cpp:786-832`). Accept with `exp(-(dH - offset)/(k*T))`, T = fluctuation amplitude
  (`.../Potts3D/DefaultAcceptanceFunction.h:24-32`, `Potts3D.cpp:836-837`). OpenMP over sub-grid sections.
- Hamiltonian: dH = sum of each energy plugin's `changeEnergy` (`Potts3D.cpp:474-478`).
- Contact (adhesion): symmetric table J[type1][type2] (`.../plugins/Contact/ContactPlugin.cpp:166-173`, lookup
  `ContactPlugin.h:70-72`). dH sums J over the site's neighbours up to `NeighborOrder` (default 1) or `Depth`,
  skips same-cell and same-cluster pairs, optional 1/distance weight (`ContactPlugin.cpp:55-78`, `:82-158`).
- Volume: E = lambda (V - Vt)^2; the change for +1/-1 site is `lambda*(1 +/- 2(V - Vt))`
  (`.../plugins/Volume/VolumePlugin.cpp:140-160`), global, per type or per cell. Surface works the same, with
  the surface change counted as unlike neighbours times a lattice factor (`.../plugins/Surface/SurfacePlugin.cpp:143-170`).
- Neighbour search: no tree. `BoundaryStrategy` precomputes integer offsets sorted by distance and grouped by
  neighbour order (`.../Boundary/BoundaryStrategy.cpp:300-360`); `getNeighborDirect(pt, idx)` = `pt + offset[idx]`
  plus a bounds check (`:1072-1110`). The NeighborTracker plugin keeps, per cell, a set of (neighbour, common
  surface area), updated on every accepted copy (`.../plugins/NeighborTracker/NeighborTracker.h:22-52`,
  `NeighborTrackerPlugin.cpp:59`, `:86-200`).
- Output: legacy VTK structured points with per-site `CellType` (uchar), `CellId`, `ClusterId` (long) plus
  chosen fields (`[CC3D] CompuCell3D/core/pyinterface/PlayerPythonNew/FieldWriter.cpp:177-200`, `:280-330`;
  name in `cc3d/core/CMLFieldHandler.py:100-106`). No per-cell attribute table. Restart snapshots
  (`cc3d/core/RestartManager.py`) store more; their cell content is unverified.
- For us: we are already one agent per site. The J table over a precomputed neighbour-offset list is a cheap,
  lattice-native way to add type-type affinity. "Common surface area per neighbour pair" is a ready per-cell
  output we could log for the inspector.

## J. Licence

- `[CC3D]`: MIT, "Copyright (c) 2022 Biocomplexity Institute" (`License.txt:1-3`). Covers the engine, field
  extractors and `GraphicsOffScreen` drawing code. We may copy or translate it if we keep the notice. Bundled
  Eigen, ViennaCL, muParser and Cleaver have their own licences (not checked, not needed).
- `[P5]`: GNU LGPL v3 (`LICENSE.txt:1-2`). Covers the GUI: windows, slice toolbar, colour dock, steering
  panel, replay table, screenshot and movie dialogs. Do not copy; re-implement the ideas.
- No per-file licence headers in the viewer paths (searched for GPL/licence text). VTK is not in the clones.
- Every port below is a fresh JavaScript re-implementation and needs no CC3D text.

## K. Port list for `hucre3b.html` (three.js r147, classic scripts)

**K1. Colour by property: lockable min/max, data-range readout, colour bar** (effort S)
- Source: `[CC3D] cc3d/core/GraphicsOffScreen/MVCDrawModel3D.py:546-563` (auto range, separate locks),
  `MVCDrawModelBase.py:284-341` (true-range readout, per-field settings), `:379-418` (bar).
- Per-instance properties we can compute: days in current type, same-type neighbours (of 26), distance to the
  nearest bone site, previous occupant's type. `three@0.147.0/examples/js/math/Lut.js` exists on jsDelivr (HTTP 200).
```js
// <script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/math/Lut.js"></script>
const lut = new THREE.Lut("rainbow", 256), lock = {};          // lock[prop] = {min:null|v, max:null|v}
function colourBy(prop, day) {
  const cells = cellsOfDay(day), vals = cells.map(c => PROPS[prop](c, day));
  let lo = Infinity, hi = -Infinity; for (const v of vals) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  $("minmax").textContent = `min ${lo}  max ${hi}`;              // always the data range, like CC3D
  const L = lock[prop] || {}; if (L.min != null) lo = L.min; if (L.max != null) hi = L.max;
  lut.setMin(lo); lut.setMax(hi > lo ? hi : lo + 1);
  cells.forEach((c, k) => c.mesh.setColorAt(c.slot, lut.getColor(Math.min(hi, Math.max(lo, vals[k])))));
  allCellMeshes.forEach(m => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  drawColourBar($("bar"), lut, lo, hi);                          // plain 2D canvas beside the view
}
```
- Keep today's per-instance HSL jitter (line 410) for type mode only.

**K2. Orthogonal slice beside 3D, plane shown in 3D, clicks linked** (effort M)
- Source: quads per non-empty site `FieldExtractor.cpp:341-415`, border segments `:494-601`, axis tables
  `FieldExtractorBase.cpp:50-108`, mid-plane default and per-plane memory `GraphicsFrame.py:608-625`,
  `[P5] GraphicsFrameWidget.py:476-543`.
- Beyond CC3D: show the plane in 3D, link picks both ways, draw type borders (CC3D's cluster-border idea),
  since every site is a cell for us.
```js
const AX = { xy: [0, 1, 2], xz: [0, 2, 1], yz: [1, 2, 0] };      // u, v, normal
const pos = { xy: D[2] >> 1, xz: D[1] >> 1, yz: D[0] >> 1 };     // remembered per plane
function drawSlice(pl, day) {
  const [a, b, n] = AX[pl], W = D[a], H = D[b], img = sctx.createImageData(W, H), p = [0, 0, 0];
  p[n] = pos[pl] = Math.max(0, Math.min(pos[pl], D[n] - 1));
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
    p[a] = u; p[b] = v; const t = code(day, p); if (t) img.data.set(RGBA[t], 4 * (v * W + u)); }
  small.getContext("2d").putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, W * S, H * S);
  ctx.beginPath(); forEachEdge(W, H, (u, v, du, dv) => {          // only +u / +v edges: each edge once
    if (codeAt(u, v) !== codeAt(u + du, v + dv)) segment(ctx, u, v, du, dv, S); }); ctx.stroke();
  planeMesh.position.setComponent(n, (pos[pl] - D[n] / 2 + 0.5) * SITE);   // translucent quad in 3D
}
// slice click: site = (u, v, pos) -> same inspector as the raycaster; 3D pick -> pos[pl] = site[n]
```

**K3. Label-exact matrix surface as an option** (effort S)
- Source: `MVCDrawModel3D.py:77-161` (one discrete marching cubes per type on a padded label image, light
  smoothing, normals), padding `FieldExtractor.cpp:3226`.
- We already fill one `THREE.MarchingCubes` per tissue by trilinear sampling of a smoothed density
  (`matrisGuncelle`). Feed the raw 0/1 indicator and set isolation 0.5: the surface then sits halfway between
  sites, as with vtkDiscreteMarchingCubes, and single-site holes stay open. Keep the smooth look as default.
```js
function indicatorFields(R, d) {                 // used instead of alanlar(R, d) in exact mode
  const out = {};
  for (const [ad, T] of Object.entries(MATRIS)) {
    const f = new Float32Array(R.nx * R.ny * R.nz);
    for (let s = 0; s < f.length; s++) f[s] = T.kodlar.includes(code(R, d, s)) ? 1 : 0;
    out[ad] = f; }
  return out;
}
// matrisGuncelle: const F0 = exact ? indicatorFields(R, d) : alanlar(R, d); mc.isolation = exact ? 0.5 : T.esik;
// keep >= 1 empty grid layer at the slab edge so surfaces close (CC3D pads with medium)
```
- Trilinear sampling rounds corners a little more than discrete MC. Acceptable.

**K4. View bookmark and frame series with a day stamp** (effort S-M)
- Source: scene description `ScreenshotData.py:20-45`, `:120-158`; off-screen re-render per step
  `ScreenshotManagerCore.py:317-381`; stamp from the file name `MovieCreator.py:76-87`.
- Beyond CC3D: burn the day into the pixels. The page cannot download, so frames go to a gallery panel for
  right-click saving. Whether an artifact file-save capability fits here is unverified.
```js
function bookmark() { return { cam: kH.position.toArray(), tgt: kontrolH.target.toArray(),
  region: R.ad, hidden: [...gizliTur], colour: currentProp, lock: structuredClone(lock), slice: { ...pos } }; }
async function frames(bm, days) {
  apply(bm);
  for (const d of days) {
    await setDay(d); renderer.render(sahne, kH);                 // read back in the same task
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.drawImage(renderer.domElement, 0, 0);
    g.font = "600 20px sans-serif"; g.fillStyle = "#fff"; g.fillText(`day ${d}`, W - 110, 30);
    gallery.appendChild(Object.assign(new Image(), { src: c.toDataURL("image/png"), title: `day_${d}` }));
  }
}
```

**K5. Side-by-side runs: one camera, one day slider** (effort M)
- Source: independent windows (`[P5] SimpleTabView.py:446-490`) and field-by-field camera copy
  (`[CC3D] cc3d/core/GraphicsUtils/GraphicsFrame.py:208-222`). CC3D never compares runs; we have three of one seed.
```js
const runs = [loadRun("unbonded_orig"), loadRun("bonded_orig")];          // two scenes, same region
function renderSplit() {
  const w = el.clientWidth, h = el.clientHeight; renderer.setScissorTest(true);
  runs.forEach((run, i) => {
    renderer.setViewport(i * w / 2, 0, w / 2, h); renderer.setScissor(i * w / 2, 0, w / 2, h);
    renderer.render(run.scene, kH); });                                    // same camera = same view
  renderer.setScissorTest(false);
}
daySlider.oninput = (e) => runs.forEach(r => r.setDay(+e.target.value));
// kH.aspect = (w / 2) / h; pick in the half under the mouse, show that site for both runs
```
- Memory: two runs' ROI data and two sets of InstancedMesh; size not measured.

Not ported: CC3D has no chart-3D linked selection and no picking.
