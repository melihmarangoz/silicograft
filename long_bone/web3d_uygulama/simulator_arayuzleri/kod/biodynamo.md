# BioDynaMo: how the viewer and engine work (code study, 2026-11-07)

Clone: `kaynak/biodynamo`, commit `bb681cf423079e21abd47d8fdc123069e9bfcb42` (2026-11-04, master).
All paths below are from the repo root. Hands-on note: `simulator_arayuzleri/biodynamo.md`.
"Unverified" means the claim depends on ParaView, VTK or ROOT code that is not in this clone.

## A. Architecture map

- BioDynaMo has no GUI of its own. It is a C++ engine plus adaptors that hand agent data to
  ParaView (export files or Catalyst in situ) or to ROOT (TGeo geometry for notebooks).
- Visualization is a normal scheduled operation. `"visualize"` runs after load balancing and the
  environment update, before `"update time series"` (`src/core/scheduler.cc:63-65`).
  `VisualizationOp` creates the adaptor by name and calls `Visualize()` every step
  (`src/core/operation/visualization_op.h:36-50`). The adaptor is a ROOT plugin looked up by
  name, with a built-in fallback for `"paraview"` (`src/core/visualization/visualization_adaptor.cc:35-63`).
- `ParaviewAdaptor::Visualize()` returns unless `step % visualization_interval == 0`, builds the VTK
  objects, then does in situ and/or export (`src/core/visualization/paraview/adaptor.cc:99-123`).
- Data path, export mode:
  1. `VtkAgents` owns one `vtkUnstructuredGrid` per OpenMP thread (`vtk_agents.cc:48-56`).
  2. Each grid holds points only. No VTK cells are ever inserted (grep for `SetCells`,
     `InsertNextCell`, `VTK_VERTEX` in `src/core/visualization` finds nothing). Every agent is one point.
  3. Per-agent attributes are `MappedDataArray`s: VTK arrays that read straight out of the C++
     agent objects at a byte offset (`mapped_data_array.h:69-76`).
  4. `ParallelVtuWriter` writes one `.vtu` per thread in parallel plus a `.pvtu` index, then
     patches the `.pvtu` to list all pieces (`parallel_vtu_writer.cc:31-57`, `:60-96`).
  5. At the end, `simulation_info.json` is written and `pvbatch generate_pv_state.py` builds a
     ParaView state file (`adaptor.cc:80-84`, `:236-285`). `bdm view` opens that `.pvsm`.
- Data path, in situ mode: one grid only, handed to Catalyst by name (`vtk_agents.cc:59-62`).
  The user's Python pipeline is concatenated with `default_insitu_pipeline.py` and loaded into a
  `vtkCPProcessor` (`adaptor.cc:140-153`, `:288-317`). Live view connects to `localhost:22222`
  (`default_insitu_pipeline.py:303`, `:331`).
- Field data (substances) go the same way as `.vti`/`.pvti` image data, split into z slabs, one
  per thread (`vtk_diffusion_grid.cc:149-166`). The concentration buffer is passed by pointer, not
  copied (`vtk_diffusion_grid.cc:133`, `:169`).
- ROOT path: `RootAdaptor` makes one TGeo volume per agent and exports a `.root` file each
  visualization step (`src/core/visualization/root/adaptor.h:48-71`). `VisualizeInNotebook()` forces
  one update and draws in a TCanvas (`root/notebook_util.h:26-35`). In the notebook, JSROOT renders
  the canvas (unverified, JSROOT is not in the clone).
- Threads: the export runs inside OpenMP parallel regions (`vtk_agents.cc:126-139`,
  `parallel_vtu_writer.cc:66`). No caching of frames on the viewer side; ParaView reads files.

## B. Cell drawing

- A cell is a point plus a diameter. The shape comes from the agent class (`Shape::kSphere` or
  `kCylinder`), read from a temporary instance (`vtk_agents.cc:64-66`).
- Spheres: the stock ParaView `Glyph` filter with `GlyphType=Sphere`, `ScaleFactor=1.0`,
  `GlyphMode='All Points'`, scale array `diameter_` (`default_insitu_pipeline.py:25-33`, `:65-68`).
  `simulation_info.json` names `diameter_` as the scaling attribute (`helper.cc:44-47`).
  The ParaView sphere source has radius 0.5, so the diameter scale gives true size (unverified).
  `All Points` matters: the default ParaView glyph mode subsamples points (unverified), which
  would silently drop cells.
