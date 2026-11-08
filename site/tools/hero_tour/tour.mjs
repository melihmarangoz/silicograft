// Frame-by-frame capture of the hero tour: the callus viewer, then the cell viewer, explored with a
// drawn mouse pointer. Every frame is exactly 1/30 s of page time (clock.js), so the result is smooth
// however slow software WebGL is.
//
// Usage: node tour.mjs <part> <outdir> [--base http://127.0.0.1:8790] [--every K] [--limit N]
//   part: callus | cells (the landscape hero, 1920 x 1080, mouse) or phone-callus | phone-cells (the
//   portrait hero for phones: the viewers' phone layouts at 390 x 780 CSS px, 720 x 1440 frames,
//   touch input and drawn fingertips). Frames are written as <outdir>/f0000.png ... ; --every K
//   writes only every K-th frame (a quick look at the tour), --limit N stops after N frames.
// Env: CHROME = path of a Chrome (headless shell is enough). Run with DISPLAY unset (SwiftShader).
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const FPS = 30, W = 1920, H = 1080;
// the phone tours' screen: a 390 x 780 CSS px phone (1:2, the shape of the hero under the site's masthead on
// current phones, so the site's object-fit: cover crops almost nothing), 720 / 390 device pixels per CSS px:
// 720 x 1440 frames, touch and mobile emulation
const PHONE = { width: 390, height: 780, deviceScaleFactor: 720 / 390, isMobile: true, hasTouch: true };
const args = process.argv.slice(2);
const part = args[0], outdir = args[1];
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt("--base", "http://127.0.0.1:8790"), EVERY = +opt("--every", 1), LIMIT = +opt("--limit", 1e9);
const here = path.dirname(new URL(import.meta.url).pathname);

// Home position of the pointer: where part 1 starts and part 2 ends, so the loop's crossfade
// joins the pointer to itself.
const HOME = [1140, 500];
// Where part 1 ends and part 2 starts (the crossfade between the two viewers).
const SWAP = [1250, 600];

