# REVIEW2: integration, pass 2 (2026-11-07)

Scope: the six pass-2 beats together as one take, against SPEC.md (the "PASS 2" section wins).
Everything below was seen on SwiftShader frames from `hyperframes snapshot --no-browser-gpu`
(one browser at a time, under `/tmp/silicograft-browser.lock`) and on the 10 fps draft
`renders/draft2.mp4`. Snapshot folders are under `.hyperframes/artifacts/snapshots/`; the
960 px copies used for this review are in `/tmp/sgpass2/int/` (A, B: QA frames before the
fixes; C, D, E: beat boundaries; F, G: after the fixes).

Empty ground below is measured, not guessed: the share of pixels in the ground colour range
(`#02071d` and its fog, r <= 16, g <= 26, 20 <= b <= 56) of the 1920 x 1080 snapshot.

## Check

`npx hyperframes check --json --no-browser-gpu`: ok, 0 errors, before and after the fixes.
Warnings kept on purpose:

- `console_warning` x7, "GPU stall due to ReadPixels": SwiftShader driver noise from the
  capture readback, not from the composition.
- `film_silent` (and the info `audio_none`): SPEC OUTPUT says silent.

## Fixes made in this pass

| # | Rank | Where | Problem | Change |
|---|---|---|---|---|
| 1 | P0 | t=6.0 · `b2.js` state | b1 hands over the day-0 stem-cell voxels at opacity 1; b2 restarted them from 0 with an 18-frame tween, so the amber layers vanished on frame 180 and faded back in over 0.6 s (a SPEC BANNED pop) | b2 writes `voxelOpacity = 1` while any block is shown (the shrink logic still turns it off in the close-up). 5.9 / 6.1 s now carry the same amber layers |
| 2 | P1 | t=34.5-36 · `b6.js` state | The strain face dissolved into the day-357 voxels at stem opacity 1: a solid amber mass, a different look from the same callus at 15-24 s and nearly one colour on the last frame | b6 keeps b3's look: `stemOpacity = ctx.shared.b3.STEM_OPACITY_END` (0.4) and `voxelOpacity <= 0.998`, so b3's bone overlay shows. The last frame now shows ivory bone inside the translucent amber, with the blue and coral flecks along the plate and the azure arc |
| 3 | P1 | t=18 · contract key `b3.js` K_OUT, `b4.js` CAMERA, `ENGINE.md` | The b3 / b4 boundary frame was 53 % empty ground; b4's orbit ran 92 -> 90 -> 88 -> 86 mm | The 18 s key moved in to 86 mm along the same line of sight, and b4's inner keys to 86 mm at the same angles: a constant-radius orbit. 17.9 / 18.1 s now 51 % empty (planner cover 0.58 -> 0.62). ENGINE.md's boundary table is updated |
| 4 | P1 | t=11.3-11.7 · `engine.js` composer | The pull back from the cells (cells + voxels growing back + BokehPass) cost 3.6-4.5 s per frame, over the 3.5 s budget | The composer's render target drops its 4x MSAA (`samples: 0`). Side-by-side at 10 s and 11.5 s show no visible difference under the bokeh; 11.5 s now 3.1 s, 10 s 1.7 s |

Backups of every file before these edits: `/tmp/sgpass2/backup/integrator/`.

## QA frames (P2-7: horizontal, at least three palette colours, depth, at most 50 % empty)