- Cylinders (neurites): BioDynaMo's own `BDMGlyph` filter, a modified VTK `vtkGlyph3D`
  ("Based on default Kitware glyph", `paraview_plugin/Plugin/BDMGlyphFilter/BDMGlyph.cxx:16`).
  It scales x and z by `diameter_`, y by `actual_length_`, orients along `spring_axis_` and moves
  the glyph to the middle of the segment from `mass_location_` (`default_insitu_pipeline.py:110-140`,
  `BDMGlyph.cxx:473-491`, `:519-552`). Rotation is a 180 degree turn about the half vector
  between y and the axis (`BDMGlyph.cxx:479-480`), a cheap trick that maps y onto the axis.
- No instancing. The glyph filter copies the source mesh once per agent on the CPU: topology
  (`BDMGlyph.cxx:458-467`), transformed points (`:541-552`) and every input point attribute,
  duplicated onto all glyph vertices (`:558-574`). Memory is N agents x glyph vertices.
- Which attributes travel: the class's required set plus the user's extras.
  `Agent::GetRequiredVisDataMembers()` returns `position_`, `diameter_` (`src/core/agent/agent.h:140-142`);
  neurites need `mass_location_`, `diameter_`, `actual_length_`, `spring_axis_`
  (`src/neuroscience/neurite_element.cc:134-136`). Extras come from `bdm.toml`
  `[[visualize_agent]] additional_data_members` (`src/core/param/param.h:364-386`, parsed at
  `src/core/param/param.cc:264-274`) and are merged in `vtk_agents.cc:191-200`.
- For each member, ROOT reflection (TClass/TDataMember) gives the C++ type and byte offset. A
  JIT-compiled functor then creates one typed VTK array per member (`vtk_agents.cc:70-101`,
  `jit_helper.h:99-140`). Supported value types: real, int, uint64, `AgentUid` and agent pointers
  as uint64, fixed arrays as multi-component (`jit_helper.h:39-95`).
- ROOT path: one `TGeoSphere` or `TGeoTube` per agent, 15 segments per circle, at most 1e6
  visible nodes, all blue (`root/adaptor.h:45`, `:96`, `:110-112`, `:141-195`). Each node is named
  type + uid (`root/adaptor.h:142`). Fine for a notebook, not for millions.
- How many: no hard limit in the export. The glyph copy is the bottleneck on the ParaView side.

### Why the default view hid the cells (from the hands-on note)

The cells were there. The default state stacks two field layers on top of them:
- substances are shown as `Volume` in export mode (`default_insitu_pipeline.py:229-232`),
  coloured and rescaled to the data range (`:223-225`), with no opacity tuning;
- gradient arrows use a fixed `ScaleFactor = 10` (`:189-190`, `:201`), not tied to the grid
  spacing or to the cell size, so on a fine grid they cover the scene.
- The camera is reset after the agents are added (`:184-185`), but the substances are added
  later (`generate_pv_state.py:95-101`). Whether the saved state keeps that camera is unverified.
- Glyphs have no colour array (`ColorArrayName = [None, '']`, `default_insitu_pipeline.py:39`), and the
  scalar bar call is commented out (`:54-58`).

### Why hover showed a wrong id

- The agent grid has no id array unless the user exports `uid_` (`agent.h:140-142`, `agent.h:271`).
- The glyph output is a new mesh. Its point ids are glyph vertex ids. `vtkGlyph3D` can add the
  source point id to each vertex (`GeneratePointIds`, `BDMGlyph.cxx:261-267`, `:576-581`), but
  `BDMGlyphFilter.xml` does not expose that property (grep finds no `GeneratePointIds` in the XML),
  and the sphere path uses the stock `Glyph` with nothing set. So "Id 580153" is a sphere vertex.
- Fix in BioDynaMo terms: add `uid_` to `additional_data_members`. It is exported as uint64
  (`jit_helper.h:61-64`, `mapped_data_array.h:89-101`) and copied onto every glyph vertex
  (`BDMGlyph.cxx:558-565`), so hover would then show the agent's uid (stock Glyph behaviour unverified).

## C. Colour by property

- BioDynaMo itself sets nothing for agents: glyphs are solid (`default_insitu_pipeline.py:39`).
  The user picks any exported array in ParaView's colour menu.
- For substances: `ColorBy(... 'Substance Concentration')` and
  `RescaleTransferFunctionToDataRange(True, True)` (`default_insitu_pipeline.py:223-225`), i.e.
  automatic range from the data. Locking the range is ParaView's own feature.
- No categorical palette or legend anywhere in the clone. `cell_type_` is an int array and gets
  ParaView's continuous map, which matches the hands-on note.
- The ROOT path has no colour by property: every volume is `kBlue` (`root/adaptor.h:150`, `:190`).

