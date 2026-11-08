# REVIEW3: integration, pass 3 (2026-11-07)

Scope: the eight pass-3 beats (b1 b2 b3 c2 c3 b4 b5 b6) as one 52 s take, against SPEC.md
(the "PASS 3" section wins, then "PASS 2"). Every frame below was rendered on a remote 16-thread
Linux machine (SwiftShader, `hyperframes snapshot --no-browser-gpu`, 1920 x 1080) and
every PNG was read. Nothing ran in a browser on the development machine.

Empty ground is measured the way REVIEW2 did it: the share of pixels in the ground colour
range (`#02071d` and its fog: r <= 16, g <= 26, 20 <= b <= 56) of the 1920 x 1080 frame.

Snapshot folders (local copies): `~/silicograft-tools/remote-out/integrate*/`. First round
(before the fixes): `integrate/204738-*`, `integrate2/204721-*`, `integrate3/204719-*`; extra
in-stop frames `integrate2/*` and `integrate3/*` of 20:5x; final round (after the fixes):
`integrate2/` and `integrate3/` of 21:4x. 960 px copies and montages: `/tmp/sgpass3/int/r1..r5/`.

## Check

`hyperframes check --json --no-browser-gpu`: `ok: true`, 0 errors, before and
after the fixes. Kept on purpose, as in pass 2:

- `console_warning` x7, "GPU stall due to ReadPixels": SwiftShader noise from the capture.
- `film_silent` and the info `audio_none`: SPEC OUTPUT says silent.

## Fixes made in this pass

| # | Rank | Where | Problem | Change |
|---|---|---|---|---|
| 1 | P0 | 9.6, 11.57, 22.33, 24.7, 30.03, 32.2 s · `engine.js` render | Every switch of the depth of field on or off was a pop. The DOF frames went through the EffectComposer (half-float RenderPass, then OutputPass), where transparent materials blend in linear light before tone mapping; the canvas blends them after it. At the six switch frames the mean channel value jumped by +13 to +24 (on) and -13 to -22 (off), against about 1 between neighbouring frames; the clot gel and the translucent cells flared up for the whole close-up of each stop (SPEC BANNED: a state that pops) | A DOF frame is now drawn exactly as the canvas draws it, into `dofTarget`, an 8-bit non-MSAA render target flagged `isXRRenderTarget` (three r170 then tone-maps and sRGB-encodes in the shaders and stores the encoded bytes, like the canvas), and the BokehPass composite reads it and draws onto the canvas. Measured again at the six frames: the change there is 0.0-2.4 per channel, the same as between any two neighbouring frames. Details in ENGINE.md "Look as built", Depth of field |
| 2 | P1 | 22.6-24.5 s · cost | With fix 1 drawn on the MSAA canvas plus a copy (first try), the c2 close-up cost 3.2-3.9 s per frame, over the 3.5 s budget | Fix 1's non-MSAA target (2.9-3.0 s at 22.6 and 24.5 s). And `c2.js` hides the voxels while its clip box is fully grown (as c3 already did): the box clips every voxel and b3's overlay out of view there, so the frames are unchanged (checked side by side at 23.6 s) and 23.0-24.0 s drop from 3.2-3.3 s to 1.2-1.35 s |
| 3 | P2 | 2.5-5.5 s · `b1.js` keys K1, K1b, K1c | The wide moves to the loaded end and back were 66 % (3 s) and 72 % (5 s) empty ground: a thin 200 mm rod far away | K1 112 -> 92 mm (target y 64 -> 72), K1b 106 -> 90 mm (target y 56 -> 62), K1c 86 -> 76 mm with fov 36 -> 34 (target y 36 -> 40). Now 59 % at 3 s and 61 % at 5 s; both load marks read whole at 2-4.6 s and their tails at the left edge at 5 s; planner screen speed at most 0.57 (5.5 s), bone horizontal and plate up throughout. The boundary keys (0 s, 6 s) are untouched |

Backups of every file before these edits: `/tmp/sgpass3/backup/integrate/` (`js_before/`,
`b1.orig.js`, `c2.orig.js`, `engine.canvascopy.js`, `ENGINE.pre-int3.md`).

## QA frames (P3-4), final round

"Empty" is the measured share. b2, c2 and c3 frames are judged against P3-4's cell-stop line
("recognisable cells of at least two types, matrix and context (cortex or plate) in focus").

