# Morpheus 2.4.1: GUI notes

Tested hands-on on 2026-11-07 in a pool container (official Ubuntu 24.04 `.deb`, software OpenGL). The GUI needed `QTWEBENGINE_DISABLE_SANDBOX=1` there (container quirk). Examples run: CPM > CellSorting_2D and CellSorting_3D. Items marked *(not verified)* I did not see myself.

## What it is and how the GUI is laid out
Morpheus (TU Dresden) couples cellular Potts model (CPM) cells, ODEs and reaction-diffusion PDEs. A model is one XML file (MorpheusML). The GUI is a structured editor and job launcher, and the simulator is a separate CLI.

Qt dock panels:
- **Documents** (left): each open model as a tree of fixed sections (Space, Time, Global, CellTypes, CPM, CellPopulations, Analysis, ParamSweep...).
- **JobQueue** (left): jobs grouped by model with elapsed time, and a right-click Stop/Remove/Group By. A **FixBoard** dock stayed empty *(purpose not verified)*.
- **Centre editor**: Description shows an auto-generated **model graph** (Graphviz) of symbols, plugins and dependencies, with filters. Other sections show an element tree, an Attributes table, and the model's symbols and components.
- **Documentation** (right): the MorpheusML reference, which follows the selected element.
- Menus: File, Examples (ODE, PDE, CPM, Multiscale, Miscellaneous), Window, About. The toolbar has Run/Stop and a local/remote selector.

## Visualisation
- **No interactive viewport.** Output comes from Analysis plugins added to the model: Gnuplotter (images), Logger (CSV and time-series plots), TiffPlotter (stacks for Fiji/ImageJ).
- **Colour by type or property:** each Gnuplotter `Plot` colours cells by any symbol (`cell.type`, a neighbour count), with an optional ColorMap and numeric CellLabels.
- **3D:** CellSorting_3D renders as a static gnuplot 3D projection that cannot be rotated. Its TIFF (100³, 2 channels) reached 137 MB in 42 s of running.
- **Post-hoc:** the job view lists output files and previews the selected image.
- **Live:** with the Gnuplotter terminal set to `screen` (also `x11`, `wxt`), a separate gnuplot window updates during the run. Hovering shows only plot coordinates.
- **Export:** PNG, JPEG, GIF, SVG, EPS, PDF. "Create movie" turns `plot*.png` into an MP4 with ffmpeg (worked: 52 frames, 4.3 s).

## Interaction, analysis, editing, sweeps
- No click-to-inspect for cells. Values show up only through CellLabels or Logger columns.
- Editing: section → element → attributes. "+" adds elements, and the schema limits the choices.
- **ParamSweep:** right-click any attribute → "ParamSweep". Values as a list (`100;200;300`), range (`0:2:10`), count or log scale. The job count is computed (3 here), parameters dragged together sweep pairwise, and seeds can be preset. I set up a sweep but did not launch it.
- Settings: concurrent jobs (default 2), threads per job, timeout. The Remote tab was greyed out.

## Strengths and weaknesses I experienced
Strengths: model, help and dependency graph in one window, excellent context help, one-click examples, sweeps without scripting, and plain PNG/CSV/TIFF outputs.

Weaknesses: no rotate, zoom or pick in 2D or 3D. Visualisation is fixed before the run, so changing it means rerunning. During a run the file list re-sorts and clicks land on the wrong file. The live window floats apart from the main one, and 3D TIFF output is huge. (In this container one scripted click reached Qt twice and duplicated jobs. That came from the input tool, not Morpheus.)

## Ideas for our three.js viewer
1. **Layer panel built like Gnuplotter Plots:** colour agents by type or any property (age, differentiation state, matrix fraction) with a selectable colormap and optional numeric labels.
2. **Linked time-series panel:** a Logger-style chart (cell counts per type, bone fraction against day) with a cursor tied to the time slider.
3. **Rule graph:** an auto-drawn diagram of MSC → osteoblast/chondrocyte/fibroblast transitions and their conditions.
4. **Context help:** selecting a cell type or parameter shows a short description in a side panel.
5. **Run list with parameters:** load several runs (sweep members) side by side, and export PNG or MP4 with one click.

Click-to-inspect an agent with its history would be our advantage, since Morpheus has nothing like it.

## Screenshots
- `01_main_window_model_graph.png`: main window with CellSorting_2D open. Docks plus the auto-generated model graph.
- `02_model_editor_celltypes.png`: CellTypes editor with the element tree, VolumeConstraint attributes, symbols and context help.
- `03_job_view_gnuplot_output.png`: running 2D job with its file list, log and preview (cell types, then neighbour counts with labels).
- `04_live_gnuplot_window.png`: live gnuplot window (`screen` terminal) updating during the run.
- `05_3d_cellsorting_gnuplot.png`: CellSorting_3D frame as a gnuplot 3D projection.
- `06_logger_timeseries_plot.png`: Logger plot of boundary length against time.
- `07_analysis_gnuplotter_config.png`: Analysis section with Gnuplotter plots, ColorMap and CellLabels.
- `08_param_sweep.png`: ParamSweep panel with VolumeConstraint target = 100;200;300 (3 jobs).
- `extra_examples_menu.png`: the Examples > CPM menu.
- `extra_create_movie_dialog.png`: the Create Movie dialog in the job view.
