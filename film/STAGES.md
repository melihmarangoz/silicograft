# STAGES: the film's seven website stages (pass 3)

For the site update that follows pass 3. The film is `renders/silicograft-dive.mp4`:
52.0 s, 1560 frames, 30 fps, 1920 x 1080, silent. Frame `n` shows film time `n / 30` s.
The source of truth for every number below is `assets/js/timeline.js` (`BEATS`, `dayAt`).

## Stages

Frame ranges are inclusive, at the film's 30 fps. The "8 fps" column is the same range in the
site's scroll frames (`site/tools/film_frames.sh` samples 8 fps, so sample `k` is film time
`k / 8` s).

| Stage | Title (site) | Beats | Seconds | Frames (30 fps) | Samples (8 fps) | Simulated day |
|---|---|---|---|---|---|---|
| 1 | A gap in the tibia | b1 | 0-6 | 0-179 | 0-47 | 0 |
| 2 | Stem cells move in | b2 (cell stop `ilik_ucu`) | 6-14 | 180-419 | 48-111 | 0 -> 30 |
| 3 | Each cell lays down tissue | b3 (macro) + c2 (cell stop `korteks_ucu`) | 14-27 | 420-809 | 112-215 | 30 -> 220 |
| 4 | Bone and cartilage along the plate (new) | c3 (cell stop `plak_alti`) | 27-34 | 810-1019 | 216-271 | 220 -> 357 |
| 5 | Tissue sets the stiffness | b4 | 34-40 | 1020-1199 | 272-319 | 357 (the E map replays FE days 6 -> 357) |
| 6 | CalculiX loads the leg | b5 | 40-46 | 1200-1379 | 320-367 | 357 |
| 7 | Strain picks the next cell | b6 | 46-52 | 1380-1559 | 368-415 | 357 |

What each stage shows, for the captions (no text is in the film):

1. Close on the gap and both bone ends under the plate (day 0: the run's stem-cell layer at
   the bone ends). The camera travels to the loaded end, where the axial load (823 N) and the
   bending arc enter at 1.6-2.0 s; the model is cut in half at 4.0-4.6 s; back into the gap.
2. A dive into the marrow-canal opening at the proximal bone end. Among the cells (closest
   9.7-11.5 s, with depth of field) stem cells (amber) leave the red marrow (left) for the clot
   (right, dark with pink gel and fibrin threads) as the days run. Only stem cells exist here
   in the run at days 0-30. Out to the proximal half of the callus.
3. b3 (14-20 s): the three-quarter view of the half callus while tissue forms (days 30-120;
   bone grows at the cortex ends and along the plate, the middle stays empty). c2 (20-27 s): a
   dive into the proximal cortex corner away from the plate: the intact cortex block on top,
   new woven bone under it with osteoblasts on its surfaces and osteocytes inside, stem cells
   around; at days 146-178 the core of the new bone empties and stem cells refill it.
4. A dive along the cut face to the plate's bone-facing side: the bone band under the plate
   thickens (bone cells 404 -> 1346 in the slab), from about day 325 (31.4 s) cartilage with
   chondrocytes forms beside it; the plate edge stays at the top. Out to the three-quarter view.
5. The single 25 deg orbit: the cut face turns from tissue to the stiffness map (viridis,
   34.6-35.6 s), then the map replays FE days 6 -> 357 (35.6-39.6 s, linear in time).
6. A slight push in: the stiffness map turns into the strain map (magma, 40.8-41.8 s); the
   load arrows pulse twice.
7. Points leave the cut face (from 47.0 s) and fly to the decision plane below the callus
   (all landed by about 50.3 s); the strain face dissolves into the day-357 tissue
   (50.45-51.45 s) and the azure return arc is drawn back into the stem cells (50.4-51.6 s).
   The last frame (52 s) uses the same camera as 6 s: the loop rhymes with stage 2's start.

Hero loop (website hero, SPEC P3-1): film 6.5-16.5 s (frames 195-494), with a baked 0.5 s
crossfade (the last 0.5 s, 16.0-16.5 s, into 6.0-6.5 s). `site/tools/film_frames.sh` already
cuts it this way (`HERO_START=6`, `HERO_LEN=10`, `HERO_FADE=0.5`).

## Day track

`dayAt(t)` in `assets/js/timeline.js`: monotonic, continuous, with a continuous rate. A
piecewise cubic Hermite through these knots (t in s, day, slope in days per second):

| t | 0 | 6 | 14 | 20 | 27 | 34 | 52 |
|---|---|---|---|---|---|---|---|
| day | 0 | 0 | 30 | 120 | 220 | 357 | 357 |
| slope | 0 | 0 | 6.176471 | 14.643304 | 16.515973 | 0 | 0 |

Between knots (t0, d0, m0) and (t1, d1, m1), with h = t1 - t0 and s = (t - t0) / h:

```
day(t) = (2s^3 - 3s^2 + 1) d0 + (s^3 - 2s^2 + s) h m0 + (-2s^3 + 3s^2) d1 + (s^3 - s^2) h m1
```

Day 0 for t <= 6 s, day 357 for t >= 34 s. Values once a second:

| t (s) | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| day | 0.0 | 0.6 | 2.4 | 5.1 | 8.8 | 13.3 | 18.4 | 24.0 | 30.0 | 38.9 | 52.3 | 68.6 | 86.4 | 104.0 | 120.0 |

| t (s) | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| day | 134.3 | 148.0 | 161.6 | 175.2 | 189.3 | 204.1 | 220.0 | 239.7 | 264.0 | 290.1 | 315.2 | 336.6 | 351.4 | 357.0 |

The site's `film_frames.sh` still carries the pass-1 track (36 s, six stages) in its
`day_at()` and stage list: for the 52 s film it needs the seven ranges above and either this
formula or a `--day-track` file. A per-frame track (1560 values) can be written with node:

```bash
cd film && node -e "import('./assets/js/timeline.js').then(m => console.log(JSON.stringify(Array.from({length: 1560}, (_, n) => +m.dayAt(n / 30).toFixed(3)))))" > /tmp/day_track.json
```

What the day means in stages 5-7: the tissue and the solve are those of day 357; stage 5's
map replays the FE days 6 -> 357 of the run (`elem_E_days`), not the film's day track.