| t (s) | Must show | Shows | Empty | Verdict |
|---|---|---|---|---|
| 0 | b1 opens close: the gap and both bone ends fill the frame (P3-1, owner's choice) | the gap under the plate, both bone ends with the day-0 amber stem-cell rims (the proximal end's cut ring shows the red marrow), one screw tip at lower left | 54 % | met. The gap is empty at day 0 (the run), hence the ground |
| 3 | the load marks readable (P3-3) | the loaded proximal end, the axial arrow and the bending arc in ink, the plate with three screw heads, the screw tips below | 59 % (66 % before fix 3) | met |
| 5 | the arrows, or their tails (P3-3), the half cut | the half model: steel plate, the three proximal screws cut (light bars), red marrow and grey cortex in section, the amber rim at the gap end; the arrow tails at the left edge (fading, exit at 5.3 s) | 61 % (72 % before fix 3) | met. Still over half ground: a thin rod in 16:9 (Remaining 4) |
| 8 | b2 dive: the window opens on the marrow opening | MSC spindles on the red marrow section (left), the amber voxel blocks shrinking in a column at the bone end, the clot side dark with pink gel (right) | 28 % | met (transition frame) |
| 10.5 | cell stop 1 among the cells | MSCs (amber spindles with nuclei and processes) dense on the red marrow (left) and spreading into the clot (right, dark with pink gel and fibrin threads), the bone-end edge as a thin vertical line; light DOF | 18 % | PARTLY: cells recognisable, context (marrow, bone-end edge) in focus. Only ONE cell type: the run has only MSCs in `ilik_ucu` at days 0-30 (Remaining 1) |
| 12.5 | b2 pull-out | MSC layer on the marrow section, the amber blocks regrowing at the bone end, ground beyond | 33 % | met |
| 17 | b3: three-quarter of the half callus, days 30-120 | plate on top, both bone ends in section, translucent amber callus lobes with the first ivory bone at the cortex ends, the empty middle | 46 % | met |
| 22 | c2 among the cells | the intact cortex block (lamellar, lacunae) on top, the new woven bone (ivory matrix) under it with osteoblasts (violet) on its surfaces and osteocytes (lilac) inside, MSCs around and in the cavity, voxel walls at the frame edges | 2 % | met: three cell types, matrix, cortex context |
| 24.5 | c2 closest, the cavity refilled | cortex roof, the U-shaped bone wall with osteoblasts and osteocytes, MSCs filling the cavity, the ground through the cavity | 2 % | met |
| 29 | c3 dive among the cells | the slab's plate strip on top under the macro plate, ivory bone with osteoblasts/osteocytes, MSCs, the window's voxel walls | 14 % | met |
| 31.5 | c3 close: bone under the plate | the plate edge along the top, the bone band (ivory matrix, osteoblasts, osteocytes) right, MSCs in the clot left, light DOF. Cartilage starts at about day 325 and reads from 32.0-32.4 s (blue matrix with chondrocytes; snapshot 32.4 s) | 17 % | met (two cell types + matrix + plate here; three types at 32.4 s) |
| 37.33 | stiffness map, bright bone ends | viridis map: violet callus, teal-yellow at the cortex ends and under the plate, the cortex cut faces yellow, the marrow blue | 38 % | met |
| 43.33 | strain map, arrows thicker | magma map, the ink axial arrow on the proximal marrow and the moment arc at lower left at the pulse | 33 % | met |
| 49.33 | points in flight / settling in the plane | points streaming from the strain face to the decision plane below, the region fills (20 %) and their ink outlines readable, ivory bone cluster, grey and coral points, blue cartilage strip | 36 % | met |
| 51.97 | the last frame rhymes with b2's first (6 s) | the camera at the 6 s key: the half callus at day 357 (translucent amber with ivory bone, blue and coral flecks along the plate), the azure return arc into the stem-cell layer | 40 % | met |

Every QA frame is horizontal with the plate up (planner, all 52 s) and shows at least three
palette colours.

## Beat boundaries (t +- 0.1 s)

