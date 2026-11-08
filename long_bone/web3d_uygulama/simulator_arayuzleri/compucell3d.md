# CompuCell3D 4.10: Player5 and Twedit++ (hands-on notes)

Installed CompuCell3D 4.10.0 from the `compucell3d` + `conda-forge` channels with micromamba in a pool container (Ubuntu, software OpenGL, no GPU). Ran the cellsort 2D/3D, bacterium-macrophage, steering-panel and scientific-plots demos from the GitHub `Demos` folder. Everything below was seen on screen unless marked *(not verified)*.

**Workaround used:** with software OpenGL the Player drew only cell borders, no cell fill. Setting `pixelized_cartesian_field = False` in `cc3d/core/GraphicsOffScreen/MVCDrawModel2D.py` fixed it. All screenshots are taken after this patch.

## What it is, how the GUI is laid out
CompuCell3D is a Cellular Potts (GGH) simulator. Models are CC3DML (XML) plus Python "steppables". **Player5** runs and shows a model. **Twedit++** is the model editor.

- **Player5** is a Qt main window. Menus: File, View, Simulation (Run/Step/Pause/Stop), Visualization, Tools, Window, Help. A toolbar repeats run controls and zoom.
- Left docks: *Model Editor* (the CC3DML as a property tree), *LatticeDataFiles* (for replaying saved lattice output, *not verified*), *Cell Type Colors* (id, colour, name, "Show in 3D" checkbox). The bottom dock is a *Console* with Output/Errors tabs. The status bar shows the current MC step.
- The centre is an MDI area. Graphics windows, plot windows and the steering panel are all sub-windows. Window menu: New Graphics Window, Tile, Cascade.

## Visualisation
- Each graphics window has its own toolbar: projection (3D / xy / xz / yz), slice position spin box, field selector (Cell_Field or any chemical field) and a camera button *(not tested)*.
- Visualization menu toggles cells, cell borders, cluster borders, glyphs, FPP links, concentration limits, and has Reset Camera and zoom.
- The field view shows a colour bar and a "Min/Max" readout, with cell borders drawn on top.
- In 3D, the mouse rotates the camera. Unticking a type in "Show in 3D" hides it, which makes inner structure visible.
- Preferences has 7 tabs. Screenshots/Movies: redraw every Nth MCS, save image every Nth MCS, resolution, movie fps/quality, "Write MCS on each frame", Create Movie Now. Field: fixed or auto range, legend labels, vector arrows, isocontours. 3D: invisible types, "outer shell only" rendering, camera angles. Output: "Pause at MCS", restart snapshots.
- Time control is only Run/Step/Pause/Stop. There is no scrubber and no speed slider.

## Interaction, plots, steering, editing
- **Inspecting cells:** left and right clicks on a cell did nothing. I found no cell info panel.
- **Plots:** steppables open pyqtgraph windows that update live. Right-click gives View All, axis options, mouse mode and Export.
- **Steering:** parameters declared in Python (`add_steering_param`, slider or combo box) appear in a table. Clicking a value turns it into a slider. Raising `target_vol` from 25 to 63 made the cells grow within seconds.
- **Twedit++:** project tree (main Python, XML, resources), tabbed editor with syntax highlighting and folding. The "CC3D Python" menu has a snippet library grouped by topic, with a code preview popup. CC3D Project menu: New project, Open In Player, Add Parameter Scan, Zip *(not tried)*.

## Strengths and weaknesses I ran into
Strengths: installed in about a minute. Several views of one run can sit side by side. Per-type 3D visibility. A steering panel needs only a few lines of Python. Live plots need no setup. Preferences are thorough.

Weaknesses: empty 2D cells on software GL until the code patch. `cc3d-player5 -i file` opened an empty Player (`python -m cc3d.player5 -i` worked). Re-running a finished simulation quits the Player. No cell picking, no time scrubbing. Window layout resets on each start. 3D is slow without a GPU. The look is dated and the Model Editor is raw XML.

## Ideas for our three.js viewer
1. A cell-type dock: colour swatch plus visibility toggle per type (MSC, osteoblast, chondrocyte, fibroblast), with an "outer shell only" mode for speed.
2. Linked views: 3D next to an orthogonal slice (xy/xz/yz plus a position slider) on the same day.
3. A per-view field selector (cell type or a scalar field) with a colour bar, a fixed/auto range and a min/max readout.
4. Live, docked time-series plots (cell counts per type over 360 days), with "view all" and CSV/PNG export.
5. Export every Nth day as frames or video with the day stamped on each frame. Then go past CC3D: click-to-inspect a site, and a time scrubber.

## Screenshots
- `01_player_main_window_cellsort2d_two_views.png`: main window with all docks, two tiled 2D views of cellsort.
- `02_cellsort3d_3d_view_and_xy_slice.png`: 3D view (one type hidden) next to an xy slice at z=50.
- `03_plot_windows_pyqtgraph_tiled.png`: three live plot windows tiled with the cell view.
- `04_steering_panel_sliders_live.png`: steering panel with an inline slider, cells enlarged after a change.
- `05_preferences_screenshots_movies.png`: screenshot and movie settings.
- `06_preferences_cell_type_colors_glyphs.png`: cell-type colours, border colours, glyph settings.
- `07_chemical_field_ATTR_with_legend_vs_cell_field.png`: chemoattractant field with colour bar next to the cell field.
- `08_twedit_project_tree_xml_and_python_snippet_menu.png`: Twedit++ project tree, XML editor, snippet menu with preview.

