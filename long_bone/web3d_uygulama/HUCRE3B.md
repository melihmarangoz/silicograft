# Cell-level viewer (`hucre3b.html`)

A second 3D viewer next to `kallus3b.html`. `kallus3b` shows the whole callus as 0.4 mm voxels every
10 days. `hucre3b` shows, in four small slabs of the callus, **every cell agent of the model as a
realistic cell**, day by day, with a whole-callus tissue map beside it.

## Data

The viewer needs the full 0.1 mm lattice of every day, which the normal runs do not keep
(`RAW_WRITE_INTERVAL` is 10). The three viewer runs (seed 12345: unbonded/original sign,
unbonded/Claes-Heigele sign, bonded/original sign) were re-run on 2026-11-07 with a daily lattice:

```
araclar/gunluk_kosu.sh      # in a pool lease: builds with -DRAW_WRITE_INTERVAL=1, zstd-compresses every day
araclar/hucre3b_hepsi.sh    # runs hucre3b_veri.py for the three runs, packages base64 text for the artifact
```

`araclar/hucre3b_veri.py` writes per run:

- `roi_<region>.bin.gz`: every site of a 28 x 28 x 5 site slab (2.8 x 2.8 x 0.5 mm, mid-frontal plane)
  plus a 3-site margin, every day, as 4-bit codes, and a callus/marrow mask of the plane.
- `makro.bin.gz`: MSC, bone, cartilage and fibrous fractions on 0.8 mm blocks every 10 days.
- `sayilar.json`: daily agent counts for the whole callus and for each region.

The regions are in `veri/bolgeler.json`. They were chosen from the day-359 lattice of the main run:
the proximal cortex corner (most periosteal bone), the proximal marrow opening, the bone-facing side
of the plate with the most bone + cartilage, and the MSC front on the bone axis (the defect centre
itself stays empty all year). All four lie in the proximal half (lattice z = 0 is the distal, fixed
end; z = 40 mm the proximal end with the loaded reference node).

Artifacts do not serve `.bin`, so the files are published as `.b64.txt` (base64 of the gzip).

The artifact host's content security policy runs only inline scripts and scripts from its CDN
allowlist: ES modules, import maps and the page's own `.js` files are blocked (the first publish
stayed on "Veri yükleniyor…"). So the viewer uses three.js r147 with its classic `examples/js`
add-ons, and the published page is built with the geometry inlined:

```
python3 araclar/hucre3b_paketle.py <publish-folder>/hucre3b.html   # then publish it with veri/
```

For local work any static server is enough (`python3 -m http.server` in `web3d_uygulama/`).

### The re-runs are not bit-identical to the 2026-10-26 runs

Same code, seed, mesh generator version (gmsh 4.15.2, 1541 duplicated plate-interface nodes as before)
and settings, but compared through `istatistik.csv` (callus elements only):

| run | first day that differs | bone day 180 old/new (mm³) | bone day 359 old/new (mm³) |
|---|---|---|---|
| unbonded, original sign | 10 | 169.4 / 169.5 | 444.1 / 488.7 |
| unbonded, Claes-Heigele | 31 | 169.1 / 168.1 | 458.8 / 429.2 |
| bonded, original sign | 7 | 648.8 / 735.4 | 1302.0 / 1675.2 |

The qualitative result (non-union, tissue strip along the plate) is the same. Likely cause, not verified:
CalculiX ran with `OMP_NUM_THREADS=4` before and 5 now, so floating-point summation order in the FE solve
differs and the stochastic cell rules amplify it. Pin `OMP_NUM_THREADS` (and the ccx build) when a run must
be reproduced exactly.

## How the cells are drawn

- One drawn cell per agent, at its lattice site plus a fixed per-site offset of up to 35 um (so lattice rows
  do not show) and a +-10 % size spread. Cells are drawn at 1.5x their true size, the same factor for every
  type. The spacing between cells is the model's 100 um lattice.
- Cell types and shapes: MSC, fibroblast, chondrocyte, osteoblast, osteocyte. Procedural geometry in
  `hucre/hucre_geometri.js` (sizes from literature summaries, see below).
- The model has one bone-cell type. A bone agent with at least 5 non-bone sites among its 26 neighbours is
  drawn as an osteoblast (flat basal face toward the bone sites within 3 steps, nucleus away from the bone);
  any other bone agent is drawn as an osteocyte. (Counting single-site holes as surface put osteoblasts
  inside bone that the smoothed matrix surface had closed over.)
- The horizontal MSC bands in the marrow come from the model: the initial MSCs are seeded in every third
  lattice layer there.
- Fibroblasts are aligned with the principal axis of nearby fibroblasts (else with the bone axis).
- Motion between two days is inferred, because the model stores no cell identity: vacated and newly
  occupied MSC sites are matched greedily by distance (radius 5 sites, only MSCs migrate in the model).
  Unmatched new cells next to a cell of the same type are drawn as a division; a site that keeps a cell
  but changes type is drawn as differentiation; the rest appear or fade out. The page says the paths
  are illustrative.
