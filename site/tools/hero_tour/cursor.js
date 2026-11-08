// Drawn mouse pointer and click ring. Screenshots do not show the OS cursor, so the capture script
// moves this overlay to the same place it sends the real mouse events. pointer-events: none, so it
// never takes an event from the page.
(() => {
  let root = null, arrow = null, ring = null;
  function build() {
    root = document.createElement("div");
    root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden";
    ring = document.createElement("div");
    ring.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;border-radius:50%;border:2px solid rgba(255,255,255,0.9);box-shadow:0 0 0 1px rgba(0,0,0,0.25);opacity:0";
    arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("viewBox", "0 0 20 28");
    arrow.setAttribute("width", "24");
    arrow.setAttribute("height", "34");
    arrow.style.cssText = "position:absolute;left:0;top:0;transform-origin:2px 2px;filter:drop-shadow(0 1.5px 2px rgba(0,0,0,0.55))";
    arrow.innerHTML = '<path d="M2 2 L2 22.5 L7.2 17.6 L10.6 25.4 L14 23.9 L10.7 16.3 L17.6 16.3 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>';
    root.append(ring, arrow);
    document.documentElement.append(root);
  }
  window.__cursor = {
    // x, y: hotspot; pressed: a button is down; r: click ring {x, y, p} with p from 0 to 1, or null
    set(x, y, pressed, r, visible = true) {
      if (!root) build();
      root.style.display = visible ? "" : "none";
      arrow.style.transform = `translate(${x - 2}px, ${y - 2}px) scale(${pressed ? 0.9 : 1})`;
      if (r) {
        const e = 1 - Math.pow(1 - r.p, 3), rad = 7 + 21 * e;
        ring.style.opacity = String(0.85 * (1 - r.p));
        ring.style.width = ring.style.height = `${2 * rad}px`;
        ring.style.transform = `translate(${r.x - rad - 2}px, ${r.y - rad - 2}px)`;
      } else ring.style.opacity = "0";
    },
  };
})();
