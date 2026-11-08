# SPEC: "Cells, tissue, strain, and back" (SG-Bone dive)

GOAL: after the film the viewer can picture the SG-Bone loop as one object: a sheep tibia defect under a plate. Cells move in, tissue forms, the tissue sets the stiffness, the load sets the strain, and the strain picks the next cell.

OUTPUT: HyperFrames, 1920 x 1080, 30 fps, silent. Three uses come from one render:
1. The website's scroll story. Six stages are scrubbed by scroll; frames are sampled at 8 fps, 1280 x 720 WebP.
2. The website hero, a silent 10 s loop taken from 6 s to 16 s with a baked 0.5 s crossfade, as H.264 and VP9.
3. `renders/silicograft-dive.mp4`, the whole film.

TIME: 36 s x 30 fps = 1080 frames. Six beats of 6 s (180 frames). No music.

| Beat | Frames | Seconds | Website stage | Simulated day |
|---|---|---|---|---|
| b1 Defect and load | 0-179 | 0-6 | 1 A gap in the tibia | 0 |
| b2 Stem cells move in | 180-359 | 6-12 | 2 Stem cells move in | 0 to 30, eased in |
| b3 Tissue forms | 360-539 | 12-18 | 3 Each cell lays down tissue | 30 to 357 |
| b4 Stiffness | 540-719 | 18-24 | 4 Tissue sets the stiffness | 357 (E replays FE days 6 to 357) |
| b5 Strain | 720-899 | 24-30 | 5 CalculiX loads the leg | 357 |
| b6 Decision | 900-1079 | 30-36 | 6 Strain picks the next cell | 357, then the return arc |

## LOOK: a specimen under a cold technical light (the site's Midnight theme)

- **Ground:** `#02071d` (the page paper, so frames sit seamlessly on the site). Depth comes from light falloff and fog, from `#02071d` at 0 to `#0a1430` at the far plane. No vignette, no grain: the frames are compressed for scrubbing.
- **Ink** for in-scene marks (load arrows, plane axes): `#e7f0f9`. Muted `#98a9c1`.
- **One accent:** azure `#6bcbf7`, darker `#3483ad`. It appears only on:
  - the load arrows in b1
  - stem cells in b2 and b3
  - the hottest end of the field maps
  - the return arc in b6
- **Tissue colours** (the same as the 2D stage images):
  - new bone `#e7f0f9` (ivory, matte bisque)
  - cartilage `#6bcbf7`
  - fibrous `#8181af`
  - stem cells `#2e749b`
  - intact cortex `#596475`
  - marrow `#253142`
  - plate `#364868`
- **Field maps** (E and strain): a sequential map `#0f1c37` → `#3483ad` → `#e7f0f9`, log-scaled. E runs from 0.2 to 17000 MPa, strain from 0.001 % to 10 %. These are the same ranges as the stage images.
- **Medium:** a physically lit 3D study model.
  - Renderer: `ACESFilmicToneMapping`, exposure 1.0, sRGB output.
  - Bone and cortex: `MeshStandardMaterial`, roughness 0.85, metalness 0.
  - Plate and screws: brushed steel, roughness 0.45, metalness 0.8, environment intensity 0.5.
  - Voxel tissue: instanced cubes of 0.3 mm with 5 % gaps, roughness 0.7.
  - Cut faces: flat, roughness 0.6, colour from the field.
  - Cells (b2 close-up): the procedural cell meshes of `hucre_geometri.js` (see Reuse), with a subsurface-like rim at 0.25.
- **Light:**
  - A cool key from upper left: direction (-0.5, 0.8, 0.4), intensity 2.2, `#dbe8ff`.
  - A rim from behind right: (0.6, 0.3, -0.8), 1.6, `#6bcbf7` at 40 % saturation.
  - A fill from below: 0.25.
  - A soft room environment from `RoomEnvironment` (PMREM) at 0.5. The environment turns 20° over the film, so highlights sweep.
  - A contact shadow under the plate end only in b1 (opacity 0.35).
- **Lens:** a physical camera, fov 28° (about 50 mm) for wide shots and 22° for close-ups. Depth of field only in b2's close-up (aperture f/2.8 equivalent, focus on the cell layer), using the postprocessing BokehPass with a deterministic setup.
- **No text in the film.** The website writes all words beside the frames.

