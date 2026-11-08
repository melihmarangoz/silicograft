// Cell-type labels (pass 4): a thin leader line from a dot on one real cell to its type's name.
//
// The owner asked for them during the three cell stops ("orada gozuken hucre tipleri neler
// onlari da gostersin bi cizgi ile ismi yazsin ingilizce"), which overrides SPEC's "no text in
// the film" for these labels only (SPEC "PASS 4").
//
// Two halves, both pure:
// - makeLabelOverlay(svg): the engine's per-frame writer. The beats declare this frame's labels
//   through ctx.labels.set(list) in update(t); after the beats ran, the engine projects every
//   label's anchor with this frame's camera and writes the SVG overlay in compositions/dive.html
//   (pre-made slots, attributes only). A label fades with the depth-of-field blur at its
//   anchor and near the frame edge.
// - pickLabels(ctx, slab, specs): the build-time choice of WHICH cell carries each label and on
//   which side its text sits, by a fixed rule (no randomness; documented in ENGINE.md
//   "Cell-type labels (pass 4)").
//
// No three.js import here (the planner imports the beats in node): THREE comes from ctx.

export const LABEL_STYLE = {
  font: '"Mona Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  size: 28, // px at 1080p
  weight: 500,
  ink: "#e7f0f9",
  ground: "#02071d",
  lineWidth: 1.75,
  lineOpacity: 0.7,
  haloLine: 4.5, // dark halo under the leader line (px)
  haloLineOpacity: 0.4,
  haloText: 6, // dark halo behind the text (stroke under the fill, px)
  haloTextOpacity: 0.55,
  dotR: 3.5, // 7 px dot
  gap: 10, // px between the leader's end and the text
  safe: 80, // px safe margin on every side of the 1920 x 1080 frame
};
export const LABEL_CSS_FONT = `${LABEL_STYLE.weight} ${LABEL_STYLE.size}px ${LABEL_STYLE.font}`;
const W = 1920;
const H = 1080;

// Leader geometry from the dot (x0, y0) and the text offset (dx, dy): an angled run from the dot
// to an elbow, then a horizontal run to the end, where the text starts (the way a scientific
// figure labels a structure). Returns the points and the text box for a text width w.
export function leaderGeometry(x0, y0, dx, dy, w) {
  const s = dx >= 0 ? 1 : -1;
  const ady = Math.abs(dy);
  const ex = ady < 6 ? 0 : s * Math.min(ady, 0.5 * Math.abs(dx)); // 45 deg or steeper
  const elbow = [x0 + ex, y0 + dy];
  const end = [x0 + dx, y0 + dy];
  const tx = end[0] + s * LABEL_STYLE.gap;
  const half = LABEL_STYLE.size * 0.62;
  const box = s > 0 ? [tx, end[1] - half, tx + w, end[1] + half] : [tx - w, end[1] - half, tx, end[1] + half];
  return { s, elbow, end, tx, box };
}

