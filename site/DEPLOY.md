# Deploying the site to GitHub Pages

## What the workflow does

`.github/workflows/pages.yml` runs on every push to `main` that touches
`site/**` or `long_bone/web3d_uygulama/**`, and on demand (`workflow_dispatch`).

1. Checks out the repo and runs `actions/configure-pages`.
2. Copies `site/` to `_site/`.
3. Copies the callus viewer to `_site/viewer/`: `kallus3b.html` becomes
   `viewer/index.html`, and `data/*.b64.txt` goes to `viewer/data/`
   (the `.bin` files are not needed; the viewer fetches the base64 text files).
   `kallus3b.html` is built: edit `kallus3b_sablon.html` and run
   `python3 long_bone/araclar/kallus3b_derle.py`, which fills in the daily volumes
   from `data/kallus3b_istatistik.json` (`--kontrol` checks the built page is current).
4. Copies the cell viewer to `_site/cells/`: `hucre3b.html` becomes
   `cells/index.html`, with its `hucre/` scripts and `veri/` data next to it
   (`hucre/hucre_test.html` is left out).
5. Removes what the pages never load: `partials/`, `content/`, `tools/`,
   `assets/stages/` (the old stage stills, kept in the repo as a reference for
   `film/SPEC.md`), `assets/viewer-poster.txt` and this file.
6. Runs `site/tools/build_site.py _site`, a speed-up pass on the deployed copies only
   (the sources stay as they are, because the viewers are also published as claude.ai
   artifacts): the home page gets `tokens.css`, `base.css` and `styles.css` inlined,
   and the two viewers load IBM Plex from `assets/fonts/` and three.js r147 from
   `vendor/three-0.147.0/` instead of Google Fonts and jsDelivr. The script stops the
   build if a link it rewrites is not found exactly once.
7. Uploads `_site` and deploys it with `actions/deploy-pages`.

Action versions: checkout v7, configure-pages v6, upload-pages-artifact v5,
deploy-pages v5. Only one deployment runs at a time (concurrency group `pages`).

The deployed site is about 95 MB (151 files, measured 2026-11-08): 72 MB of
video and images in `assets/`, 19 MB for `cells/`, 1.6 MB for `viewer/`.

## The videos on the home page

All of them live in `assets/film/`. Neither script runs in the workflow: make
the files locally and commit them.

### Hero: a recording of the two 3D viewers

`hero-av1.mp4` (1920x1080 AV1, for wide screens whose browser plays AV1),
`hero.mp4` (1280x720 H.264, for everything else) and `hero-poster.jpg`. A 29.5 s seamless loop: a pointer explores the callus
viewer, then picks a free box on the cell viewer's callus map. It is captured
frame by frame on a virtual clock, so it never stutters. How to re-record it,
and the tour second by second: `tools/hero_tour/README.md`. The capture needs
several GB of RAM and many CPU threads; use a remote Linux machine with many
threads, not a laptop.

Phones held upright (`(max-width: 40rem) and (orientation: portrait)`) get a portrait
recording of the same tour: `hero-portrait.mp4` (720x1280 H.264 High, seamless loop, no
audio, faststart, at most about 4 MB) with its poster `hero-portrait-poster.jpg` plus
`.avif` and `.webp` (720x1280). They are recorded and encoded by the same tools in
`tools/hero_tour/` (see its README). `story.js` puts the portrait file first and `hero.mp4`
after it, so a missing portrait file falls through to the landscape one; the hero's
`<picture>` lists the portrait posters first with the same media query, and a small script
at the end of `index.html` drops them if they fail to load, so the landscape still shows.

`story.js` attaches the video only when `hero.mp4` answers, motion is allowed
and Save-Data is off; otherwise the still `assets/hero-still.jpg` stays. The
video pauses off screen and in a background tab. It has no pause control: the owner removed
it on 2026-11-08, knowing that WCAG 2.2.2 / Hallmark gate 18 ask for one (the lint reports
that one gate-18 FAIL on the hero); reduced-motion visitors get the still image. The hero
starts under the masthead, not behind it.

### Model section: seven stage clips

`clips/stage-N-av1.mp4` (1920x1080 AV1, from 60rem up when the browser plays AV1)
and `clips/stage-N-720.mp4` (1280x720 H.264, for screens between 40 and 60rem, browsers
without AV1, and phones when a portrait clip is missing), with posters in `stills/`. The first clip starts downloading when the section is a screen
away, and each stage warms the next one, so opening the page downloads no video. Each poster is a lazy `<picture>` under its video (AVIF, then
WebP, 1280 and 1920 px, with `stills/stage-N.jpg` as the fallback); the video stays
transparent until it first plays. They are cut from the final film
`film/renders/silicograft-dive.mp4` (not in git: render it as in
`film/RENDER.md`). From the repo root:

```
site/tools/film_clips.sh film/renders/silicograft-dive.mp4
```