## OBJECTS (all from the run's data; nothing drawn freehand except arrows and the plane axes)

- **Bone ends:** cortex shell and marrow as two parts, proximal and distal, from `surf_cortex_*`, `surf_marrow_*`. Half versions are for the cut views.
- **Plate:** 155 mm, and six screws (r 1.75 mm). Steel, as above.
- **Callus:** hull (`surf_callus_hull`), half and cut faces (`surf_callus_cut`), with per-face element ids for colouring by field.
- **Voxels:** `vox_days.bin` blocks for the sampled days. Use the colour per code, and for days between samples crossfade by scale and opacity.
- **Stem cells, close-up:** an instanced region of interest (ROI) near the proximal bone end, built from the lattice at day 9 to day 30. One cell mesh per stem cell lattice site, at true scale: one site is 0.1 mm, and a cell is about 0.012 mm across inside it.
- **Load:**
  - The axial arrow: 823 N down the bone axis, a 0.6 mm thick line with a 4 mm head, in accent.
  - The bending moment: a 270° arc arrow about the moment axis given in the manifest.
- **Decision plane** (b6): a flat chart floating beside the callus.
  - x axis: log |minimum principal strain| from 0.0001 % to 30 %.
  - y axis: symmetric-log hydrostatic pressure from -1 to 1 MPa.
  - The region rectangles come from the `Read_stimulus.cpp` thresholds (see `site/assets/stages/README.md`), fill at 12 %, edges 1 px ink at 30 %.
  - Points: the 24,698 callus elements, each a 0.25 mm sprite in its region colour.

## MOTION

- **Camera:** one continuous take. Keyframes are joined by a centripetal Catmull-Rom path for position and target. Time between keys follows `easeInOutCubic` on each segment. Speed never jumps at a key: match tangents across segments.
- **Enter of objects:** opacity and scale, 18 frames, `power2.out`. Exit: 12 frames, `power2.in`.
- **Day track:** a monotonic function of time (see TIME). Voxels interpolate between sampled days.
- **Field blend** from tissue to E (b4), and from E to strain (b5): 30 frames, `power1.inOut`, on the cut faces only.
- **E replay** in b4: the FE days 6 to 357 run across 120 frames, linearly.
- **Load pulse** in b5: the arrows thicken by 30 % and settle twice, each over 24 frames, `sine.inOut`.
- **Decision flight** in b6: points lift off the cut face along the face normal by 3 mm over 20 frames, then fly to their chart position over 50 frames. Each point is staggered by its element id hash over 30 frames, along `power3.inOut` arcs that bow 15 % toward the camera.
- **Return arc** in b6: a 1.5 px accent curve from the chart's bone region back to the callus stem cell layer, drawn over 36 frames. The film ends on a frame that matches b2's first frame closely enough for the loop.
- Nothing loops or wobbles as decoration. Cell shape wobble is allowed only in the b2 close-up, amplitude 4 %, deterministic in time.

## SHOTS

| Shot | Frames | The one hero move | What the viewer reads | Hand-off |
|---|---|---|---|---|
| b1 | 0-179 | A slow push from a three-quarter wide shot of the whole plate to the gap. The model halves (cut away) at frame 120 | the gap, the plate, the screws, the 823 N arrow and the bending arc | ends looking into the half-cut gap |
| b2 | 180-359 | A dive to the proximal bone end. At frames 260-330 an extreme close-up of the stem cell layer (cells as cells), then out | stem cells spreading from the bone end and the marrow (day 0 to 30) | pull back past the cells |
| b3 | 360-539 | Pull back to a three-quarter view of the half callus while days run 30 to 357 | bone growing against the plate; the middle of the gap stays empty | holds on the half callus, cut face toward camera |
| b4 | 540-719 | A 25° orbit around the cut face | the cut face turns from tissue to a stiffness map, then the map replays days 6 to 357 | holds face-on to the cut |
| b5 | 720-899 | A slight push in; the load arrows pulse | the stiffness map turns into the strain map | holds |
| b6 | 900-1079 | A pull back while points lift off the cut and land on the decision plane beside the callus | points settle into regions, mostly bone; the accent arc returns to the cells | the last frame rhymes with b2's first frame |

## Code layout (the contract between parallel builders)

The film is ONE sub-composition, `compositions/dive.html`, holding one canvas. The root `index.html` mounts it for 36 s.