| Boundary | Camera | Day | State and objects | Verdict |
|---|---|---|---|---|
| 5.9 / 6.1 (b1 / b2) | no stop; the dive starts out of b1's return (planner 0.10 frame widths/s at 6 s) | 0 / 0.01 | half 1, day-0 amber voxels at full opacity on both sides; the arrows are gone (exit at 5.3 s) | continuous. 55 / 54 % empty: the fixed 6 s key looks into the empty day-0 gap (Remaining 3) |
| 13.9 / 14.1 (b2 / b3) | no stop: b2's pull-out runs into b3 | 29.4 / 30.6 | slab and window gone by 13.25 s; voxels at 1 on both sides, same blocks | continuous. 51 / 54 % empty (contract key, Remaining 3) |
| 19.9 / 20.1 (b3 / c2) | no stop | 118.5 / 121.5 | translucent amber with ivory bone (stem opacity 0.4) on both sides, no slab yet (window opens 20.6 s) | continuous, 52 % empty both |
| 26.9 / 27.1 (c2 / c3) | no stop | 218.4 / 221.7 | c2's slab and window closed by 26.2 s; the same macro look on both sides | continuous, 51 / 47 % |
| 33.9 / 34.1 (c3 / b4) | c3's pull-out runs into b4's orbit on the 86 mm key without a stop | 356.9 / 357 | c3's slab gone by 33.75 s; voxels 0.998 with the bone overlay on both sides; b4's cut face enters from 34.0 s on bone pixels | continuous, 49 / 51 % |
| 39.9 / 40.1 (b4 / b5) | the orbit lands face-on, b5's push begins | 357 | day-357 E map on both sides; b5's axial arrow enters at 40.0 (18 frames power2.out, faint at 40.1) | continuous (an enter, not a pop), 38 % |
| 45.9 / 46.1 (b5 / b6) | no stop | 357 | strain map on both sides; b5's marks finish their 12-frame exit at 46.0 (fading at 45.9, gone at 46.1) | continuous (an exit), 30 / 31 % |

Inside the stops (in-between frames, first round): 6.8, 7.3, 9.0, 9.6, 11.8, 13.3 (b2), 20.9,
21.4, 21.8, 23.0, 25.5, 25.9 (c2), 27.9, 28.3, 29.3, 29.7, 32.4, 33.2 (c3), 1.5, 4.1, 4.3, 4.5
(b1), 15.5, 18.5 (b3). The windows open and close on the clock with the slab fade, the voxels
regrow far to near (b2), c2's and c3's clip boxes widen and narrow behind the slab without a
jump, the half-cut sweep at 4.0-4.6 s reads as one clean cut with capped solids (no plate flap,
no whole screw cylinders: the pass-2 leftover is fixed). The DOF switches were the one pop
found (fix 1).

## SPEC BANNED, checked on the frames

- Glow, bloom, flares, rays, decorative particles: none. The cells' rim term is the viewer's
  membrane shading, not a glow pass.
- A small object floating in an empty frame: none; the cell frames are full.
- Text, labels, HUD, borders: none (the decision plane has ticks only).
- Orbiting for its own sake: only b4's orbit. Cuts: none.
- Background gradients, glass panels: none.
- Colours outside the palette: the slab colours are the viewer's, mapped onto the palette as
  P3-2 allows (MSC amber, bone ivory, cartilage blue, fibrous coral; osteoblast violet,
  osteocyte lilac, nuclei, the clot and fibrin reds are the viewer's own hues, allowed by P3-2).
- Invented data: nothing added in this pass. Fix 2 hides voxels that the clip box already
  removed from view.
- Pops at a boundary: none at the eight boundaries; the DOF pops inside the stops are fixed.
- Dark metal, vanishing screws: the plate reads as bright brushed steel; screw heads read as
  darker discs (3 s), cut screws as light bars (5 s).
- The camera at rest on a mostly empty frame: the film's first frame rests (the director rests
  at the first and last key) at 54 % empty (Remaining 3).

## Remaining (not fixed, ranked)

1. P1 · 9.7-11.5 s · stop 1 shows ONE cell type. P3-4 wants two types in every cell-stop
   frame; `ilik_ucu` at days 0-30 holds only MSCs in the run (plus the clot gel, the fibrin
   threads and the marrow). Making another type appear would invent data. Options for the
   owner: read P3-4 "two cell types" across the tour (c2 shows MSCs, osteoblasts, osteocytes;
   c3 adds chondrocytes), or show stop 1 at a later day range, which changes the story order
   (stem cells move in first).
2. P2 · 9.7-11.5 s · "context (cortex or plate) in focus": the slab sits inside the marrow canal
   and the cortex cut face is about 3 mm away in z, outside a frame that shows cells. The
   context in focus is the red marrow and the bone-end edge. The cortex and screws read in the
   7.0-7.3 s and 13.3-14 s macro frames around it.
