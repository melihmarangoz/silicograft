# Viewer research: existing tools and usability patterns for the bone-healing ABM viewer

Date: 2026-11-07. Facts below were checked in the repos themselves (GitHub API, shallow clones of the Simularium repos, GitLab API for Morpheus). "Last commit" means the latest commit on the default branch.

## 1. Existing tools

GitHub searches for "agent based model visualization 3d", "cell simulation visualization web", "simulation trajectory viewer threejs", "agent-based webgl" and "multicellular simulation visualization" turned up no mature general viewer. Only toy repos came back (3 stars or fewer). The field has one dedicated web viewer (Simularium). Everything else is a simulation engine with its own GUI, or a general scientific viewer.

| Tool | What / input | Web or desktop | Licence | Activity (stars, last commit) | Fit for our data |
|---|---|---|---|---|---|
| **Simularium** (viewer, website, simulariumio) | Trajectory viewer for `.simularium` files (JSON or binary). simulariumio converts Cytosim, MCell, MEDYAN, PhysiCell, ReaDDy, Smoldyn, SpringSaLaD and custom engines | Web (React + three.js 0.171; npm `@aics/simularium-viewer`) | Apache-2.0 | 4 / 6 / 8 stars. Maintenance mode: viewer v3.10.5 (2026-02), website v0.16.0 (2026-09-21), io v1.13.0 (2025-08). Recent commits are mostly dependabot | Good for sharing. Loses a lot (see 1a) |
| **PhysiCell Studio** | Model editor, runner and plotter for PhysiCell XML/MAT output | Desktop (PyQt5) | GPL-3.0 | 40, 2026-10-11 | PhysiCell only |
| **pcdl** (physicelldataloader) | Converts PhysiCell output to pandas, VTK, OME-TIFF, AnnData, GML neighbour graphs, Simularium, Neuroglancer | Python CLI | BSD-3 | 11, 2026-09-05 | A good model for *our* exporter, not usable directly |
| **CompuCell3D + Player5** | CPM engine with a Qt player | Desktop | MIT (CC3D), LGPL-3.0 (player5) | 84 / 3, 2026-10-28 | CC3D only |
| **BioDynaMo** | ABM engine that exports to ParaView | Desktop (ParaView) | Apache-2.0 | 138, 2026-11-04 | Engine, not a viewer |
| **Morpheus** (GitLab) | Multicellular engine; gnuplot/TIFF/VTK output | Desktop | BSD-3 | 109, last commit 2026-05-19 (2.4.1) | Engine |
| **Tissue Forge** | Particle engine with built-in renderer, bonds and angles | Desktop / Python | LGPL-3.0 | 29, 2025-07-14 (stale) | Engine. Ideas for bonds only |
| **Chaste** | Cell-based and cardiac engine, VTK output | Desktop (ParaView) | BSD-3 | 156, 2026-10-30 | Engine |
| **ParaView** / Glance / trame / ParaViewWeb | General VTK viewer; web variants | Desktop; Glance web; trame needs a Python server | BSD-3; trame Apache-2.0 | Glance 278, 2024-09 (stale); trame 710, 2026-09; ParaViewWeb 2023 (stale) | Desktop analysis only. trame cannot run on static hosting |
| **napari** (+ napari-animation, napari-threedee, napari-clusters-plotter) | n-D image, labels, points, tracks, surfaces, vectors | Desktop (Qt) | BSD-3 | 2797, 2026-11-05; animation 97; threedee 38 (2025-07); clusters-plotter 91 | Very good *internal* tool: whole lattice as a 4-D labels layer (t,z,y,x). Not for the public site |
| **PyVista / vedo** | Python VTK wrappers | Desktop / Jupyter | MIT | 3878 / 2275, active | `export_html` (PyVista, needs trame) writes one static scene without time |
| **vtk.js** / itk-vtk-viewer | WebGL VTK library / viewer | Web | BSD-3 | 1548, active / 241, 2025-02 | Rebuilding on vtk.js ≈ rebuilding our viewer |
| **Neuroglancer** | Volumes, segmentations, meshes, skeletons, annotations (point, line, box, ellipsoid, polyline) with properties and *relationships* to segment IDs | Web, works on static hosting (precomputed / Zarr) | Apache-2.0 | 1578, 2026-11-03 | Excellent for slicing the lattice. Per-object meshes, no instanced per-type cell meshes |
| **Rerun** | Time-indexed multimodal viewer: Points3D, Asset3D (OBJ/GLB/STL) with InstancePoses3D instancing, LineStrips3D, GraphNodes/Edges, Volume3D (unstable), plots | Web (WASM, npm `@rerun-io/web-viewer`) + desktop | MIT / Apache-2.0 | 11.7k, 0.42.0 on 2026-11-04 (weekly releases) | Strong generic option. A `.rrd` file only loads in the same or next minor version, so the viewer version must be pinned |

### 1a. Simularium in detail (checked in source)