| Frame (s) | Must show | Shows | Empty | Verdict |
|---|---|---|---|---|
| 0 (0) | the whole plate with six screws, the gap, on the ground; whole construct filling the width (P2-6) | the construct lying horizontal across the full width, plate on top with six darker screw heads, the gap, amber day-0 stem-cell rims on both bone ends with a little red marrow; key-light shadow of the plate on the bone | 75 % | horizontal, colours (steel, warm cortex, amber, marrow red) and depth met. FILL FAILS (contract key, see "Remaining" 1) |
| 150 (5) | the half cut, the arrows | the half model close on the proximal fragment: plate, two cut screws, grey cortex and red marrow in section, the amber rim at the gap end | 41 % | P2-7 met. No arrows: b1 shows them 1.8-4.2 s and slides them out as the camera leaves the loaded end (Remaining 3) |
| 300 (10) | stem cells as cells in focus, the bone end out of focus | a thin focal plane of amber cells over dark-red marrow bokeh, the grey cortex blurred at the right edge | 0 % | met. Three colours, but all warm and dark: the frame reads brown-amber |
| 450 (15) | ivory bone voxels along the plate, an empty middle | the half callus at day ~340 in voxels, stem cells translucent (0.53): ivory bone along the plate and in both lobes, blue cartilage and coral fibrous blocks along the plate, the empty middle, cortex grey, marrow red, steel | 40 % | met |
| 640 (21.33) | the cut face as a stiffness map with bright bone ends | the viridis E map (replay near day 150): violet callus (granulation and stem cells, 0.2 MPa), teal-yellow at the cortex ends and under the plate, the cortex cut faces yellow (17000 MPa), the marrow blue-violet | 40 % | met. The callus border still shows long teal-yellow tet triangles (Remaining 4) |
| 820 (27.33) | the strain map, the arrows thicker | the magma strain map (peach-orange middle, violet along the plate and the bone ends), the ink axial arrow on the proximal marrow and the moment arc at lower left at the pulse peak | 33 % | met |
| 1000 (33.33) | points in flight toward the plane | thousands of points streaming from the strain face down to the decision plane below the callus; ivory, grey, coral and blue points; the faint region fills, ink axes upright | 36 % | met |
| 1079 (35.97) | points settled, the return arc complete | (after fix 2) the camera at b2's first key: translucent amber callus with ivory bone inside, blue and coral flecks, the azure return arc from the bottom edge into the stem-cell layer, plate, cortex, marrow | 40 % | met. The decision plane has left the frame by then (b6's glide), so "points settled" is read at 34.5-35 s, not on the last frame |

Every QA frame is horizontal (planner axis 180 deg, plate up, all 0-36 s) and shows at least
three palette colours. The only one above 50 % empty is frame 0.

## Beat boundaries

Camera speeds come from the director itself (`/tmp/sgpass2/tools/speed.mjs`: position speed as
a share of the target distance per second, view-direction turn in deg/s), plus the planner's
screen speed at the subject (frame widths per second, limit 0.6).

| Boundary | Camera | State and objects | Verdict |
|---|---|---|---|
| 5.9 / 6.1 (b1 / b2) | no stop: position 0.10 -> 0.30 of the distance per second, the turn 1.5 -> 4.7 deg/s; the dive starts out of b1's push | half 1 both sides; day-0 amber layers at full opacity both sides (after fix 1) | ok. Both frames about 55 % empty: the gap holds no tissue at day 0 and the 6 s key is fixed (b2's first frame, the hero loop's start) |
| 11.9 / 12.1 (b2 / b3) | no stop: the pull back runs through at log-distance rate 0.93 per second (screen speed 0.28) | voxels on both sides, the same blocks | ok. 5-10 % empty but only amber and marrow red: at day 30 the run has 34,297 stem-cell blocks and 1,929 bone blocks |
| 17.9 / 18.1 (b3 / b4) | no stop: position 0.02 of the distance per second, turn 1.3 deg/s (the orbit starts gently, as its sine quarter-point keys intend) | translucent stem cells and the bone overlay on both sides; the cut face enters only on bone, cartilage and fibrous pixels | ok after fix 3; 51 % empty |
| 23.9 / 24.1 (b4 / b5) | slowest moment of the film but not a stop: the orbit lands face-on while b5's push begins (position 0.013 of the distance per second, turn 0.01 deg/s); no hold key | day-357 E map on both sides; b5's axial arrow enters at 24.0 (18 f power2.out) | ok |
| 29.9 / 30.1 (b5 / b6) | no stop: the distance channel turns round at 30 s (push in -> pull back) while the target starts moving (position 0.011 -> 0.020 per second) | strain map both sides; b5's marks finish their 12-frame exit at 30.0 (at 29.9 they are at 44 % opacity, at 30.1 gone: an exit, not a pop); b6's voxels enter behind the opaque face | ok |

The calm stretch: from 18 s to 30 s the planner reads at most 0.01 frame widths per second at
the subject (a 25 deg orbit about the target, then a 86 -> 78 mm push). The frame changes
through the orbit and the field blends, but it is the stillest third of the film.

## SPEC BANNED, checked on the frames

