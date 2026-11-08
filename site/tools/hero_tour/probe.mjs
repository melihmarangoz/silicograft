// Probe: open a viewer at 1920x1080 under the virtual clock, advance some frames, screenshot,
// and print the boxes of the controls the tour uses. Usage: node probe.mjs <url> <out.png> [frames]
// PHONE=1: the phone tour's screen instead (390 x 693 CSS px at 1280/693 device pixels per px, so a 720 x 1280
// screenshot, touch, mobile; the window's own scale forced to match, as in tour.mjs).
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const [url, out, nfr = "30"] = process.argv.slice(2);
const PHONE = process.env.PHONE ? { width: 390, height: 693, deviceScaleFactor: 1280 / 693, isMobile: true, hasTouch: true } : null;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME, headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox", "--hide-scrollbars",
    ...(PHONE ? [`--force-device-scale-factor=${PHONE.deviceScaleFactor}`] : [])] });
const page = await browser.newPage();
await page.setViewport(PHONE || { width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: process.env.SCHEME || "dark" }]);
const cdp = await page.createCDPSession();
page.on("console", (m) => console.log("console:", m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.evaluateOnNewDocument(fs.readFileSync(new URL("./clock.js", import.meta.url), "utf8"));
await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
for (let i = 0; i < 400; i++) {
  const ok = await page.evaluate(() => window.__hazir === true || (document.getElementById("yukleme")?.hidden === true));
  if (ok) break; await page.evaluate(() => window.__clock.advance(1000 / 30)); await new Promise((r) => setTimeout(r, 100));
}
if (process.env.PRE) await page.evaluate(process.env.PRE);
const t0 = Date.now();
for (let i = 0; i < +nfr; i++) await page.evaluate(() => window.__clock.advance(1000 / 30));
console.log("advance ms/frame", (Date.now() - t0) / +nfr);
const t1 = Date.now();
// a phone shot through the page's own session (the one with the device scale), else a plain capture
if (PHONE) fs.writeFileSync(out, await page.screenshot({ type: "png", captureBeyondViewport: false }));
else { const shot = await cdp.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(out, Buffer.from(shot.data, "base64")); }
console.log("screenshot ms", Date.now() - t1);
if (process.env.EXTRA) console.log(JSON.stringify(await page.evaluate(process.env.EXTRA)));
const boxes = await page.evaluate(() => {
  const r = {};
  for (const el of document.querySelectorAll("button, input, select, canvas, #vizor, #vizor-tuval, #secim *[id], #sahne, #hucre-sahne, #makro-sahne, label.sec, aside, header, main, section")) {
    const b = el.getBoundingClientRect(); if (b.width === 0) continue;
    const k = (el.id || el.dataset.kamera || el.dataset.tur || el.dataset.doku || el.dataset.hiz || el.textContent.trim().slice(0, 24) || el.tagName);
    r[el.tagName.toLowerCase() + ":" + k] = [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)];
  }
  return r;
});
console.log(JSON.stringify(boxes));
await browser.close();