- **`assets/js/engine.js`** (an ES module) owns everything shared:
  - the renderer, scene, camera, lights, environment and postprocessing
  - loading `assets/data/*` through the manifest, inside a `window.__hf.buildReady` promise
  - the parts (bone, marrow, plate, screws, callus hull, half and cut), the voxel system and the field colouring of the cut faces
  - the camera director that merges every beat's camera keys
  - the `hf-seek` render
- **`assets/js/beats/b1.js` to `b6.js`**, one module per beat. Each default-exports:

```js
export default {
  id: 'b2', start: 6, end: 12,              // seconds
  camera: [ { t: 6.0, pos: [x, y, z], target: [x, y, z], fov: 28 }, ... ], // keys inside [start, end]
  async build(ctx) { /* create this beat's own objects, add them to ctx.scene, hidden */ },
  update(t, ctx) { /* t = global seconds; set this beat's objects and write ctx.state for its window */ },
};
```

- **`ctx`** holds:
  - `THREE`, `scene`, `camera`, `renderer`
  - `data`: the parsed manifest plus typed arrays
  - `palette` (the hex values above), `materials`
  - `parts`: named meshes
  - `voxels`: an API `setDay(d)` and `setOpacity(a)`
  - `fields`: an API `setMode('tissue'|'E'|'strain')`, `setBlend(a)` and `setEDayIndex(i)`
  - `util`: `ease`, `lerp`, `clamp`, `smoothstep`, `mulberry32`, `hashId`
  - `state`
- **`ctx.state`**, reset to defaults by the engine every frame before the beats run, in order b1 to b6: `{ day, half, voxelOpacity, fieldMode, fieldBlend, eDayIndex, envRotation, dof }`.
  - A beat writes state ONLY while `start <= t < end`. The last beat to write wins.
  - After its window, the next beat is responsible for continuity.
- Every beat must be a pure function of `t`: no frame-to-frame state, no `Math.random`, no timers.

## Reuse (read-only sources)

- `site/assets/stages/` and `long_bone/araclar/site_stages.py`: the colours, the thresholds, the decision-plane axes.
- From the cell-viewer session, branch `hucre-gorunumu` in `~/mechanobio-hucre` (read-only; copy what you use into `film/assets/js/vendor/` with a header naming the branch and commit):
  - `long_bone/web3d_uygulama/hucre/hucre_geometri.js`: procedural MSC, fibroblast, chondrocyte, osteoblast and osteocyte meshes, in micrometres.
  - the `sekilDegistir` and `kenarParlamasi` shaders, `baglamOlustur`, and the MarchingCubes isosurfaces in `long_bone/web3d_uygulama/hucre3b.html`.

  Their scene mapping: lattice (x, y, z) -> scene (x, z - 20, y) in mm, with the plate at +y in the lattice. Our exporter writes its own `scene_transform` into the manifest, so use that.

## BANNED

- glow, bloom, lens flares, particles as decoration, light rays
- a small object floating in the middle of an empty frame: the hero fills at least 40 % of the frame height in every shot
- text, labels, HUD readouts, corner marks or frame borders inside the film
- orbiting for its own sake (one orbit only, in b4)
- purple or blue gradients in the background, glass panels
- colours outside the palette
- invented data: every coloured element must come from the run
- cuts: the film is one take
- (added in the integration review) metal so dark it reads as a black slab, or screws that vanish into the plate
- (added) an object or a state that pops on or snaps at a beat boundary (voxels switched on, an opacity jumping back to 1): every hand-off carries the previous beat's look and changes it with the enter/exit eases
- (added) colours borrowed from another document that are not in this palette (the stage-6 resorption grey): map them to the nearest palette entry
- (added) the camera coming to rest on a frame that is mostly empty ground

## QA (frames to check after each build)

| Frame | Must show |
|---|---|
| 0 | the whole plate with its six screws, the gap, on the paper ground |
| 150 | the half cut, the arrows in accent |
| 300 | stem cells as recognisable cells in focus, the bone end out of focus |
| 450 | ivory bone voxels along the plate, an empty middle |
| 640 | the cut face as a stiffness map with bright bone ends |
| 820 | the strain map, the arrows thicker |
| 1000 | points in flight toward the plane |
| 1079 | points settled in the plane regions, the return arc complete |

Each of these must also render in under 4 s on this machine (software WebGL).