Options: `--crf N` (720p H.264, default 28), `--av1-crf N` (1080p AV1, default 38),
`--webm` (adds VP9 copies), `--stages FILE`,
`--threads N` (default 6). The stage boundaries (0, 6, 14, 27, 34, 40, 46,
52 s), each poster's time and the holds are in `tools/film_stages.json`; change them
there, not in the script. A hold (`"holds": [{"at": 23.75, "seconds": 3}]`) repeats the
film frame at that time inside the clip, so labels stay on screen long enough to read:
stage 3 holds its four cell-type labels for 3 s, stage 4 its four labels for 3 s, and
stage 7 holds the strain map for 1.5 s and the filled strain plane for 3 s. The script checks each clip's frame count, writes
`clips/clips.json` with the sizes, and swaps the new folders in only when all
clips are good. It takes about 80 s. After cutting new clips, remake the AVIF/WebP
posters from the same render, so they show the same frames:

```
python3 site/tools/optimize_images.py --render film/renders/silicograft-dive.mp4
```

Without `--render` it remakes only the hero still and the viewer poster (from their JPEGs).
AVIF quality 70 and WebP 88 were chosen by SSIM against a lossless frame (see the script).

Phones (40rem and narrower) get their own cut of each stage: `clips/stage-N-portrait.mp4`
(720x900, 4:5, H.264 High, 30 fps, the same film range and holds as the landscape clips, no
audio, faststart, a keyframe every 2 s) and the posters `stills/stage-N-portrait.jpg`, `.avif`
(quality 70) and `.webp` (quality 88), all 720x900. `film_clips.sh` writes them in a full run;
`--portrait-only` writes just these files after a crop changes. The crop window of each stage
(its width and a left edge that can move between keyframes, so the burnt-in labels and the
strain-plane diagram stay whole) is the `"portrait"` entry of that stage in
`tools/film_stages.json`. In the page each video lists the portrait clip first with
`media="(max-width: 40rem)"` and each poster `<picture>` its portrait files first with the same
query; a missing clip falls through to `stage-N-720.mp4`, a missing poster is dropped by the
script at the end of `index.html` and the landscape poster shows.

In the page the stages are a plain list (no JS: the posters show). `story.js` turns it
into a full-screen pinned deck: a tall track (one 80vh scroll step per stage, then a short
hold) with a sticky pin that covers the screen. The stage texts share one place on the
left, the clips one 16:9 deck on the right (rounded corners and a soft shadow, no other
frame, no captions). Scrolling picks the stage, it does not scrub the video: the current
clip slides out to the left, the next comes in from the right and plays from its start.
After stage 7 the track ends and the page scrolls on. A thin bar at the pin's top shows
the progress, and a small Play/Pause icon in the deck's corner holds the clip (Hallmark
gate 18, WCAG 2.2.2); under reduced motion nothing plays until it is pressed.