- Matrix: bone, cartilage and fibrous surfaces are marching-cubes isosurfaces of the smoothed agent
  density in the slab; empty sites of the callus are drawn as fibrin threads (clot/granulation tissue).
  Intact cortex (lattice code 11) and the plate (13) come from the lattice. The model has no vessels
  and no hypertrophic chondrocytes, so none are drawn.

## Provenance of the design (2026-11-07)

- Cell sizes and shapes: two independent literature summaries (kimi-k3 and gemini-4-argon through
  OpenCode Go), cross-checked by Claude; disagreements (exaggeration factor, colours) decided by Claude.
- The visualization layout (whole-callus map + slab "microscope") was checked with the Hermes MoA
  council.
- `hucre/hucre_geometri.js` was written by Codex from an exact API spec and fixed by Claude (seam
  normals, rounder osteoblast, thinner MSC processes). `hucre/hucre_test.html` shows every cell type.

## Colour by property (v4)

The "Boya" select above the cell toggles recolours the cell bodies (`InstancedMesh.instanceColor`; the body
material is set to white in these modes so the type colour does not tint the value):

- **Tip**: the type colours with the small per-cell HSL jitter (unchanged default).
- **Bu sitede gün**: days the lattice site has held the same code without a break. The model stores no cell
  identity, so an MSC replaced by another MSC counts as one occupant. Same rule as the card's "since day N".
- **Aynı tip komşu**: sites with the same code among the 26 lattice neighbours (0-26).
- **Kemiğe uzaklık**: exact Euclidean lattice distance in mm to the nearest bone (2) or intact-cortex (11) site
  inside the region box (slab plus its 3-site margin), by a separable distance transform. With no bone in the
  box the cells are grey and the bar says so.
- **Önceki hücre** (categorical): the code that held the site before the current one, in the type colours;
  grey for "empty before", dark grey for "unchanged since day 0". Bone is one model code, shown in the
  osteoblast colour.

Scalars use viridis (polynomial fit, the darkest fifth left out so cells stay visible on the dark stage). The
colour bar (min/max, unit), the range buttons and the categorical legend sit on the stage under the day badge,
as scalar bars do in ParaView and CompuCell3D: the side panel had no height left at 1366x768. Range: **Gün** (this day's cells in the slab), **Koşu** (all days, computed
once per region in ~10 ms slices so the page keeps running; until it is ready the day range is used and the
bar says so), **Kilitli** (freezes the range shown, per property; the true range of the current day is shown
under the bar, as CompuCell3D does). During a day transition each cell takes the nearer day's value, or the
other day's if its site is empty on that day. The info card shows the clicked cell's value. Per-day history
arrays (about 14 MB) are kept only for the open region.

## Chart and 3D linked (v4)

The cell toggles also drop that type's series from the chart and the y axis rescales to what is left (the
chart has one bone-cell series, hidden only when both osteoblasts and osteocytes are hidden). Hovering a
series in the chart, or a row in the cell legend, highlights that type in 3D: the other types' bodies,
nuclei (each type now has its own nucleus material) and chondrocyte capsules fade, and the chart fades the
other series. "Diğer koşular" in the chart legend overlays the other two runs' curves for the same region
(or the whole callus) as thin dashed lines, named in the chart's top-left corner (the panel has no height left for
another legend line). Click-to-seek and the day cursor are kept.

## Same-type neighbour lines (v4)

"Komşu ağı" among the tissue toggles draws one `LineSegments` buffer: a thin line between two drawn cells whose
sites hold the same model code and are lattice neighbours (26-neighbourhood, each pair once), at the cells'
drawn positions of the nearest day, coloured by each end's type. Hidden types are left out and the slab
clipping planes apply. It is rebuilt only when the day, the region or the hidden types change; the toggle
tooltip gives the number of lines. Osteoblast and osteocyte are one model code, so lines join them too.
## Slice panel, table, capped faces, exact surface (v4, 2026-11-07)

Ported from the code study (`simulator_arayuzleri/kod/*.md`, section K of each note).

### Orthogonal slice (`Kesit` in the top bar)

A 2D canvas docked at the bottom right of the stage (above the key hint, clear of the day badge, the region
title and the cell card), small or large (`Büyüt`). It shows one lattice plane of the current day through the
slab, CompuCell3D style (`FieldExtractor` quads and border segments): one filled square per site in its type
colour, cortex and plate dimmer, empty callus and marrow sites faint (brighter when `Pıhtı` is on), thin dark
lines where the type changes between neighbours, a 500 um scale bar and edge labels (proximal/distal,
plate side, x-/x+).

- Planes: `Frontal` (across the thin x axis, the 28 x 28 "histology" view, the default, drawn as the Face
  camera sees it: plate side on the left), `Sagittal` (across y, seen from the plate side), `Transverse` (across
  the bone axis, seen from distal). The code keys stay `sagittal`/`koronal`/`enine`. Naming (Melih, 2026-11-08):
  the plate is taken as medial, so the x = 0 section that holds the bone axis and the plate direction is the
  frontal (coronal) plane and y = 0 is sagittal. The position is a slider or the up/down keys (left/right stay the day keys);
  each plane keeps its own position.