## D. Slices, clipping, cross-sections

- None in BioDynaMo code. Clip and Slice in the hands-on note are standard ParaView filters.
- The substance grid is written as z slabs (`vtk_diffusion_grid.cc:149-166`). That is a parallel
  I/O split, not a slicing feature.

## E. Time

- Frame selection is by step: `total_steps % visualization_interval` (`adaptor.cc:107-110`).
  Default interval 1 (`param.h:345-353`).
- Files are named `<Agent>-<step>.pvtu` with `_<thread>.vtu` pieces (`vtk_agents.cc:146-152`,
  `parallel_vtu_writer.cc:70`, `:85`); substances `<name>-<step>.pvti` (`vtk_diffusion_grid.cc:194-200`).
- No `.pvd` in the main path. The state script globs the files, sorts them by the number after the
  last `-` and passes the list to `XMLPartitionedUnstructuredGridReader`
  (`generate_pv_state.py:41-55`). ParaView then counts frames 0..N-1, which is the "max is 99"
  in the hands-on note. Simulation time is set only for Catalyst (`adaptor.cc:112-113`); whether
  the exported files carry it is unverified.
- `UpdateAnimationUsingDataTimeSteps()` sets the slider range, and the state is saved twice so a
  crash in that render pass still leaves a usable file (`generate_pv_state.py:116-131`).
- A legacy `ParaviewExporter` writes ASCII `.vtu` plus a `.pvd` with `timestep = i * dt`
  (`src/core/exporter.cc:303-322`). Nothing in `src/` outside `exporter.*` uses it.
- Play/scrub/caching: ParaView's. In situ there is no scrubbing, only the live frame.

## F. Picking and inspection

- Nothing in BioDynaMo code. Picking and the spreadsheet are ParaView's.
- The id problem is in section B. The fix is to carry the agent id through the glyph step.
- Our viewer already does this right: `hucreSec` maps `instanceId` to a lattice site through
  `K.siteler` (`hucre3b.html`, around line 1185). Keep that design.

## G. Plots

- `TimeSeries` collects one value per step, after visualization (`scheduler.cc:63-65`,
  `src/core/operation/default_ops.cc:117-125`). Collectors are a function of the simulation
  or a reducer such as a `Counter` with a predicate (`src/core/analysis/time_series.h:212-239`).
- External data can be added for comparison (`time_series.h:248-258`), and several runs can be
  merged into one curve with error bands through a user merger (`time_series.h:173-185`).
- `LineGraph` draws them with ROOT and saves to file (`src/core/analysis/line_graph.h:51-74`).
- Post hoc only. Plots are not linked to the 3D view.

## H. Export (images, movies)

- In situ: `coprocessor.WriteImages(datadescription)` each visualization step
  (`default_insitu_pipeline.py:328`). Which views write images is set by the user's script.
- Export mode: none in BioDynaMo; screenshots and movies are ParaView's Save Screenshot and Save
  Animation. `LineGraph::SaveAs` writes plots (`line_graph.h:71`).
- Data export size: one `.vtu` per thread per frame (`parallel_vtu_writer.cc:66-95`), zlib
  compression on by default (`param.h:418-427`). This is why the demo produced 3102 files.

## I. Engine: cell-cell interaction (feeds our next step)

- Per-agent mechanics run in `MechanicalForcesOp` (`src/core/operation/mechanical_forces_op.h:76-103`).
  The search radius is the largest agent size, refreshed once per step (`:85-90`).
- Sphere-sphere force (`src/core/interaction_force.cc:60-111`):
  - each radius is inflated by `10 * 0.15 = 1.5` length units, so cells feel each other before
    touching (`:65-79`);
  - overlap `delta = r1 + r2 - d`; no force if `delta < 0` (`:87-92`);
  - `f = k*delta - gamma*sqrt(r*delta)` with `k = 2` (repulsion), `gamma = 1` (attraction) and
    `r = r1*r2/(r1+r2)` (`:102-105`). The sqrt term is the only adhesion; it is hard-coded;
  - coincident centres get a random push in [-3, 3] (`:95-100`).
- Sphere-cylinder and cylinder-cylinder have their own cases, dispatched by shape (`:33-58`); a
  short cylinder is treated as a sphere at its distal end (`:126-138`).
- Motion is overdamped, not Newtonian (`src/core/agent/cell.h:262-353`):
  displacement = `tractor_force * dt` + `sum(F) * dt / mass`, but the force part applies only if
  `|sum F| > adherence` (static friction), and the step is capped at
  `simulation_max_displacement` (`cell.h:287`, `:328-351`). "PhysicalBonds" is a comment with no
  code (`cell.h:326`).
