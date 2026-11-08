# Hero tour: a screen recording of the two 3D viewers

The home page's hero background (`site/assets/film/hero-av1.mp4`, `hero.mp4`,
`hero-poster.jpg`) is a 29.5 s seamless loop of the callus viewer (`viewer/`) and then the cell viewer
(`cells/`) being explored with a visible mouse pointer. It is captured frame by frame, so it plays
smoothly however slowly the machine drew it.

A phone held upright (`max-width: 40rem` and portrait, `site/story.js`) gets its own recording instead:
`site/assets/film/hero-portrait.mp4` (720x1440, 1:2, 24.0 s loop) with `hero-portrait-poster.jpg/.avif/.webp`,
the same two viewers in their phone layouts, driven by touch with drawn fingertips (below, "The portrait
tour").

## How it works

- `clock.js` is injected before any page script. `requestAnimationFrame` callbacks run only when the
  capture calls `window.__clock.advance(1000 / 30)`, with the virtual time as their timestamp, and
  `performance.now()` / `Date.now()` follow the same clock. Both viewers take their play speed and
  their animation from the rAF timestamp, so each captured frame is exactly 1/30 s of page time.
- `cursor.js` draws the pointer (an arrow) and a click ring as a fixed overlay with
  `pointer-events: none`. Screenshots do not show the OS cursor, so the capture moves this overlay
  to the same place it sends the real mouse events (puppeteer `page.mouse`: moves, left and right
  drags, wheel, clicks), and the viewers react to those events as they would to a person.
- `tour.mjs` holds the tour as a list of segments (wait, move, click, drag, wheel) and captures
  one PNG per frame. Moves follow an eased path with a slight arc. Targets are fixed points or page
  elements, looked up again every frame. When a click opens a cell-viewer region, the capture waits
  in real time for its data and does not advance the page clock, so loading never shows.
- `encode.sh` crossfades the two parts (0.5 s) and makes the loop seamless: the output starts 0.5 s
  in, and its last 0.5 s crossfades into its own first 0.5 s, so the last frame leads straight into
  frame 0. The pointer starts part 1 and ends part 2 at the same spot.
- The callus part hides the viewer's own title and description (`css` in its tour entry,
  `visibility: hidden`, so the layout and every pointer target stay put). In the hero that block sat
  right under the site's navigation bar.
