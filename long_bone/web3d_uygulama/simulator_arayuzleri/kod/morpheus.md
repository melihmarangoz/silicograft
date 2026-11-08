# Morpheus source study

Commit: `110278081c6b1b9a2a0113fbf19d390e37435814`

## A. Architecture map

Morpheus separates the simulation engine from its desktop model editor.
The core and plugins are C++.
The GUI uses Qt.
A MorpheusML model configures the simulation and its analysis plugins.

The GUI is a structured editor and job launcher.
It is also a useful place to understand the model.
Its model graph, context help, parameter sweep and job output browser deserve attention alongside visualization.

The model graph is generated from the model's registered dependencies.
The GUI saves a temporary model and starts the simulator with `--model-graph`.
It reuses the graph while the model edit counter is unchanged.
If rendered output is unavailable, it accepts DOT output.
See `gui/morpheusML/morpheus_model.cpp:165`.

The dependency plugin walks model scopes and time-step listeners.
It emits a directed DOT graph.
Symbol nodes point to components that read them.
Components point to symbols they write.
Symbol-to-symbol dependencies also become edges.
See `morpheus/plugins/analysis/dependency_graph.cpp:234`,
`morpheus/plugins/analysis/dependency_graph.cpp:350` and
`morpheus/plugins/analysis/dependency_graph.cpp:509`.

This is a dataflow graph, not automatically a cell-type transition graph.
Scopes group its contents.
Filters and reduced output can omit or expand some symbols.
The plugin can render with Graphviz's `dot` layout.
Without Graphviz support it writes DOT instead.
See `morpheus/plugins/analysis/dependency_graph.cpp:71` and
`morpheus/plugins/analysis/dependency_graph.cpp:105`.

The GUI's DOT viewer loads D3, Viz.js and d3-graphviz.
It renders the DOT into the page.
See `gui/data/model_graph_viewer.html:137`.
The exact behavior of every graph filter is unverified.

Simulation images are primarily produced by analysis plugins.
Gnuplotter sends plot commands and data to gnuplot.
TIFF and VTK plugins write scientific image or field data.
Logger writes selected values and can generate plots.
See `morpheus/plugins/analysis/gnuplotter.cpp:1339`,
`morpheus/plugins/analysis/tiff_plotter.cpp:238`,
`morpheus/plugins/analysis/vtk_plotter.cpp:102` and
`morpheus/plugins/analysis/logger2.cpp:283`.

The job view reads a selected image using `QImageReader`.
It puts the decoded image into a `QGraphicsPixmapItem`.
The preview is explicitly non-interactive.
See `gui/jobcontroller.cpp:97` and `gui/jobcontroller.cpp:456`.
A frame cache, asynchronous image decoder and dedicated preview thread are unverified.

## B. Cell drawing

A CPM cell occupies a set of lattice nodes.
Gnuplotter's filled-cell path reconstructs a boundary in a chosen z plane.
It does not construct a 3D cell surface in that path.

For each non-medium cell, the painter visits its nodes.
It keeps nodes on the requested z slice.
For each in-plane neighbor that is outside the same cell, it emits an edge segment.
It handles the lattice's orthogonal coordinates and alternating neighborhoods.
See `morpheus/plugins/analysis/gnuplotter.cpp:690` and
`morpheus/plugins/analysis/gnuplotter.cpp:908`.

It joins segments by matching endpoints until a polygon closes.
A cell can produce more than one polygon.
The code reports a failure when it cannot close a polygon.
See `morpheus/plugins/analysis/gnuplotter.cpp:999`.

Each resulting boundary specification carries a scalar value.
The default value is `cell.type`.
Gnuplot receives polygon blocks and their scalar values.
It fills the polygons from the palette and draws outlines.
See `morpheus/plugins/analysis/gnuplotter.cpp:500`,
`morpheus/plugins/analysis/gnuplotter.cpp:722` and
`morpheus/plugins/analysis/gnuplotter.cpp:1834`.

Flooding is the default for non-membrane values.
Other cases use a lattice matrix representation.
See `morpheus/plugins/analysis/gnuplotter.cpp:521` and
`morpheus/plugins/analysis/gnuplotter.cpp:548`.

The inspected filled-cell path is a 2D slice, even for a 3D lattice.
The hands-on note describes a static 3D projection.
Which rendering path produced that particular screenshot is unverified.

