// Screenshot the home page hero with the new video at a few times. Usage: node herocheck.mjs <url> <outdir>
import puppeteer from "puppeteer-core";
const [url, out] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: process.env.CHROME, headless: true,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
p.on("console", (m) => console.log("console:", m.text()));
await p.goto(url, { waitUntil: "networkidle0" });
await p.waitForFunction(() => { const v = document.querySelector(".hero__canvas video"); return v && v.readyState >= 2; }, { timeout: 60000 });
console.log(await p.evaluate(() => { const v = document.querySelector(".hero__canvas video"); return v.currentSrc + " " + v.duration; }));
for (const t of [1, 4.5, 8.5, 15.8, 22, 25.5]) {
  await p.evaluate(async (t) => { const v = document.querySelector(".hero__canvas video"); v.currentTime = t; v.play(); await new Promise((r) => v.addEventListener("seeked", r, { once: true })); await new Promise((r) => v.requestVideoFrameCallback(() => r())); }, t);
  await p.evaluate(() => document.querySelector(".hero__canvas video").pause());
  await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: `${out}/page_t${t}.png` });
}
await b.close();
