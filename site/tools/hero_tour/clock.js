// Deterministic clock for frame-by-frame capture. Injected before any page script runs
// (page.evaluateOnNewDocument). requestAnimationFrame callbacks only run when the capture script
// calls window.__clock.advance(ms), and they receive the virtual time, so every captured frame is
// exactly 1/30 s of page time apart no matter how long SwiftShader takes to draw it.
// performance.now() returns the virtual time plus the real time spent inside the current frame
// (capped at 15 ms): pages that slice work by performance.now() still terminate, and nothing can
// read a time past the next frame's timestamp.
(() => {
  const realNow = performance.now.bind(performance);
  const EPOCH = Date.UTC(2026, 10, 8, 12, 0, 0);
  let vt = 1000;            // ms; start above zero so "first frame" checks on a 0 timestamp behave
  let frameStartReal = realNow();
  let nextId = 1;
  let queue = [];
  performance.now = () => vt + Math.min(realNow() - frameStartReal, 15);
  Date.now = () => EPOCH + performance.now();
  window.requestAnimationFrame = (cb) => { const id = nextId++; queue.push({ id, cb }); return id; };
  window.cancelAnimationFrame = (id) => { queue = queue.filter((q) => q.id !== id); };
  window.__clock = {
    advance(ms) {
      vt += ms; frameStartReal = realNow();
      const q = queue; queue = [];
      for (const { cb } of q) { try { cb(vt); } catch (e) { console.error("rAF callback:", e); } }
      return q.length;
    },
    get now() { return vt; },
  };
})();