- `finger.js` is the phone tours' overlay instead of `cursor.js`: a soft translucent disc where a finger
  touches (it fades in, settling from a larger size, and fades out after the lift) and a ripple where it
  taps. It also records what the page has received (each touch pointer's last position, the clicks).
- The phone parts (`phone-callus`, `phone-cells` in `tour.mjs`) run at 390 x 780 CSS px with
  720 / 390 device pixels per px, so every frame is exactly 720 x 1440, with mobile and touch emulation.
  Touches go in through the DevTools protocol (`Input.dispatchTouchEvent`), so the viewers get real touch
  pointer events (one finger orbits, two pinch, the sheet handle follows the finger). Before a frame is
  shot the capture waits until the page has seen its touch events (Blink hands touch moves to the page
  with its next real frame), and a tap waits for its click. Three things had to be right:
  - Chrome runs with `--force-device-scale-factor` equal to the emulated scale. Without it each
    screenshot re-emulates the page at the device scale and back, and a finger held down meanwhile
    reaches the page as a pointermove at its position divided by that scale: the sheet jumped and the
    orbit spun in the first preview.
  - Screenshots go through the page's own session (`page.screenshot`, which carries the device scale)
    with `captureBeyondViewport: false`, which would otherwise resize the page for every shot.
  - A tap sends its touchStart and touchEnd together, and a drag's first move goes out with its
    touchStart: the browser's tap and long-press timers run in real time while a frame takes about a
    second. A swipe inside the sheet's list is a `scroll` segment: the drawn finger moves and the list's
    `scrollTop` follows it, with no touch events, so no fling runs on in real time.
- `serve.py` is a static server that sends `charset=utf-8` as GitHub Pages does.
- `probe.mjs` opens one viewer, prints the boxes of its controls and saves a screenshot, to plan
  the pointer's targets (`PRE` / `EXTRA` env: page code to run before / after the frames; `PHONE=1`:
  the phone tours' screen, `SCHEME=dark` as the tours use).
- `herocheck.mjs` screenshots the home page with the hero video playing (layout and scrim check).

## The tour (times in the final loop)

| time (s) | what happens |
|---|---|
| 0.0 | Callus viewer, three runs side by side, playing at 30 days/s from day 77 |
| 0.3-1.8 | Pointer to "One run", click at 1.8: one large callus (bonded-plate run) |
| 2.1-4.8 | Pointer onto the callus, right-drag pans it right of centre |
| 5.1-7.0 | Left-drag orbits the callus about 70 degrees while tissue grows |
| 7.3-7.8 | Wheel zooms in a little |
| 7.8-9.4 | Pointer to "Intact bone, marrow, plate", click at 9.4: intact bone, marrow and plate hidden; play stops at day 359 |
| 9.6-12.2 | Pointer to the day slider, drags it back from day 359 to day 215 (tissue recedes) |
| 12.2-13.0 | Pointer to the middle right, at rest |
| 13.0-13.5 | Crossfade to the cell viewer: preset 3 (under the plate), playing at 5 days/s from day 170 |
| 13.8-15.2 | Pointer to "Large selection", click at 15.2: the large callus map opens |
| 15.5-17.2 | Pointer to a free point (new bone and stem cells at the proximal cortex end), click at 17.2: the box centres there |
| 17.5-18.7 | Pointer to "Go here", click at 18.7: the custom box opens (day 199) |
| 19.3-21.7 | Pointer onto the slab, right-drag pans it right of centre |
| 21.7-22.3 | Wheel zooms in to the cells |
| 22.3-24.3 | Left-drag orbits the slab slowly; cells move and divide |
| 24.6-26.8 | Hover on the MSC toggle: MSCs light up, the other types fade |
| 26.8-27.9 | Hover on the osteoblast toggle |
| 27.9-29.0 | Pointer back to its start spot, at rest (day 250) |
| 29.0-29.5 | Crossfade into frame 0 |

Hard cuts are the viewers' own: the layout switch at 1.8, the map window at 15.2 and the new box at
18.7 (region data loads while the page clock stands still, so no loading screen shows).

## The portrait tour (phones, times in the final loop)

Frames are 720x1440 (the viewers at 390x780 CSS px): 1:2, about the shape of the hero under the site's
masthead on current phones (390x771 on a 390x844 screen), so the site's `object-fit: cover` crops almost
nothing. The viewers' own interface text is hidden for the capture (injected CSS, `visibility: hidden`, so
the layout and every target stay put): both top bars, the day badges, the region name, the direction labels,
the hints, the scale bar, the cell-type buttons and the sheet handles' labels. The top of the frame sits
behind the site's masthead and the lower half under the hero's headline, so only the 3D scene and the time
bar show there. The cell viewer's large map is moved down below the top 15 % of the frame and its side panel
shows only "Go here".

| time (s) | what happens |
|---|---|
| 0.0 | Callus viewer, phone layout (the bonded-plate run), playing at 30 days/s from day 20 |
| 0.6-2.6 | One finger orbits the callus about 75 degrees while tissue grows |
| 3.0-4.3 | Two fingers pinch outwards: zoom in a little |
| 5.9-7.5 | The finger drags the day slider back to day 150: tissue recedes, play goes on |
| 8.1-9.7 | One finger orbits back a little |
| 11.0-11.5 | Crossfade to the cell viewer: preset 3 (under the plate), playing at 5 days/s from day 170 |
| 11.6 | Tap on the slab: the callus map opens (the canvas ignores this tap, the capture opens the map) |
| 12.8 | Tap on the map (new bone and stem cells at the proximal cortex end): the box centres there |
| 14.0 | Tap on "Go here": the custom box opens |
| 15.1-16.7 | Two fingers pinch outwards and move up: zoom in to the cells |
| 17.0-21.5 | One finger orbits the slab slowly; cells move and divide |
| 21.5-23.5 | Camera at rest, the cells move on |
| 23.5-24.0 | Crossfade into frame 0 |

