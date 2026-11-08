# ENGINE: the shared film engine, as built

For the beat builders. SPEC.md is the brief and the contract; this file is the API that
`assets/js/engine.js` actually provides. Read both. **Pass 3:** the film is 52 s with eight beats
(b1 b2 b3 c2 c3 b4 b5 b6); the timeline, the day track and the boundary keys are in
"Pass 3 boundary keys (contract)" at the end, which overrides the pass-2 times quoted above it.

## Files

| File | What it is |
|---|---|
| `index.html` | Root, 52 s (pass 3), mounts `compositions/dive.html` (`#dive`) for the whole film. |
| `compositions/dive.html` | One full-frame `<canvas id="dive-canvas">`. A classic script registers `window.__hf.buildReady["dive"]`, the `hf-seek` listener and a paused GSAP timeline `dive` (one 52 s tween on a dummy clock, so the duration is right). A module script imports `assets/js/engine.js`, calls `boot()`, and resolves the build promise after the first frame is drawn. |
| `assets/js/timeline.js` | Pass 3: the timeline as data (`DURATION` 52, `FPS`, `BEATS` with windows, days and regions, `BEAT_IDS`, `BOUNDARIES`, `SHIFT_B456` 16, `HERO_LOOP`) and the day track `dayAt(t)` (`DAY_KNOTS`, `dayRateAt`, `timeOfDay`). No three.js; engine, beats, planner and the website share it. |
| `assets/js/engine.js` | Renderer, scene, camera, lights, shadows, environment, post-processing, data loading, parts, voxels, fields, per-frame state. |
| `assets/js/director.js` | The camera director (pass 2): pure functions, no three.js, shared by the engine and the planner. |
| `assets/js/beats/*.js` | One module per beat, built in this order: `b1`, `b2` (cell stop 1), `b3`, `c2` (cell stop 2), `c3` (cell stop 3), `b4`, `b5`, `b6`. `b2`, `c2`, `c3` are pass-3 stubs (see "Pass 3 boundary keys (contract)"). |
| `.hyperframes/engine-bench/` | `bench.html` + `bench.mjs`: frame-time bench outside HyperFrames (see "Timing"). |
| `.hyperframes/camera-plan/plan.mjs` | Camera planner without a browser (see "Camera director"). |

## How a frame is drawn

