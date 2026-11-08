# REVIEW: integration pass (2026-11-07)

Scope: the six beats together as one take, against SPEC.md. Everything below was seen on
SwiftShader frames from `hyperframes snapshot --no-browser-gpu` (one browser at a time, under
`/tmp/silicograft-browser.lock`) and on a 10 fps draft render (`renders/draft.mp4`).
Before-fix frames: `/tmp/sgint/s1/`. After-fix frames: `/tmp/sgint/s2/`, `/tmp/sgint/s3/`.

## Check

`npx hyperframes check --json --no-browser-gpu`: ok, 0 errors. Warnings kept on purpose:

- `console_warning` x7, "GPU stall due to ReadPixels": SwiftShader driver noise from the
  capture readback, not from the composition.
- `film_silent`: SPEC OUTPUT says silent (the frames serve a scroll story and a muted hero loop).

## QA frames: what they show against what they must show

| Frame (s) | Must show | Shows (after fixes) | Verdict |
|---|---|---|---|
| 0 (0) | the whole plate with six screws, the gap, on the paper ground | three-quarter wide shot, bone vertical through the frame centre, the whole plate, all six screw heads as light discs, the gap between the bone ends, ground #02071d | met. Before: the plate read as a black slab and the three distal screws were invisible (fixed, see 1) |
| 150 (5) | the half cut, the arrows in accent | the half model (cortex, marrow and cut screws visible), the 823 N arrow on the proximal end face and the moment arc in #6bcbf7 | met. The axial shaft runs off the top edge (b1's choice, the head and arc are in frame) |
| 300 (10) | stem cells as cells in focus, the bone end out of focus | about 1,000 procedural MSCs at true scale, a sharp band of cells with nuclei, the bone end face a blurred grey band, cells in front and behind blurred | met |
| 450 (15) | ivory bone voxels along the plate, an empty middle | the half callus in voxels at day 340, translucent stem cells (0.53), ivory bone patches along the plate and under both bone ends, the middle of the gap empty | met after the day-track fix (see 3). The bone along the plate is seen nearly edge-on from this three-quarter view, so it reads as patches, not a band |
| 640 (21.33) | the cut face as a stiffness map with bright bone ends | face-on-ish cut: callus on the E map (day ~157 of the replay, mostly dark granulation with brighter elements along the plate and at the bone ends), the cortex cut faces at the top of the map (#e7f0f9), the marrow dark blue | met after fix 2. Before: the bone ends stayed cortex grey |
| 820 (27.33) | the strain map, the arrows thicker | the strain map (bright, high strain in the middle of the gap; dark, low strain along the plate and the bone ends), both arrows at the pulse peak beside the callus | met |
| 1000 (33.33) | points in flight toward the plane | 24,698 points streaming from the cut face to the decision plane on the left, the plane's region rectangles and axes | met |
| 1079 (35.97) | points settled in the plane regions, the return arc complete | points in the regions (bone wedge ivory, fibrous, cartilage, resorption), the 1.5 px accent arc from the bone points back to the stem cell layer under the proximal bone end, camera at b2's first key | met |

The pictures alone tell the loop in order: a plate over a gap, the load, cells at the bone end,
tissue filling against the plate, a stiffness map, a strain map, points sorted into regions, a
line back to the cells.

## Continuity at the beat boundaries

| Boundary | Camera | State | Objects | Verdict |
|---|---|---|---|---|
| 5.9 / 6.1 (b1 / b2) | shared key at 6 s, speed 0 on both sides | half 1 both sides; day 0 | b2's stem-cell voxels enter over 18 f from 6 s (they are the beat's subject, so the enter is the read, not a pop) | ok. The push into the gap peaks at about 320 mm/s around 5.5 s and stops at 6 s before the dive starts; in the draft this reads as one push with a short breath |
| 11.9 / 12.1 (b2 / b3) | shared key at 12 s, speed 0 on both sides | day continuous with matched rate (10 days/s) | voxels on both sides | ok after fix 5 (the frame at rest was three quarters empty) |
| 17.9 / 18.1 (b3 / b4) | shared key at 18 s | b3 left stem cells at 0.4 opacity; b4 reset them to 1 | voxels | fixed (4): b4 now keeps b3's stem opacity while the voxels exit |
| 23.9 / 24.1 (b4 / b5) | shared face-on key at 24 s | E map at day 357 on both sides | b5's arrows enter over 18 f | ok |
| 29.9 / 30.1 (b5 / b6) | shared key at 30 s | strain map both sides | voxels were off in b5 and switched on at frame 900 (a staircase edge popped on the callus outline) | fixed (6): 18 f enter |

## Notes and fixes (P0 breaks the contract, P1 weakens the film)

1. P0 · t=0 · steel. The #364868 metal at the SPEC environment 0.5 reflected almost nothing:
   the plate read as a black slab and the three distal screw heads were invisible. Fixed in
   `engine.js`: the plate and the screws carry their own envMap (same PMREM room, rotation tied
   to `state.envRotation`) at 1.6 and 2.0; the screws are less metallic (0.6) so the heads catch
   the key light. The rest of the scene keeps 0.5. This departs from the SPEC number on purpose.