- The plane is drawn in 3D as a translucent outlined quad.
- Picks are linked both ways: a click on a site runs `bilgiGoster` (card and selection ring), and any pick
  (3D, slice, table) moves the plane to the picked cell and outlines its square.
- The slice follows the day under the slider (`floor`, the day the cell card reads), the hidden cell types and
  the `Korteks, plak` toggle. It draws lattice sites, so the 3D view's per-cell offsets and the inferred motion
  between days are not in it (said in the method notes).
- Hook: `kesitKare()` in the frame loop polls the region, day, hidden types and `secili`; nothing is redrawn
  unless one of them changed.

### Visible-cell table (`Tablo` tab of the same panel)

The cells inside the slab on that day: type, site (x, y, z in mm), start day of the current run of that code
at that site, and the previous occupant. Columns sort on click. Rows are virtualised (about 30 DOM rows for
up to ~4000 cells). A row click picks that cell in 3D and in the slice; a 3D pick scrolls to and highlights its
row (BioDynaMo K4). The start day and previous occupant come from one backward scan of the packed days per
region, then an O(N) update per day step forward.

### Capped cut faces

The slab's clipping planes used to leave cut cells as hollow shells. As in PhysiCell's POV-Ray writer, every
cell that crosses a slab face now gets a flat cap on that face in its own (per-instance) colour and a darker cap
where its nucleus is cut, offset slightly outward against z-fighting. The cut outline is the exact section of
an ellipsoid fitted to the cell body (bounding box of the soma vertices, `aUc == 0`, so processes are left out;
blended toward the rounding sphere during divisions), i.e. an ellipse rather than the bounding circle, still
O(1) per cell. One pair of `InstancedMesh` discs per face, clipped by the other five planes only. Rebuilt in
`kapakGuncelle()` when the moment, region or hidden types change (every frame during playback, a few thousand
cells, no allocation).

### Label-exact matrix surface (`Kesin sınır`, Doku heading)

Feeds marching cubes the raw 0/1 tissue indicator (inside the slab) with isolation 0.5 (0.4999, to avoid
samples exactly on the isovalue), so the surface runs halfway between sites and single-site holes stay open,
like `vtkDiscreteMarchingCubes` in CompuCell3D. The smoothed density stays the default. One-line hook at the
top of `alanlar()`. In this mode, osteocytes can sit in visible single-site holes (they are still drawn as
osteocytes, by the 26-neighbour rule).
## Rule graph ("Kurallar", 2026-11-07)

The "Kurallar" button in the top bar opens a drawer over the right side of the middle row (not modal, so cells
stay clickable; Esc or "Kapat" closes it). It holds a hand-laid inline SVG graph of the cell types and the
transitions the C++ model implements, and a detail box.

- Source of truth: `long_bone/src`, not the docs. The rules sit in one JS structure (`KURAL_DUGUM`, `KURAL_KENAR`,
  `UYARANLAR` in the "Differentiation rule graph" block); every edge has from, to, a short Turkish condition and
  `file:line` references relative to `long_bone/`.
- What the code does (all per FE element, stimulus from `Read_stimulus.cpp:89-117`, checked in the order
  resorption, bone, cartilage, fibrous): MSC -> fibroblast / chondrocyte / bone by stimulus 5 / 4 / 2, only for
  MSCs at least 6 days old with a non-empty, non-MSC face neighbour, from day 6, 30 % of eligible MSCs per element
  until day 15 and 6 % after (`Cell_differentiation.cpp`). Fibroblasts die (5 %/day) under stimuli 4, 2, 1,
  chondrocytes (10 %/day) under 5, 2, 1, bone cells (16 %/day) only under resorption. Each type divides into a free
  face neighbour only under its own stimulus, MSCs under any (`Cell_proliferation.cpp`, `Cell_mitosis.cpp`).
  MSCs migrate (7 jumps/day) and are removed outside the callus and marrow zone (`Jump_migration.cpp`). MSCs have
  no death rule. The cartilage threshold depends on the build: `p < -0.15 MPa` (original sign, effectively tension)
  or `p > 0.15 MPa` (Claes-Heigele sign); the graph shows the one of the selected run.
- Citations checked (2026-11-07): every `file:line` in the rule data was opened against `long_bone/src` at commit
  d0c646a (sources last changed in d85e161). 16 of 33 pointed at another version of the sources (e.g.
  `Read_stimulus.cpp:210-238` in a 124-line file) and were corrected; the stated thresholds and rates all match the
  code. The strain in the stimulus test is `min_E_read`, the smallest principal strain (mean over the 4 integration
  points, compared by absolute value), so the graph writes `|ε_min|` (it said `ε₁`, which usually means the largest).
- Not in the code, drawn dashed and labelled "doğrulanmadı": chondrocyte -> bone (endochondral ossification). Only
  comments mention it; in the model cartilage is replaced by chondrocyte death plus bone division or MSC
  differentiation into the freed site.
- Viewer inference, stated in the panel: osteoblast vs osteocyte, paths between days and which neighbour divided
  are drawn, not modelled; the viewer has no per-element stimulus, so it cannot say which condition held.