// ---------------------------------------------------------------------------------------------
// Per-frame overlay
// ---------------------------------------------------------------------------------------------
export function makeLabelOverlay(svg, THREE) {
  const NS = "http://www.w3.org/2000/svg";
  const slots = svg ? Array.from(svg.querySelectorAll("g.sg-label")) : [];
  const parts = slots.map((g) => ({
    g,
    halo: g.querySelector(".sg-halo"),
    line: g.querySelector(".sg-line"),
    dot: g.querySelector(".sg-dot"),
    text: g.querySelector(".sg-text"),
    last: {},
  }));
  // Text widths, measured once per string with the label font (the font is loaded before boot).
  const widths = new Map();
  let c2d = null;
  function measure(text) {
    if (widths.has(text)) return widths.get(text);
    let w = text.length * LABEL_STYLE.size * 0.52; // fallback estimate
    try {
      if (!c2d) c2d = document.createElement("canvas").getContext("2d");
      c2d.font = LABEL_CSS_FONT;
      w = c2d.measureText(text).width;
    } catch (e) {
      /* keep the estimate */
    }
    widths.set(text, w);
    return w;
  }
  const set = (p, el, name, v) => {
    // write only on change (the overlay is a pure function of t; this only saves DOM work)
    const k = name;
    if (p.last[el + k] === v) return;
    p.last[el + k] = v;
    p[el].setAttribute(name, v);
  };
  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();
  const sm = (a, b, x) => {
    const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };

  /**
   * Draw this frame's labels. list: [{ id, text, anchor: [x, y, z] scene mm, offset: [dx, dy]
   * px, dot, line, textAlpha, alpha: 0..1 }] (labelFade gives the four fades); camera: this
   * frame's camera (final); dof: state.dof or null.
   * Returns the drawn labels' screen data (for stats and checks).
   */
  function draw(list, camera, dof) {
    const out = [];
    camera.updateMatrixWorld();
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const L = list[i];
      let alpha = 0;
      let geo = null;
      let x0 = 0;
      let y0 = 0;
      let blurPx = 0;
      if (L) {
        _v.fromArray(L.anchor);
        _w.copy(_v).applyMatrix4(camera.matrixWorldInverse);
        const depth = -_w.z;
        _v.project(camera);
        x0 = ((_v.x + 1) / 2) * W;
        y0 = ((1 - _v.y) / 2) * H;
        if (depth > 0) {
          // depth of field at the anchor (BokehPass: blur uv = |depth - focus| * aperture, about
          // 1920 px per uv unit): the label leaves while its cell goes soft
          if (dof) blurPx = Math.min(Math.abs(depth - dof.focus) * dof.aperture, dof.maxblur ?? 0.01) * W;
          const dofFade = 1 - sm(4, 7, blurPx);
          const edge = Math.min(x0, W - x0, y0, H - y0);
          const edgeFade = sm(30, 70, edge);
          const enter = Math.max(L.dot ?? 1, L.line ?? 1, L.textAlpha ?? 1);
          alpha = enter > 0 ? (L.alpha ?? 1) * dofFade * edgeFade : 0;
          const w = measure(L.text);
          let [dx, dy] = L.offset;
          // keep the text inside the safe margins (a continuous shift, never a jump)
          geo = leaderGeometry(x0, y0, dx, dy, w);
          const S = LABEL_STYLE.safe;
          const shiftX = Math.max(0, S - geo.box[0]) - Math.max(0, geo.box[2] - (W - S));
          const shiftY = Math.max(0, S - geo.box[1]) - Math.max(0, geo.box[3] - (H - S));
          if (shiftX || shiftY) geo = leaderGeometry(x0, y0, dx + shiftX, dy + shiftY, w);
        }
      }
      if (!L || alpha <= 0.002 || !geo) {
        set(p, "g", "opacity", "0");
        continue;
      }
      const f = (v) => v.toFixed(1);
      const d = `M${f(x0)} ${f(y0)}L${f(geo.elbow[0])} ${f(geo.elbow[1])}L${f(geo.end[0])} ${f(geo.end[1])}`;
      const len = Math.hypot(geo.elbow[0] - x0, geo.elbow[1] - y0) + Math.hypot(geo.end[0] - geo.elbow[0], geo.end[1] - geo.elbow[1]);
      const lineP = Math.min(1, Math.max(0, L.line ?? 1));
      const dash = `${f(len + 1)} ${f(len + 1)}`;
      const off = f((len + 1) * (1 - lineP));
      set(p, "g", "opacity", alpha.toFixed(3));
      for (const el of ["halo", "line"]) {
        set(p, el, "d", d);
        set(p, el, "stroke-dasharray", dash);
        set(p, el, "stroke-dashoffset", off);
        set(p, el, "opacity", lineP > 0 ? "1" : "0");
      }
      set(p, "dot", "cx", f(x0));
      set(p, "dot", "cy", f(y0));
      set(p, "dot", "opacity", (L.dot ?? 1).toFixed(3));
      set(p, "text", "x", f(geo.tx));
      set(p, "text", "y", f(geo.end[1]));
      set(p, "text", "text-anchor", geo.s > 0 ? "start" : "end");
      set(p, "text", "opacity", (L.textAlpha ?? 1).toFixed(3));
      if (p.text.textContent !== L.text) p.text.textContent = L.text;
      out.push({ id: L.id, text: L.text, x: x0, y: y0, box: geo.box, alpha, blurPx });
    }
    return out;
  }
  void NS;
  return { draw, measure, slots: parts.length };
}