- Neighbour search, `param.environment` = `uniform_grid` (default), `kd_tree` (nanoflann) or
  `octree` (unibn) (`param.h:115-122`, `src/core/environment/kd_tree_environment.h:70`,
  `octree_environment.h:43`).
  - Uniform grid: box length = ceil(largest agent size) unless set (`uniform_grid_environment.cc:134-148`).
    A box is a 16-byte header with a spinlock and a linked list into `successors_`
    (`uniform_grid_environment.h:69-80`). A query walks the 27 Moore boxes and checks distances in
    SIMD batches of 64 (`uniform_grid_environment.h:469-497`). A radius larger than the box is an error (`:424-430`).
- Per-agent state: `Cell` stores `position_`, `tractor_force_`, `diameter_`, `volume_`,
  `adherence_`, `density_` (`cell.h:371-379`); every agent has `uid_` (`agent.h:271`).
  Output writes only `position_` + `diameter_` + the chosen extras (section B). The backup is the
  whole `Simulation` object written with ROOT I/O, plus the step count
  (`src/core/simulation_backup.h:54-73`), every `backup_interval` seconds of wall time
  (`scheduler.cc:420-428`). The visualization member list is not backed up (`param.h:370`).
- Speed tricks relevant to many cells: agents are kept per NUMA node and regrouped so neighbours
  share a node (`src/core/resource_manager.h:386-388`, `:503`); the grid uses Morton order
  (`uniform_grid_environment.h:35`, `:630`); static agents can skip the force pass
  (`param.h:461-470`). For drawing: zero-copy attribute arrays (`param.h:538-556`,
  `mapped_data_array.h:240-282`) and one file per thread.

Relevance to us: our model is a lattice with at most one agent per 0.1 mm site, so this
off-lattice force law does not apply directly. The useful parts are the adherence threshold idea
(move only when net push beats a threshold) and the overlap-plus-adhesion force shape.

## J. Licence

- Whole repo: Apache-2.0 (`LICENSE`), with a `NOTICE` naming CERN, Surrey and Innopolis. Source
  files carry the Apache header (e.g. `adaptor.cc:1-13`).
- `paraview_plugin/`: Apache header, but "Based on default Kitware glyph" (`BDMGlyph.cxx:16`), so it
  is derived from VTK (BSD-3, unverified here).
- Third party used by the engine: nanoflann BSD (`third_party/nanoflann/nanoflann.hpp:2`), unibn
  octree MIT-style (`third_party/unibn/unibn_octree.h:5-11`). ParaView (BSD-3) and ROOT (LGPL-2.1)
  are not in the clone (unverified).
- No GPL file found in `src/` or `paraview_plugin/` (grep for "GPL").
- What we may do: Apache-2.0 allows copying with the licence text, the NOTICE and a note of
  changes. Nothing here is JavaScript, so in practice we re-implement ideas. If we ever copy a
  constant table or a formula verbatim, keep an attribution line in the file header.

## K. Port list for `hucre3b.html` (three.js r147, classic scripts)

### K1. Colour by property with a lockable range and a legend (M)

BioDynaMo leaves this to ParaView: solid glyphs (`default_insitu_pipeline.py:39`), auto range for
fields (`:223-225`), no categorical legend. We should do better: categorical for type,
continuous for scalars (days at site, neighbour count, previous occupant), range auto or locked.

```js
// per instance: iProp (float). One 256x1 DataTexture per colour map.
const lut = new THREE.DataTexture(rgbaBytes, 256, 1); lut.needsUpdate = true;
mal.onBeforeCompile = (s) => {
  Object.assign(s.uniforms, { uLut: { value: lut }, uMin: { value: 0 }, uMax: { value: 1 }, uMode: { value: 0 } });
  s.vertexShader = 'attribute float iProp; varying float vP;\n' + s.vertexShader
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n vP = iProp;');
  s.fragmentShader = 'uniform sampler2D uLut; uniform float uMin,uMax; uniform int uMode; varying float vP;\n' + s.fragmentShader
    .replace('#include <color_fragment>', '#include <color_fragment>\n if (uMode==1) diffuseColor.rgb = texture2D(uLut, vec2(clamp((vP-uMin)/(uMax-uMin),0.,1.),.5)).rgb;');
};
function setDay(d) { fillProp(d); if (!locked) [uMin, uMax] = rangeOf(visibleProps); drawLegend(uMin, uMax); }
```

### K2. Self-describing run manifest with an attribute list (S)