There is no measured cell-count limit in the inspected code.
There is no evidence in this path of GPU instancing, LOD or mesh decimation.
Boundary extraction and gnuplot rendering cost depend on lattice and boundary size.
SilicoGraft already uses `InstancedMesh` per type and variant.
Its geometry and rendering problem therefore differ substantially.

## C. Colour by property

A Cells plot evaluates its configured `value` symbol for each cell.
The default is `cell.type`.
The symbol can instead represent a cell property.
See `morpheus/plugins/analysis/gnuplotter.cpp:500` and
`morpheus/plugins/analysis/gnuplotter.cpp:731`.

An explicit ColorMap associates numeric values with named colours.
For integer symbols without an external palette, a repeating default palette is constructed.
See `morpheus/plugins/analysis/gnuplotter.cpp:560` and
`morpheus/plugins/analysis/gnuplotter.cpp:605`.

The plot accepts explicit minimum and maximum values.
It can use one explicit bound and derive the other.
A non-adaptive external palette can fix the range to its endpoint values.
Otherwise the code tracks observed values or lets gnuplot choose.
See `morpheus/plugins/analysis/gnuplotter.cpp:521` and
`morpheus/plugins/analysis/gnuplotter.cpp:635`.

Observed extrema persist across frames by default.
`per-frame-range` resets them before collecting the next frame.
Thus the default observed range can expand as the run progresses.
See `morpheus/plugins/analysis/gnuplotter.cpp:526` and
`morpheus/plugins/analysis/gnuplotter.cpp:690`.

With decoration enabled, the plot requests a colour box and ticks.
Without decoration, it hides the colour box.
See `morpheus/plugins/analysis/gnuplotter.cpp:1698`.

## D. Slices, clipping and cross-sections

A Gnuplotter Plot has a z-slice parameter.
The code validates it against the lattice depth.
The boundary painter then selects nodes on that plane.
See `morpheus/plugins/analysis/gnuplotter.cpp:1223` and
`morpheus/plugins/analysis/gnuplotter.cpp:958`.

This is a configured output slice.
Interactive orthogonal slice controls and arbitrary clipping are unverified.
TIFF can crop output to selected cells.
That crop computes a bounding box from cell nodes.
See `morpheus/plugins/analysis/tiff_plotter.cpp:86` and
`morpheus/plugins/analysis/tiff_plotter.cpp:347`.

For SilicoGraft, an orthogonal slice can use the existing daily lattice.
It need not reproduce Morpheus polygon extraction.

## E. Time, frame loading and browsing

Analysis plugins use a configured `time-step`.
Gnuplotter also has a condition that can suppress an analysis call.
See `morpheus/core/interfaces.cpp:249` and
`morpheus/plugins/analysis/gnuplotter.cpp:1107`.
The example `CellSorting_2D` requests Gnuplotter every 100 simulation time units.
See `Examples/CPM/CellSorting_2D.xml:102`.

Gnuplotter supports time-based and sequential file numbering.
Time-based numbering is its default.
See `morpheus/plugins/analysis/gnuplotter.cpp:1111`.
VTK filenames use a zero-padded sequential plot number.
See `morpheus/plugins/analysis/vtk_plotter.cpp:102`.

The GUI job view previews the currently selected output file.
It reads the selected image and replaces the scene contents.
A user can browse different time steps by selecting their image files.
See `gui/jobcontroller.cpp:456`.
A timeline, playback control or image prefetch cache in this view is unverified.

This supports the hands-on observation of post-hoc image browsing.
The code inspected does not establish the cause of the observed file-list reordering.

## F. Picking and inspection

The job image preview calls `setInteractive(false)`.
It displays pixels rather than a cell-aware scene.
See `gui/jobcontroller.cpp:97`.
A click-to-cell inspector in that preview is therefore not implemented there.

Gnuplotter can render configured cell labels.
Logger can write configured cell-level values and cell IDs.
See `morpheus/plugins/analysis/gnuplotter.cpp:449` and
`morpheus/plugins/analysis/logger2.cpp:501`.
These are not equivalent to interactive picking or a cell history.

SilicoGraft already has an inspector.
Its site history is meaningful at a fixed lattice position.
Individual migration paths remain inferred because the supplied data has no persistent cell identity.
Any linked selection should preserve that distinction.

## G. Plots linked to the view

Logger writes configured output on analysis calls.
Its text writer supports CSV and matrix output.
Its line-plot implementation obtains columns from a writer and builds gnuplot commands.
See `morpheus/plugins/analysis/logger2.cpp:283`,
`morpheus/plugins/analysis/logger2.cpp:704` and
`morpheus/plugins/analysis/logger2.cpp:1266`.