// Fade-in/out of one label: the dot appears, the line draws out from it (12 frames), the text
// fades in (14 frames, 4 frames after the dot); the whole label (alpha) leaves over 12 frames
// ending at tOut. Outside [tIn, tOut) alpha is 0.
export function labelFade(t, tIn, tOut, util) {
  const F = util.frames;
  const inDot = util.tween(t, tIn, F(10), "power2.out");
  const inLine = util.tween(t, tIn, F(12), "power2.out");
  const inText = util.tween(t, tIn + F(4), F(14), "power2.out");
  const out = 1 - util.tween(t, tOut - F(12), F(12), "power2.in");
  return { dot: inDot, line: inLine, textAlpha: inText, alpha: t >= tIn && t < tOut ? out : 0 };
}

// ---------------------------------------------------------------------------------------------
// Build-time choice of the labelled cells and of the text side (pure, fixed rule)
// ---------------------------------------------------------------------------------------------
/**
 * specs: [{ id, type (slab.js type index), text, tIn, tOut, region: [x0, y0, x1, y1] px (the
 *          screen box the cell must stay in for the whole label window; keeps labels apart) }]
 * opts:  { days: [d0, d1] (the beat's slab range), dayAt, step (s, default 2 frames) }
 * Returns the labels that have a cell (a type absent from the data on any day of its window,
 * or without a qualifying cell, is dropped: no label names a type the data does not show):
 *   [{ ...spec, anchor: [x, y, z], offset: [dx, dy], site, key, report }]
 */