`render(t)` (t in global seconds, called from `hf-seek` and from the GSAP timeline's `onUpdate` while scrubbing; `dive.html` draws each time only once):

1. Camera from the director (all beats' keys merged), rolled to the horizontal frame; lights and the shadow frustum follow it.
2. `ctx.state = defaults(t)`.
3. `b1.update(t, ctx)`, `b2`, `b3`, `c2`, `c3`, `b4`, `b5`, `b6`, in that order (timeline.js `BEAT_IDS`), **every frame for every beat** (not only inside its window).
4. The engine applies the state (half cut, part opacities, voxels, field colours, environment rotation, exposure).
5. The key light's shadow map is rendered once (`shadowMap.autoUpdate` is off; the engine sets `needsUpdate` per frame).
6. Render: plain `renderer.render` to the canvas or, when `state.dof` is set (integration pass 3), the same render into `dofTarget` (an 8-bit target that tone-maps and encodes like the canvas) followed by the BokehPass composite onto the canvas. See "Depth of field (integration pass 3)" under "Look as built".

Everything is a pure function of t. Caches inside the engine (the voxel merge for a day, the field colours for a mode/blend/day) are memoisation only: the output never depends on the order of frames.

## Beat module

```js
export default {
  id: 'b2', start: 6, end: 12,                       // seconds
  camera: [{ t: 6.0, pos: [x, y, z], target: [x, y, z], fov: 28, roll?: deg, near?: mm, hold?: true }, ...],
  async build(ctx) { /* create objects, add them to ctx.scene (or ctx.model), hidden */ },
  update(t, ctx) { /* set own objects for ANY t; write ctx.state only while start <= t < end */ },
};
```

- `build` runs once, sequentially in `BEAT_IDS` order, after the engine's parts exist. Heavy work belongs here (it is inside the build-ready promise).
- `update` is called for every beat on every frame. Your own objects are never reset by the engine: set their `visible`/opacity for every t (hide them outside your window). No frame-to-frame state, no `Math.random`, no timers; use `ctx.util.mulberry32(seed)` or `ctx.util.hashId(id)`.
- Write `ctx.state` only inside `[start, end)`. Later beats win. After your window the next beat owns continuity, so each beat writes the full set of state it needs (see the stubs).
- Keys at the same `t` in two beats (a hand-off) are merged; the later beat's key wins. Keep hand-off keys identical in both beats.

## ctx

| Field | Meaning |
|---|---|
| `THREE` | three@0.170.0 (`https://cdn.jsdelivr.net/npm/three@0.170.0/+esm`). Use this instance, never import another three. Addons: import from `.../three@0.170.0/examples/jsm/<path>.js/+esm`, which resolve to the same three module. |
| `scene`, `camera`, `renderer` | `camera` is a PerspectiveCamera driven by the director every frame (do not move it yourself). |
| `model` | Group holding the manifest's `scene_transform` (quaternion (0, 0.7071, 0.7071, 0), position (0, -20, 0)). Children use **model-frame millimetres** (the data's frame). Add data-derived objects here. |
| `data` | `manifest`, `summary`, `voxIndex`, `feDays` (118 FE days, 6..357), `surfaces[name]` (`position`, `normal`, `index`, `faceTag`, `element` (callus parts only), `groups`, `nFaces`, `bbox`), `elem` (`n` = 24698, `centroid` Float32 n*3 model mm, `E_q` Uint16 118*n, `E_rows`, `strain357` Float32 (signed min principal strain), `hp357` Float32 MPa, `class357` Uint8), `vox` (`days`, `grid` [121,121,134], `blockMM`, `day(i)` -> `{day, count, block: Uint32Array (sorted), code: Uint8Array}`). |
| `palette` | Pass-2 hex strings (SPEC P2-2), see "Palette (pass 2)". Same names as pass 1 plus `screw`, `resorption`, `nucleus`, `rimLight`, `fillLight`, `strainLow/Mid/High`. |
| `materials` | Prototypes (`SgStandardMaterial`, a MeshStandardMaterial whose SG_* defines survive `clone()`): `cortex` (grain), `marrow` (grain), `steel` (plate, brushed), `screwSteel`, `hull`, `cut` (compat only; `callus_cut` has its own shader material), `voxel` (bevel look). Each part mesh has its own clone; clone again for your own objects. A clone keeps the look (defines) even if you set your own `onBeforeCompile`, and receives the key light's shadow automatically (`userData.sgReceiveShadow`). |
| `parts` | Named meshes (all in `model`): `cortex_prox`, `cortex_dist`, `marrow_prox`, `marrow_dist`, `plate`, `screws`, `callus_hull` (full); the same names + `_half` (skin of the kept half); `<name>_half_cut` (flat cut faces on x = 0, for the five solid parts); `callus_hull_half`; `callus_cut` (the field face: indexed, per-vertex attributes `aE`, `aS`, `aEdge`; per-face element ids in `geometry.userData.faceElement`). Not in `parts`: `<name>_cap` meshes (pass 3), the half-cut sweep caps of the six solid parts, shown only while 0 < `half` < 1. Skins use creased normals (35 deg); cut faces stay flat. All parts but the hull cast and receive the key light's shadow. Visibility and opacity are set by the engine from `state`; do not toggle them directly, use `state.partOpacity`. |
| `voxels` | See below. |
| `fields` | See below. |
| `util` | `ease` (GSAP names: `linear`, `power1..3.in/out/inOut`, `sine.in/out/inOut`, `inOutCubic`; `ease.get(name)`), `tween(t, t0, dur, ease)` -> eased 0..1, `enterExit(t, tIn, tOut)` (SPEC enter 18 frames power2.out / exit 12 frames power2.in), `frames(n)` = n / 30, `lerp(a, b, x)`, `clamp(x, a=0, b=1)`, `smoothstep(a, b, x)`, `mulberry32(seed)`, `hashId(id, seed?)` -> [0, 1), `fieldColor(u, target?, map = 'E')` (u in 0..1 -> THREE.Color, linear; `'E'` viridis, `'strain'` magma 0.15..1), `viridis(u, target?)`, `magma(u, target?)` (the strain map, already restricted to 0.15..1), `logE(MPa)` and `logStrain(eps)` -> 0..1 on the SPEC log ranges, `toScene(v)` / `toModel(v)` (array or Vector3 -> Vector3), `FPS`. |
| `state` | Reset every frame; see below. |
| `shared` | A plain object that persists from build on. Register objects other beats animate (b1: `ctx.shared.arrows`; b5 pulses them). Read other beats' entries in `update` (or late in `build`), and tolerate their absence. |
| `clipPlane` | The half-cut clipping plane (scene x >= c is kept). Give your own materials `clippingPlanes: [ctx.clipPlane]` if they must be cut with the model. |
| `composer`, `bokeh` | Post-processing. Since integration pass 3 only `bokeh` (the BokehPass, `renderToScreen`) runs, while `state.dof` is set; `composer` is kept for its sizes and is never rendered. b2 wraps `bokeh.render` so Points and Lines stay out of its depth render (`bokeh.userData.sgSkipPointsInDepth`); this applies to every DOF frame. |
| `cameraKeys`, `cameraAt(t)` | The merged keys and the director (returns `{pos, target, fov, roll, near, distance}`); useful to aim objects at the camera. |
| `cameraTarget`, `cameraDistance`, `cameraRoll` | This frame's target (Vector3), camera-target distance (mm) and roll (deg). Set before the beats run. To keep a flat object upright on screen (b6's chart), align it with the camera's own axes (`ctx.camera.matrixWorld`, x = screen right, y = screen up), which include the roll. |
| `lights` | `{ key, rim, fill }` DirectionalLights (camera-relative; `key` casts the shadow). |
| `t` | This frame's time. |
| `dayAt` | Pass 3: the film's day track (`timeline.js`): every beat writes `state.day = ctx.dayAt(t)` (b1 0, b4-b6 357). |
| `timeline` | Pass 3: `timeline.js` `BEATS` (`{ id, start, end, days, region? }`). |
| `macroMaterials` | Pass 3: a `Set` of beat materials that belong to the macro scene (b3's bone overlay); `state.macroClip` cuts them with the engine's parts and voxels. |

## ctx.state (defaults, reset every frame)

| Key | Default | Meaning |
|---|---|---|
| `day` | 0 | Simulated day 0..359 for the voxels and the tissue field. Fractional days blend the two sampled days around it. |
| `half` | 0 | 0 whole model; 1 half model (kept half: model x <= 0, i.e. **scene x >= 0**); in between, a clipping plane sweeps from scene x = -span to 0 over the full meshes, each solid capped by its exact cross-section on the plane (see "Half-cut sweep (pass 3)"); the voxels are clipped with them; the flat cut faces of the half meshes take over at 1. |
| `voxelOpacity` | 0 | Global voxel opacity (0 hides them). |
| `fieldMode` | `'tissue'` | Mode of the callus cut face: `'tissue'`, `'E'`, `'strain'`: the mode being blended **to**. |
| `fieldBlend` | 1 | 0 = the previous mode (`E` blends from `tissue`, `strain` from `E`), 1 = `fieldMode`. Ignored for `tissue`. |
| `eDayIndex` | 0 | Fractional row of `elem_E_days` (0 = day 6 ... 117 = day 357); rows are interpolated in log space. |
| `envRotation` | 20 deg * t / 52 (radians; pass 3, was / 36) | Y rotation of the RoomEnvironment (highlights sweep over the whole film; b4-b6 therefore see a few degrees more than in pass 2). |
| `dof` | `null` | `{ focus: mm from the camera, aperture, maxblur }` turns on the BokehPass for this frame. |
| `cutOpacity` | 0 | Engine extension: opacity of `callus_cut` (the field face). Shown only while `half > 0`. |
| `hullOpacity` | 0 | Engine extension: callus hull (transparent skin; the full hull while half < 1, the half hull at half = 1). |
| `partOpacity` | `{}` | Engine extension: multiplier per part name (`plate_half`) or group (`plate`, `cortex_prox`, `screws`, `callus_hull`, `callus_cut`, ...). 0 hides. |
| `halfSpan` | `null` | Engine extension: mm the cut plane travels (null: 7.6, or 18.5 when the hull is visible). |
| `exposure` | 1 | Multiplies the engine's base exposure (0.9, chosen so ivory bone does not clip). |
| `shadows` | 1 | 0 switches the key light's shadow off for this frame (changing it recompiles the lit programs once). |
| `macroClip` | `null` | Pass 3 (cell stops): `{ centre: [x, y, z], size: [sx, sy, sz], open: 0..1 }` in scene mm: a box HOLE in the macro scene so a cell slab is not buried (see "Macro clip box (pass 3)"). |
| `slab` | `null` | Pass 3: `{ name, opacity }` of the cell slab this frame shows; written by the stop beats, informational (the engine copies it into `stats.slab`; each beat drives its own slab object). |
| `stemOpacity` | absent (= 1) | b3's extension (see b3.js): alpha of the stem-cell voxels. b3 fades it to 0.4 (16.2-17.4 s); c2, c3, b4, b6 keep 0.4 in their macro frames. |

## Coordinates (scene units = mm)

- `scene = R * model + t`: scene.x = -model.x, scene.y = model.z - 20, scene.z = model.y.
- Bone axis = scene y, proximal up: proximal end face (loaded) y = +100, distal clamp y = -100. Defect y = -15..+15 (bone end faces), callus y = -20..+20, radius 9 at y = +-20 and 18 at y = 0.
- Plate on **+z** (bone-facing face z = 9, outer face z = 14.6), x -6.8..6.8, y -77.5..+77.5. Cortex outer half axes 7.5 (x) by 8.5 (z), marrow 3.75 by 4.4.
- Screws (r 1.75) along z through the bone at y = -70, -55, -40 (distal) and 40, 55, 70 (proximal); heads flush with the plate's outer face (z = 14.6), tips at z = -9.5.
- Cut plane: scene x = 0, cut faces have normal -x (they face a camera on the -x side).
- **Screen (pass 2, default roll -90 deg):** for any camera on the -x side, scene +y (proximal) is screen LEFT, -y (distal) screen RIGHT, +z (the plate) screen TOP. A camera with a +z component (azimuth > 0) sees the plate's outer face and the screw heads; a camera with a -y component (elevation < 0) looks along the bone from the distal side, so the proximal end recedes to the left. `(-160, 0, 0) -> origin` now sees the cut face face-on with the bone horizontal and the plate on top.
- Load: 823 N along -y applied at (0, 100, 0); bending moment 9777 N mm about +z (bends in the scene x-y plane).
- Voxel blocks: model centre = (-18, -18, 0) + 0.1 * (3 * (bi, bj, bk) + 1); the kept half is bi <= 59 (their +x face is at model x = -0.05, so 0.05 mm behind the cut face).

## Voxels (`ctx.voxels`)

One `InstancedMesh` (`voxels.mesh`, in `model`) of cubes 0.285 mm (0.3 mm with 5 % gaps), roughness 0.7, colour by code (pass 2): 1 stem cell `#d9a43a` amber, 2 bone `#efe2c4` ivory, 4 cartilage `#5aa0e0` blue, 5 fibrous `#e07a8a` coral. Bevel look (`SG_BEVEL`): the fragment shader bends the normal towards the cube's edges over the outer quarter of each face and darkens the edges by up to 20 %, so clusters read as tissue without extra geometry. The voxels cast and receive the key light's shadow (a regrown mesh keeps the flags). Instance buffers are reused and grown when needed.

- `setDay(d)`, `setOpacity(a)`, `setHalf(bool)`: the engine calls these from `state` every frame; beats normally only write `state.day` / `state.voxelOpacity`.
- Between sampled days (every 3 days, plus 359): blocks present only in the earlier day shrink (scale 1 - f), blocks present only in the later day grow (scale f), blocks whose code changes keep full size and crossfade colour. Opacity is global, not per instance.
- Blocks enclosed on all six sides by full-size shown neighbours are culled (exactly invisible). At day 357 the half model draws 22,746 cubes of 125,991 stored; the full model about 40,000 of 252,844.
- `codeAt(blockIndex)` (nearest sampled day to the current day; 0 = empty), `blockIndex(bi, bj, bk)`, `blockCentre(bi, bj, bk)` (model frame), `sampledDay(i)`, `days`, `grid`, `instanceCount`, `material` (a clone of `materials.voxel`; b3 chains its stem-cell alpha onto it).

## Fields (`ctx.fields`), on `parts.callus_cut` only (pass 2, SPEC P2-4)

The cut face is an indexed mesh (shared vertices) with its own lit material (`MeshStandardMaterial`, roughness 0.6, flat, polygon offset -2/-8; shader in `makeCutMaterial`). Per pixel it mixes three maps with the weights of the mode and blend, `[tissue, E, strain]` = `fields.weights()`: tissue only; `E` blends from tissue; `strain` blends from E.

- **tissue, per pixel**: a 121 x 134 R8 data texture (`fields.tissueTexture`, x = bj, y = bk, nearest filter) holds the voxel code of the slab next to the cut plane (block bi = 59 just behind the cut, else bi = 60 which holds the plane x = 0) at the **nearest sampled day** to `state.day`; the fragment's model (y, z) picks its texel, so the edges are the voxel edges, not the tet triangles. An empty block inside the face is granulation tissue (0.2 MPa) and takes viridis 0 (`#440154`, with the field's emissive share), the colour E mode gives it, so the tissue -> E blend keeps it. The voxel export has no callus mask (empty blocks are not stored), so nothing is discarded inside the face: the face's outline stays the tet mesh's; fragments outside the voxel grid read as granulation.
- **E, per pixel (pass 3, SPEC P3-3)**: the element values are rasterised on a 0.1 mm grid on the cut plane (`FIELD_TEXEL`; each texel takes the element of the triangle holding its centre; about 280 x 410 texels) and smoothed by a Gaussian of sigma 0.45 mm (`FIELD_SIGMA`) normalised by the smoothed coverage mask (normalised convolution: the level holds up to the outline and the ground never mixes in; texels just outside the face carry the extrapolated value, so linear filtering adds no rim). The result is an R16F texture (`fields.eTexture`, linear filter) the fragment samples at its model (y, z) and maps through viridis. Value per element: the log-coded modulus of `elem_E_days` row `eDayIndex` (fractional rows interpolate the uint16 log code; the code is already log(E / 0.2) / log(17000 / 0.2), so u = q / 65535 on 0.2..17000 MPa). Refilled when `eDayIndex` changes (about 20 ms in SwiftShader's page). This replaces pass 2's per-vertex means, whose long tet triangles at the callus border smeared one vertex's value into spikes. `aE` is still filled (per-vertex area-weighted mean) but no longer drives the colour.
- **strain, per pixel**: the same raster and smoothing of u = log10(|`elem_strain_357`| / 1e-5) / 4 (0.001 % .. 10 %) (`fields.strainTexture`, built once), mapped through magma restricted to 0.15..1. `aS` is kept as in pass 2 but unused by the shader.
- Maps: 17-stop tables `VIRIDIS` and `MAGMA` (exported from engine.js; matplotlib 3.10), interpolated in sRGB per fragment (shader) or in JS (`util.viridis`, `util.magma`, `util.fieldColor(u, c, map)`).
- Emissive: the cut material adds 0.22 x the field colour (E and strain share, plus granulation in tissue mode), so the low ends never sink into the ground.
- Boundary line: vertices on boundary edges that the callus face shares with the cortex and marrow cut faces carry `aEdge = 1`; the fragment darkens a line about one pixel wide (50 %) where the interpolated flag reaches 1 (`fwidth`). If no shared vertices are found the whole outline is drawn.
- Bone-end cut faces: in E mode the flat cut faces of the cortex and the marrow (`cortex_*_half_cut`, `marrow_*_half_cut`) take their modulus from `manifest.codes.region_material_MPa` (cortex 17000 MPa = viridis 1 `#fde725`; marrow 2 MPa = viridis 0.2) as colour and 0.22 x that as emissive, weighted by the E share of the blend times `cutOpacity`. The run has no strain for them, so they return to their material colour as the face blends from E to strain. The plate (210000 MPa) is outside the range and keeps its steel.
- API: `setMode(m)`, `setBlend(a)`, `setEDayIndex(i)` (engine-driven from state), `weights()`, `eValue(element, rowIndex)` and `strainValue(element)` -> u, `eDay(rowIndex)` -> FE day, `mode`, `mesh`, `tissueTexture`, `eTexture`, `strainTexture`.

## Palette (pass 2, SPEC P2-2)

`PALETTE` (engine.js, `ctx.palette`), sRGB hex. The names of pass 1 are kept; their values changed.

| Name | Hex | Use |
|---|---|---|
| `ground` | `#02071d` | background (the site's paper) |
| `groundFar` | `#0a1430` | fog colour |
| `ink` | `#e7f0f9` | load arrows (b1, b5), plane axes |
| `muted` | `#98a9c1` | spare neutral |
| `accent` | `#6bcbf7` | ONLY the return arc in b6 |
| `accentDark` | `#3483ad` | kept for compatibility, unused |
| `bone` | `#efe2c4` | new bone (code 2) |
| `cartilage` | `#5aa0e0` | code 4 |
| `fibrous` | `#e07a8a` | code 5 |
| `stemCell` | `#d9a43a` | code 1 (MSC) |
| `cortex` | `#9c958a` | intact cortex (with +-4 % grain) |
| `marrow` | `#6e3434` | marrow |
| `plate` | `#aab4bf` | plate steel |
| `screw` | `#8c96a1` | screws |
| `resorption` | `#8a8f96` | decision-plane resorption region |
| `nucleus` | `#46337a` | cell nuclei in b2 (the cell viewer's nucleus colour) |
| `keyLight`, `rimLight`, `fillLight` | `#fff1e0`, `#9fc4ff`, `#dfe8ff` | lights |
| `fieldLow/Mid/High` | `#440154`, `#21918c`, `#fde725` | viridis 0, 0.5, 1 (E) |
| `strainLow/Mid/High` | `#251255`, `#d5446d`, `#fcfdbf` | magma 0.15, 0.575, 1 (strain) |

Field maps: `VIRIDIS` (E) and `MAGMA` (strain, magma on 0.15..1), 17 stops each, exported by engine.js.

## Look as built (pass 2)

- Renderer: antialias, no stencil buffer (pass 3: a depth-stencil canvas cost about 60 % more on every frame in SwiftShader), `ACESFilmicToneMapping`, base exposure 0.9 (times `state.exposure`; ivory bone does not clip), sRGB output, pixel ratio 1, 1920 x 1080, `preserveDrawingBuffer: true`, local clipping on, shadow map on (`PCFSoftShadowMap`, updated once per frame).
- Background `#02071d` exactly (clear colour is not tone-mapped, on the canvas and on `dofTarget` alike). Fog towards `#0a1430` (same inverse), from the target distance to the far plane (target distance + 400 mm).
- Lights are **camera-relative** (directions in camera space after the roll: x right, y up, z towards the viewer): key (-0.5, 0.8, 0.4) 2.6 `#fff1e0`, rim (0.6, 0.3, -0.8) 1.4 `#9fc4ff`, fill from below 0.3 `#dfe8ff`. The key stays upper left on screen through the whole take, i.e. on the plate side, so the plate shades the bone and the callus below it.
- Shadows (P2-3): the key light casts a 2048 x 2048 PCF-soft shadow. Its orthographic frustum is re-fitted every frame to a square of half size 1.5 x the half diagonal of the view at the target distance (2..180 mm), depth 40..560 mm along the light; `normalBias` = 1.5 texels, `bias` -0.0004. Casters: plate, screws, cortex, marrow, voxels. Receivers: the same plus the cut faces and any beat mesh whose material is a clone of an engine material. b2's cells (Phong) neither cast nor receive.
- Surfaces: every skin is rebuilt with creased normals (`BufferGeometryUtils.toCreasedNormals`, 35 deg): tubes shade round, plate and screw rims stay sharp. Cut faces keep their flat normals.
- Materials: `SgStandardMaterial` (MeshStandardMaterial whose `SG_*` defines survive `clone()`); the shader-chunk extensions are global and switched on by those defines, so a beat that clones a material and sets its own `onBeforeCompile` keeps the look. Cortex roughness 0.85 and marrow 0.8 with `SG_GRAIN` (+-4 % colour and roughness noise in the model frame). Plate: `#aab4bf`, metalness 0.9, roughness 0.32 with `SG_BRUSHED` (roughness streaks stretched along the plate), own envMap at 1.1. Screws: `#8c96a1`, metalness 0.9, roughness 0.3, own envMap at 1.3 (the heads read as darker discs on the plate; their flat cut faces reflect the room and read light). Hull: cortex grey at 0.3 opacity (unused by the beats).
- `RoomEnvironment` through PMREM, `scene.environmentIntensity = 0.6`, rotated by `state.envRotation` (the steel's own envMaps too).
- Camera: vertical fov from the keys, rolled by the key's `roll` (default -90 deg); near = the key's `near` or 5 % of the target distance (0.0005..25 mm), interpolated in log space; far = target distance + 400 mm. Anything closer to the camera than near is clipped.
- Depth: the cut face has a negative polygon offset and the voxels a positive slope-scaled one; without them SwiftShader drew the voxels' near-edge-on side faces through the cut face 0.05 mm in front of them as thin streaks. Give your own coplanar or near-coplanar overlays the same treatment.
- No ambient-occlusion pass (P2-3 made it optional within budget; the voxel frames already cost 2.0 to 2.6 s with shadows). b1's contact-shadow overlay is gone (P2-6); the key light's shadows ground the plate.
- Depth of field (integration pass 3): a DOF frame is drawn exactly as the canvas draws it, into `dofTarget`, and the BokehPass composite (its own depth render, then the blur) reads that target and draws onto the canvas. `dofTarget` is an 8-bit, sRGB-tagged, non-MSAA render target flagged `isXRRenderTarget`, which in three r170 makes the programs tone-map and sRGB-encode in the shader, clears it to the plain ground colour and stores the encoded bytes (WebGLPrograms `toneMapping`/`outputColorSpace`, `getUnlitUniformColorSpace`, `getInternalFormat(..., forceLinearTransfer)`), so its pixels and its blending equal the canvas's. Until then the DOF frames went through the EffectComposer (half-float RenderPass, OutputPass): transparent materials (cells, clot gel, fibrin, translucent voxels) blended in linear light there and after tone mapping on the canvas, so each of the six DOF on/off frames (9.6, 11.57, 22.33, 24.7, 30.03, 32.2 s) was a pop of +13 to +24 in the mean channel value (the clot flared up); now the change at those frames equals the change between any two neighbouring frames (`/tmp/sgpass3/intbench/dofswitch*.mjs`). The target has no MSAA: drawing on the MSAA canvas and copying it (tried first) cost 0.6-0.9 s more per c2 close-up frame, and under the blur the missing MSAA does not show (integration pass 2 found the same for the composer).

## Camera director (pass 2, `assets/js/director.js`)

Keys `{ t, pos, target, fov?, roll?, near?, hold? }` from every beat, sorted by `t`; same-time keys collapse and the later beat wins (keep hand-off keys identical in both beats). The per-key `ease` of pass 1 is ignored.

- One continuous parameterisation over all keys: target (x, y, z), view direction as azimuth (about scene y, from -x towards +z) and elevation (towards +y) of `pos - target`, log distance, fov, roll and log near. Every channel is a C1 cubic Hermite in time with Fritsch-Butland (PCHIP) tangents: it passes through every key, never overshoots between keys, and its velocity is continuous; it is zero only where that channel turns round, at a `hold: true` key, and at the film's first and last key. Two identical consecutive keys hold the camera still between them.
- Because distance moves in log space, a dive (b2: 64 mm to 1.35 mm) zooms at an even rate, and keys on an arc about a target give a true orbit (b4).
- Roll: `camera.lookAt(target)` with up +y, then `camera.rotateZ(roll)`. Default -90: scene +y to screen left, +z to screen top for a camera on the -x side. A key's `roll` overrides it (degrees, interpolated like fov); avoid elevations near +-90 deg (looking straight along the bone), where the lookAt up is degenerate.
- `ctx.cameraAt(t)` returns `{ t, pos, target, fov, roll, near, distance, segment, u }`.
- Speed: no move should exceed about 60 % of the frame width per second at the subject (SPEC P2-5). The planner below measures it.

### Planner: `.hyperframes/camera-plan/plan.mjs`

Node only (no browser, no lock needed, about 2 s): merges the beats' keys with the real director, projects the visible geometry of each time (full or half model, the day's voxels, the cut face, b6's plane rectangle) into a 192 x 108 grid and prints per time the covered share (1 - empty ground; it reads about 0.1 high against real frames), the covered bbox, the bone axis angle on screen (180 = horizontal, proximal left), plate-up, the screen speed at the subject (share of the frame width per second), the distance, and how many screw heads and load-mark points are in frame.

```bash
cd film
node .hyperframes/camera-plan/plan.mjs 0,3,5,7.5,13,15,21.33,33.33   # or a:b:step, --ascii for a coarse picture
node .hyperframes/camera-plan/plan.mjs --keys 0:36:1                  # also list the merged keys
node .hyperframes/camera-plan/plan.mjs --keys-file=cand.json 0:6:0.5  # try candidate keys ({t, target, az, el, dist, fov} or {t, pos, target})
```

## Pass 2 boundary keys (superseded by pass 3, kept as history)

Pass 3 replaced this table with "Pass 3 boundary keys (contract)" (end of this file); the
times below are pass-2 times (b4-b6 now play 16 s later). The beat builders after the engine pass had to keep these keys EXACTLY (same t, pos, target, fov; no roll, near or hold on them), in both beats that share them. Inner keys inside a beat are free.

| t (s) | beats | pos | target | fov | frame |
|---|---|---|---|---|---|
| 0 | b1 | [-73.274, -15.549, 35.124] | [0, 1.5, 2.5] | 28 | pass 3 (SPEC P3-3, the owner's choice): CLOSE on the gap, both bone ends and the plate filling the frame, five of the six screw heads outside it (az 24, el -12, 82 mm) |
| 6 | b1 / b2 | [-58.04, -1.31, 23.95] | [0, 12, 0.5] | 28 | into the half-cut gap: the proximal bone end and its cut at the centre, the gap to the right (az 22, el -12, 64 mm) |
| 12 | b2 / b3 | [-4.65, 10.37, -0.08] | [0.35, 14.1, -1.9] | 24 | 6.5 mm from the bone end and the cell layer, oblique from the gap (az 20, el -35); cells fully faded, voxels at full opacity |
| 18 | b3 / b4 | [-77.836, -35.345, 2.079] | [0, 1, -2] | 28 | three-quarter of the half callus along the bone from the distal side, slightly below the plate's level (az 3, el -25, 86 mm; integration pass 2, was 92 mm) |
| 24 | b4 / b5 | [-86, 0, -2] | [0, 0, -2] | 28 | face-on to the cut face (86 mm) |
| 30 | b5 / b6 | [-77.893, -4.082, -3] | [0, 0, -3] | 28 | face-on, pushed in (78 mm, el -3) |
| 36 | b6 (= the 6 s key) | [-58.04, -1.31, 23.95] | [0, 12, 0.5] | 28 | the last frame rhymes with b2's first frame |

Inner keys as built: b1 (pass 3) 3.0 s (az 30, el -22, 112 mm, target y 64: the brief wider moment, the proximal half with both load marks), 4.3 s (az 28, el -28, 106 mm, fov 30, target y 56: the half cut), 5.0 s (az 25, el -30, 86 mm, fov 36, target y 36: both load marks whole at the left edge, screen x -0.81..-0.93, while the camera heads for the gap; the fov closes to 28 by 6 s); b2 7.2 s (11.2 mm, 40 deg down the bone axis: an oblique corner view, no flat slab), 8.667 s and 10.8 s (the cell close-up); b3 14 s (the gap opening); b4 20 s and 22 s (the orbit, elevation -25 -> 0 at sine.inOut quarter points); b6 33.3 s (callus and the decision plane below it, 125 mm).

What the plan leaves to the beat builders:
- b1 (pass 3): frame 0 opens close on the gap (planner cover 0.46); the arrows enter at the left edge as the camera pulls back (from about 1.7 s), read fully 2.3-4.6 s and are still whole at the left edge at 5.0 s, exit 5.3-5.7 s. Planner: horizontal and plate up throughout, screen speed at most 0.51 frame widths per second (5.5 s), a momentary turnaround at 3.0 s where the camera reverses from the loaded end back down the bone. Day 0 has no tissue, so b1's colours are steel, cortex grey, amber stem cells, marrow red (after the cut) and the ink arrows.
- b5: the arrows at scene z -28 (pass-1 `TIP`) are now below the frame; place them beside the callus in the horizontal frame (left or right of the cut face, on the bone band).
- b6: the decision plane at scene z -36 sits under the callus in the horizontal frame (P2-6 allows below), but its axes are still built in scene x/y and appear rotated 90 deg on screen; build its basis from the camera's screen axes (`ctx.camera.matrixWorld` columns 0 and 1 at a fixed time, which include the roll) so the chart's x axis is horizontal and y vertical.
- b2: the dive peaks at about 0.7 frame widths per second around 6.8 s (the zoom from 64 to 11 mm in 1.2 s); everything else stays under 0.6.

## Data loading

`boot()` fetches `assets/data/manifest.json`, `summary.json`, `vox_index.json` and every `.bin` named there with `fetch(new URL('assets/data/<file>', document.baseURI))` inside the `buildReady["dive"]` promise (about 86 MB, mostly `vox_days.bin`). `hyperframes lint` and `check` accept this (no finding); the render server serves the project folder, so root-relative paths work in the root and in the sub-composition. The modules load from jsDelivr (three@0.170.0 `+esm`), so check, snapshot and render need network access.

## Timing (SwiftShader, 1920 x 1080, this machine)

Measured with `.hyperframes/engine-bench/bench.mjs` (Chrome headless shell, `--use-angle=swiftshader`, `readPixels` sync after each frame, one frame stepped before timing so the voxel merge is cold):

Pass 2 (shadows, creased normals, bevel voxels, per-pixel cut face), 2026-11-07:

| t (s) | what | ms |
|---|---|---|
| 0 / 3 / 5 | whole model / proximal fragment / half cut | 410 / 440 / 390 |
| 8.7 / 9.5 / 10.5 | b2 close-up, cells + BokehPass | 2230 / 2470 / 2720 |
| 12 | voxels at 6.5 mm, day 30 | 2030 |
| 15 / 17.6 | b3 voxels (23,476 / 22,746 cubes) + bone overlay | 2650 / 2250 |
| 18.3 | cut face fading in over the voxels | 2350 |
| 21.33 | E map | 580 |
| 31 / 33.33 / 35.9 | b6 points, plane, voxels, strain map | 2190 / 1680 / 2160 |

Integration pass 2 (after the beat builders, composer without MSAA), `bench.mjs`:

| t (s) | what | ms |
|---|---|---|
| 10.0 / 10.9 | b2 close-up, cells + BokehPass | 1730 / 1920 (2775 / 2852 with 4x MSAA) |
| 11.3 / 11.5 / 11.7 | b2 pull back: cells, voxels growing back, BokehPass | 2370 / 3130 / 3060 (3990 / 4500 / 4090 with 4x MSAA) |
| 12 | voxels at 6.5 mm, day 30 | 1990 |
| 15 / 17.6 | b3 voxels + bone overlay | 3020 / 2210 |
| 34.8 / 35.4 / 35.967 | b6 dissolve to translucent stem cells + bone overlay | 2120 / 2650 / 2260 |

The heaviest frames are the DOF close-up and the voxel frames with shadows (the shadow pass draws the voxels again). All stay under 2.8 s, below the 3.5 s budget; cut the shadow map to 1024 (`SHADOW_MAP`) or set `state.shadows = 0` on a frame first if a beat pushes past it. Build (fetch + parse + programs) takes about 2 s once the CDN modules are cached. Beat builders: keep your own per-frame cost well under 1.5 s so the total stays under 4 s; re-run the bench after adding objects:

```bash
cd film && python3 -m http.server 38765 --bind 127.0.0.1 & \
flock /tmp/silicograft-browser.lock node .hyperframes/engine-bench/bench.mjs 38765 9,21.3,27.3 /tmp/bench; kill %1
```

Use `--no-browser-gpu` on every `hyperframes check / snapshot / render` here: the GPU probe reports a D3D12 adapter, but WebGL context creation then fails in the headless shell.

## Half-cut sweep (pass 3, SPEC P3-3)

While 0 < `half` < 1 (b1, 4.0-4.6 s) the full solids are clipped at scene x = c (`clipPlane`, `clipShadows` on) and each of the six solid parts (cortex and marrow, both fragments, plate, screws) is capped on the plane by its exact cross-section: `makeSlicer` welds the part's vertices by position, classifies them once against the plane, intersects the crossing edges (the same point for both faces of an edge), walks the segments into closed loops, nests them by containment (outlines and holes: screw holes, the marrow canal) and triangulates them with `ShapeUtils` (earcut). The cap (`<name>_cap`, a clone of the part's material, normal model +x like the exported cut faces) is rebuilt only when c changes (memo). Bench on a remote 16-thread machine (SwiftShader, a loaded machine, so read the ratios): the sweep frames 4.1 / 4.3 / 4.45 s take 0.5 / 0.7 / 0.7 s against 0.3 / 0.4 s at 3.9 / 4.6 s. The voxels are clipped with the solids during the sweep (the whole set, so the near half does not pop out at 4.0 s) and switch to the kept half at 1. The flat cut faces of the half meshes (`*_half_cut`) now show only at `half` = 1, where they coincide with the caps. Pass 2 showed the clipped shells open: the plate's top face as a flap and whole screw cylinders through the cut for 18 frames.

A stencil-buffer cap was tried first and dropped: a depth-stencil canvas made every frame of the film about 60 % slower in SwiftShader, and rendering only the sweep through a stencil render target sent it through OutputPass, which tone-maps the ink arrows and the ground differently from the canvas (arrows #d7dadd instead of #e7f0f9).

## Notes for the beat builders

- b1: `ctx.shared.arrows` for the axial arrow and the moment arc (ink since pass 2); the half cut at frame 120 is `state.half` (the stub sweeps it over 18 frames). The screw heads are flush with the plate and read as darker discs on it.
- b2: the exported voxels are 0.3 mm blocks; the SPEC's per-lattice-site cells (0.1 mm sites) need lattice data the film export does not contain yet (`vox_days.bin` is block-level). Stem cells at day 0..30 sit just below the proximal bone end face (scene y 10..20) around the marrow and the outer cortex.
- b4/b5: the cut face is `parts.callus_cut`; its colours come only from `state.fieldMode/fieldBlend/eDayIndex`. Voxels behind it are drawn too (keep `voxelOpacity` 1 for depth at the cut edges, or 0 when face-on to save their cost).
- b6: `data.elem.centroid`, `strain357`, `hp357`, `class357` are the per-element inputs for the decision plane; `util.toScene()` converts centroids. The film's last key (36 s) equals b2's first key (6 s), so the last frame rhymes with b2's first frame. Region colours since pass 2: the tissue palette and `palette.resorption`; pass 3 (P3-3): fills at 20 %, region outlines 1 px ink at 40 %, the return arc 3 px wide at 1080p.

## Cell slabs (pass 3, SPEC P3-2)

`assets/js/cells/slab.js` ports the sister cell viewer (`~/mechanobio-hucre`, branch `hucre-gorunumu`, commit 3b7e79f, `long_bone/web3d_uygulama/hucre3b.html`) to three r170: the procedural cells (`assets/js/vendor/hucre_geometri.js`, plus `assets/js/cells/hucre_geometri_lod.js` for coarser levels of the same cells), the membrane material with its rim glow and wobble (`hucreMalzemesi`, `kenarParlamasi`, `sekilDegistir`), the noise-textured matrix materials (`dokuDeseni`, `matrisMalzemesi`), the marching-cubes matrix isosurfaces of the smoothed agent density (`alanlar`, `matrisGuncelle`), the clot gel and fibrin threads (`fibrinKur`, `fibrinGuncelle`), the osteoblast/osteocyte rule, the per-site offsets and size spread, cells at 1.5x true size, and the inferred motion, division and differentiation between days (`gecis`, `hucreAni`). Data: `assets/data/cells/` (raw `MBR2` files, format and provenance in its `README.md`).

### API

```js
import { createSlab } from '../cells/slab.js';               // from assets/js/beats/*.js
const slab = await createSlab(ctx, 'korteks_ucu', { days: [120, 220] });   // in build(); adds slab.group to ctx.scene
slab.warm(ctx.renderer, ctx.camera);                         // optional, in build(): compiles its programs once
// update(t, ctx), EVERY frame (hide it outside your window):
slab.setVisible(on);
slab.setOpacity(a);                                          // 0..1, multiplies every slab material
slab.setTime(t);                                             // wobble clock (film seconds); 0 freezes the membranes
slab.setDay(day, ctx.camera);                                // fractional day + this frame's camera (see below)
```

| Member | Meaning |
|---|---|
| `createSlab(ctx, name, opts)` | `name`: `'ilik_ucu'`, `'korteks_ucu'`, `'plak_alti'`. Needs `ctx.THREE`, `ctx.scene` (parent, unless `opts.parent`), `ctx.data.manifest.scene_transform` (falls back to `ctx.model.matrixWorld`). Fetches `assets/data/cells/bolgeler.json` and `roi_<name>.bin` from `opts.baseURL ?? document.baseURI` (like the engine). |
| `opts.days` | `[d0, d1]`: the day range the beat will show. Prepared inside `createSlab` (cells, transitions, identity chain, 0.2-0.6 s per slab), and the identity chain starts at `d0` (see Determinism). Default: the whole run (slower build). |
| `opts.palette` | `'film'` (default) or `'viewer'` (the viewer's own colours, for side-by-side checks). |
| `opts.clot`, `opts.gel` | Clot sprites + fibrin threads on empty and MSC sites of the callus/marrow (default both on; the viewer starts with them off). `gel: false` keeps only the threads. |
| `opts.envIntensity` | Default 0.6 (= the film's `scene.environmentIntensity`; at the viewer's 1 the film's stronger key light washes the bone matrix out). |
| `opts.clipPlanes` | Extra world planes for every slab object (e.g. `[ctx.clipPlane]`). |
| `opts.lodPx` | On-screen radius (px at 1080 lines) from which a cell uses detail level 0 / 1 (default `[40, 14]`; below 14 px level 2). |
| `opts.renderOrder` | Added to the viewer's render orders (-1 nuclei and plate, 1 clot, 2 lacunae, 3 bone, 4 cartilage/fibrous/cortex, 6 cell bodies). |
| `group` | `THREE.Group` at the slab centre in the scene; `group.children[0]` (`slab.inner`) holds the viewer's frame (10 um units) through one matrix. Do not move it. |
| `centre`, `size`, `box` | Scene centre (Vector3), extent along scene x, y, z (Vector3, mm: 0.5, 2.8, 2.8) and `Box3` of the visible slab. |
| `range`, `days`, `region` | The prepared day range, the run's days (0..359) and the `bolgeler.json` entry. |
| `setDay(day, camera?)` | Fractional simulated day, clamped to 0..359. Between integer days the cells move, divide, differentiate, appear and fade exactly as the viewer's `hucreAni`, the matrix isosurfaces blend the two days' smoothed density, the clot fades where tissue-forming cells take a site. With `camera` (the frame's camera, final when beats run: `ctx.camera`), cells outside the view frustum are skipped and small ones use the coarser levels; without it every cell draws at full detail (fine for stills, slow for wide views). Cells whose bounding sphere misses the slab box are always skipped (invisible anyway). |
| `setTime(sec)`, `setOpacity(a)`, `setVisible(b)` | See above. Opacity 0 also hides the group. All materials are transparent from the start, so a fade never recompiles. |
| `warm(renderer, camera)` | `renderer.compile` on the slab with every part visible. |
| `focusDepth(camera, point = centre)` | View-space depth (mm) of a scene point: the BokehPass `focus` for a slab close-up (`state.dof = { focus: slab.focusDepth(ctx.camera), ... }`). |
| `viewerCamera(view)` | The viewer's three cameras in scene coordinates: `'yuz'` (face-on, 6.0 mm), `'egik'` (oblique, 6.5 mm), `'yakin'` (close, 1.6 mm); returns `{ pos, target, up, fov: 32 }`, up = scene +y (proximal up, as in the viewer). Director keys take `pos`/`target`; the director's default roll -90 then puts proximal left and the plate up. |
| `latticeToScene(i, j, k)` | Global lattice site -> scene Vector3. |
| `counts(day)` | Agents of the visible slab on an integer day by drawn type `{ msc, fibroblast, chondrocyte, osteoblast, osteocyte }`. |
| `transitionStats(day)` | Inferred events from `floor(day)` to the next day in the visible slab `{ stay, move, change, birth, appear, gone }`. |
| `stats()` | Last `setDay`: `{ day, cells, lod: [n0, n1, n2], triangles: { bone, cartilage, fibrous, cortex, plate } }`. |
| `dispose()` | Removes the group and frees its geometries and materials. |

`CELL_TYPES`, `MSC`, `FIB`, `KON`, `OB`, `OC` are exported too.

### Placement (scene mm, manifest `scene_transform`)

Lattice (i, j, k) -> model mm (i * 0.1 - 18, j * 0.1 - 18, k * 0.1) -> scene (x = -model x, y = model z - 20, z = model y). Every slab is 5 x 28 x 28 lattice sites, 0.5 mm along scene x by 2.8 mm along y (bone axis) and z (towards the plate), centred on lattice i = 180, so it **straddles the cut plane x = 0** (0.25 mm in front of the cut face, 0.25 mm behind). The cut face, the voxels and the hull bury the back half and the cut face hides the cells behind it: fade or clip them around `slab.box` during a stop (SPEC P3-2).

| Region | Scene centre | What the stop shows (agents in the visible slab) |
|---|---|---|
| `ilik_ucu` | (0, 14.95, -0.05) | The marrow opening at the proximal bone end face (y = 15). Only MSCs: 777 / 1423 / 2022 on days 0 / 9 / 30, in horizontal bands in the marrow (the model seeds every third layer) and growing into the clot. Clot gel deep red in the marrow, pink in the callus. No cortex or plate in the slab. Between days only divisions happen (about 70 a day to day 10, 15 a day by day 30; no migration is inferred). |
| `korteks_ucu` | (0, 15.95, -9.05) | The proximal cortex corner away from the plate: the intact cortex block (lamellar texture) and new woven bone beside it, osteoblasts (purple) on its surfaces, osteocytes (lilac) inside, MSCs around. Days 120 / 180 / 220: MSC 1537 / 1937 / 1951, osteoblasts 332 / 438 / 431, osteocytes 1112 / 620 / 618. Most change happens before day 150; 180-220 is almost still. |
| `plak_alti` | (0, 9.25, 7.75) | Under the plate (the slab's plate strip is at its +z edge and meets the macro plate's bone-facing face z = 9). Days 220 / 300 / 357: MSC 1476 / 2560 / 1847, bone cells 404 / 734 / 1346; cartilage with chondrocytes in lacunae (484) and a few fibroblasts (57) appear only near day 357. |

Checked in the real engine (`.hyperframes/cells-bench/engine.html`): each slab lands on its spot of the cut face, the `plak_alti` plate strip under the macro plate, the `korteks_ucu` cortex block on the macro cortex end.

### Determinism

- Everything drawn is a pure function of (day, camera, wobble time). Per-day structures (codes, cells with their orientations, transitions, smoothed fields) are memoised by integer day; bounded memos only ever drop entries that are recomputed identically.
- Cell identity: the viewer keyed a cell's look (shape variant, size, wobble phase, colour jitter) by its site, so a migrating MSC changed shape on arrival. Here a key travels along the inferred transitions (stay, move and change keep it; a division or an appearance gets a new one), chained from `opts.days[0]`. Keep `days[0]` fixed for a beat (it is part of the result); the chain is computed in `createSlab` for the range and lazily (still pure) beyond it.
- Checked: the same fractional day rendered after different previous days gives identical pixels (`det_*` runs of the bench).

### Cost (SwiftShader, 1920 x 1080, a remote 16-thread Linux machine under shared load; `.hyperframes/cells-bench`)

| View | Cells drawn (level 0/1/2) | Triangles | ms per frame (setDay + render) |
|---|---|---|---|
| whole slab, `egik` (6.5 mm) | ~4000 (0 / 3600 / 450) | 1.5 M | 750-1230 |
| slab filling the frame (3.6 mm) | ~3000 (700 / 2350 / 30) | 1.65 M | 2100-2600 (2.9-3.7 s with every cell at level 0) |
| close, `yakin` (1.6 mm) | ~1100 (900 / 200 / 0) | 1.0-1.2 M | 650-1500 |
| `ilik_ucu` (MSCs only) | 300-1300 | 0.3-1.2 M | 240-880 |
| `plak_alti` 357 rolled, 2.9 mm | 3750 | 2.3 M | 2200 |

`setDay` itself costs 10-30 ms; the rest is the render (triangle-bound: the cells are 750-1200 triangles each at level 0). Pass `ctx.camera` to `setDay`: without it a wide view draws ~1.5x the triangles. Levels 1 and 2 are the same cells (same PRNG draws) with about 1/3 and 1/5 of the triangles; at their switch sizes the difference is not visible. Nothing in a slab casts or receives shadows; `state.shadows = 0` during a stop saves the engine's shadow pass if the macro is faded out anyway. Build: 0.2-0.6 s per slab with its range, plus a first-use program compile (use `warm`).

### Look notes

- Cells: viewer shapes and materials; colours MSC `#d9a43a` (palette `stemCell`), fibroblast `#e07a8a` (`fibrous`), chondrocyte `#5aa0e0` (`cartilage`), osteoblast `#a46ad8` and osteocyte `#c9b3ea` (the viewer's), nuclei `#46337a`, lacunae `#d6ebfa`. Matrix: bone `#efe2c4` (`bone`), cartilage `#8dbbe6` (a lighter `cartilage`, as the viewer lightens its own), fibrous `#e07a8a`, intact cortex `#b3aa9b`, plate `#aab4bf` (`plate`); clot and fibrin keep the viewer's reds.
- Lights: the scene's camera-relative rig; the materials add the viewer's rim glow. Compared side by side with the viewer at the same days and cameras (`.hyperframes/cells-bench/viewer.mjs`, the viewer's frame is the mirror image of the true scene, so flip it): same cells, positions, matrix shapes and clot; the film's matrix is a little warmer and the plate greyer (the viewer's plate reflects a bluish room).
- Background inside a slab is the film's ground; holes in the matrix show it.

### Bench

`.hyperframes/cells-bench/` (run on the remote machine with `node`): `bench.html` + `bench.mjs` (the film's renderer and light rig around the slabs, no engine; shots from a JSON list, timing, determinism hashes, LOD equality check), `viewer.mjs` (screenshots of `hucre3b.html` served from a copy of the viewer folder, stage forced to 1920 x 1080), `engine.html` + `engine.mjs` (slabs inside the real engine, director overridden), `geo.mjs` (triangles per mesh), `shots/*.json`.

```bash
node .hyperframes/cells-bench/bench.mjs .hyperframes/cells-bench/shots/final.json .hyperframes/cells-bench/final
node .hyperframes/cells-bench/viewer.mjs <viewer-folder> .hyperframes/cells-bench/shots/viewer_all.json .hyperframes/cells-bench/all
```

## Pass 3 boundary keys (contract)

SPEC P3-1: 52 s, 1560 frames, 30 fps, eight beats. The timeline is data in
`assets/js/timeline.js` (`BEATS`, `BOUNDARIES`, `DURATION`), the engine loads the beats in its
`BEAT_IDS` order and `dive.html` / `index.html` carry `data-duration="52"`.

| Beat | Window (s) | Frames | Content | Day (track) | Module |
|---|---|---|---|---|---|
| b1 | 0-6 | 0-179 | defect and load, half cut at 4.0 s | 0 | `b1.js` (unchanged) |
| b2 | 6-14 | 180-419 | cell stop 1, `ilik_ucu` | 0 -> 30 | `b2.js` (pass-3 stub; the pass-2 close-up is in `/tmp/sgpass3/backup/b2.pass2.js`) |
| b3 | 14-20 | 420-599 | macro, three-quarter of the half callus | 30 -> 120 | `b3.js` (shortened, new keys) |
| c2 | 20-27 | 600-809 | cell stop 2, `korteks_ucu` | 120 -> 220 | `c2.js` (pass-3 stub) |
| c3 | 27-34 | 810-1019 | cell stop 3, `plak_alti` | 220 -> 357 | `c3.js` (pass-3 stub) |
| b4 | 34-40 | 1020-1199 | stiffness | 357, E replay | `b4.js` (pass 2 + 16 s) |
| b5 | 40-46 | 1200-1379 | strain | 357 | `b5.js` (pass 2 + 16 s) |
| b6 | 46-52 | 1380-1559 | decision plane, return arc | 357 | `b6.js` (pass 2 + 16 s) |

b4, b5 and b6 are the pass-2 beats with every absolute time + 16 s (`const SHIFT = 16` in each:
windows, camera keys, tween starts, pulses, the plane basis time); relative timings are
untouched, so they look as in pass 2. Their comments quote pass-2 frame numbers (+480 now).

### Boundary keys

Keep these keys EXACTLY (same t, pos, target, fov; no roll, near or hold on them) in both
beats that share them. Inner keys are free. Angles: azimuth about scene y from -x towards +z,
elevation towards +y, distance to the target (`keyAt` in b1/b2/b3/c2/c3).

| t (s) | beats | pos | target | fov | az / el / dist | frame |
|---|---|---|---|---|---|---|
| 0 | b1 | [-73.274, -15.549, 35.124] | [0, 1.5, 2.5] | 28 | 24 / -12 / 82 | close on the gap (pass-3 b1, unchanged) |
| 6 | b1 / b2 | [-58.04, -1.31, 23.95] | [0, 12, 0.5] | 28 | 22 / -12 / 64 | into the half-cut gap, the proximal bone end at the centre; first frame of the hero loop region (6.5-16.5 s); unchanged from pass 2 (an approved frame) |
| 14 | b2 / b3 | [-31.911, -1.143, 6.956] | [0, 13.5, -1] | 28 | 14 / -24 / 36 | b2's pull-out: the proximal half of the half callus from below the plate's level, the ilik_ucu spot (marrow opening) left of centre |
| 20 | b3 / c2 | [-29.652, 4.513, -4.465] | [0, 16.5, -5.5] | 28 | 2 / -22 / 32 | the proximal lobe, the cortex corner away from the plate (korteks_ucu) below and left of centre |
| 27 | c2 / c3 | [-40.697, -6.483, 2.846] | [0, 10, 0] | 28 | 4 / -22 / 44 | c2's pull-out and c3's start: the proximal lobe, korteks_ucu lower left, plak_alti (under the plate) above centre |
| 34 | c3 / b4 | [-77.836, -35.345, 2.079] | [0, 1, -2] | 28 | 3 / -25 / 86 | the pass-2 18 s key: three-quarter of the half callus (b4's orbit starts here) |
| 40 | b4 / b5 | [-86, 0, -2] | [0, 0, -2] | 28 | 0 / 0 / 86 | the pass-2 24 s key: face-on to the cut face |
| 46 | b5 / b6 | [-77.893, -4.082, -3] | [0, 0, -3] | 28 | 3 / -3 / 78 | the pass-2 30 s key: face-on, pushed in |
| 52 | b6 (= the 6 s key) | [-58.04, -1.31, 23.95] | [0, 12, 0.5] | 28 | 22 / -12 / 64 | the last frame rhymes with b2's first frame (loop rhyme) |

Inner keys as built (stubs, first cut by the timeline pass; the beat builders own them):
- b2: 7.0 s (18 mm, target (0, 14, 0.2)), 8.0 s (the slab, 5.5 mm, az 22, el -20, fov 30),
  9.8 s (3.8 mm), 11.4 s (closest, 3.0 mm, az 32, el -12), 12.4 s (7 mm), 13.2 s (17 mm).
- b3: 17.0 s (az 6, el -26, 72 mm, target (0, 2, -1.5)): the three-quarter of the half callus.
- c2: 21.0 s (15 mm), 22.0 s (the slab, 5.5 mm, az -8, el -20), 23.3 s (3.8 mm), 24.4 s
  (closest, 3.2 mm, az -18, el -12), 25.4 s (7.5 mm), 26.2 s (18 mm).
- c3: 27.9 s (15 mm, target (0, 9.5, 5)), 28.8 s (the slab, 5.5 mm, az 14, el -20), 30.1 s
  (3.8 mm), 31.2 s (closest, 3.2 mm, az 22, el -12), 32.1 s (7 mm), 32.8 s (16 mm), 33.4 s
  (38 mm).

Planner (`node .hyperframes/camera-plan/plan.mjs 0:52:0.5`, updated for pass 3: it reads the
beats from `timeline.js`, the day from `dayAt`, draws a stop's slab face during its window, the
cut face from 34 s and b6's plane from 46.4 s): the bone stays horizontal with the plate up at
every time; screen speed peaks 0.48 (b2 dive), 0.55-0.61 (c2/c3 dives), 0.63-0.65 (b2
pull-out, 12.5-12.75 s), 0.67 (c2 pull-out, 25.75 s), 0.65 (c3 pull-out, 33.0-33.5 s, which must
arrive at rest on the 34 s key, 86 mm); a little over the SPEC's 0.6, like pass 2's b2 dive
(0.7). Every stop holds 3.0-5.5 mm for 2.4-3.4 s at under 0.1 frame widths per second. Covered
share (reads about 0.1 high): 0.48 at 14 s, 0.49 at 20 and 27 s, 0.62 at 34 s; at day 30-120
the middle of the gap is still empty ground, so the macro keys of b2-c3 sit near the SPEC's
50 % limit (the b3 builder may tighten them, keeping the boundary keys).

### Day track

The day is one function of t for the whole film, `dayAt(t)` in `assets/js/timeline.js`
(exported again by `engine.js`, and `ctx.dayAt`): monotonic, continuous, and its rate is
continuous too (no rate jump at any boundary). It is a piecewise cubic Hermite through these
knots, with these slopes (days per second; the Fritsch-Butland PCHIP tangents of the knots,
written out as fixed numbers so the website can reproduce the track exactly):

| t (s) | 0 | 6 | 14 | 20 | 27 | 34 | 52 |
|---|---|---|---|---|---|---|---|
| day | 0 | 0 | 30 | 120 | 220 | 357 | 357 |
| slope m | 0 | 0 | 6.176471 | 14.643304 | 16.515973 | 0 | 0 |

Between knots (t0, d0, m0) and (t1, d1, m1), with h = t1 - t0 and s = (t - t0) / h:

```
day(t) = (2s^3 - 3s^2 + 1) d0 + (s^3 - 2s^2 + s) h m0 + (-2s^3 + 3s^2) d1 + (s^3 - s^2) h m1
```

day 0 for t <= 6 (b1 holds day 0), 357 for t >= 34. Some values: 8 s 2.4, 10.5 s 11.0,
12.5 s 21.1, 17 s 68.6, 22 s 148.0, 24.5 s 182.2, 29 s 264.0, 31.5 s 326.5. Checked: monotonic
on a 1 ms grid; the rate on both sides of 14 / 20 / 27 s agrees to 0.01 day/s.

Every beat writes `state.day = ctx.dayAt(t)` (or a constant that equals it: 0 in b1, 357 in
b4-b6). A slab is set with `slab.setDay(clamp(dayAt(t), days))`, its window's day range. b3's
bone overlay follows `dayAt(t)` after its own window, so its render-time gate (state day ==
its built day) holds through c2 and c3.

### Macro clip box (pass 3)

`state.macroClip = { centre, size, open }` (scene mm) cuts a box hole into the macro scene while
a stop shows its slab, so the cut faces, the voxels and the skins do not bury it (SPEC P3-2;
the slab straddles the cut plane x = 0). The engine builds six world planes with outward
normals and `clipIntersection` (a fragment is discarded only inside all six) and applies them
to every part of the half model (half skins, flat cut faces `*_half_cut`, the callus cut face,
the half hull), to the voxels and to `ctx.macroMaterials` (b3's bone overlay). The full model
(half < 1) keeps its half-cut plane only; the sweep (0 < half < 1) wins over the box on the
voxels. The shadow pass is not clipped. `open` scales the box about its centre along scene y
and z only (the face's extent), so the hole opens on the cut face like a window; `open` 0 or
`macroClip` null: no hole. Changing the plane count switches programs (cached after the first
time). The stubs use the slab's y-z footprint plus 0.05 mm and a shaft from 0.3 mm in front of
the cut plane to 5.7 mm behind it: `centre = slab centre + (2.7, 0, 0)`, `size = (6.0, 2.9,
2.9)`, and `open` = the slab's fade. A box only 0.4 mm deep (first try) left the 0.3 mm voxel
blocks deeper in standing right behind the cells as an amber wall (snapshots 8 and 10 s); with
the shaft the camera sees the ground through the slab, as in the cell viewer, and the macro
around the window stays as context.

### The stop stubs (b2, c2, c3)

Each stub (same template) creates its region's slab in `build` (`createSlab(ctx, region,
{ days })`, imported dynamically so the planner can import the module in node), warms it,
registers `ctx.shared.<id> = { slab, region, days }`, and in `update` (every t): slab visible
only while its fade is on; `setOpacity(fade)`, `setTime(t)`, `setDay(clamp(dayAt(t)), ctx.camera)`.
The fade (and the clip box's `open`) enters 0.7-1.5 s into the window (24 frames power2.out,
camera at about 15-8 mm) and exits 1.6-0.8 s before its end (24 frames power2.in). In its
window it writes `day`, `half` 1, `voxelOpacity` (b2: 1; c2, c3: 0.998 with `stemOpacity` 0.4,
b3's end look that b4 continues), `cutOpacity` 0, `hullOpacity` 0, `macroClip`, `slab`. Not in
the stubs yet: depth of field at the closest moment, cell-level choreography, any check of
SPEC P3-4's "two cell types in focus".

## Integration pass 3 (changes in behaviour; details in REVIEW3.md)

- Depth of field: drawn through `dofTarget` and the BokehPass onto the canvas, no longer
  through the EffectComposer (see "Look as built", Depth of field). The DOF frames now look
  exactly like their neighbours; the six on/off switches no longer pop.
- c2: while its clip box is fully grown (camera at or under 2.3 mm, about 23.0-24.2 s) it also
  writes `voxelOpacity = 0` (it already wrote `shadows = 0`), as c3 does while its shaft is
  open. The box hides every voxel and b3's overlay there anyway; the frames cost 1.2-1.35 s
  instead of 3.2-3.3 s.
- b1: inner keys K1 / K1b / K1c moved in (92 / 90 / 76 mm, fov 34 at 5 s); the boundary keys
  (0 s, 6 s) are unchanged.

Frame times after these changes (SwiftShader, 1920 x 1080, the idle remote machine, `/tmp/sgpass3/
intbench/intbench.mjs`): b2 close-up 1.05-1.15 s; c2 dive 2.6-3.0 s, close-up 1.2-3.0 s; c3
dive 2.6-3.0 s, close-up 1.9-2.3 s, pull-out 3.0-3.2 s (32.4-32.6 s, the heaviest frames of the
film); macro frames 0.4-1.2 s. The full table is in REVIEW3.md "Frame time".

## Pass 4 (2026-11-08): opening, voxel walls, duplicate cortex/plate, cell-type labels

SPEC "PASS 4" is the brief. Changes in behaviour:

- **Director before the builds.** `boot` makes the director (and `ctx.cameraAt`, `ctx.cameraKeys`)
  before the beats' `build`, so a beat can use the camera of any time while it builds (the stop
  beats choose their labelled cells there). The keys are static module data; nothing changed in
  the director itself.
- **`macroClip.keep`** (array of part names or groups, e.g. `['cortex_prox']`): parts the box
  leaves whole. c2 keeps the proximal cortex, so the macro cortex is the one cortex next to its
  cells.
- **`createSlab(ctx, name, { hide: ['cortex' | 'plate'] })`**: fixed lattice tissues the slab
  does not draw (c2 hides its cortex block, c3 its plate strip; the macro cortex and plate are
  the context). Pass 3 drew both copies; the slab's lighter, rounded copy read as a "brick"
  in front of the macro cortex (c2) and as a second steel bar under the macro plate (c3).
- **Voxel walls at the stops.** `createSlabBackdrop(ctx, slab, { depth, zMax })` (slab.js) puts
  a ground-coloured, unlit plane 0.36 mm behind a slab over its footprint (opacity = the slab's
  fade, render order -2): through the cells the camera sees the paper ground instead of the clip
  box's side walls, while the voxels around the window stay as context. c2 and c3 use it. c2's
  box now grows while the camera closes from 8.5 to 6.0 mm (was 3.0 to 2.3; about 21.45-21.7 s
  and back at 25.15-25.4 s) to `[19, 26, 18]` mm, so no voxel is in view below 6 mm (voxels and
  the shadow pass are then off). c3's shaft grows by camera distance, 6.0 to 4.4 mm (about
  28.7-29.4 s and back at 32.35-32.5 s; was on the clock, 29.0-29.6 s), and reaches 11 mm
  towards -y. b2's voxel shrink box runs 8 mm behind the slab (`SHAFT_DEPTH`), so the stem-cell
  blocks seen through the slab dissolve with the front.
- **b1 camera** re-planned close (see b1.js header); the 6 s key is unchanged.

### Cell-type labels (pass 4, `assets/js/labels.js`)

The owner asked for the cell types visible at each stop, each with a line and its English name
(SPEC "PASS 4"). This is the only text in the film.

```js
// in a stop beat's build (after createSlab):
import { pickLabels, labelFade } from "../labels.js";
labels = pickLabels(ctx, slab, [
  { id: "c2-osteoblast", type: 3, text: "Osteoblast", tIn: 22.55, tOut: 24.6, region: [x0, y0, x1, y1] },
  // ...
], { days: DAYS, dayAt });
// in update(t), every frame inside the window:
for (const L of labels) {
  const f = labelFade(t, L.tIn, L.tOut, util); // { dot, line, textAlpha, alpha }
  if (f.alpha > 0) ctx.labels.add({ id: L.id, text: L.text, anchor: L.anchor, offset: L.offset, ...f });
}
```

| Member | Meaning |
|---|---|
| `ctx.labels.set(list)`, `ctx.labels.add(...items)` | This frame's labels. The engine empties the list before the beats' `update` and draws it after the render. Item: `{ id, text, anchor: [x, y, z]` scene mm, `offset: [dx, dy]` px at 1080p (dot to the end of the leader), `dot`, `line`, `textAlpha`, `alpha` 0..1 `}`. Up to five labels (the slots in `dive.html`). |
| `ctx.labels.measure(text)` | Text width in px with the label font (canvas `measureText`, after the font has loaded). |
| `labelFade(t, tIn, tOut, util)` | The dot appears (10 frames), the line draws out from it (12 frames), the text fades in (14 frames from 4 frames after the dot), all `power2.out`; the whole label leaves over 12 frames `power2.in` ending at `tOut`; `alpha` is 0 outside `[tIn, tOut)`. Stops stagger `tIn` by 7 frames. |
| `pickLabels(ctx, slab, specs, { days, dayAt })` | Chooses each label's cell and text side in build (below); returns the specs that have a cell, with `anchor`, `offset`, `site`, `key` and a `report`; `ctx.labelReport` collects every stop's picks and the dropped labels with the reason. |
| `slab.stableCells(type, d0, d1)`, `slab.cellsOn(day)`, `slab.sitePosition(site)`, `slab.cellRadius(type)`, `slab.typeName(type)` | The slab data behind it (cells.js API, pass 4). |

**The fixed rule (pickLabels).** For each spec, in order:
1. The label's days are the integer days of the slab's clamped day track over `[tIn, tOut]`.
   If `slab.counts(day)` has no cell of the type on any of them, the label is dropped (no label
   names a type the data does not show there).
2. Candidates: cells of the type that keep their identity key, their type and their site on
   every one of those days, inside the visible slab (`stableCells`). Between those days they
   are drawn as "stay" cells, so the cell centre (the dot) is a fixed scene point.
3. At every sample (every even film frame of the window, the director's camera; one frame grid
   for all labels, so staggered windows line up), the cell's projection must lie inside the
   spec's `region` and 120 px inside the frame's sides (110 px top and bottom), and at least
   170 px from the dots of the labels placed before it.
4. Ranking: the largest distance from the focal plane over the window (every stop focuses on
   the camera target, `focus = camera distance`), in 0.02 mm steps; then the mean distance from
   the region's centre; then the lowest site index.
5. In that order, the first candidate that is not hidden (at the middle sample no other cell of
   that day lies in front of it within 0.8 of its projected radius) and whose text finds a
   place (6) is taken; if none does, the label is dropped.
6. Text side: of 32 offsets (left or right; 40, 80, 120 or 160 px up or down; a horizontal run
   of 0.55 |dy| + 70 or + 150 px), the one whose text box stays inside the 80 px safe margins,
   clears the labels placed before it (boxes 14 px apart, no leader under another text, no
   crossing leaders) at every sample, and covers the fewest projected cells over the window
   (plus 0.02 per px of leader). The label keeps that offset for the whole window.

**Per frame (engine, `makeLabelOverlay`).** The anchor is projected with the frame's camera;
the leader runs from the dot at 45 deg (or steeper) to an elbow, then horizontally to the
text. The label fades out (pure in t) when the depth of field blurs its cell: blur =
|depth - focus| x aperture x 1920 px, faded from 4 to 7 px; and within 30-70 px of the frame
edge. The text is shifted continuously to stay inside the 80 px safe margins. Writes only the
attributes of five pre-made SVG slots (`#dive-labels` in `compositions/dive.html`), never DOM
structure (except the text node's content when the text changes).

**Look (the site's Midnight style).** Mona Sans (`assets/fonts/MonaSans-latin-var.woff2`, the
site's `--font-display`; `@font-face` in `dive.html`, loaded with `document.fonts.load` inside
the build-ready promise), weight 500, 28 px, ink `#e7f0f9`, a 6 px ground-colour halo under
the text at 55 % (`paint-order: stroke`); leader 1.75 px ink at 70 % over a 4.5 px ground
halo at 40 %; dot 7 px ink with a 1.5 px ground ring. No boxes, backgrounds or arrowheads.

`assets/fonts` must be copied to the remote machine with the code (pass 4).

### The labels as built (pass 4)

| Stop | Label | On (fade in starts) | Off (fade out ends) | Days | Cell (site) | Off focal plane |
|---|---|---|---|---|---|---|
| b2 `ilik_ucu` | Mesenchymal stem cell | 9.55 s | 11.6 s | 7-17 | 8616 | 0.11 mm |
| c2 `korteks_ucu` | Osteoblast | 22.55 s | 24.6 s | 155-184 | 8793 | 0.04 mm |
| | Osteocyte | 22.78 s | 24.6 s | 158-184 | 8716 | 0.32 mm |
| | Mesenchymal stem cell | 23.02 s | 24.6 s | 161-184 | 5184 | 0.04 mm |
| c3 `plak_alti` | Osteoblast | 30.1 s | 32.4 s | 292-344 | 6445 | 0.05 mm |
| | Osteocyte | 30.33 s | 32.4 s | 298-344 | 6441 | 0.04 mm |
| | Mesenchymal stem cell | 30.57 s | 32.4 s | 304-344 | 8868 | 0.04 mm |
| | Chondrocyte | 31.75 s | 32.55 s | 331-346 | 5459 | 0.06 mm |

Dropped by the rule (the data): c2 "Fibroblast" (no fibroblast in the slab at days 155-184) and
c3 "Fibroblast" (1-15 fibroblasts exist from day 325; 8 keep their site through 331-346, none
of them inside the frame for the whole window). The chondrocyte label is short (about 0.4 s at
full opacity): the run has chondrocytes only from day 325 (31.4 s), at the end of the stop. The fade-out of each label is the last 12 frames before "Off". Frame time
with labels (SwiftShader, lease): 0.8-1.5 s at the labelled close-ups; the c3 pull-out (32.4-
32.6 s, no labels from 32.55 s) stays the heaviest at 3.1-3.3 s.
