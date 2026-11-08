# BioDynaMo: interface notes (hands-on, 2026-11-07)

Tested in a throwaway Linux container (Ubuntu 26.04, 16 threads, software OpenGL). BioDynaMo v1.05.179 (master), with the ParaView 5.9.0 it ships.

**Install:** the docs list Ubuntu 20.04/22.04 only. Master added 24.04/26.04 support (merged 2026-10-15), so `BDM_INSTALL=master curl https://biodynamo.github.io/install | bash` worked in ~10 min. It needs a TTY ("Press any key"), and the first `bdm demo` asks for a git name and e-mail. The Codespaces image `ghcr.io/biodynamo/demo` is not public.

## What it is, how you use it

A C++ agent-based engine with no model GUI. The work happens in the terminal: `bdm demo <name>` / `bdm new` create a CMake project, you write C++ in `src/`, `bdm run` compiles and runs it (with a progress bar), and `bdm view` opens ParaView. `bdm.toml` controls visualisation: the agent class, the data members to export (`additional_data_members`), the export interval and the diffusion grids. There are also C++ Jupyter notebooks (ROOT kernel).

## Visualisation

- **Export (verified):** soma_clustering, 1000 steps exported every 10, gave 100 frames, 3102 files and 355 MB. Each frame is one `.pvtu` plus one `.vtu` per thread, along with the substance `.vti` files, a `.pvsm` state and `simulation_info.json` (shape, scaling field, substances).
- **`bdm view` (verified):** opens the newest state with the pipeline already built: raw points, a sphere Glyph scaled by `diameter_`, volume-rendered concentration and gradient arrows. This demo used the stock Glyph filter, not BioDynaMo's own `BDMGlyph` plugin.
- **Colour by any exported member (verified).** `cell_type_` gets a continuous colour map by default, with no categorical legend.
- **Clip and slice (verified):** standard ParaView filters, each with its own colour bar.
- **Time controls (seen):** step, play, loop, a frame index box and "max is 99". I did not time playback.
- **Not tried, from the docs and `param.h`:** live in-situ mode through ParaView Catalyst (`insitu_visualization`, a Python pipeline), `VisualizeInNotebook()` (JSROOT), and movie/screenshot export through ParaView's Save Animation.

## Interaction and analysis

- **Spreadsheet view (verified):** one row per agent (ID, type, diameter, position), next to the 3D view.
- **Hover tooltip (verified):** it hits the glyph mesh. It showed "Id 580153", a sphere vertex, not the agent's ID.
- **Plotting (verified as notebook HTML exported during install, no live kernel):** `TimeSeries::AddCollector` collects values (agent count, a predicate `Counter`), ROOT `LineGraph` plots them, and the data can be fitted.

## Strengths and weaknesses

Good: fast (about 3900 cells, 1000 steps, 10.7 s), demo to picture in three commands, any member exportable, all of ParaView available.
Bad: at the last frame the default state was unusable. The gradient arrows swallowed the scene and the red substance volume hid the cells, so I hid two layers and reset the camera by hand. There is no categorical colouring. Picking returns vertices, not agents. ParaView's UI is dense, camera drags overshoot, and the substance grid is far larger than the tissue. Export is heavy, and the build floods the terminal with compiler warnings.

## Ideas for our three.js viewer

1. A per-run manifest like `simulation_info.json` (types, fields, units), so the viewer configures itself.
2. A categorical palette and legend for MSC, osteoblast, chondrocyte and fibroblast, with continuous maps only for scalar fields.
3. Picking that returns the agent (instance ID → lattice site → state), linked both ways to a table.
4. Safe defaults: fields hidden, camera fitted to the agents rather than the grid, one clip plane and one slice.
5. Count-per-type plots over 360 days, tied to the time slider.

## Screenshots

- `01_cli_bdm_demo_build_run.png`: `bdm demo` + `bdm run` in the terminal (warnings, progress bar, timing).
- `02_cli_demo_list_config_output_files.png`: demo list, `bdm.toml` visualisation block, exported files (3102, 355 MB).
- `03_paraview_bdm_view_default_state_t0.png`: ParaView right after `bdm view`, default pipeline at t=0.
- `04_paraview_glyphs_colored_by_cell_type_t99.png`: spheres coloured by `cell_type_` at the last frame.
- `05_paraview_clip_cells_and_slice_substance.png`: clipped cells and a concentration slice, two colour bars.
- `06_paraview_spreadsheet_view_per_agent_table.png`: 3D view next to the per-agent spreadsheet.
- `07_paraview_hover_tooltip_on_agent.png`: hover tooltip showing a mesh vertex ID, not the agent.
- `08_notebook_timeseries_linegraph_root.png`: notebook ST10, TimeSeries collectors and a ROOT LineGraph.