- Glow, bloom, flares, rays, decorative particles: none.
- Text, labels, HUD, borders: none (the decision plane has ticks only).
- Orbit: only b4's. Cuts: none (one take; every boundary checked above).
- Background gradients, glass: none; the ground is flat `#02071d` with fog.
- Colours outside the palette: none seen; viridis and magma are the P2-2 field maps.
- Invented data: nothing added in this pass. Fix 2 only reuses b3's per-code opacity.
- Dark metal, vanishing screws: the plate reads as bright brushed steel; the six screw heads
  read as darker discs at frame 0.
- Pops at a boundary: the one found (6 s voxels) is fixed.
- The camera at rest on a mostly empty frame: the film's first frame (the director rests at
  the first key) is 75 % empty. See Remaining 1.

## Remaining (not fixed, ranked)

1. P1 · t=0 · 75 % empty ground. P2-6 asks for the whole construct with six screws filling
   the width; P2-7 for at most 50 % empty. A 200 mm rod in 16:9 cannot do both: a planner
   search over 108 framings (target y 0 and 10, azimuth 30-70, elevation -18 to -42,
   110-170 mm, fov 28 and 34) found no framing with all six screws above 0.26 cover (about
   0.16-0.2 on real frames). I kept the whole construct (P2-6 and the QA line for frame 0).
   If the owner prefers a full frame: start at about 110 mm, target y 10, az 30, el -18
   (planner 0.49 cover), which leaves 3-4 screws out of frame.
2. P1 · 5.5-6.5 s · about 55 % empty: the gap is empty at day 0 and the 6 s key is the hero
   loop's first frame. Moving it means re-planning b1, b2 and b6's end together.
3. P1 · t=5 (QA 150) · no load arrows. b1 shows them clearly from 1.8 to 4.2 s (2.3-3.4 s
   fully in frame) and exits them as the camera follows the load path to the gap.
4. P2 · 18.6-30 s · the E and strain maps still show long tet triangles as spikes along the
   callus border (engine, per-vertex interpolation of element values). The interior is smooth.
5. P2 · 4.0-4.6 s · during the half-cut sweep the plate's top face lingers as a thin flap past
   its clipped body and the screws show as whole cylinders through the cut bone (18 frames;
   engine clipping of the half meshes).
6. P2 · colour balance comes from the run: at day 357 the callus is 92 % stem-cell blocks
   (231,063 of 252,844), 8 % bone, under 1 % cartilage and fibrous. Every voxel frame is
   therefore amber-led; b3's translucent stem cells (0.4) are what lets the ivory bone show.
   Nothing is recoloured.
7. P2 · 10 s · the close-up is all warm and dark (amber cells on dark-red bokeh). The violet
   nuclei hardly read at this scale.

## Frame time (SwiftShader, 1920 x 1080, `.hyperframes/engine-bench/bench.mjs`)

| t (s) | what | ms |
|---|---|---|
| 10.0 / 10.9 | b2 close-up, cells + BokehPass | 1730 / 1920 (2775 / 2852 before fix 4) |
| 11.3 / 11.5 / 11.7 | b2 pull back: cells, voxels growing back, BokehPass | 2370 / 3130 / 3060 (3570-4500 before fix 4) |
| 12 | voxels at 6.5 mm, day 30 | 1990 |
| 15 / 17.6 | b3 voxels + bone overlay | 3020 / 2210 |
| 34.8 / 35.4 / 35.97 | b6 dissolve to translucent stem cells + bone overlay (after fix 2) | 2120 / 2650 / 2260 |

The heaviest frame is now about 3.1 s (11.5 s); all measured frames stay under 3.5 s.

## Draft

- `renders/draft2.mp4`: the whole film, 10 fps, scaled to 960 x 540 from
  `/tmp/sgpass2/draft2_1080.mp4` (`render --no-browser-gpu --fps 10 --quality draft --workers 1`).
  `renders/draft.mp4` (pass 1) is kept.
- `renders/draft2_sheet.jpg`: 3 x 3 contact sheet from the draft, the eight QA frames plus 18 s.
- The draft took 10 min 36 s (1.77 s per frame end to end, 1 worker); RENDER.md now says about
  32 min for the 30 fps film on one worker here, and lists `assets/js/director.js`, which the
  pass-1 file list missed.

What was measured: check, empty-ground shares, camera speeds, frame times. What was only
looked at: colour reads, depth, the story order. Nobody heard anything (the film is silent).