// ---------------------------------------------------------------------------------------------
// The tour. Segments run in order; dur in seconds. Targets are [x, y] or {sel} (centre of the
// element) or {rel, fx, fy} (a point of an element as fractions of its box) or {slider: day} (the day
// slider's thumb at that day). Totals: callus 14.0 s, cells 16.5 s.
const TOURS = {
  callus: {
    url: "/viewer/",
    frames: 14.0 * FPS,
    ready: () => document.getElementById("yukleme").hidden === true,
    // the page's own title and description would sit under the site's navigation bar in the hero:
    // hide them but keep their space, so the stage and every pointer target stay where they are
    css: ".sayfa > header { visibility: hidden; }",
    // three runs side by side, the bonded-plate run picked for the single view, playing from day 40
    setup: `durum.secili = 2; document.getElementById("kosu-sec").value = "2";
            durum.hiz = 30; durum.gun = 40; zamanUygula(); oynatAyarla(true); ciz();`,
    segments: [
      { type: "wait", dur: 0.8 },
      { type: "move", to: { sel: "#duzen-tek" }, dur: 1.3 },
      { type: "wait", dur: 0.2 },
      { type: "click", dur: 0.3 },                                  // single view, one big callus
      { type: "move", to: [960, 470], dur: 1.2 },
      { type: "drag", button: "right", to: [1130, 455], dur: 1.5 },  // pan the callus right of centre
      { type: "wait", dur: 0.3 },
      { type: "drag", button: "left", to: [1000, 425], dur: 1.9 },   // orbit about 70 degrees
      { type: "wait", dur: 0.3 },
      { type: "wheel", dy: -100, count: 4, dur: 0.5 },               // zoom in a little
      { type: "move", to: { sel: "#g-baglam" }, dur: 1.4 },
      { type: "wait", dur: 0.2 },
      { type: "click", dur: 0.3 },                                  // hide intact bone, marrow, plate
      { type: "wait", dur: 0.2 },
      { type: "move", to: { slider: 359 }, dur: 1.0 },               // play has stopped at day 359
      { type: "wait", dur: 0.1 },
      { type: "drag", button: "left", to: { slider: 215 }, dur: 1.2 }, // scrub back to month 7
      { type: "move", to: SWAP, dur: 0.8 },                          // at rest before the crossfade (13.5 s)
      { type: "wait", dur: 99 },
    ],
  },
  cells: {
    url: "/cells/?test&gun=170&bolge=2&kamera=egik",
    frames: 16.5 * FPS,
    ready: () => window.__hazir === true && document.getElementById("yukleme").hidden === true,
    // opens on preset 3 (under the plate), playing at 5 days/s
    setup: "",
    afterSetup: `window.__ic.gunAyarla(170); document.getElementById("oynat").click();`,
    segments: [
      { type: "wait", dur: 0.8 },
      { type: "move", to: { sel: "#vizor-buyut" }, dur: 1.2 },
      { type: "wait", dur: 0.2 },
      { type: "click", dur: 0.3 },                                  // open the large callus map
      { type: "move", to: { rel: "#secim-tuval", fx: 0.667, fy: 0.134 }, dur: 1.4 },
      { type: "wait", dur: 0.3 },
      { type: "click", dur: 0.3 },                                  // a free point: new bone and stem cells at the proximal cortex end
      { type: "move", to: { sel: "#secim-git" }, dur: 1.0 },
      { type: "wait", dur: 0.2 },
      { type: "click", dur: 0.3, waitLoad: true },                   // open that box
      { type: "wait", dur: 0.3 },
      { type: "move", to: [960, 520], dur: 1.0 },
      { type: "drag", button: "right", to: [1140, 480], dur: 1.4 },  // pan the slab right of centre
      { type: "wheel", dy: -100, count: 8, dur: 0.6 },               // zoom in to the cells
      { type: "drag", button: "left", to: [1070, 445], dur: 2.0 },   // orbit slowly
      { type: "wait", dur: 0.3 },
      { type: "move", to: { sel: '#hucre-lejant [data-tur="0"]' }, dur: 1.2 },   // MSCs light up
      { type: "wait", dur: 1.0 },
      { type: "move", to: { sel: '#hucre-lejant [data-tur="3"]' }, dur: 0.6 },   // osteoblasts
      { type: "wait", dur: 0.5 },
      { type: "move", to: HOME, dur: 1.1 },                          // at rest before the loop's crossfade (16.0 s)
      { type: "wait", dur: 99 },
    ],
  },

  // The portrait hero for phones: the same two viewers in their phone layouts, driven by touch. A finger
  // shows only while it touches (tap, drag, scroll, pinch: see runPhone below), so the joins need no rest
  // spot. Totals: phone-callus 11.5 s, phone-cells 13.5 s.
  "phone-callus": {
    phone: true,
    url: "/viewer/",
    frames: 11.5 * FPS,
    ready: () => document.getElementById("yukleme").hidden === true,
    // the viewer's top bar, day badge and pane label would sit behind the site's masthead or under the hero's
    // headline: hidden, their space kept, so the stage and the targets stay where they are
    css: ".sayfa > header, .gun-rozet, .pane-etiket, #etiketler, #tabaka-tutamak > span { visibility: hidden !important; }",
    // the bonded-plate run (a phone shows one run), playing at 30 days/s from day 20
    setup: `const s = document.getElementById("kosu-sec"); s.value = "2"; s.dispatchEvent(new Event("change"));
            durum.hiz = 30; durum.gun = 20; zamanUygula(); oynatAyarla(true); ciz();`,
    segments: [
      { type: "wait", dur: 0.6 },
      { type: "drag", from: { rel: "#sahne", fx: 0.74, fy: 0.5 }, to: { rel: "#sahne", fx: 0.46, fy: 0.48 }, dur: 2.0 },  // one finger orbits about 75 degrees
      { type: "wait", dur: 0.4 },
      { type: "pinch", at: { rel: "#sahne", fx: 0.5, fy: 0.5 }, from: 90, to: 112, angle: -60, dur: 1.3 },    // two fingers zoom in a little
      { type: "wait", dur: 1.6 },
      { type: "drag", from: { slider: "now" }, to: { slider: 150 }, dur: 1.6 },                                 // the day slider back to month 5: tissue recedes
      { type: "wait", dur: 0.6 },
      { type: "drag", from: { rel: "#sahne", fx: 0.36, fy: 0.46 }, to: { rel: "#sahne", fx: 0.55, fy: 0.45 }, dur: 1.6 },  // orbit back a little
      { type: "wait", dur: 99 },
    ],
  },
  "phone-cells": {
    phone: true,
    url: "/cells/?test&gun=170&bolge=2&kamera=egik",
    frames: 13.5 * FPS,
    ready: () => window.__hazir === true && document.getElementById("yukleme").hidden === true,
    // the top bar, the day badge, the region name, the direction labels, the hints, the scale bar and the sheet's
    // handle text would sit behind the site's masthead or under the hero's headline: hidden, their space kept.
    // The large map is moved down below the top 15 % of the frame, and its side panel shows only "Go here".
    css: `.ust, .ortu.rozet, .bolge-ad, .yon, .ortu.ipucu, .ortu.olcek, #panel-tutamak > span,
          .anahtar, .secim-yan * { visibility: hidden !important; }
          #secim-git { visibility: visible !important; }
          .secim-kutu { padding-top: 120px !important; background: #0e1317 !important; }`,
    // opens on preset 3 (under the plate), playing at 5 days/s
    setup: "",
    afterSetup: `window.__ic.gunAyarla(170); document.getElementById("oynat").click();`,
    segments: [
      { type: "wait", dur: 0.6 },
      // a tap on the slab opens the callus map: the canvas ignores this tap (no cell card), the script opens the map
      { type: "tap", at: { rel: "#hucre-tuval", fx: 0.28, fy: 0.5 }, dur: 0.6, mute: "#hucre-tuval", run: "window.__ic.secimAc()" },
      { type: "wait", dur: 0.6 },
      { type: "tap", at: { map: [115.2, 348.1] }, dur: 0.6 },                 // new bone and stem cells at the proximal cortex end
      { type: "wait", dur: 0.6 },
      { type: "tap", at: { sel: "#secim-git" }, dur: 0.6, waitLoad: true },   // "Go here": that box opens
      { type: "wait", dur: 0.5 },
      { type: "pinch", at: [195, 330], atTo: [195, 270], from: 70, to: 150, angle: -55, dur: 1.6 },  // two fingers zoom in to the cells
      { type: "wait", dur: 0.3 },
      { type: "drag", from: [240, 320], to: [180, 312], dur: 4.5 },          // one finger orbits the slab slowly
      { type: "wait", dur: 99 },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// eased path with a slight arc, as a hand moves
function along(a, b, t) {
  const e = ease(t), dx = b[0] - a[0], dy = b[1] - a[1], bow = 0.06 * Math.sin(Math.PI * e);
  return [a[0] + dx * e - dy * bow, a[1] + dy * e + dx * bow];
}

const tour = TOURS[part];
if (!tour) { console.error(`part must be one of ${Object.keys(TOURS).join(", ")}`); process.exit(2); }
const VIEW = tour.phone ? PHONE : { width: W, height: H, deviceScaleFactor: 1 };
fs.mkdirSync(outdir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME, headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl", "--ignore-gpu-blocklist",
    "--no-sandbox", "--hide-scrollbars", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--force-color-profile=srgb", `--window-size=${VIEW.width},${VIEW.height}`,
    // phone: the window's own scale equals the emulated one. Otherwise every screenshot re-emulates the page at
    // the device scale and back, and a finger held down meanwhile reaches the page as a pointermove at its
    // position divided by that scale (the callus sheet jumped, the orbit spun).
    ...(tour.phone ? [`--force-device-scale-factor=${VIEW.deviceScaleFactor}`] : [])],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warn") console.log(`console.${m.type()}:`, m.text()); });
await page.setViewport(VIEW);
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await page.evaluateOnNewDocument(fs.readFileSync(path.join(here, "clock.js"), "utf8"));
await page.evaluateOnNewDocument(fs.readFileSync(path.join(here, tour.phone ? "finger.js" : "cursor.js"), "utf8"));
const cdp = await page.createCDPSession();
await page.goto(BASE + tour.url, { waitUntil: "networkidle0", timeout: 180000 });
if (tour.css) await page.addStyleTag({ content: tour.css });

const step = (n = 1) => page.evaluate((n, dt) => { for (let i = 0; i < n; i++) window.__clock.advance(dt); }, n, 1000 / FPS);
async function until(fn, what, maxS = 300, advance = true) {
  const t0 = Date.now();
  while (!(await page.evaluate(fn))) {
    if (Date.now() - t0 > maxS * 1000) throw new Error(`timed out waiting for ${what}`);
    if (advance) await step(1);
    await new Promise((r) => setTimeout(r, 200));
  }
}
await until(tour.ready, "the viewer data");
await page.evaluate(tour.setup);
await until(tour.ready, "the setup");
await step(20);                                    // let surfaces and charts settle
if (tour.afterSetup) await page.evaluate(tour.afterSetup);
await step(2);

async function resolve(t) {
  if (Array.isArray(t)) return t;
  if (t.sel) {
    const b = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, t.sel);
    if (!b) throw new Error(`no element ${t.sel}`);
    return b;
  }
  if (t.rel) {
    const b = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }, t.rel);
    return [b[0] + t.fx * b[2], b[1] + t.fy * b[3]];
  }
  if (t.map) {
    // a point of the cell viewer's callus map in lattice sites [u, v]: its kesitOlcek / kesitX / kesitY with
    // the map crop KESIT_J0 = 30, KESIT_J1 = 336, KESIT_KUST = 402 (hucre3b.html), which are not global
    return page.evaluate(([u, v]) => {
      const r = document.getElementById("secim-tuval").getBoundingClientRect(), J0 = 30, J1 = 336, K = 402;
      const s = Math.min(r.width / (J1 - J0), r.height / K), ox = (r.width - (J1 - J0) * s) / 2, oy = (r.height - K * s) / 2;
      return [r.x + ox + (J1 - u) * s, r.y + oy + (K - v) * s];
    }, t.map);
  }
  if (t.slider !== undefined) {
    // {slider: "now"}: the thumb where it is (the day keeps playing)
    return page.evaluate((d) => { const g = document.getElementById("gun"), r = g.getBoundingClientRect(), th = 16; if (d === "now") d = +g.value; return [r.x + th / 2 + (r.width - th) * d / 359, r.y + r.height / 2]; }, t.slider);
  }
  throw new Error("bad target");
}