This supports time-series plots during or after a run.
A shared selection or time cursor between a Logger plot and the job image preview is unverified.
The inspected job preview is a separate image display.

The GUI's sweep editor can add a model attribute to ParamSweep.
Ranges can specify increments, interval counts and logarithmic spacing.
Grouped attributes advance pairwise, limited by the shortest value list.
Independent groups expand into combinations.
Optional preset seeds are added to generated jobs.
See `gui/domnodeviewer.cpp:271`,
`gui/morpheusML/paramsweepmodel.cpp:77` and
`gui/morpheusML/paramsweepmodel.cpp:552`.

This confirms the useful distinction between paired parameter changes and a Cartesian sweep.
It does not prove that the hands-on sweep was launched.

## H. Export

Gnuplotter supports screen, PNG, JPEG, GIF, SVG, PDF and EPS terminals.
PNG is the configured default.
See `morpheus/plugins/analysis/gnuplotter.cpp:1120`.

The movie dialog invokes FFmpeg.
Its arguments specify H.264, an input frame rate and even-sized YUV420 output.
See `gui/moviedialog.cpp:83` and `gui/moviedialog.cpp:211`.
This supports the hands-on MP4 workflow when FFmpeg is installed.

TIFF provides channel data and can write stacks or cropped cells.
VTK writes legacy `STRUCTURED_POINTS` with scalar channels.
See `morpheus/plugins/analysis/tiff_plotter.cpp:238` and
`morpheus/plugins/analysis/vtk_plotter.cpp:128`.

SilicoGraft's strict CSP and no-download requirement constrain export.
A browser capture can be displayed in-page.
Saving or encoding a movie needs a separately approved delivery mechanism.

## I. Cell-cell interaction model

Morpheus's CPM is a lattice model.
A cell can occupy many lattice sites.
A proposed update changes site ownership between cells.
It is not a center-based particle simulation with a universal force law.

The sampler evaluates an interaction-energy change.
It adds cell-type-specific energy changes and a configured yield term.
If the resulting change is non-positive, it accepts the update.
For positive changes, it compares a random draw with `exp(-dE / temperature)`.
See `morpheus/core/cpm_sampler.cpp:465`.

Contact energies are configured for pairs of cell types.
A contact value can be an expression using the two cells' scopes.
The implementation stores the pair in both lookup directions.
Contact plugins can add to or override interaction behavior.
See `morpheus/core/interaction_energy.cpp:60`.

The interaction calculation uses a boundary neighborhood.
It precomputes offsets into the lattice layer for those neighbors.
See `morpheus/core/interaction_energy.cpp:160`.
This is local lattice-neighbor lookup, not a spatial tree of cell centers.

The sampler supports random and edge-list stepper modes.
The CPM can construct an edge tracker for its update and surface neighborhoods.
See `morpheus/core/cpm_sampler.cpp:14` and `morpheus/core/cpm.cpp:116`.
Lattice stencils also precompute memory offsets.
See `morpheus/core/cpm_layer.cpp:15`.

A volume constraint penalizes deviation from a target.
Its energy is `strength * (target - volume)^2`.
The update delta is the after-minus-before difference.
See `morpheus/plugins/shape/volume_constraint.cpp:12`.

A surface constraint similarly compares current and proposed surface measures.
It supports a surface target or an asphericity-derived target.
Its default penalty is quadratic; an exponent can be configured.
See `morpheus/plugins/shape/surface_constraint.cpp:36`.

Optional mechanical links add spring-like interactions between touching cells.
The documented equilibrium distance uses cell centers and equivalent radii.
Link and unlink probabilities are configurable.
The header states that links currently form among cells of the same type.
See `morpheus/plugins/interaction/mechanical_link.h:21`.

These terms are model-dependent plugins.
One should not assume that every model enables all of them.
They are useful analogues for future interaction work, not direct descriptions of SilicoGraft's rules.

Output state also depends on configuration.
A saved cell can include its ID, name and lattice nodes.
See `morpheus/core/cell.cpp:136`.
Logger can export selected symbols and IDs.
VTK exports selected scalar channels over lattice points.
See `morpheus/plugins/analysis/logger2.cpp:501` and
`morpheus/plugins/analysis/vtk_plotter.cpp:128`.
A complete universal per-cell history is not established by these outputs.

## J. Licence