2. P0 · t=21.33 · "bright bone ends" were cortex grey. Fixed in `engine.js` (field colouring):
   in E mode the cortex and marrow cut faces take the moduli the run gives in
   `manifest.codes.region_material_MPa` (17000 and 2 MPa) on the same log map; they return to
   their material colour as the face blends to strain (the run has no strain for them). Data,
   not decoration.
3. P0 · t=15 · no ivory bone along the plate: the day track reached only day 222 by frame 450,
   and in this run most of the bone along the plate forms after day 300. Fixed in `b3.js`: the
   Hermite day track now ends at 15.5 s instead of 17.5 s (day 340 at 15 s); the beat holds day
   357 while the camera settles. Same start rate as b2's end, still monotonic.
4. P1 · t=18.0 · b3's translucent stem cells snapped back to opaque on frame 540, hiding the
   bone b3 had just shown. Fixed in `b4.js` (keeps `stemOpacity` 0.4 and a transparent voxel
   material while the voxels leave).
5. P1 · t=11.6-13 · the camera came to rest at 12 s on a frame with the bone end in its top
   quarter and empty ground below. Fixed in `b2.js` and `b3.js` (the shared key's target moved
   from y 8 to y 12, identical in both): the bone end and the cell layer now sit in the upper
   middle. The gap below is still empty at day 30, which is the data.
6. P1 · t=30.0 · voxels popped on at frame 900. Fixed in `b6.js` (18 f power2.out enter).
7. P1 · t=30-36 · the resorption region and its points used #5c646f, which is not in the
   palette. Fixed in `b6.js`: the palette's nearest entry, cortex #596475 (visually the same).

## Defaults that slipped in, now on SPEC's BANNED line

- metal so dark it reads as a black slab; screws vanishing into the plate (1)
- an object or a state that pops on or snaps at a beat boundary (4, 6)
- colours borrowed from another document that are not in the palette (7)
- the camera coming to rest on a mostly empty frame (5)

Checked and not present: glow, bloom, lens flares, light rays, decorative particles (the b6
points are the 24,698 elements), text, labels, HUD, borders, background gradients, glass
panels, cuts. The b6 plane's 12 % region fills read as a chart, not a glass panel.

## Profile (SwiftShader, 1920 x 1080, this machine, `engine-bench`)

| t (s) | what | ms |
|---|---|---|
| 0 | whole model | 133 |
| 4.3 | the half cut sweeping | 248 |
| 8.7 / 9.5 / 10 / 10.8 | b2 close-up, cells + BokehPass | 2267 / 2492 / 2588 / 2377 |
| 14 / 15 / 17.6 | b3 voxels + bone overlay | 723 / 1106 / 1231 |
| 18.3 | b4 cut face fading in over the voxels | 994 |
| 21.33 / 27.33 | E map / strain map | 428 / 315 |
| 33.33 / 35.97 | b6 points, plane, voxels | 901 / 884 |

Heaviest frame 2.6 s (the depth-of-field close-up), under the 4 s budget, so no detail was cut.
The 10 fps draft (360 frames, 1 worker, capture and encode included) took 5 min 47 s, 0.95 s
per frame.

## Draft

`renders/draft.mp4`: the whole film, 960 x 540, 10 fps, rendered by
`hyperframes render --no-browser-gpu --fps 10 --quality draft --workers 1` at 1920 x 1080 (the
CLI has no 960 x 540 preset and the canvas is fixed at 1920 x 1080) and scaled with FFmpeg
(lanczos, CRF 20), from the final code (all seven fixes); 6 min 2 s for 360 frames.

## What was measured, what was only looked at

- Measured: check, frame times, render time, the day track values, the voxel counts per day.
- Looked at: every QA and boundary frame, contact sheets of the draft around 4-7 s and 11-14 s.
- Not checked by anyone: the hardware-GPU path (`--browser-gpu`), the website derivatives
  (8 fps WebP, the 6-16 s hero loop and its crossfade), and how the frames sit on the site.

## Weakest shots, and what I would change with more time

- b1 (0-6 s): a vertical bone in a 16:9 frame leaves two thirds of the frame empty, and most
  of the push happens in the last second. A slower push (b1's K1 earlier, as its builder
  suggested) and a slight roll-free reframe with the target off-centre would use the frame better.
- b3 at 15 s: the bone along the plate is seen nearly edge-on. A K_OUT a little further
  towards +z would show it face-on but would cost b4's orbit its 25 deg start.
- b5: the load arrows are drawn beside the callus, translated from their true application
  point (75 mm above the frame) as a free-body mark. Honest and documented in `b5.js`, but a
  viewer could read them as acting at that spot.
- The director stops the camera at every key (zero speed): the hand-offs at 6 s and 12 s
  read as short breaths in the draft. Matching non-zero speeds across beat keys would need
  coordinated eases in b1, b2 and b3.