const t0 = Date.now();
let frame = 0;
const done = () => frame >= tour.frames || frame >= LIMIT;
const logProgress = () => {
  if (frame % 30 === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`${part}: frame ${frame}/${tour.frames}  ${(el / frame).toFixed(2)} s/frame  ${el.toFixed(0)} s`);
  }
};
const waitLoad = async () => {                     // data loads in real time; page time stands still
  await new Promise((r) => setTimeout(r, 500));
  await until(() => document.getElementById("yukleme").hidden === true, "the region", 300, false);
};
if (tour.phone) { await runPhone(); await browser.close(); process.exit(0); }

let pos = [...(tour === TOURS.callus ? HOME : SWAP)], pressed = false, ring = null;
await page.mouse.move(pos[0], pos[1]);

async function shoot() {
  // the overlay and the clock in one round trip; the rAF callbacks render the new frame
  const r = ring && frame - ring.f < 14 ? { x: ring.x, y: ring.y, p: (frame - ring.f) / 14 } : null;
  await page.evaluate((x, y, p, r, dt) => { window.__cursor.set(x, y, p, r); window.__clock.advance(dt); }, pos[0], pos[1], pressed, r, 1000 / FPS);
  if (frame % EVERY === 0) {
    const s = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(outdir, `f${String(frame).padStart(4, "0")}.png`), Buffer.from(s.data, "base64"));
  }
  frame++;
  logProgress();
}
async function moveTo(p) {
  const q = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
  if (q[0] !== pos[0] || q[1] !== pos[1]) { pos = q; await page.mouse.move(q[0], q[1]); }
}