One gesture moves at most one stage, on every device (the owner's request). Fighting native
scrolling failed on real devices (smooth wheel scrolling, trackpad inertia and finger flings keep
moving the page after the input), so `story.js` LOCKS the page inside the deck: `html.deck-locked`
(overflow hidden, no overscroll) stops any scroll under way and the page is held at the shown
stage's place. Coming down across stage 1's place (or up across stage 7's), by any input, locks at
stage 1 (or 7). While locked, each new gesture moves one stage, at most one per 900 ms: a wheel
gesture is new after a 220 ms pause, on a change of direction, or when its size jumps well above
the last 200 ms' smallest event (a new trackpad swipe during inertia; steady mouse notches and
free-spinning wheels never do that); each touch drag (over 30 px, one per 600 ms) and each key
press (no auto-repeat) is one gesture; the phone card's sideways swipe too. A new gesture down at
stage 7 (or up at stage 1) unlocks and moves the page on by a third of a screen; the rest of that
gesture scrolls the page. In-page links, Tab focus leaving the deck and an open modal (the phone
menu) unlock it. There is no CSS scroll snapping (it pulled readers of the section head into the
pin). `scrollbar-gutter: stable` keeps the layout still when the locked page hides its scrollbar.
The behaviour is checked with a puppeteer suite (Chrome with `--enable-smooth-scrolling`; CDP
scroll gestures, wheel sequences shaped like mouse spins and trackpad inertia, real touch-point
flings) kept with the job's scratch files, not in the repo.

### Phones (40rem and narrower)

The phone layout lives in the same three files (`index.html`, `styles.css`, `story.js`), in
`max-width: 40rem` media queries and a few phone-only branches; wider screens do not change.

- **Masthead.** With JS the bar shows the brand and a Menu button (`aria-expanded`,
  `aria-controls="menu"`). It opens `<dialog id="menu">` with `showModal()`: a full-screen
  list of every section link. Esc, the Close button and following a link close it; focus goes
  into the dialog on open and back to the button on close; `html.is-locked` stops the page
  from scrolling meanwhile. Without JS the bar keeps Cells and About.
- **The model as a story card.** The pinned deck keeps its scroll steps and its slide to the
  left, laid out as a card: seven thin segments on top (done ones full, upcoming ones empty, the
  current one filling with its clip's `currentTime / duration`, updated by
  `requestAnimationFrame` only while the clip plays), the 4:5 portrait clip edge to edge, then
  "3 / 7" and the days on one line, the title and the text. `--card-text` (14.5rem) is the
  height the segments and the text need; on a screen shorter than the clip plus that, the clip
  narrows instead of cropping. At 390x844 and 360x740 every stage fits in `100dvh`. A
  horizontal swipe on the card (pointer events, more than 40 px; `touch-action: pan-y`, so a
  vertical drag stays a page scroll) moves the clips with the finger and then scrolls the page
  to the next or previous stage's place in the track: the scroll position stays the one
  source of truth. The large stage number of the desktop is not shown.
- **Hero.** The portrait recording and poster above; the text and buttons as on other small
  screens.
- **Validation table.** Each case becomes a block with its three values on labelled lines
  (`data-label` on each cell); the column heads stay for screen readers.

### 3D section: two viewer cards

The home page links to `viewer/` and `cells/` as pages of their own (no embedded viewer):
both fill the window and offer Full screen. The cell viewer opens with its callus map
("Choose a spot on the callus") unless the URL names a region (`?bolge=N`). The card
images `assets/viewer-callus*` and `assets/viewer-cells*` are 1600x1000 screenshots of
the two viewers (dark theme; callus: one run, day 300; cells: `?bolge=2`, day 300), saved
as JPEG 88 plus AVIF 70 / WebP 88 at 800 and 1600 px. `assets/viewer-poster*` is no longer
used by the page.

### Fonts and speed

Mona Sans (home page) and IBM Plex (viewers) are served from `assets/fonts/` with
their OFL licences: Google Fonts' own latin and latin-ext subset files, unchanged.
`mona-sans-core.woff2` is the latin file cut with pyftsubset to ASCII and the few other
characters the page uses (outlines, advances and kerning unchanged; 71 kB instead of
98 kB). It is preloaded and declared last in `tokens.css`, so it serves those
characters and the full latin file is fetched only for a character outside it. When
the page gains a new non-ASCII character, add it to the core file's unicode-range and
remake the file, or it comes from the full latin file (correct, one extra download).

Lighthouse, same machine (a remote Linux machine, Chrome 157), 2026-11-08, old 6cc32a9 against this
setup (medians of 3 runs for the home page): home page on a phone 78 to 98 (LCP 5.9 s to
2.4 s, first paint 1.5 s to 0.9 s), desktop 91 to 100 (LCP 1.2 s to 0.6 s); callus viewer
on a phone 94 to 100; cells page on a phone 90 to 93, CLS 0.003 to 0 (its top bar is
written in the HTML; 0.355 on the live site before, where the fonts came later).

### Checking a change locally

Assemble `_site` as in the workflow (copy over an existing folder), serve it
with any static server and run the Hallmark lint from `_site`:

```
HALLMARK_PUPPETEER=~/silicograft-tools \
CHROME_PATH=~/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell \
flock /tmp/silicograft-browser.lock \
node ~/.agents/skills/hallmark/scripts/sloplint.mjs index.html --render --url http://127.0.0.1:8770/index.html
```

## One-time setup (GitHub UI, owner only)

1. Repo -> Settings -> Pages.
2. Under Build and deployment, set Source to **GitHub Actions**.
3. Push to `main` (or run the workflow from the Actions tab). The first
   deploy may ask you to approve the `github-pages` environment.
4. The site appears at `https://melihmarangoz.github.io/silicograft/`.

Pages on a private repository needs a paid plan (Pro, Team or Enterprise).
On the Free plan the Pages settings are unavailable for private repos.

## Custom domain (later)

1. Settings -> Pages -> Custom domain: enter e.g. `www.example.com`, save.
   With the Actions source, GitHub keeps the domain in settings (no CNAME
   file is needed in the artifact; a `CNAME` file in `site/` is ignored).
2. At your DNS provider:
   - Subdomain (`www`): CNAME record -> `melihmarangoz.github.io`.
   - Apex domain (`example.com`): A records -> `185.199.108.153`,
     `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (optional AAAA: `2606:50c0:8000::153`, `2606:50c0:8001::153`,
     `2606:50c0:8002::153`, `2606:50c0:8003::153`).
3. Wait for DNS to propagate, then tick **Enforce HTTPS**.
4. Optionally verify the domain (Settings -> Pages -> Add a domain, TXT
   record) to prevent takeover.
5. Re-check the DNS values against GitHub's docs before use; they can change.

## Privacy warning

A Pages site published from a private repository is still **public** on the
internet (unless you are on Enterprise Cloud with private Pages access
control). Anything copied into `_site` is readable by anyone with the URL,
including the viewer data. Do not put unpublished or sensitive material in
`site/` or the viewer data.
