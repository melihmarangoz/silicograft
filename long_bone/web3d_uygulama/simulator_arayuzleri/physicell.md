# PhysiCell + PhysiCell Studio: hands-on notes

Tested 2026-11-07 in a throwaway Linux container (Ubuntu 26.04, Python 3.14, software OpenGL): PhysiCell 1.14.2 with `interaction-sample` (7 cell types, "stem" transforms into "differentiated"), Studio `main` with PyQt5 5.15.11, VTK 9.7.2. All of it was seen in the running GUI (twice, the first lease was lost in a local crash) unless marked *(not verified)*.

## What it is, how the GUI is organised
PhysiCell is a C++ agent-based framework without a GUI. Studio is a PyQt5 desktop app that edits the model XML, runs the compiled executable and plots its output. One window: menu bar (Studio, File, View, Action, Help) and a tab bar **Config Basics, Microenvironment, Cell Types, User Params, Rules, ICs, Run, Plot**. Cell Types has a type list on the left and ten phenotype sub-tabs (Cycle, Death, Mechanics, Motility, Secretion, Interactions, ...). Every field shows its unit.

## Visualisation
- **2D Plot tab (matplotlib):** frame buttons `|< < [n] > >|` and Play/Pause. Cells drawn with the model's SVG colours (legend in its own window) or coloured by any of 100+ per-cell variables, with colormap and optional fixed cmin/cmax. Substrate field underlay with its own colormap and gradient options. A **Filter** dialog hides cell types.
- **View → Plot options:** cell edge/fill/nucleus, neighbour/attachment graph lines, voxel grid, 1:1 aspect, ROI zoom typed as centre + radius, "Save snap.csv", PNG per frame *(PNG not verified)*.
- **Population plot:** counts per cell type over time, one click, popup.
- **Make Movie:** replays every frame on the canvas, then ffmpeg encodes it (20 frames gave a 2 s, 1280x960 mp4 at 10 fps).
- **3D (start with `-3`, VTK):** spheres coloured by a scalar, mouse rotation (keys j/t/r), XY/YZ/XZ substrate slices, isosurface, clipping planes with flip, axes, sphere resolution. It crashed on VTK 9.7 (`AddActor2D` removed) until I patched that call in the lease. With this 2D model the slices showed only faint lines *(slices on a real 3D model not verified)*.

## Interaction, analysis, editing workflow
No cell picking: clicking a cell did nothing, and the mouse wheel does not zoom the 2D plot. Analysis is only the population plot and colour-by-variable. Workflow: edit tabs → Run (console streams in, Cancel stops it) → Plot. **Rules** builds signal→behaviour Hill rules and plots the response curve. **ICs** places cells per type by shape (disk/annulus, box, ring, point) with a preview and saves `cells.csv`.

## Strengths and weaknesses I met
Good: edit, run and view in one window, every parameter visible with its unit, colour-by-variable, population plot and movie each two clicks away.
Weak: many separate popups (legend, filter, plot options, population). The Plot tab stays empty until you press a frame button. The default colour variable was meaningless (all zero), and the range rescales every frame unless "fix" is set. Zoom only by typing numbers. Frames redraw slowly (2-3 s each in movie export). A cancelled run left a half-written last SVG, and Make Movie stopped at a modal error until I clicked OK. Setup needed packages missing from `requirements.txt` (PyGithub, Qt xcb libraries) and the VTK patch. On 8 threads the sample ran 2.5 simulated days (660 → 1940 agents) in 2 min 47 s before I cancelled it.

## Ideas for our three.js viewer
1. "Colour by" any agent field, with an auto/locked range toggle so playback does not flicker.
2. One clickable legend that also filters (MSC, osteoblast, chondrocyte, fibroblast), not separate Legend and Filter windows.
3. A population-over-time chart docked under the 3D view, with a cursor at the current day and click-to-seek.
4. Field slices (XY/YZ/XZ) with their own colormap plus clipping planes for cells, to see inside the callus.
5. Studio's overlays (lattice grid, neighbour graph, one-click PNG/MP4) plus what it lacks: click a cell to see its variables, mouse zoom/pan.

## Screenshots
- `01_main_window_config_basics.png`: main window, tab bar, Config Basics form.
- `02_cell_types_editor.png`: Cell Types, "stem" selected, Interactions sub-tab (transformation rate to differentiated 0.0001 1/min).
- `03_ics_initial_conditions.png`: ICs tab, 200 stem cells in an annulus plus 80 differentiated cells in a disk (preview only, not saved).
- `04_plot_cell_types_legend.png`: Plot tab, day 1.4 (1339 agents), model SVG colours with legend window.
- `05_plot_colour_by_pressure_on_substrate.png`: cells coloured by pressure over the pro-inflammatory field, two colour bars.
- `06_plot_options_roi_neighbor_graph.png`: Plot options dialog, ROI zoom 200x200 µm, voxel grid, neighbour graph.
- `07_population_plot.png`: population plot popup (cells per type vs time).
- `08_plot3d_vtk_viewer.png`: 3D VTK viewer, day 2.5, tilted by mouse, cell_type and resource colour bars, 3D plot options (slices ticked, not visible in this 2D model).
- `extra/x1_rules_hill_curve.png`: Rules tab with a demo rule and its Hill curve popup (demo only, deleted again).
- `extra/x2_microenvironment.png`: Microenvironment tab.
- `extra/x3_run_tab_console.png`: Run tab with streamed console output after cancelling.
- `extra/x4_plot_cell_type_filter.png`: Filter dialog showing only stem + differentiated.
- `extra/x5_studio_make_movie.mp4`: movie produced by Make Movie.