The repository's Morpheus licence states BSD 3-clause.
It permits source and binary redistribution with its stated notice conditions.
It also restricts endorsement using the copyright holder's or contributors' names.
See `LICENSE.md:1`.

The same file says bundled third-party libraries have their own licences.
The Morpheus BSD licence does not automatically cover those libraries.
See `LICENSE.md:20`.
The precise licences and distribution obligations of each bundled dependency are unverified.

Reimplementing the ideas avoids importing their implementation dependencies.
If copying Morpheus-owned BSD code, retain the required notices and check provenance.
Do not copy GPL code into the viewer.
Review the actual licence of every external library before bundling it.
This matters whether the repository remains private or is published.

## K. Port list

### 1. Property colours with a lockable range — M

Morpheus evaluates a cell symbol and controls palette bounds.
See `morpheus/plugins/analysis/gnuplotter.cpp:635`.
Add a property selector, colour bar and explicit auto/locked range.
Offer per-day and whole-run auto ranges as distinct choices.
Mark unavailable properties rather than inventing values.

```js
const v = values[site];
const t = clamp((v - range.min) / (range.max - range.min), 0, 1);
mesh.setColorAt(instanceIndex, palette(t));
mesh.instanceColor.needsUpdate = true;
```

Handle a constant range and missing values explicitly.
Use the same range for side-by-side comparisons.

### 2. Orthogonal lattice slice — M

Morpheus selects a configured z plane before extracting boundaries.
See `morpheus/plugins/analysis/gnuplotter.cpp:958`.
Add an XY, XZ or YZ slice beside the 3D view.
Draw site codes to a canvas or texture using the current day.
Link the slice position to a visible plane in the three.js scene.

```js
for (const site of sitesOnPlane(axis, index)) {
  drawPixel(site.u, site.v, colourFor(codeAt(day, site)));
}
sliceTexture.needsUpdate = true;
```

Clicking a slice site can use the existing site inspector.
The slab's limited depth should be clear in the interface.

### 3. Linked population chart and selection — M

Logger demonstrates configurable output series.
See `morpheus/plugins/analysis/logger2.cpp:1266`.
Use the viewer's existing daily counts and a shared day state.
A chart click changes the day; moving the day slider moves the chart cursor.
Clicking a type series can highlight that type in 3D.

```js
chart.onClick = x => setDay(nearestDay(x));
slider.oninput = () => setDay(Number(slider.value));
function setDay(day) {
  state.day = day;
  updateInstances(day);
  updateChartCursor(day);
}
```

A population series selects a type, not an individual cell.

### 4. Differentiation rule graph — M

Morpheus derives a directed graph from declared readers and writers.
See `morpheus/plugins/analysis/dependency_graph.cpp:350`.
Apply that idea to structured SilicoGraft rule metadata.
Use cell types as nodes and a directed edge for each implemented transition.
Label each edge with the rule and its conditions.
This graph requires explicit transition metadata; Morpheus's dataflow graph does not supply it.

```js
for (const rule of rules) {
  addNode(rule.from);
  addNode(rule.to);
  addEdge(rule.from, rule.to, rule.name, rule.conditions);
}
renderAccessibleSvg(nodes, edges);
```

Use inline SVG and classic scripts to fit the CSP.
Selecting an edge should show its conditions and source reference.
Generate metadata from the authoritative rules where feasible.
Flag graph entries that cannot be traced to implemented rules.

### 5. Side-by-side runs — L

Morpheus expands sweep parameters into identifiable jobs.
See `gui/morpheusML/paramsweepmodel.cpp:77`.
Let users choose two available runs and show their parameters.
Share day, region, camera and locked colour range.
Make synchronization optional when inspecting a single run.

```js
left.setFrame(day, region);
right.setFrame(day, region);
left.camera.copy(sharedCamera);
right.camera.copy(sharedCamera);
renderBoth();
```

Compare the same region and day.
The design note says the available reruns are not bit-identical to earlier runs.
Display run provenance and seed with the comparison.

### 6. In-page frame capture — S

Morpheus exports image frames and passes sequences to FFmpeg.
See `morpheus/plugins/analysis/gnuplotter.cpp:1120` and
`gui/moviedialog.cpp:211`.
Render a selected frame with its day, region and run label.
Show the captured image in-page under the current no-download constraint.

```js
renderer.render(scene, camera);
const image = renderer.domElement.toDataURL("image/png");
preview.src = image;
```

Test capture with the actual renderer and CSP.
Movie encoding and file delivery remain separate work.