for (const seg of tour.segments) {
  if (done()) break;
  const n = Math.max(1, Math.round(seg.dur * FPS));
  const a = [...pos];
  let b = seg.to ? await resolve(seg.to) : a;
  for (let k = 0; k < n && !done(); k++) {
    // an element target is looked up again every frame: the page's layout can shift while the
    // pointer travels (a readout that changes height as the pointer leaves a map)
    if (seg.to && !Array.isArray(seg.to) && k > 0) b = await resolve(seg.to);
    if (seg.type === "move") await moveTo(along(a, b, (k + 1) / n));
    else if (seg.type === "drag") {
      if (k === 0) { await page.mouse.down({ button: seg.button }); pressed = true; }
      await moveTo(along(a, b, (k + 1) / n));
      if (k === n - 1) { await page.mouse.up({ button: seg.button }); pressed = false; }
    } else if (seg.type === "click") {
      if (k === 0) { await page.mouse.down(); pressed = true; ring = { x: pos[0], y: pos[1], f: frame }; }
      if (k === 3) {
        await page.mouse.up(); pressed = false;
        if (seg.waitLoad) await waitLoad();
      }
    } else if (seg.type === "wheel") {
      if (k < seg.count) await page.mouse.wheel({ deltaY: seg.dy });
    }
    await shoot();
  }
}
while (!done()) await shoot();
console.log(`${part}: ${frame} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
await browser.close();

// ---------------------------------------------------------------------------------------------
// The phone tours: touch events through the DevTools protocol (Input.dispatchTouchEvent on the page's own
// session, which also carries the touch and screen emulation) and fingertips drawn by finger.js.
// Segments: wait; tap {at} (with mute: a selector whose element ignores this tap, and run: page code run
// after it, for a tap that stands for an action the page offers elsewhere); drag {from, to} (one finger); pinch {at, atTo, from, to, angle} (two fingers, their
// distance in CSS px from -> to along the angle, their midpoint from at to atTo, which pans); scroll {el, from,
// to} (a one-finger swipe in a scrolling element: the drawn finger moves and the element's scrollTop follows it,
// with no touch events, so no fling runs on in real time).
// Every touch has the same envelope: the fingertip appears over APPROACH frames (fading in, settling from a
// larger size), touches down, and fades out over LIFT frames after it lifts. A tap sends its touchStart and
// touchEnd together (the browser's tap and long-press timers run in real time, and a frame takes about a
// second); a drag's first move goes out with its touchStart for the same reason.
async function runPhone() {
  const APPROACH = 5, LIFT = 7, RIPPLE = 16, PRESS = 3;
  const client = page._client();
  const send = (type, pts) => client.send("Input.dispatchTouchEvent", {
    type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i, radiusX: 10, radiusY: 10, force: 1 })),
  });
  // Blink hands touch moves to the page with its next real frame, so wait until the page has seen them (finger.js
  // keeps each touch pointer's last position and event) before the frame is shot
  async function arrived(what, check, arg) {
    const t = Date.now();
    while (!(await page.evaluate(check, arg))) {
      if (Date.now() - t > 3000) { console.log(`${part}: frame ${frame}: ${what} not seen by the page after 3 s`); return; }
      await new Promise((r) => setTimeout(r, 15));
    }
  }
  const atPoints = (pts) => arrived("touch at " + JSON.stringify(pts), (pts) => {
    const at = Object.values(window.__finger.seen.at);
    return pts.every((p) => at.some((q) => q[2] !== "pointerup" && Math.abs(q[0] - p[0]) < 1 && Math.abs(q[1] - p[1]) < 1));
  }, pts);
  const lifted = () => arrived("touch end", () => Object.values(window.__finger.seen.at).every((q) => q[2] === "pointerup" || q[2] === "pointercancel"));
  const clicks = () => page.evaluate(() => window.__finger.seen.clicks);
  let fingers = [], ripples = [];
  async function shootPhone() {
    ripples = ripples.filter((w) => frame - w.f < RIPPLE);
    const w = ripples.map((q) => ({ x: q.x, y: q.y, p: (frame - q.f) / RIPPLE }));
    await page.evaluate((f, w, dt) => { window.__finger.set(f, w); window.__clock.advance(dt); }, fingers, w, 1000 / FPS);
    if (frame % EVERY === 0) {
      // the page's own session (it carries the device scale, so 720 x 1440), and no capture beyond the viewport:
      // that resizes the page for the shot, and the viewers re-lay out (and redraw) under it
      const png = await page.screenshot({ type: "png", captureBeyondViewport: false });
      fs.writeFileSync(path.join(outdir, `f${String(frame).padStart(4, "0")}.png`), png);
    }
    frame++;
    logProgress();
  }
  // a fingertip at p, k frames into a touch of n frames that lifts after frame `up`
  const tip = (p, k, up) => {
    if (k < APPROACH) { const e = (k + 1) / APPROACH; return { x: p[0], y: p[1], a: e, s: 1.35 - 0.35 * e }; }
    if (k <= up) return { x: p[0], y: p[1], a: 1, s: k - APPROACH < PRESS ? 0.9 : 1 };
    const e = Math.min(1, (k - up) / LIFT); return { x: p[0], y: p[1], a: 1 - e, s: 1 + 0.15 * e };
  };
  const lerpPath = (a, b, t) => { const e = ease(t); return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e]; };
  for (const seg of tour.segments) {
    if (done()) break;
    const n = Math.max(1, Math.round(seg.dur * FPS));
    if (seg.type === "wait") { for (let k = 0; k < n && !done(); k++) { fingers = []; await shootPhone(); } continue; }
    if (seg.type === "tap") {
      const p = await resolve(seg.at);
      for (let k = 0; k < n && !done(); k++) {
        if (k === APPROACH) {
          const c0 = await clicks();
          if (seg.mute) await page.evaluate((s) => { document.querySelector(s).style.pointerEvents = "none"; }, seg.mute);
          await send("touchStart", [p]); await send("touchEnd", []);
          await lifted();
          await arrived("the tap's click", (c0) => window.__finger.seen.clicks > c0, c0);
          if (seg.mute) await page.evaluate((s) => { document.querySelector(s).style.pointerEvents = ""; }, seg.mute);
          if (seg.run) await page.evaluate(seg.run);
          ripples.push({ x: p[0], y: p[1], f: frame });
          if (seg.waitLoad) await waitLoad();
        }
        fingers = k < APPROACH + PRESS + LIFT ? [tip(p, k, APPROACH + PRESS - 1)] : [];
        await shootPhone();
      }
      continue;
    }
    // drag, scroll and pinch: approach, move along an eased path, lift
    const moveN = n - APPROACH - LIFT;
    if (moveN < 2) throw new Error(`segment too short: ${JSON.stringify(seg)}`);
    let A, B;
    if (seg.type === "pinch") {
      const r = (seg.angle * Math.PI) / 180, u = [Math.cos(r), Math.sin(r)];
      const at = (c, d) => [[c[0] - u[0] * d / 2, c[1] - u[1] * d / 2], [c[0] + u[0] * d / 2, c[1] + u[1] * d / 2]];
      A = at(await resolve(seg.at), seg.from); B = at(await resolve(seg.atTo || seg.at), seg.to);
    } else { A = [await resolve(seg.from)]; B = [await resolve(seg.to)]; }
    const s0 = seg.type === "scroll" ? await page.evaluate((s) => document.querySelector(s).scrollTop, seg.el) : 0;
    let cur = A.map((p) => [...p]);
    for (let k = 0; k < n && !done(); k++) {
      const m = k - APPROACH;               // index along the path; the touch is down for m = 0 .. moveN - 1
      if (m >= 0 && m < moveN) {
        cur = A.map((a, i) => lerpPath(a, B[i], (m + 1) / moveN).map((v) => Math.round(v * 10) / 10));
        if (seg.type === "scroll") {
          await page.evaluate((s, y) => { document.querySelector(s).scrollTop = y; }, seg.el, s0 + (A[0][1] - cur[0][1]));
        } else {
          if (m === 0) await send("touchStart", A);
          await send("touchMove", cur);
          await atPoints(cur);
          if (m === moveN - 1) { await send("touchEnd", []); await lifted(); }
        }
      }
      fingers = cur.map((p) => tip(p, k, APPROACH + moveN - 1));
      if (k > APPROACH + moveN - 1 + LIFT) fingers = [];
      await shootPhone();
    }
  }
  while (!done()) { fingers = []; await shootPhone(); }
  console.log(`${part}: ${frame} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
