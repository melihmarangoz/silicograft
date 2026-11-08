# RENDER: the final 1920 x 1080, 30 fps film on a fresh Linux box

The film is one HyperFrames sub-composition drawn by three.js (WebGL). Every frame is a
pure function of t, so frames can be rendered in any order and by several workers.

## What the render needs (push only these)

```
film/
  index.html              # 52 s (pass 3)
  compositions/dive.html
  package.json            # pins hyperframes@0.9.19
  hyperframes.json
  meta.json
  assets/js/engine.js
  assets/js/director.js   # camera director (pass 2), imported by engine.js and b6.js
  assets/js/timeline.js   # pass 3: the 52 s timeline and the day track, imported by everything
  assets/js/beats/b1.js b2.js b3.js c2.js c3.js b4.js b5.js b6.js
  assets/js/cells/slab.js               # pass 3: the cell slabs (port of the cell viewer)
  assets/js/cells/hucre_geometri_lod.js # pass 3: coarser levels of the same cells
  assets/js/vendor/hucre_geometri.js
  assets/data/manifest.json
  assets/data/summary.json
  assets/data/vox_index.json
  assets/data/roi_cells.json
  assets/data/roi_cells.bin
  assets/data/vox_days.bin
  assets/data/elem_centroid.bin
  assets/data/elem_E_days.bin
  assets/data/elem_strain_357.bin
  assets/data/elem_hp_357.bin
  assets/data/elem_class_357.bin
  assets/data/surf_*.bin        # 15 files: cortex/marrow prox+dist, plate, screws,
                                #   callus_hull (each full + _half), callus_cut
  assets/data/cells/            # pass 3: bolgeler.json, roi_ilik_ucu.bin, roi_korteks_ucu.bin,
                                #   roi_plak_alti.bin (2.3 MB each), README.md (provenance)
```

About 92 MB in all, mostly `vox_days.bin` (the cell slabs add 7 MB). Leave out
`assets/data_old_0543/` (an earlier export, 85 MB, referenced by nothing), `renders/`,
`.hyperframes/` and the docs.

The page loads three@0.170.0 (with its addons, MarchingCubes for the cell slabs among them) and
gsap@3.15.0 from cdn.jsdelivr.net at render time, so the box needs outbound HTTPS to jsDelivr.

## Install

```bash
# Node 22 (nvm) and FFmpeg
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm install 22
sudo apt-get update && sudo apt-get install -y ffmpeg   # or a static ffmpeg on PATH

cd film
npx --yes hyperframes@0.9.19 browser ensure   # downloads the pinned Chrome headless shell
npx --yes hyperframes@0.9.19 doctor --json     # gate on .ok
```

Headless Chrome on a bare server may also need the usual shared libraries
(`libnss3 libatk-bridge2.0-0 libgbm1 libxkbcommon0 libasound2 libxcomposite1 libxdamage1
libxrandr2 libpango-1.0-0 libcairo2`); `doctor` names any that are missing.

## Render

Software WebGL (SwiftShader), the path every review frame was checked on. Deterministic:

```bash
cd film
npx --yes hyperframes@0.9.19 check --json --no-browser-gpu      # must report "ok": true
npx --yes hyperframes@0.9.19 render \
  --no-browser-gpu \
  --fps 30 --quality delivery \
  --workers 4 \
  --output renders/silicograft-dive.mp4
```

- `--workers`: each worker is one Chrome holding the 92 MB of data, the three cell slabs and a
  1920 x 1080 WebGL context; count about 1 to 1.5 GB of RAM per worker. 4 workers fit in 8 GB
  free; use more only on a bigger box. On this development machine (7.5 GB shared) do not
  render at all (it crashed once under the shared load); use a remote machine with more
  memory and threads (`hyperframes render` there).
- Pass 3 (52 s, 1560 frames), measured: the delivery render on a remote Linux machine (16 threads,
  24 GB) with `--workers 8` took 34 min 33 s end to end (capture 34 min 32 s, encode and
  assemble under 1 s), about 1.33 s of wall time per frame; RAM stayed at about 6 GB used of 24.
  SwiftShader spreads one frame over all threads, so 8 workers oversubscribe 16 threads (load
  average 100-125) and more workers would not help. Output: 139 MB (H.264, yuv420p).
- Frame cost (one frame alone, idle lease, SwiftShader; REVIEW3.md "Frame time"): 0.4-1.2 s for
  the macro frames, 1.0-1.15 s for stop 1's close-up, 1.2-3.0 s for the c2 and c3 close-ups,
  2.6-3.2 s for the c2/c3 dives and pull-outs (whole slab plus voxels plus shadows; 32.4-32.6 s
  are the heaviest frames of the film). All under 3.5 s.
- Pass 2 (36 s), for history: the 10 fps draft (360 frames, 1 worker) on the development
  machine took 10 min 36 s, 1.77 s per frame.
- A box with a real GPU: `--browser-gpu` makes Chrome use it for WebGL (it errors if no GPU
  is reachable). This is faster but not bit-identical to the SwiftShader frames that were
  reviewed; check a few frames (`snapshot --browser-gpu --at 0,10.5,24.5,31.5,37.33,51.97`) against
  `snapshot --no-browser-gpu` before committing to it. The CLI has no flag for choosing an
  ANGLE backend (Vulkan, GL); `--browser-gpu` lets Chrome pick. `--gpu` is only hardware
  video ENCODING (NVENC, VAAPI, ...) and can be added when the box has it.
- Do not use `--docker` unless Docker is set up: it always renders with software WebGL anyway.

## Check the output

```bash
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate \
  -of default=nw=1 renders/silicograft-dive.mp4
# expect width=1920 height=1080 r_frame_rate=30/1 duration=52.000000 (1560 frames)
ffmpeg -v error -ss 24.5 -i renders/silicograft-dive.mp4 -frames:v 1 /tmp/f735.png
```

Compare a few decoded frames with the QA frames in REVIEW3.md (0, 3, 5, 8, 10.5, 12.5, 17, 22,
24.5, 29, 31.5, 37.33, 43.33, 49.33, 51.97 s). Checked for the pass-3 render: 1920 x 1080,
30/1 fps, 1560 frames, 52.000 s; `renders/draft3_sheet.jpg` is a 4 x 3 sheet decoded from it.

## Derived outputs (SPEC OUTPUT, not part of this render)

- Website scroll story: sample 8 fps, 1280 x 720 WebP from the full render; seven stages, see
  STAGES.md for their frame ranges and the day track.
- Website hero: 6.5 s to 16.5 s with a baked 0.5 s crossfade (into 6.0-6.5 s), H.264 and VP9.
- `renders/draft3.mp4`: 960 x 540 copy of the full render (libx264 CRF 24, 30 fps, 10 MB).