A finger shows only while it touches, so neither join needs a rest spot. The hard cuts are the map
window at 11.6 and the new box at 14.0 (loaded with the page clock standing still).

## Re-recording

Machine: a remote Linux machine with many CPU threads (software WebGL is slow and memory-hungry; it took 1.3
to 4 s per frame on 16 threads, 8 min for the callus part and about 20 min for the cell part). Node
with `puppeteer-core`, a Chrome headless shell, ffmpeg with libx264 and libvpx-vp9.

1. Assemble the viewers as `.github/workflows/pages.yml` does, into `<site>/viewer/` and
   `<site>/cells/` (or copy them from an assembled `_site`).
2. Serve them: `python3 serve.py <site> 8790`.
3. Capture both parts (each takes a few GB of RAM; they can run at the same time):

   ```
   unset DISPLAY WAYLAND_DISPLAY        # WebGL needs SwiftShader, which fails with DISPLAY set
   export CHROME=/path/to/chrome-headless-shell
   node tour.mjs callus frames/callus   # 420 frames, 14.0 s
   node tour.mjs cells frames/cells     # 495 frames, 16.5 s
   ```

   `run.sh` does the same with the paths of the machine used on 2026-11-08 (Node in `~/node`,
   puppeteer-core and the headless shell from `hyperframes@0.9.19` in `~/hf`, linked as
   `node_modules` next to this folder). `--every 10` writes only every tenth frame for a quick
   look; `--limit N` stops early.
4. `./encode.sh frames out` writes `master.mp4`, `hero-av1.mp4` (1920x1080, AV1 CRF 54, for large
   screens whose browser plays AV1), `hero.mp4` (1280x720, H.264 CRF 28, for everything else) and
   `hero-poster.jpg` (frame 0), all faststart. Copy the three site files to `site/assets/film/`.

The portrait tour, the same way (re-recorded on 2026-11-08 on a remote 16-thread Linux machine, the two
parts side by side: 0.9 to 1.5 s per frame, about 6 min for the callus part and 10 min for the cell part):

```
node tour.mjs phone-callus frames-p/callus   # 345 frames, 11.5 s
node tour.mjs phone-cells frames-p/cells     # 405 frames, 13.5 s
./encode.sh --portrait frames-p out          # needs Pillow >= 11 with AVIF on python3's path
```

`encode.sh --portrait` writes `master-portrait.mp4`, `hero-portrait.mp4` (720x1440, H.264 High CRF 28,
a keyframe every 2 s, faststart, no audio) and `hero-portrait-poster.jpg` (quality 90), `.avif`
(quality 70) and `.webp` (quality 88) from frame 0. Copy those four files to `site/assets/film/`. That
machine had Node only from the nodejs.org tarball (`~/node`), puppeteer-core 24 from npm, the headless
shell from `npx @puppeteer/browsers install chrome-headless-shell@stable --path ~/hero/chs` and Pillow
in a venv (`python3 -m venv ~/venv; ~/venv/bin/pip install pillow`; the system Pillow had no AVIF).
`--every 6` gives a quick look at the whole tour in half the time.

On narrow screens (under 60rem) the site crops the landscape video to its middle: `object-position:
50% 30%` for the hero video in `site/styles.css`. A phone held sideways or a narrow window then shows
about x = 710-1210 of the 1920 px frame, so keep the 3D action there; the viewers' control panels (right
of x = 1300) are off screen. A phone held upright gets the portrait recording, framed in full.

To change the tour, edit the segments in `tour.mjs`. Part lengths are `frames` there and `LEN_A` /
`LEN_B` in `encode.sh` (one pair per mode); keep them equal. A phone segment's targets follow the same
rules; `{map: [u, v]}` is a point of the cell viewer's callus map in lattice sites (the map crop is
copied from `hucre3b.html` into `resolve()`, since the page does not expose it). Element targets use the viewers' ids, so a renamed control
breaks the tour loudly (`no element ...`) rather than silently.