- Selecting a cell (`bilgiGoster`) whose previous occupant differs adds a "kural" link to the info card and, if the
  drawer is open, highlights the edge (previous -> current type). Because records are daily and the step order is
  differentiation, proliferation, migration, a change between two consecutive days is unambiguous: a cell -> cell
  change that has no edge (e.g. chondrocyte -> bone) is shown as the two-step path through an empty site (death,
  then a division or MSC arrival the same day).

## Frame capture ("Kare", 2026-11-07)

The "Kare" button (shutter icon; between 901 and 1439 px wide only the icon shows, so the top bar stays on one line)
renders the current view and copies the WebGL canvas to a 2D canvas in the same task (no
`preserveDrawingBuffer`), fills the stage background, and draws the day and month, region, run name, scale bar
(pixels per 100 um at the orbit target, as on screen), orientation labels and the 1.5x size note onto it. A frame
taken between two days is marked "ara kare: hücre yolları çıkarım". The image is shown in an overlay as an `<img>`
(right-click to save; downloads are blocked) with "Panoya kopyala" when `navigator.clipboard.write` and
`ClipboardItem` exist; if the write fails the button hides and the note says so.

- Image URLs: both `blob:` and `data:` load under the artifact-check copy of the CSP (`img-src 'self' data: blob:`),
  tested with a small canvas page. The viewer uses `blob:` URLs (no large strings) and falls back to `data:` once if
  an image fails to load.
- Film şeridi: every 10, 30 or 60 days over the whole run (plus the last day), shown as a scrolling strip of
  thumbnails; a click shows a frame large. The visible stage is covered by a still copy of itself while the other
  days are rendered into the same canvas, then the scene is restored to the current moment, so the main view does
  not jump. Progress bar, "Durdur" to cancel; closing the overlay or changing region also stops it. While the
  overlay is open, the viewer's keyboard shortcuts are blocked so the day underneath cannot change.
- Right-click saving and clipboard writes inside the real claude.ai artifact frame are not verified (headless
  Chromium only).

## Side-by-side runs ("Yanında", 2026-11-07)