3. P2 · 0, 5.5-6.5, 13.5-14.5, 19.5-20.5, 26.5-27.5 s · 50-55 % empty ground at the macro keys
   of the contract (planner cover 0.46-0.49). At days 0-120 the middle of the gap is still empty
   in the run, and the keys are the hero loop's first frame (6 s) and the boundaries the beat
   builders worked to. Tightening them means re-planning the neighbouring beats together.
4. P2 · 2.5-5.5 s · still 58-61 % empty after fix 3: the wide move to the loaded end has to hold
   the arrows and the bone end, and the bone is a thin rod in a 16:9 frame.
5. P3 · 8.0 and 12.5 s · about a quarter of the frame is the flat red marrow section (b2's
   backdrop at x = 0.36) without cells in front of it. It is the run's marrow, lit flat.
6. P3 · inside c2 and c3 the slab's own cortex block (c2) and plate strip (c3) are drawn with
   the viewer's look (lighter, lamellar cortex; a rounded steel bar for the plate) and sit just
   in front of the macro cortex face and under the macro plate; at 20.9-21.4 and 25.5-25.9 s the
   slab's cortex reads as a lighter brick on the macro cortex. It is the data's cortex mask.
7. P3 · DOF frames have no MSAA (fix 1); under the blur no difference was seen.

## Frame time

SwiftShader, 1920 x 1080, on the lease while it was otherwise idle (load about 0.6 before each
run), `intbench.mjs` (the real engine outside HyperFrames: two warm renders, then one timed
render with a `readPixels` sync; temporary, kept in `/tmp/sgpass3/intbench/`, never in the film).

| t (s) | what | ms (before fixes) | ms (after) |
|---|---|---|---|
| 0 / 4.3 | b1 close / sweep | 390 / 434 | - / 528 |
| 8 / 9 | b2 dive, slab + shrinking voxels | 765 / 982 | |
| 10 / 10.5 / 11.5 | b2 close-up, DOF | - / 868 / 959 | 1050 / 1144 / 1132 |
| 12.2 / 12.8 | b2 pull-out, voxels regrowing | 1212 / 1180 | |
| 15 / 17.6 | b3 macro | 529 / 642 | |
| 21.5 / 22 | c2 dive, slab + voxels + shadows | - / 3007 | 2577 / 2983 |
| 22.6 / 23 / 23.6 / 24 / 24.5 | c2 close-up, DOF | 2897 / - / 2517 / - / 2802 | 2982 / 1217 / 1236 / 1346 / 2893 |
| 25 / 26 | c2 pull-out | 2428 / 1527 | |
| 28.7 / 29.3 | c3 dive, slab + voxels + shadows | 2641 / 2963 | 2645 / 3021 |
| 30.5 / 31.5 | c3 close-up, DOF | 1320 / 1256 | 2326 / 1929 |
| 32.4 / 32.6 / 33 | c3 pull-out, slab + voxels | - / 3089 / 2130 | 3201 / 3046 / - |
| 37.33 / 43.33 / 49.33 / 51.97 | b4 / b5 / b6 / last frame | 1217 / 361 / 964 / 1117 | |

The heaviest frames are the c2/c3 dives and pull-outs, where the whole slab (about 3000-4000
cells, 1.5-2 M triangles) and the macro voxels with their shadow pass are drawn together:
2.6-3.2 s. Every measured frame is under 3.5 s. The c3 close-up got 0.6-1.0 s slower with
fix 1 (the "before" column skipped tone mapping in the shaders and blended in half float);
it stays well inside the budget.

## Render

- `renders/silicograft-dive.mp4`: rendered on the remote machine after all fixes (`hyperframes render
  --fps 30 --quality delivery --workers 8`), 34 min 33 s. ffprobe: h264, yuv420p, 1920 x 1080,
  30/1 fps, 1560 frames, 52.000 s, 139 MB. Decoded frames at the DOF switches (286-289,
  899-902, 965-966) change their mean value by under 2.7 per channel per frame: no pop.
- `renders/draft3.mp4`: 960 x 540 from it (libx264 CRF 24, 30 fps, 52.0 s, 10 MB).
  `draft.mp4` and `draft2.mp4` are kept.
- `renders/draft3_sheet.jpg`: 4 x 3 sheet decoded from the render at 0, 3, 5, 10.5, 17, 22,
  24.5, 31.5, 37.33, 43.33, 49.33 and 51.97 s (8, 12.5 and 29 s are in the QA table only).

What was measured: check, empty-ground shares, the image change at the DOF switches, frame
times, the planner's speeds and framing. What was only looked at: colour reads, depth, cell
types, the story order. Nobody heard anything (the film is silent).