- **Custom meshes:** yes, one OBJ (or PDB) per agent type through `DisplayData(display_type=OBJ, url=...)` with a colour per type. But `GeometryStore.ts` keeps only *the first geometry* in the OBJ, and its own deferred shader (G-buffer, SSAO, outline) colours it. **Our nucleus mesh and `MeshPhysicalMaterial`/`onBeforeCompile` look would be lost.** We could only merge the nucleus into one single-colour mesh.
- **Scale:** `MAX_MESHES = 100000` agents per frame. Our four slabs hold at most 4 × 28×28×5 = 15,680 sites, so that fits. Binary format: 11 float32 per agent, about 0.69 MB per frame, **about 250 MB for 360 days**. The website loads the whole file, so we would need `every_nth_timestep` subsampling or split files.
- **Plots:** scatter and histogram (Plotly). If the x-axis title contains "time", a moving time bar is drawn. A click on a plot does **not** change the time (a TODO in `Plot/index.tsx`).
- **Inspector:** a click follows the agent. The metadata panel shows only unique ID, type, position, rotation and radius, so we cannot attach custom per-agent fields.
- **Good UI ideas:** an agent tree with per-type visibility, a colour picker and a "highlight" star; tags through `Type#state` names; hotkeys `h` (reset), `f` (focus), arrow keys (zoom); a typed time input; share links with `trajUrl` + `t`; iframe embed; "Record movie".
- **Not supported:** matrix isosurfaces (volume rendering is still "planned"), the whole-callus map, run comparison.
- **Converting** would be about 100 lines of Python: build `AgentData` (times, n_agents, types, positions, radii, rotations) from the zstd snapshots, add `DisplayData` per type, `ScatterPlotData` per chart, then `TrajectoryConverter(...).save()`. Later, cell-cell bonds fit as 2-point FIBER agents (visType 1001).

## 2. UI/UX patterns worth copying (and where they come from)

1. **Selection + inspector:** Rerun's selection panel shows everything known about the clicked entity at the current time and keeps an undo/redo *selection history*. Neuroglancer has a selection-details panel. Simularium's metadata panel is minimal.
2. **Layer panel:** click to toggle a layer, colour and opacity per layer (Neuroglancer, napari layer list). Per-type toggle, colour picker and highlight/solo (Simularium agent tree).
3. **Linked plots and selection:** in ParaView, a selection in the 3D view highlights spreadsheet rows and the reverse; *Plot Selection Over Time* plots the picked cell's values across time steps. napari-clusters-plotter: a lasso in a scatter plot colours the matching objects in the viewer.
4. **Timeline:** play/pause/step/loop over a chosen sub-range (Rerun timeline). A time cursor stays centred on plots while playing (Rerun). A time bar on plots (Simularium).
5. **Keyboard:** `h` opens the full shortcut list (Neuroglancer). Camera hotkeys (Simularium).
6. **Focus + context and slicing:** a cross-section + 3D layout (Neuroglancer). Interactive slicing planes (napari-threedee, ParaView Clip/Slice).
7. **Comparison:** ParaView comparative view and linked cameras.
8. **Export and sharing:** Neuroglancer stores the whole viewer state as JSON in the URL and has a screenshot tool. Rerun puts the time in a `#when=` fragment. Simularium has `t=`, embed snippets and movie recording.
9. **Bookmarks:** none of the tools has real annotated time bookmarks. Our existing day markers are already ahead here.

## 3. Recommendation (ranked)

**1. Keep our three.js viewer and adopt the patterns (recommended).** Simularium is itself just three.js + React with fewer features than we need. Moving to it costs the realistic cells, the isosurfaces and the callus map, and buys sharing features we can build in a few days. A quick check of `hucre3b.html` shows it has no picking (no Raycaster), no keyboard handling, no URL hash state and no image export. Priority order:

1. **Click a cell → inspector.** three.js `Raycaster` returns `instanceId` on an `InstancedMesh`. Show ID, type, state, age, lattice index, local mechanical stimulus and matrix fractions. Pin the selection and keep a selection history (IntelliCell-style framed panel).
2. **Layer panel:** per cell type and per matrix isosurface: eye toggle, colour swatch, opacity, solo/highlight, live counts.
3. **Linked time:** a cursor on every chart; click or drag on a chart jumps to that day; hover shows values. uPlot (MIT, 10.6k stars) is fast enough.
4. **Linked selection both ways:** a picked cell is highlighted in its region's curves (or its own per-cell time series). Brushing a range on a chart or histogram (e.g. stimulus) highlights the matching cells in 3D.
5. **Keyboard + playback:** Space play/pause, ←/→ one day, Shift+←/→ ten days, Home/End, loop range, speed. `?`/`h` opens a shortcut overlay.
6. **URL state in the hash:** run, day, region, camera, visible layers, selected cell. This gives shareable links on the static site and costs almost nothing.
7. **Focus + context:** the callus map as a clickable overview that drives the slab view, plus a clip-plane slider inside the slab (clipping already exists).
8. **Side-by-side runs** with synced day and camera, then PNG/video export (canvas `toBlob`, `MediaRecorder` or ccapture.js).

