// Drawn fingertips for the phone tour: a soft translucent disc where a finger touches the screen and a
// ripple where it taps. Screenshots show no touch, so the capture script draws this overlay at the same
// points it sends the touch events to. pointer-events: none, so it never takes an event from the page.
(() => {
  const R = 19;   // disc radius in CSS px, about a fingertip on a 390 px wide phone
  let root = null;
  const discs = [], rings = [];
  function disc() {
    const d = document.createElement("div");
    d.style.cssText = `position:absolute;left:0;top:0;width:${2 * R}px;height:${2 * R}px;border-radius:50%;opacity:0;` +
      "background:radial-gradient(circle, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.40) 58%, rgba(255,255,255,0.22) 100%);" +
      "border:1.5px solid rgba(255,255,255,0.85);box-shadow:0 0 0 1px rgba(0,0,0,0.22), 0 3px 10px rgba(0,0,0,0.35)";
    root.append(d); return d;
  }
  function ring() {
    const r = document.createElement("div");
    r.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;border-radius:50%;opacity:0;" +
      "border:2px solid rgba(255,255,255,0.95);box-shadow:0 0 0 1px rgba(0,0,0,0.2), inset 0 0 12px rgba(255,255,255,0.35)";
    root.append(r); return r;
  }
  function build() {
    root = document.createElement("div");
    root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden";
    document.documentElement.append(root);
  }
  // what the page has received: each touch pointer's last position and event, and the clicks, so the capture
  // can wait until its touch events have arrived before it shoots a frame (window, capture phase: first in line)
  const seen = { at: {}, clicks: 0 };
  for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
    addEventListener(t, (e) => { if (e.pointerType === "touch") seen.at[e.pointerId] = [e.clientX, e.clientY, t]; }, true);
  }
  addEventListener("click", () => { seen.clicks++; }, true);
  window.__finger = {
    seen,
    // f: fingers [{x, y, a, s}] (centre, opacity 0..1, scale); w: ripples [{x, y, p}] with p from 0 to 1
    set(f, w) {
      if (!root) build();
      while (discs.length < f.length) discs.push(disc());
      while (rings.length < w.length) rings.push(ring());
      discs.forEach((d, i) => {
        const q = f[i];
        if (!q || q.a <= 0) { d.style.opacity = "0"; return; }
        d.style.opacity = String(q.a);
        d.style.transform = `translate(${q.x - R}px, ${q.y - R}px) scale(${q.s})`;
      });
      rings.forEach((r, i) => {
        const q = w[i];
        if (!q) { r.style.opacity = "0"; return; }
        const e = 1 - Math.pow(1 - q.p, 3), rad = R + 26 * e;
        r.style.opacity = String(0.9 * (1 - q.p));
        r.style.width = r.style.height = `${2 * rad}px`;
        r.style.transform = `translate(${q.x - rad - 2}px, ${q.y - rad - 2}px)`;
      });
    },
  };
})();