The select right of the run select (`#karsi-sec`, "Yanında: —" or "⇆ <run>") opens a second run next to the main
one. To fit the full top bar at 1366 px the run names in both selects are the short names from the manifests
("Bağsız · orijinal"; the full name is the option's tooltip), and below 1500 px the bar's gaps and button
paddings are a little tighter. Choosing "—" returns to the single view without a reload.

- One `WebGLRenderer`, two viewports (`setViewport` + `setScissor`), one camera with the aspect of a half
  (CompuCell3D K5, Morpheus port 5). Orbiting in either half moves both. One day slider, one Boya mode.
- The right view is a second `THREE.Scene` (cloned lights, the same environment map and matrix materials) with
  its own instanced cell meshes, caps, neighbour lines, clot and marching-cubes surfaces. The functions that
  build and update these work on module-level variables (`R`, `kumeler`, `sH`, `kapaklar`, ...), so the right
  view is made current by swapping those variables (`gorunumGec`, `gorunumde`) instead of threading a view
  argument through every function. The frame loop runs the same updates for both views (`karsiKare`).
- Colour range: shared by both views. **Gün** takes the union of this day's values of both runs, **Koşu** the
  union of both whole-run ranges (shown as "hesaplanıyor" until both are ready), **Kilitli** freezes the shared
  numbers, so both views keep the same scale.
- Labels: each half names its run, seed and re-run date, with "Eski koşuyla birebir aynı değil (bkz. Yöntem)"
  (see "The re-runs are not bit-identical" above); the day badge stays top left, the region description is
  hidden while comparing (the title stays). A divider marks the halves; the orientation labels are repeated in
  the right half.
- Picking works in both halves (the pointer's half picks the view); the selection ring moves to that view's
  scene and the info card says "Soldaki/Sağdaki koşu: ...". Double-click focusing works in both.
- Side panel and chart: the cell counts are the main (left) run ("Hücreler · gün N · soldaki"); the chart
  overlays the compared run dashed with the existing "Diğer koşular" code (the button is replaced by
  "kesikli: sağdaki koşu" while comparing).
- Per view: caps, neighbour lines, clot, matrix surfaces, `Kesin sınır`. Main (left) view only: the slice panel,
  the cell table and the slice plane in 3D (the panel header says "soldaki", the `Kesit` tooltip too). A pick in
  the right view still moves the slice plane to that lattice site, which shows the same place in the left run.
- Frame capture and the film strip render both halves into one image, with the divider, both run labels, the
  day, the region and the scale bar.
- Turning the comparison off drops the whole right view: instanced meshes, caps, clot, lines, its five
  marching-cubes objects (about 10 MB of buffers each) and its per-day colour history. The compared run's data
  stays in the page's cache, like any run opened before (the viewer has always kept visited runs).

Memory (headless Chromium with SwiftShader at 1366x768, `?test&gun=300`, Plak altı, main run unbonded/original,
after three forced GCs; JS heap from CDP `Performance.getMetrics`, ArrayBuffer backing stores (typed arrays) from
`Runtime.getHeapUsage`, resident memory of the renderer and GPU processes from `/proc`, geometries from
`renderer.info.memory`):

| state | JS heap | ArrayBuffers | renderer RSS | GPU process RSS | GPU geometries | drawn cells |
|---|---|---|---|---|---|---|
| one run | 4.7 MB | 179.5 MB | 255 MB | 257 MB | 48 | 4945 |
| two runs (+ bonded/original) | 5.4 MB | 287.0 MB | 323 MB | 294 MB | 82 | 4945 + 5300 |
| comparison off again | 5.2 MB | 198.4 MB | 283 MB | 265 MB | 48 | 4945 |
| two runs (+ unbonded/Claes-Heigele) | 5.7 MB | 306.2 MB | 342 MB | 285 MB | 81 | 4945 + 4834 |
| same, Boya "Bu sitede gün" | 5.7 MB | 334.5 MB | | | 81 | |
| comparison off, Boya still on | 5.3 MB | 231.6 MB | 319 MB | 266 MB | 48 | 4945 |

So the second run costs about +107 MB of typed arrays and +34 GPU geometries: its five marching-cubes objects
(~10 MB of field, normal and vertex buffers each), the run's decoded 0.8 mm tissue map (~16 MB, kept in the run
cache), the region's packed days, cell lists and transitions, and instanced meshes, caps, lines and clot. A Boya
property adds the per-day history of each open region (~14 MB per run). After switching off, the GPU geometry
count returns to the single-view value and the remaining ~19 MB per compared run is the cached run data. Draw
calls double (one render per half; `renderer.info.render` resets per render, so it shows one half).

## Integration fixes across the v4 features (2026-11-07)

From checking the merged features together and the Codex review of d0c646a (`codex_inceleme.md`, items 1-5):

- Caps: a cap's colour is the body's instance colour times the body material's colour, as the body shader does,
  so in Tip mode the cut face has the type colour (it had the bare instance colour on a white material) and in the
  property modes the Boya colour (material white). The caps cache now also keys on the Boya mode, the colour range
  and the hover highlight; the caps of dimmed types are left out (their bodies are at 7 % opacity).
- Neighbour lines: the ends of dimmed types are darkened to 6 % of their colour; the lines are rebuilt when the
  highlight changes.
- Slice: in a Boya mode the squares take the Boya colours (viridis with the 3D view's range, or the previous-
  occupant colours), the type borders stay; dimmed types are drawn at 16 % alpha; the redraw key includes the Boya
  mode, range and highlight.
- Frame capture and film strip: each frame updates every day-dependent layer for its day (cells, Boya colours,
  neighbour lines, caps, the three surfaces, clot), in both views when comparing, and stamps the colour bar (title,
  gradient, min/max with unit, or the categorical legend) in the property modes, since the HTML bar is not part of
  the WebGL image. Tested: day, region, camera position and target, aspect, Boya mode, range mode and numbers, the
  bar's text and the comparison state are the same before and after a film strip (Kilitli and Gün ranges).
- `kumeleriKur` disposed the instanced meshes but not their cloned body and nucleus geometries, so every region
  or run change left GPU buffers behind; they are freed now.

## Run manifest (`veri/<run>/manifest.json`)

`araclar/hucre3b_veri.py` writes `manifest.json` next to the run's data (`cikar` does it at the end; the
`manifest` mode builds it from the files already published, without the raw lattices:
`python3 araclar/hucre3b_veri.py manifest - web3d_uygulama/veri/<run>`; `hucre3b_hepsi.sh` runs it on the
published folder). The binary formats are unchanged. Contents: run id, display name and short name, seed, model
variant (plate bonded or not, sign convention with the build flag and source lines), the day list (checked
against every region file's header), lattice size and coordinates, the model codes with names and the viewer's
colours, the regions (title, box with margin, slab), the per-site channels (model: code, mask; derived by the
viewer: days at site, same-type neighbours, distance to bone in mm, previous code) and provenance (re-run date,
daily lattice build, the not-bit-identical note with the first differing day and bone volumes).

The viewer reads the three manifests at start: run names, short names and seeds in the selects, the comparison
labels and the frame stamps come from them. A missing or unreadable manifest leaves the built-in name, the seed
from the run id and a generic note.

## Day steps: what is rewritten (2026-11-07)

Scripted scrub with the test hook (`hucre3b.html?test&gun=240`, `__ic.olc(240, 30)`: 30 one-day steps from day
240, Plak altı, unbonded/original run, CPU time of the per-day updates without the render; headless Chromium on
the WSL laptop while other agents were running, medians of three passes, `performance.now()` resolution 0.1 ms):

| per day step | before | after |
|---|---|---|
| `hucreler()`: cell list, osteoblast and fibroblast orientation of a day not in the 24-day cache | 4.5 ms | 3.2 ms (same code, load differed) |
| `hucreAni()`: write every instance matrix and state, upload all | 0.8 ms | 0.4-0.5 ms (unchanged path) |
| Boya colours, neighbour lines, caps | 0.6 ms | 0.4 ms |
| an idle frame (same moment): `hucreAni()` | 0.4-0.8 ms every frame | 0.0 ms (skipped) |
| an in-between frame of playback (d + 0.5) | | 0.6 ms (max 1.6) |

A partial update was not built. Rewriting and uploading every instance costs about half a millisecond per day
step, a sixth of the CPU work of the step (most of it is `hucreler()` for a day the 24-day cache has dropped, which
a partial update does not touch) and far below the render; so it could save at most ~0.5 ms. It is also not safe
with the present layout: instances are packed per (type, variant) mesh in site order, so one new cell shifts every
later index, and three.js r147 uploads a single `updateRange` per attribute, so the range would run to the end of
the mesh; an unchanged site still needs a new matrix when a neighbour changes (osteoblast and fibroblast
orientation follow their neighbours) or when a bone cell turns from osteoblast to osteocyte (another mesh);
and the Tip colour jitter, the caps, picking and the Boya colours all read the instance order. Stable slots with
swap-remove bookkeeping would touch all of these for well under a millisecond.

Done instead: `hucreAni()` returns at once when the moment, the region (instanced meshes) and the hidden types
are the same as last drawn (`aniAyni`), so a paused view no longer rewrites and re-uploads every instance on
every frame. Jumps, region and run changes, playback and the film strip rebuild as before.

## Free region choice (v5, 2026-11-08)

Any box of the callus can be opened, not only the four presets: any position in x, y and z at lattice
resolution (0.1 mm), the presets' fixed size (core 5 x 28 x 28 sites, 3-site margin) and orientation (thin
along x).