UI frame: the IntelliCell look (dark instrument UI, framed boxes, near-white text, large bold headings). Layers on the left, viewport in the centre, inspector on the right, timeline and charts at the bottom. tweakpane or lil-gui (both MIT) would only save time on the controls.

**2. In addition: a Simularium export as a cheap side product (1–2 days).** Use it for the community, a paper supplement, or a PhysiCell comparison. Subsample to about 36 frames. It is not the main viewer.

**3. Internally: napari** (desktop) for the full 361×361×401 lattice as a 4-D labels layer. Explore it with napari-clusters-plotter, record with napari-animation. Neuroglancer is the web counterpart if full-lattice slicing is ever needed on the site (static precomputed/Zarr files).

**Cell-cell interactions later.** Tools with first-class edges: Simularium fibers, Neuroglancer LINE annotations with relationships to cell IDs, Rerun LineStrips3D and GraphEdges, napari Vectors/Tracks (graph), pcdl GML neighbour graphs, Tissue Forge bonds. In our viewer: draw contacts as an `InstancedMesh` of thin cylinders between agent centres, coloured by interaction type. List them in the inspector ("neighbours / contacts"). Optionally export a per-day GML for network analysis.

## Sources

- Simularium paper: https://www.nature.com/articles/s41592-022-01442-1
- https://github.com/simularium/simularium-viewer (`src/visGeometry/GeometryStore.ts`, `src/visGeometry/index.ts`)
- https://github.com/simularium/simularium-website (`src/containers/Plot/index.tsx`, `src/components/MetadataPanel`, `CameraControls`, `ShareTrajectoryModal`)
- https://github.com/simularium/simulariumio (README, `file_format.md`, `data_objects/`)
- https://github.com/elmbeech/physicelldataloader (man/TUTORIAL_python3_graph.md, TUTORIAL_neuroglancer.md, TUTORIAL_simularium.md)
- https://github.com/PhysiCell-Tools/PhysiCell-Studio, https://github.com/CompuCell3D/CompuCell3D, https://github.com/CompuCell3D/cc3d-player5
- https://github.com/BioDynaMo/biodynamo, https://biodynamo.github.io/docs/userguide/visualization
- https://gitlab.com/morpheus.lab/morpheus, https://github.com/tissue-forge/tissue-forge, https://github.com/Chaste/Chaste
- ParaView linked selection / Plot Selection Over Time: https://docs.paraview.org/en/latest/Tutorials/ClassroomTutorials/advancedDataAnalysis.html
- https://github.com/napari/napari, https://github.com/napari/napari-animation, https://github.com/napari-threedee/napari-threedee, https://github.com/BiAPoL/napari-clusters-plotter (docs/usage/plotter_widget.md)
- https://github.com/google/neuroglancer (README, `src/datasource/precomputed/annotations.md`, `segment_properties.md`, `src/util/screenshot_manager.ts`)
- https://github.com/rerun-io/rerun (docs/content/reference/viewer/selection.md, timeline.md, urls.md; archetypes asset3d, instance_poses3d, volume3d; rerun_js/web-viewer/README.md)
- https://github.com/pyvista/pyvista (`export_html` in plotting/plotter.py), https://github.com/marcomusy/vedo, https://github.com/Kitware/vtk-js, https://github.com/Kitware/itk-vtk-viewer, https://github.com/Kitware/glance, https://github.com/Kitware/trame
- https://github.com/leeoniya/uPlot, https://github.com/cocopon/tweakpane, https://github.com/georgealways/lil-gui, https://github.com/spite/ccapture.js

## Status in hucre3b.html (2026-11-07, commit 21cd315)

The survey read the page before the one-screen redesign. Of the ranked list:

| Feature | State |
|---|---|
| Click a cell -> inspector (type, position, since which day, what was there before), double-click focus | done |
| Per-type and per-tissue visibility with live counts | done (no colour, opacity or solo yet) |
| Chart cursor, click the chart to jump to a day | done (no hover values or drag yet) |
| Space, arrow keys, Shift for 10 days, keys 1-4 for regions | done (no Home/End, loop range or shortcut overlay yet) |
| Clickable callus map drives the slab view | done |
| Pin the selection, selection history | open |
| Linked selection both ways (cell <-> chart, brushing) | open |
| Clip-plane slider inside the slab | open |
| Side-by-side runs with synced day and camera | open |
| URL state | open; on a Claude artifact only a plain `#name` reaches the page, so full state links need the website |
| PNG/video export | open; artifacts block page-started downloads, so this needs the website |
| Local mechanical stimulus and cell age in the inspector | needs new data: the daily lattices hold only cell codes |