---

# PASS 2 (2026-11-07, after the owner watched the pass-1 draft)

The owner's verdict on `renders/draft.mp4`: the pipeline works, but the film does not look professional yet, and it is monochrome. **Pass 2 overrides the sections above wherever they disagree.** Everything else above still holds (one take, real data only, no text, determinism, the code contract).

## P2-1 Horizontal frame
The bone lies HORIZONTAL in the 16:9 frame in every shot: proximal end to screen LEFT, distal to the RIGHT, plate on TOP. Implement it in the camera director as a camera roll after `lookAt` (default roll so that scene +y maps to screen left and scene +z, the plate side, to screen top in a view from -x; a key may override with `roll` in degrees, interpolated like fov). Scene coordinates and the data stay as they are. All camera keys are re-planned for the horizontal frame. The hero fills at least 40 % of the frame HEIGHT and 60 % of the frame WIDTH in every shot; no frame is mostly empty ground.

## P2-2 Colour (the owner: "renkli olsun, simülasyondaki gibi")
Use the run viewer's tissue palette (`long_bone/web3d_uygulama/kallus3b.html`), which the owner knows:

| What | Pass 1 | Pass 2 |
|---|---|---|
| new bone (code 2) | `#e7f0f9` | `#efe2c4` warm ivory |
| cartilage (4) | `#6bcbf7` | `#5aa0e0` blue |
| fibrous (5) | `#8181af` | `#e07a8a` coral pink |
| stem cells / MSC (1) | `#2e749b` | `#d9a43a` amber |
| intact cortex (11) | `#596475` | `#9c958a` warm bone grey (with a subtle deterministic noise in roughness/colour, +-4 %) |
| marrow | `#253142` | `#6e3434` deep red |
| plate and screws | `#364868` | steel `#aab4bf`, metalness 0.9, roughness 0.32 with a brushed (stretched-noise) roughness map along the plate; screws slightly darker `#8c96a1` so heads read |
| resorption (decision plane) | `#596475` | `#8a8f96` neutral grey |
| ground | `#02071d` | unchanged (the site's paper) |
| load arrows | azure | ink `#e7f0f9` |
| return arc (b6) | azure | `#6bcbf7` (the site accent, the only azure in the film) |

Field maps on the cut face are colourful and perceptual, still log-scaled over the same ranges:
- E (stiffness): **viridis** (`#440154` → `#21918c` → `#fde725`).
- Strain: **magma** restricted to 0.15..1 (`#2c115f` → `#b73779` → `#fcfdbf`), so the low end stays visible on the ground.
- The cut material adds an emissive term equal to 0.22 x the field colour so low values never sink into the ground.
- Cortex and marrow cut faces in E mode take their own E on the same map (as the integrator did in pass 1).

The decision-plane region fills use the tissue colours above at 14 % opacity; points use the same colours.

## P2-3 Light and material (a lit specimen, not CAD blocks)
- Smooth normals: build every surface with creased normals (`BufferGeometryUtils.toCreasedNormals`, crease about 35 deg) so tubes shade round and only real edges stay sharp. Cut faces stay flat.
- Shadows: the key light casts soft shadows (PCFSoftShadowMap, 2048 map, tight frustum fitted to the callus region, bias tuned) from plate, screws, bone and voxels onto the bone, callus and voxels. This is the main depth cue.
- Key light warmer and stronger (`#fff1e0`, 2.6), rim cool (`#9fc4ff` at 1.4) from behind, fill 0.3; environment 0.6. Exposure tuned so ivory bone does not clip.
- Optional if the frame budget allows (under 3 s per frame in SwiftShader): a cheap ambient-occlusion pass (SAOPass or N8AO at half resolution) for the voxel clusters. Skip it if it costs more.
- Voxels: keep 0.3 mm blocks but bevel-look them (a slightly rounded cube geometry or a normal trick) so clusters read as tissue, not Minecraft.

## P2-4 Cut face and fields
- Tissue mode per PIXEL, not per triangle: sample the voxel slab next to the cut plane as a 2D data texture (nearest-neighbour codes, then the tissue colour) in the cut material, so the hand-off from voxels to the face is seamless and the tet-triangle spikes at the callus border disappear (discard fragments whose block is outside the callus).
- E and strain modes: interpolate element values to vertices (area-weighted average of the incident triangles' elements, in log space) for a smooth map; keep a 1 px darker edge where the callus meets the cortex.

## P2-5 Camera motion
- The director must not stop at every key: use one continuous parameterisation over all keys (centripetal Catmull-Rom through all positions and targets, with key times mapped by a monotone cubic, e.g. Fritsch-Carlson, so speed is continuous and non-zero through keys). A key may set `hold: true` to come to rest there. Only the film's first and last keys rest by default.
- Speeds stay calm: no move faster than about 60 % of the frame width per second at the subject.

## P2-6 Shot plan (horizontal)
- b1 0-6 s: a low three-quarter wide of the whole construct lying horizontal, plate on top with its six screw heads catching light, filling the width. A slow push and slight orbit toward the gap; the half cut sweeps at 4.0 s; the load arrows (ink) at the proximal end (screen left) read clearly. No contact-shadow plane under the construct (it is floating); keep shadows on the objects.
- b2 6-12 s: dive into the gap along the cut face to the proximal bone end (screen left) and the amber stem-cell layer; the extreme close-up of real cells (amber, the cell meshes) 8.7-11 s with depth of field; pull back. NO shot of a flat slab filling the frame (pass 1's 7.5 s frame).
- b3 12-18 s: three-quarter of the half callus, cut face toward the camera, plate on top; days 30 to 357; the ivory bone along the plate and the cortex ends, the empty middle. Camera slightly below the plate's level so the bone column under the plate reads.
- b4 18-24 s: the single 25 deg orbit around the cut face; tissue to E (viridis) then the E replay.
- b5 24-30 s: E to strain (magma), slight push in, the arrows (ink) beside the callus pulse.
- b6 30-36 s: the decision plane sits BELOW or ABOVE the callus in the horizontal frame (or beside it if the frame allows), its axes upright on screen (x axis horizontal, y vertical) regardless of the camera roll; points fly; the azure return arc. The last frame rhymes with b2's first frame.

## P2-7 QA (pass 2)
Same QA frames as above. In addition, every QA frame must show at least three distinct palette colours (not one blue family), and no frame may be more than 50 % empty ground.

---

# PASS 3 (2026-11-07 evening): the cell tour, and the pass-2 leftovers

The owner watched `renders/draft2.mp4`. Two requests:

1. **A cell-level tour.** The owner liked the cell viewer of the sister branch (`~/mechanobio-hucre`, branch `hucre-gorunumu`, `long_bone/web3d_uygulama/hucre3b.html`, documented in `HUCRE3B.md` there). Zoomed in, it shows every cell agent as a realistic cell (MSC, fibroblast, chondrocyte, osteoblast, osteocyte), matrix isosurfaces (bone, cartilage, fibrous), fibrin threads in the empty clot, intact cortex and plate, and inferred migration, division and differentiation between days. Pass 2's b2 close-up (amber streaks in bokeh) "looks strange" next to it.
   - The film dives from the macro scene into three of the viewer's regions, one after another, while the days run. Each region is entered and left through the macro scene ("from inside to outside"), so each dive is a zoom from tissue to cells and back. Pass 3 replaces the b2 close-up with this.
2. **The opening starts close** (owner's choice): the gap and both bone ends fill the frame; 3-4 of the six screws may sit outside the frame.

## P3-1 Timeline: 52 s, 1560 frames, 30 fps

| Beat | Seconds | Content | Day |
|---|---|---|---|
| b1 | 0-6 | Defect and load. Opens close on the gap (owner's choice), half cut at 4.0 s, load arrows readable until about 5 s | 0 |
| b2 | 6-14 | Cell stop 1, **`ilik_ucu`** (the marrow-canal opening at the proximal bone end): dive in, stem cells pour out of the marrow into the clot, out | 0 → 30 |
| b3 | 14-20 | Macro: tissue forms, three-quarter of the half callus | 30 → 120 |
| c2 | 20-27 | Cell stop 2, **`korteks_ucu`** (the proximal cortex corner, the earliest new bone): osteoblasts on new bone surfaces, osteocytes walled in, fibroblasts and MSCs around | 120 → 220 |
| c3 | 27-34 | Cell stop 3, **`plak_alti`** (the plate's bone-facing side): the bone and cartilage strip along the plate, chondrocytes in cartilage matrix, the plate itself at the slab edge | 220 → 357 |
| b4 | 34-40 | Stiffness (the pass-2 b4, shifted by +16 s) | 357, E replay |
| b5 | 40-46 | Strain (the pass-2 b5, +16 s) | 357 |
| b6 | 46-52 | Decision plane and the return arc (the pass-2 b6, +16 s); the last frame rhymes with b2's first frame | 357 |

The day track is monotonic and continuous: 0 until 6 s, then the ranges above, each eased so the rate never jumps at a boundary. Each cell stop spends about 2 s diving in from the macro view, about 3-4 s among the cells while its day range runs, and about 1.5-2 s pulling out into the macro view, which must show the region's place in the callus.

Website stages become seven: 1 b1, 2 b2, 3 b3+c2 ("Each cell lays down tissue"), 4 c3 (new: "Bone and cartilage along the plate"), 5 b4, 6 b5, 7 b6. Hero loop: still 10 s, taken from 6.5-16.5 s.

## P3-2 The cell slabs (data and look)

- **Data:** for run `bagsiz_orijinal_t12345` the sister branch already has `veri/bagsiz_orijinal_t12345/roi_<region>.b64.txt`: base64 of gzip of every site of a 28 x 28 x 5 site slab (2.8 x 2.8 x 0.5 mm, on the mid-frontal plane, which is our cut plane), plus a 3-site margin, every day, as 4-bit codes, and a callus/marrow mask. The regions are in `veri/bolgeler.json` (lattice i0, j0, k0, nx, ny, nz). The format is decoded by `roiCoz` in `hucre3b.html` and written by `araclar/hucre3b_veri.py`. Copy the three regions' data into `film/assets/data/cells/` (decoded to raw `.bin` or kept as `.gz` and decoded once in buildReady), with a README naming the source branch and commit.
- **Placement:** each slab sits at its TRUE place in the scene: lattice (i, j, k) → model mm (i * 0.1 - 18, j * 0.1 - 18, k * 0.1), then the manifest's scene_transform. The slab lies on the cut face (lattice i 178-182 is the mid-plane), so the dive goes straight into the cut face at the region's spot. During a dive the macro cut face, voxels and hull around the slab fade (or are clipped by a small box) so the slab is not buried; the cortex, marrow and plate stay as context.
- **Look:** port the viewer's look, not a new one: the procedural cells (`film/assets/js/vendor/hucre_geometri.js` is already vendored), `hucreMalzemesi`, `kenarParlamasi`, `sekilDegistir`, `dokuDeseni`, `matrisMalzemesi`, the matrix isosurfaces (`alanlar`, `matrisGuncelle`; marching cubes of the smoothed agent density), the fibrin threads (`fibrinKur`, `fibrinGuncelle`), the osteoblast/osteocyte rule, the per-site offsets, and the inferred motion between days (`gecis`, `hucreAni`). Cells drawn at 1.5x true size, the viewer's factor. Colours: the viewer's cell and matrix colours, mapped onto the film palette where they share a meaning (bone ivory, cartilage blue, fibrous coral, MSC amber); the viewer's own extra hues (nuclei, fibrin) are allowed. The film's three.js is r170 as an ES module; the viewer is r147 classic, so translate the API where it differs (MarchingCubes addon path, ShaderChunk names).
- **Determinism:** every function of the day must be a pure function of the fractional day (the viewer animates between days with wall-clock state; the film must compute the same interpolation from `t` alone). Precompute per-day structures in buildReady or cache them by integer day, never by frame order.
- **Light inside the slab:** the macro key/rim/fill rig plus the viewer's rim term; shadows may be off inside a slab if they cost too much. Depth of field only at the closest moment of each stop (focus on the cell layer), as in pass 2's b2.
- **No text, no labels, no scale bars** (the website names the regions and cell types beside the frames).

## P3-3 Pass-2 leftovers to fix (from REVIEW2.md)

- b1: open CLOSE (the gap and both bone ends fill the frame); the load arrows must still read (they may enter the frame as the camera pulls back slightly, or b1 shows them in a brief wider move at 2-4 s); at 5 s, QA wants the arrows or at least their tails visible.
- 4.0-4.6 s half-cut sweep: the plate's top face lingers as a flap and the screws show as whole cylinders for 18 frames: fix the clipping so the sweep reads as one clean cut.
- E and strain maps: long tet triangles still show as spikes along the callus border; soften them (e.g. clamp per-vertex values near the boundary to the face's own element, or mask the outermost ring of triangles by distance to the hull).
- b6: the decision plane is faint and most points fall into one ivory cluster; make the region fills and edges read (still within palette, 14-20 % fill, 1 px ink edges at 40 %), and make the return arc about 3 px wide at 1080p.

## P3-4 QA frames (pass 3)

0, 3, 5, 8, 10.5, 12.5, 17, 22, 24.5, 29, 31.5, 37.33, 43.33, 49.33, 51.97 s, plus every boundary ±0.1 s. Every cell-stop frame must show recognisable cells of at least two types, matrix and context (cortex or plate) in focus.

---

# PASS 4 (2026-11-08): cell-type labels, clean cell stops, a fuller opening

The owner watched `renders/silicograft-dive.mp4` (pass 3; the copy without labels is
`renders/silicograft-dive_v3_nolabels.mp4`). **Pass 4 overrides the sections above wherever
they disagree.** The 52 s timeline, the day track and every boundary key stay as they are.

## P4-1 Labels: the one exception to "no text"

The owner: "orada gözüken hücre tipleri neler onları da göstersin bi çizgi ile ismi yazsın
ingilizce" (show which cell types are visible there, each with a line and its name in English).
This overrides "No text in the film" (LOOK) and the BANNED "text, labels" line, for these
labels only.

- During the three cell stops each cell type the data shows in the slab gets one label: a 7 px
  dot on ONE real cell of that type, a thin leader line (angled from the dot, then
  horizontal) and the English name. b2 `ilik_ucu`: "Mesenchymal stem cell" (the run has only
  MSCs there). c2 `korteks_ucu`: "Osteoblast", "Osteocyte", "Mesenchymal stem cell" (no
  fibroblast or chondrocyte at days 120-220). c3 `plak_alti`: "Osteoblast", "Osteocyte",
  "Mesenchymal stem cell", then "Chondrocyte" (and "Fibroblast") only once the run has them
  (day 325 on).
- The cell is chosen by a fixed rule (ENGINE.md "Cell-type labels (pass 4)"): it keeps its
  identity, type and site for the whole label window, stays in frame and in its stop's screen
  region, is nearest the focal plane, and nothing is in front of it. The dot and line follow
  its projected position every frame; a label fades while depth of field blurs its cell.
- Look: the site's Midnight style. Mona Sans 500 at 28 px in ink `#e7f0f9` with a soft ground
  (`#02071d`) halo; line 1.75 px ink at 70 %; no boxes, backgrounds or arrowheads; 80 px safe
  margins; labels never overlap.
- Timing: each label enters once cells read as cells (dot, then the line draws out over 12
  frames, the text fades in over 14), 7 frames apart, and leaves with a 12-frame fade before
  the pull-out.

## P4-2 Clean cell stops

- No 0.3 mm voxel blocks in front of or behind the cells (the owner saw large blurry amber
  blocks in c2 from about 21 to 25 s). A ground-coloured backdrop behind each c2/c3 slab hides
  the clip box's walls that showed through the cells; c2 opens its box wide from 8.5 mm (fully
  at 6 mm, about 21.45-25.4 s) and c3 from 6 mm (fully at 4.4 mm); b2's voxel dissolve also
  removes the blocks behind its slab. Further out the voxels frame the window as context.
- One cortex and one plate: the slab's own copies (a lighter cortex "brick" in c2, a second
  steel bar in c3) are not drawn; the macro cortex (kept whole by the clip box) and the macro
  plate are the context.

## P4-3 The opening (b1, 0-6 s)

The owner's close opening, now filling the frame: at most about 40 % empty ground from 0 to
5.5 s (pass 3: 49-60 %), bone horizontal, plate on top; 3-4 screws may sit outside the frame.
As built: 26 / 30 / 37 / 34 % at 0 / 2 / 3 / 4.5 s, 47 % at 5.5 s, where the camera is already
settling into the fixed 6 s key (53 %); a closer 5.5 s frame would need a push in and pull back
before the dive.
The camera stays close and looks up the bone from the distal side and above the plate, so the
plate and the near bone fill the frame while the loaded end stays in it; the load marks read
from about 2.4 s to 4.6 s and leave by 5.0 s. The 6 s key (the hero loop's start) is unchanged.