### Whole-callus package (`araclar/hucre3b_paket.py`)

Per run, next to the region files:

- `parca.json`: index (days, lattice, box size, one entry per tile: file, lattice block, published bytes).
- `parca/pNNN.b64.txt`: tiles, base64 of gzip of `MBT1` (format in the script's docstring): an axis-aligned
  block of the lattice with its day-0 codes (4 bit), the 3D callus/marrow mask, the number of code changes per
  site and every change as (day step, new code), sites in order. Only blocks that ever hold a code or lie in
  the callus are stored. The lattice is split in half recursively (k-d, the axis longest relative to the box)
  until a tile's gzip is at most 400 kB and it holds at most 2^20 sites.
- `zemin.b64.txt`: static anatomy for the map, every second site (0.2 mm): outside, callus, marrow, intact
  cortex, plate.
- `roi_<preset>.b64.txt`: the presets are now written from the package exactly as the viewer assembles a custom
  box. Their codes are identical to the old files (checked, below); the mask differs, see next point.

The 3D mask: `hucre3b_veri.py` broadcast the mid-frontal plane's mask (from `kesit_eleman.bin`) across the
slab. The package recomputes `lattice_point_element` for the whole lattice from the mesh with the model's own
point-in-tetrahedron test (`src/Lattice_point_in_element.cpp`, float32, same bounding boxes); it matches all three
planes of `kesit_eleman.bin` exactly and the callus site count of the run log (24 862 434). In the presets this
changes 64 of 12 716 mask sites in "İlik kanalı ucu" and 37 in "Plak altı" (the callus boundary is not flat in x).

Sizes (base64 text as published, the three runs of 2026-11-07):

| run | tiles | tiles (MB) | largest tile (kB) | per box: median / p95 / max (MB) | changes stored | extraction + test |
|---|---|---|---|---|---|---|
| unbonded, original sign | 95 | 14.9 | 522 | 0.26 / 0.90 / 2.06 | 10.4 M | 175 s + 119 s |
| unbonded, Claes-Heigele | 95 | 14.8 | 526 | 0.26 / 0.90 / 2.00 | | 196 s + 180 s |
| bonded, original sign | 111 | 23.9 | 526 | 0.35 / 1.31 / 2.59 | 15.5 M | 293 s + 183 s |
| all three | 301 | 53.5 | | | | |

Plus per run `parca.json` (8 kB) and `zemin.b64.txt` (77 kB). "Per box" is what one box fetches (all tiles it
overlaps), over box positions every 1 mm inside the callus region. Decoding the 8 tiles of the largest box and
assembling it takes ~0.2 s in Node (the browser does it tile by tile between frames). The whole artifact (page, the
existing data and the package) is 330 files and 57.5 MB.

Extraction ran locally on the WSL laptop (`nice`, one day at a time; peak RSS 0.64 GB, 0.87 GB for the bonded run), so no pool lease was needed.

### Correctness test (`araclar/hucre3b_paket_test.py`)

`python3 araclar/hucre3b_paket_test.py <package_dir> <region_dir> --ham <raw_run_dir>`: for each preset, the box
assembled from the tiles must give the same code at every site on every day as the region file cut straight from
the lattices by `hucre3b_veri.py cikar` (mask differences are reported, not failed), and three random boxes are
compared with the raw daily lattices. Result on 2026-11-08 for all three runs: 0 differing codes in the four
presets (360 days x 12 716 sites each) and in the random boxes. In the browser, `?test` exposes
`__ic.ozelKarsilastir(n)`, which rebuilds preset n from the package in JS and compares packed codes, mask and the
per-day counts with the preset's own file and `sayilar.json`.

### Viewer

- Panel map (was the 3D callus map, still behind "3B"): the y-z section of the current day at the chosen depth,
  plate side on the left, proximal up (as the `Yüz` camera). Anatomy from `zemin` (0.2 mm), tissue colours from
  `makro.b64.txt` (MSC, fibrous, cartilage, bone fraction of each 0.8 mm block, interpolated between its 10-day
  records, drawn only on callus and marrow pixels). The purple frame is the box. Drag it: on release that box
  opens. A click without dragging opens the large window. The depth slider (x, 0.1 mm) moves the section; on
  release the box opens at that depth. Presets (1-4) and own bookmarks (★) are markers, hollow when their box is
  more than 1 mm away in x. "Yer imleri" lists both; "+" saves the open custom box (localStorage, per viewer,
  inside try/catch; without storage they live until the page closes and the list says so).
- "Büyük seçim": the same section large, a day slider (it moves the viewer's day), the depth slider, a toggle per
  tissue density, a crosshair with a readout (position, anatomy, the four fractions of that block), a click
  centres the box there, double-click or "Buraya git" opens it, arrows move it by 0.1 mm (Shift 1 mm), Enter opens,
  Esc closes. Bookmarks can be chosen and deleted here.
- A custom box loads its tiles (three fetches at a time, progress "Bölge kuruluyor · n/m parça · MB" on the stage),
  is assembled into the same MBR2 bytes as a region file (`ozelMbr2`) and goes through the normal region path, so
  slice, table, caps, neighbour lines, colour ranges, comparison, rule highlight and capture work unchanged. The
  chart's Bölge curves are counted from the assembled days (core slab, as `sayilar.json`); the other runs' curves
  ("Diğer koşular" or comparison) assemble the same box in those runs on demand. A new drag cancels the running
  load (`AbortController`); the open region stays until the new one is ready (two alternating slots after the
  presets in `durum.bolgeler`). Decoded tiles are kept in an LRU (120 MB), the last three custom boxes per run.
- Title: "Özel bölge · x … · y … · z … mm" (box centre). The description says where it lies along the bone
  (distal/proximal end, defect half), its distance from the bone axis toward or away from the plate, its offset from
  the mid-frontal plane, whether it is at the marrow, cortex or periosteal level of the bone section, and what its
  centre site is (callus, marrow, cortex, plate).

### Publishing

`python3 araclar/hucre3b_paketle.py <dir>/hucre3b.html --yayin <dir>/yayin.json` writes the page and a file list
split into publishes within the artifact limits (255 files and 64 MB per publish, 511 files and 256 MB per version,
16 MB per file). The first publish holds the page, `bolgeler.json` and each run's small files (manifest, counts,
makro, presets, zemin, parca.json), so the viewer works after it; the tiles follow in the next publishes to the same
URL. Today that is two publishes: 255 files / 43.3 MB, then 75 files / 13.9 MB (330 files, 57.5 MB in all). The tiles are binary data as base64 text (+33 %), because the artifact host does not serve `.bin`; a binary fetch passes the CSP (same-origin `connect-src`), but serving such a file type was not tried on the real host. The tiles are not in git (`web3d_uygulama/.gitignore`, ~54 MB); `parca.json` and `zemin.b64.txt` are. Without the tiles the presets work and a custom box says it cannot load its tiles.

### Port to site-cells-v4

The feature is one CSS block (`/* free region choice */`), two HTML blocks (`<!-- free region choice -->`: the panel
viewfinder that wraps `#makro-sahne`, and the `#secim` window) and one JS block (`// ---------- free region choice`).
Hook points:

- Strings: every user-facing string is in `BOLGE_METIN` at the top of the JS block (the HTML only carries
  `data-m`, `data-m-title`, `data-m-aria` keys, filled by `bolgeMetinleri()`). Translating means editing that
  object (and its `yerel` locale for numbers).
- Map redraw: every change of what the map shows (frame drag, depth, day, run, tissue layers, bookmarks, size, zemin
  loaded) goes through `haritaDegisti()`; `vizorKare(g)` draws only after it. In the dirty-flag loop add
  `kirli.makro = true` there and call `vizorKare` where the map is drawn.
- Render loop (`dongu`): three one-line hooks (`vizorKare` instead of `makroGuncelle`, `rM.render` and
  `kutuEtiketleri` only with the 3D map on).
- Region loading: the feature opens regions only through `bolgeAc(i0, j0, k0)` -> `sec()`, and custom data enters
  in `bolgeYukle()` (`b.ozel ? ozelYukle(...)`). A custom box is a new region object like a preset, so the
  marching-cubes bounding box (`kutuAyarla` / `matrisKutusu` there) must be reset on the same path as a preset
  change in `sec()`; nothing in the feature writes marching-cubes fields.
- Other one-liners: `ikiliAl(yol, sinyal)` (abort signal), `bolgeBasligiYaz(b, n)` and `vizorBolge(b)` in `sec()`,
  the stale/abort return in `sec()`'s catch, the AbortError return in `karsiYukle()`, `ozelEkSayilar()` at the end of
  `grafikCiz()`, the frame-capture title lines, `vizorBasla()` at start, and `__ic` test entries.

### Website subset (2026-11-08)

The website carries only the tiles that cross lattice i = 175..185, cut from a full package by
`araclar/hucre3b_site_paket.py` (about 15 MB of base64 for the three runs, committed under `veri/*/parca/`; the
full package stays local, see `.gitignore`). The filtered `parca.json` adds `ic_aralik`, the box centres i whose
tiles are all present (i 162..196, x -1.8..+1.6 mm, for all three runs), and the viewer holds both depth
sliders to it (`derinlikSiniri`). The map's dirty flag is set in `haritaDegisti()`, so viewfinder and 3D map
changes redraw the map.

## Phone layout (2026-11-08)

Below 40rem (640 px, the site's phone breakpoint) the page is one screen with no page scroll. The desktop layout
does not change: every phone rule sits in one `@media (max-width: 40rem)` block (plus three `display: none`
defaults for phone-only elements), and the markup is the desktop markup until the script moves something.

- Top bar: the way back to the site, `#yer-sec` (its text shortened to "Choose a spot") and "More" (`#daha-ac`).
  The phone layout script (`// ---------- phone layout`, before the start) moves `#kosu-sec`, `#karsi-sec` and
  `.ust-sag` (camera, Slice, Frame, Rules, Methods, Full screen) into the menu `#daha-menu` while the query matches,
  and puts them back after a comment marker each when it stops (rotating a phone to landscape). Ids and listeners
  stay, so nothing else knows. A button in the menu does its job and closes the menu; a tap outside, Escape or a
  changed select close it too.
- Panel: a bottom sheet over the foot of the stage (CSS only). The handle `#panel-tutamak` (first child of the
  panel) and the cell-type counts `#hucre-lejant` come first (flex `order`; the Cells group is `display:
  contents`) and stay on top (sticky) while the open sheet scrolls. Collapsed, the sheet is as tall as handle plus
  counts (`--tabaka-kapali` on `.orta`, measured by the script); the stage ends there, so the camera never sits
  under the sheet. A tap on the handle opens it to 70 % of the height, a drag follows the finger and snaps at half
  way.
- Time bar: the slider across the full width, step, play and speed below it; every button 44 px.
- Selection window `#secim`: full screen, the map across the top (`min(131vw, 50dvh)`: 131 = 402/306, the section's
  aspect), the controls below it scroll, the title with Close is sticky at the top and the Go here / + Bookmark
  row at the bottom (`.secim-secilen` is `display: contents`, the row is moved last with `order`). A finger dragged
  over the map moves the crosshair (`touch-action: none`), lifting it or a tap centres the box there and fills the
  readout (`secimYerlestir`). The help text and the first readout line have touch wordings in `BOLGE_METIN`.
- Touch on the stage: OrbitControls' r147 default, stated in the code (one finger rotates, two pinch-zoom and pan).
  A tap selects a cell when the finger moved less than 10 px (a mouse: 5 px), and never at the end of a two-finger
  gesture.
- Checked on 2026-11-08 with headless Chrome (390 x 844, touch, device scale 2) and at 1440 x 900 against the
  previous version (same layout boxes, same pixels apart from the hidden phone-only elements).

## Performance (2026-11-07)

Measured on a GPU pool machine (RTX 3080 Laptop, Chrome, ANGLE Vulkan), old vs new: play at 12 days/s went from
56 to 60 fps (37.9 to 60 fps with the CPU slowed 2x, as on battery), the slider from 51 to 60 fps, and long tasks
during play from 75 to 0 per 10 s. Every drawn surface and cell count is unchanged, and the 3D image is
pixel-identical.

- `hucre/marching_cubes_r147.js` is three.js r147's MarchingCubes with two opt-in flags: `mc.kutu` clears and
  polygonizes only the occupied box of the field (the slab fills about 11 of 64 cells across), and `mc.aralik`
  uploads only the vertices written. `kutuAyarla()` does one full reset whenever the box changes. Every field write
  must stay inside the box (`matrisKutusu(R)` for the slab, `MAK.kutu` for the map).
- The map rebuilds one of its four surfaces per frame (`makroGuncelle` queue); a run switch rebuilds all four at once.
- Work that only depends on state runs only when the state changes (`kirli` flags): cell instances and fibrin on a
  day change, region switch or a change of `gizliMaske()` (v4's `aniAyni` cache sits inside `hucreAni` as well); the map render and badges on map camera change, surface change,
  resize or region switch; orientation labels on main camera change. Camera moves are caught through the
  OrbitControls `change` event. The map canvas keeps its image (`preserveDrawingBuffer`). Any new code that changes
  what is drawn must set the matching flag.
- A viewport meta tag keeps phone canvases at device size (it was 2.85 Mpx without it).
- The top bar's run selects and region tabs are written in the HTML with the same content the script puts
  there (2026-11-08), so the bar does not grow and push the stage down on a phone when the script runs
  (Lighthouse CLS 0.355 on the live site before). Keep them in step with `KOSULAR`, the manifests' `kisa`
  names and `veri/bolgeler.json`.
- Not done yet: simpler cell meshes (4.9 M triangles at day 300, the GPU cost on integrated graphics), shader
  precompile for the first visit of a region, and moving the per-day matrix work to a Web Worker (phones play at
  about 25 fps).