export function pickLabels(ctx, slab, specs, opts) {
  const { THREE, util } = ctx;
  const { dayAt } = opts;
  const cam = new THREE.PerspectiveCamera(28, W / H, 0.01, 1000);
  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();
  const _c = new THREE.Vector3();
  const clampDay = (d) => util.clamp(d, opts.days[0], opts.days[1]);
  const S = LABEL_STYLE.safe;
  const placed = []; // [{ samples: [{x, y, box}] }] of labels already placed
  const result = [];
  const cellCache = new Map();
  const cellsOn = (d) => {
    if (!cellCache.has(d)) cellCache.set(d, slab.cellsOn(d));
    return cellCache.get(d);
  };
  const overlay = ctx.labels;
  const dropped = [];
  const FPS = 30;
  const MIN_DOT_SEP = 170; // px between the dots of one stop's labels

  for (const spec of specs) {
    // the label's integer days (the slab shows the clamped film day)
    const d0 = Math.floor(clampDay(dayAt(spec.tIn)));
    const d1 = Math.ceil(clampDay(dayAt(spec.tOut)));
    let present = true;
    for (let d = d0; d <= d1; d++) if (!(slab.counts(d)[slab.typeName(spec.type)] > 0)) present = false;
    if (!present) {
      dropped.push({ id: spec.id, why: "type absent from the slab on a day of the window" });
      continue;
    }
    const cands = slab.stableCells(spec.type, d0, d1);
    if (!cands.length) {
      dropped.push({ id: spec.id, why: "no cell keeps its site and type through the window" });
      continue;
    }
    // the camera on every even film frame of the window (one grid for every label, so the
    // samples of two labels with staggered windows line up by frame)
    const cams = [];
    for (let f = 2 * Math.ceil((spec.tIn * FPS) / 2); f <= spec.tOut * FPS + 1e-6; f += 2) {
      const t = f / FPS;
      const k = ctx.cameraAt(t);
      const c = cam.clone();
      c.position.fromArray(k.pos);
      c.up.set(0, 1, 0);
      c.lookAt(_v.fromArray(k.target));
      c.rotateZ(THREE.MathUtils.degToRad(k.roll));
      c.fov = k.fov;
      c.near = k.near;
      c.far = k.distance + 400;
      c.updateProjectionMatrix();
      c.updateMatrixWorld(true);
      cams.push({ c, focus: k.distance, t, f, day: Math.floor(clampDay(dayAt(t))) });
    }
    const proj = (p, c) => {
      _w.copy(p).applyMatrix4(c.matrixWorldInverse);
      _v.copy(p).project(c);
      return [((_v.x + 1) / 2) * W, ((1 - _v.y) / 2) * H, -_w.z];
    };
    const R = spec.region;
    const rc = [(R[0] + R[2]) / 2, (R[1] + R[3]) / 2];
    const rad = slab.cellRadius(spec.type);
    const midI = Math.floor(cams.length / 2);
    const why = { region: 0, near: 0, hidden: 0, layout: 0 };
    // 1. every candidate that stays in its region, in frame and apart from the dots placed before
    const ranked = [];
    for (const cand of cands) {
      let ok = true;
      let off = 0;
      let dist = 0;
      const samples = [];
      for (const k of cams) {
        const [x, y, z] = proj(cand.pos, k.c);
        if (z <= 0 || x < R[0] || x > R[2] || y < R[1] || y > R[3] || x < S + 40 || x > W - S - 40 || y < S + 30 || y > H - S - 30) {
          ok = false;
          why.region++;
          break;
        }
        for (const P of placed) {
          const q = P.byFrame.get(k.f);
          if (q && Math.hypot(q.x - x, q.y - y) < MIN_DOT_SEP) ok = false;
        }
        if (!ok) {
          why.near++;
          break;
        }
        off = Math.max(off, Math.abs(z - k.focus)); // distance from the focal plane (mm)
        dist += Math.hypot(x - rc[0], y - rc[1]);
        samples.push({ x, y, z });
      }
      if (!ok) continue;
      // score: nearest to the focal plane first (0.02 mm buckets), then nearest to the region's
      // centre, then the lowest site index (the candidates come sorted by site; stable sort)
      ranked.push({ cand, score: Math.round(off / 0.02) * 1e6 + dist / samples.length, samples, off });
    }
    ranked.sort((a, b) => a.score - b.score);
    // 2. in that order, the first that is not hidden and whose text finds a place
    const w = overlay ? overlay.measure(spec.text) : spec.text.length * 15;
    const options = [];
    for (const sd of spec.sides ?? [1, -1])
      for (const dy of [-120, -80, -40, 40, 80, 120, -160, 160]) for (const run of [70, 150]) options.push([sd * (Math.abs(dy) * 0.55 + run), dy]);
    let chosen = null;
    for (const best of ranked.slice(0, 200)) {
      // not hidden: no other cell of that day in front of it within its own projected radius
      const mid = cams[midI];
      const me = best.samples[midI];
      const pxR = ((rad / me.z) * (H / 2)) / Math.tan(THREE.MathUtils.degToRad(mid.c.fov) / 2);
      const C = cellsOn(mid.day);
      let hidden = false;
      for (let n = 0; n < C.n && !hidden; n++) {
        if (C.site[n] === best.cand.site) continue;
        _c.set(C.pos[n * 3], C.pos[n * 3 + 1], C.pos[n * 3 + 2]);
        const [x, y, z] = proj(_c, mid.c);
        if (z < me.z - rad && Math.hypot(x - me.x, y - me.y) < 0.8 * pxR) hidden = true;
      }
      if (hidden) {
        why.hidden++;
        continue;
      }
      // Text side: the offset whose text box covers the fewest cells over the window, stays
      // inside the safe margins, and clears the labels placed before it.
      let bestOff = null;
      for (const [dx, dy] of options) {
        let ok = true;
        let dens = 0;
        const byFrame = new Map();
        for (let i = 0; i < cams.length && ok; i++) {
          const sm = best.samples[i];
          const g = leaderGeometry(sm.x, sm.y, dx, dy, w);
          const b = g.box;
          if (b[0] < S || b[2] > W - S || b[1] < S || b[3] > H - S) {
            ok = false;
            break;
          }
          for (const P of placed) {
            const q = P.byFrame.get(cams[i].f);
            if (!q) continue;
            const pb = q.box;
            const pad = 14;
            if (b[0] < pb[2] + pad && b[2] > pb[0] - pad && b[1] < pb[3] + pad && b[3] > pb[1] - pad) ok = false;
            // the other label's dot and leader must not run under this text, nor ours under its text
            if (segBox(q.x, q.y, q.elbow, q.end, b, 6) || segBox(sm.x, sm.y, g.elbow, g.end, pb, 6)) ok = false;
            if (segsCross([sm.x, sm.y], g.elbow, g.end, [q.x, q.y], q.elbow, q.end)) ok = false;
          }
          if (!ok) break;
          byFrame.set(cams[i].f, { x: sm.x, y: sm.y, box: b, elbow: g.elbow, end: g.end });
          if (i % 3 === 0) {
            const C2 = cellsOn(cams[i].day);
            for (let n = 0; n < C2.n; n++) {
              _c.set(C2.pos[n * 3], C2.pos[n * 3 + 1], C2.pos[n * 3 + 2]);
              const [x, y, z] = proj(_c, cams[i].c);
              if (z > 0 && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) dens++;
            }
          }
        }
        if (!ok) continue;
        const score = dens + 0.02 * Math.hypot(dx, dy);
        if (!bestOff || score < bestOff.score) bestOff = { off: [dx, dy], score, byFrame, dens };
      }
      if (!bestOff) {
        why.layout++;
        continue;
      }
      chosen = { best, bestOff };
      break;
    }
    if (!chosen) {
      dropped.push({ id: spec.id, why, candidates: cands.length, ranked: ranked.length });
      continue;
    }
    const { best, bestOff } = chosen;
    placed.push({ byFrame: bestOff.byFrame });
    result.push({
      ...spec,
      anchor: best.cand.pos.toArray(),
      offset: bestOff.off,
      site: best.cand.site,
      key: best.cand.key,
      report: { candidates: cands.length, inRegion: ranked.length, offFocusMM: +best.off.toFixed(3), density: bestOff.dens, days: [d0, d1] },
    });
  }
  ctx.labelReport = (ctx.labelReport || []).concat(result.map((r) => ({ id: r.id, offset: r.offset, anchor: r.anchor.map((v) => +v.toFixed(3)), site: r.site, ...r.report })), dropped);
  return result;
}

function segBox(x0, y0, elbow, end, b, pad) {
  return segHitsBox([x0, y0], elbow, b, pad) || segHitsBox(elbow, end, b, pad);
}
function segHitsBox(a, c, b, pad) {
  // sample the segment (short segments, a few px apart): exact enough for a layout test
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((c[0] - a[0]) * i) / n;
    const y = a[1] + ((c[1] - a[1]) * i) / n;
    if (x > b[0] - pad && x < b[2] + pad && y > b[1] - pad && y < b[3] + pad) return true;
  }
  return false;
}
function segsCross(a0, a1, a2, b0, b1, b2) {
  const segs = (p, q, r) => [
    [p, q],
    [q, r],
  ];
  for (const [p, q] of segs(a0, a1, a2))
    for (const [r, s] of segs(b0, b1, b2)) {
      const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
      if (Math.abs(d) < 1e-9) continue;
      const u = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
      const v = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
      if (u > 0 && u < 1 && v > 0 && v < 1) return true;
    }
  return false;
}