`simulation_info.json` tells the state builder which agents, shapes, scaling attribute and
substances exist (`src/core/visualization/paraview/helper.cc:24-114`, read at
`generate_pv_state.py:70-106`). The member list is "required + user extras"
(`vtk_agents.cc:191-200`). We add `manifest.json` per run from `hucre3b_veri.py`: types with
names and colours, day list, per-site channels with unit and range, regions. The viewer then
builds the type toggles, the colour-by menu (K1) and the legend from it.

```js
const M = await fetch(`veri/${id}/manifest.json`).then(r => r.json());
// M = { days:[0..359], types:[{code:1,name:"MSC",color:"#..."}], channels:[{key:"age",unit:"day",min:0,max:359}] }
M.types.forEach(t => addToggle(t));  M.channels.forEach(c => addColourOption(c));
```

### K3. Population chart linked to the 3D view, with run overlay (M)

`TimeSeries` counts agents with a predicate per step (`time_series.h:212-239`) and merges runs
into one curve with error bands (`time_series.h:173-185`), but the plot is post hoc and unlinked.
We already have `sayilar.json`. Add: a vertical day cursor; click on the chart sets the day; click
on a curve highlights that type in 3D (others dimmed); optional overlay of the other two runs.

```js
chart.onclick = (e) => { const d = xToDay(e.offsetX); setDay(d);
  const t = nearestCurve(e.offsetY, d); if (t != null) highlightType(t); };
function highlightType(t) { kumeler.forEach((arr, i) => arr.forEach(K =>
  K.govde.material.opacity = (t == null || i === t) ? 1 : 0.15)); }
function drawRuns(ids) { ids.forEach((id, k) => drawCurve(veri[id].sayilar, dash[k])); }
```

### K4. Visible-cell table linked both ways with the 3D pick (M)

ParaView's spreadsheet sits beside the 3D view, but the link broke because the glyph mesh lost the
agent id (`BDMGlyph.cxx:576-581` exists but is not exposed). Our `instanceId -> site` map already
keeps the id. Build a small table of the cells inside the slab (type, site, since day, property);
clicking a row moves the selection ring; picking in 3D scrolls to the row.

```js
function rows() { const out = []; kumeler.forEach((a, t) => a.forEach(K => {
  for (let i = 0; i < K.govde.count; i++) out.push({ t, site: K.siteler[i] }); })); return out; }
tbody.onclick = (e) => { const r = e.target.closest('tr'); bilgiGoster(+r.dataset.t, +r.dataset.site); };
// in bilgiGoster: document.querySelector(`tr[data-site="${site}"]`)?.scrollIntoView({block:'nearest'});
```

### K5. Frame export with a day stamp, without downloads (S)

Catalyst writes an image every visualization step (`default_insitu_pipeline.py:328`). Our CSP
blocks downloads, so render one frame into a 2D canvas with the day stamp and show it as an
`<img>` (right-click save) or copy it to the clipboard. Clipboard access inside the artifact
frame is unverified.

```js
function snap() { rH.render(sH, kH);                     // same tick as the draw call
  const c = document.createElement('canvas'); c.width = rH.domElement.width; c.height = rH.domElement.height;
  const g = c.getContext('2d'); g.drawImage(rH.domElement, 0, 0);
  g.font = '24px sans-serif'; g.fillStyle = '#fff'; g.fillText(`Day ${Math.floor(durum.gun)}`, 16, 32);
  c.toBlob(b => { img.src = URL.createObjectURL(b); overlay.hidden = false;
    navigator.clipboard?.write?.([new ClipboardItem({ 'image/png': b })]).catch(() => {}); }); }
```

### K6. Update only what changed between days (S)

BioDynaMo avoids copies with zero-copy arrays that read agent memory on demand
(`mapped_data_array.h:240-282`, modes in `param.h:538-556`). For us the analogue is partial GPU
uploads: when the slider moves one day, rewrite only the instances whose site changed and upload
that range.

```js
function patch(K, changed) {           // changed: sorted instance indices
  const lo = changed[0], hi = changed[changed.length - 1];
  writeInstances(K, changed);
  K.govde.instanceMatrix.updateRange = { offset: lo * 16, count: (hi - lo + 1) * 16 };
  K.durumAttr.updateRange = { offset: lo * 4, count: (hi - lo + 1) * 4 };
  K.govde.instanceMatrix.needsUpdate = K.durumAttr.needsUpdate = true; }
```

Not portable from BioDynaMo: an orthogonal slice next to 3D and side-by-side 3D runs. It has
neither in its own code (ParaView provides them), so take those from the CompuCell3D and ParaView
notes instead.
