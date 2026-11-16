// SilicoGraft Socket View: two extraction sockets (32 empty, 33 beta-TCP) in a lower jaw, six months of simulated
// healing. Data contract: data/manifest.json (site/DEPLOY.md, "The dental viewer"). three.js r147 (global THREE) is loaded by
// index.html from ../vendor/three-0.147.0/.
"use strict";
(() => {
const $ = (id) => document.getElementById(id);
const DATA = "data/";
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Tissue codes of the frames (manifest "codes"): colour, cube size (fraction of the voxel) and label.
// Bone and graft fill their voxel; cells are drawn smaller so the tissue around them stays readable.
const TISSUES = {
  1: { key: "msc", name: "Stem cell", color: "#eda100", size: 0.55, cssVar: "--t-msc" },
  2: { key: "fib", name: "Fibroblast", color: "#1baf7a", size: 0.8, cssVar: "--t-fib" },
  3: { key: "cho", name: "Chondrocyte", color: "#7d6cf0", size: 0.8, cssVar: "--t-cho" },
  4: { key: "bone", name: "New bone", color: "#3d8fe6", size: 0.96, cssVar: "--t-bone" },
  5: { key: "tcp", name: "β-TCP granule", color: "#e34948", size: 0.96, cssVar: "--t-tcp" },
};
const MAXCODE = 8;
const SOCKET_LABEL = { "32": "empty", "33": "β-TCP" };
// human biopsy expectations (central core) at 3 and 6 months, used only when series.json brings none
// (the human socket parameters report in dental/literature/, section 0)
const LIT_FALLBACK = {
  "32": { nb: [{ day: 91, low: 25, high: 45, mid: 35 }, { day: 182, low: 40, high: 60, mid: 50 }] },
  "33": { nb: [{ day: 91, low: 15, high: 30, mid: 22 }, { day: 182, low: 25, high: 45, mid: 35 }],
          rb: [{ day: 91, low: 8, high: 30, mid: 18 }, { day: 182, low: 2, high: 20, mid: 10 }] },
};

const state = {
  day: 0, playing: false, speed: 14, touchedTime: false,
  vis: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true },
  show: { "32": true, "33": true }, teeth: true, opacity: 0.2,
  section: "off", flip: false, pos: { md: 0, bl: 0 },
};
let manifest = null, FD = [0], NF = 1, series = null;
const sockets = [];          // per socket: geometry, frames, instanced mesh
let dirty = true;
const requestRender = () => { dirty = true; };

// ---------------------------------------------------------------- three.js
const canvas = $("canvas"), stage = $("stage");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
} catch (e) {
  $("loading").textContent = "WebGL could not start in this browser. Open the page in a current Chrome, Edge, Firefox or Safari.";
  throw e;
}
renderer.setClearColor(0x000000, 0);
renderer.localClippingEnabled = true;
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(pixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 3000);
camera.position.set(40, 50, 160);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xe8eef4, 0x2a2622, 0.6));
const head = new THREE.DirectionalLight(0xffffff, 0.7); head.position.set(0.4, 0.8, 1); camera.add(head);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.12;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.addEventListener("change", requestRender);
controls.addEventListener("start", () => { tween = null; });

// jaw: bone is drawn twice (back faces, then front faces) so the see-through shell sorts correctly
const jawFront = new THREE.MeshLambertMaterial({ color: 0xd9ccb0, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.FrontSide });
const jawBack = new THREE.MeshLambertMaterial({ color: 0xb9ab90, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.BackSide });
const teethMat = new THREE.MeshLambertMaterial({ color: 0xf2ede3, side: THREE.DoubleSide });
const jawGroup = new THREE.Group(), teethGroup = new THREE.Group();
scene.add(jawGroup, teethGroup);
const jawBox = new THREE.Box3();

// ---------------------------------------------------------------- voxels (instanced cubes, one mesh per socket)
const U = {
  uT: { value: 0 }, uVox: { value: 0.2 },
  uVis: { value: new Array(MAXCODE).fill(0) }, uSize: { value: new Array(MAXCODE).fill(0) },
  uColor: { value: Array.from({ length: MAXCODE }, () => new THREE.Color(0x888888)) },
};
const VS = `
uniform float uT; uniform float uVox;
uniform float uVis[${MAXCODE}]; uniform float uSize[${MAXCODE}]; uniform vec3 uColor[${MAXCODE}];
attribute vec3 aPos; attribute vec2 aCode;
varying vec3 vColor; varying vec3 vNormal;
void main() {
  int c0 = int(aCode.x + 0.5); int c1 = int(aCode.y + 0.5);
  float t = smoothstep(0.0, 1.0, uT);
  float s = mix(uVis[c0] * uSize[c0], uVis[c1] * uSize[c1], t);
  vec3 r0 = c0 > 0 ? uColor[c0] : uColor[c1];
  vec3 r1 = c1 > 0 ? uColor[c1] : r0;
  vColor = mix(r0, r1, t);
  vNormal = normalMatrix * normal;
  if (s < 0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(aPos + position * uVox * s, 1.0);
}`;
const FS = `
varying vec3 vColor; varying vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  float a = max(dot(n, normalize(vec3(0.35, 0.6, 0.75))), 0.0);
  float b = max(dot(n, normalize(vec3(-0.6, -0.15, 0.5))), 0.0);
  gl_FragColor = vec4(vColor * (0.36 + 0.62 * a + 0.16 * b), 1.0);
}`;
const voxelMat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: U });
const cube = new THREE.BoxGeometry(1, 1, 1);
const DRAW = new Uint8Array(256), SOLID = new Uint8Array(256);
function tissueUniforms() {
  for (let c = 0; c < MAXCODE; c++) {
    const t = TISSUES[c], on = !!(t && state.vis[c]);
    U.uVis.value[c] = on ? 1 : 0; U.uSize.value[c] = t ? t.size : 0;
    if (t) U.uColor.value[c].set(t.color);
    DRAW[c] = on ? 1 : 0; SOLID[c] = on && t.size >= 0.9 ? 1 : 0;
  }
}
tissueUniforms();

function makeSocket(m) {
  const [nx, ny, nz] = m.dims, nvox = nx * ny * nz;
  const S = { id: String(m.id), arm: m.arm, nx, ny, nz, nvox, vox: m.voxel || 0.2, origin: m.origin, file: m.frames,
    frames: null, loaded: 0, inside: null, f0: -1, f1: -1, dirty: true };
  S.box = new THREE.Box3(new THREE.Vector3(...m.origin), new THREE.Vector3(m.origin[0] + nx * S.vox, m.origin[1] + ny * S.vox, m.origin[2] + nz * S.vox));
  S.center = S.box.getCenter(new THREE.Vector3());
  S.top = new THREE.Vector3(S.center.x, S.box.max.y, S.center.z);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = cube.index; geo.setAttribute("position", cube.attributes.position); geo.setAttribute("normal", cube.attributes.normal);
  geo.instanceCount = 0;
  S.geo = geo;
  S.mesh = new THREE.Mesh(geo, voxelMat); S.mesh.frustumCulled = false; S.mesh.visible = false;
  scene.add(S.mesh);
  return S;
}
// the socket's own voxels (not 255) are taken from frame 0; their centres and whether all six neighbours lie in the box
function indexSocket(S) {
  const f = S.frames, n = S.nvox, { nx, ny, nz } = S;
  let N = 0; for (let v = 0; v < n; v++) if (f[v] !== 255) N++;
  const inside = new Uint32Array(N), px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N), interior = new Uint8Array(N);
  const [ox, oy, oz] = S.origin, h = S.vox;
  let j = 0;
  for (let k = 0, v = 0; k < nz; k++) for (let y = 0; y < ny; y++) for (let i = 0; i < nx; i++, v++) {
    if (f[v] === 255) continue;
    inside[j] = v; px[j] = ox + (i + 0.5) * h; py[j] = oy + (y + 0.5) * h; pz[j] = oz + (k + 0.5) * h;
    interior[j] = i > 0 && i < nx - 1 && y > 0 && y < ny - 1 && k > 0 && k < nz - 1 ? 1 : 0;
    j++;
  }
  Object.assign(S, { inside, px, py, pz, interior, clip: new Uint8Array(N), solid: new Uint8Array(n) });
  S.aPos = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); S.aPos.setUsage(THREE.DynamicDrawUsage);
  S.aCode = new THREE.InstancedBufferAttribute(new Uint8Array(N * 2), 2); S.aCode.setUsage(THREE.DynamicDrawUsage);
  S.geo.setAttribute("aPos", S.aPos); S.geo.setAttribute("aCode", S.aCode);
  S.mesh.visible = state.show[S.id];
}
// Fill the instance buffers for the current pair of frames: a voxel is drawn when its tissue is shown in either frame,
// it is not cut away by the section, and not hidden on all six sides by solid (bone or graft) voxels.
function rebuild(S) {
  if (!S.inside) return;
  const n = S.nvox, nx = S.nx, nxy = S.nx * S.ny, N = S.inside.length;
  const A = S.frames.subarray(S.f0 * n, S.f0 * n + n), B = S.frames.subarray(S.f1 * n, S.f1 * n + n);
  const solid = S.solid, clip = S.clip, cut = section.active;
  const [qx, qy, qz] = section.normal, q0 = section.offset;
  for (let j = 0; j < N; j++) {
    const v = S.inside[j], a = A[v], b = B[v];
    const c = cut && (qx * S.px[j] + qy * S.py[j] + qz * S.pz[j] > q0) ? 1 : 0;
    clip[j] = c; solid[v] = !c && SOLID[a] && SOLID[b] ? 1 : 0;
  }
  const P = S.aPos.array, C = S.aCode.array;
  let m = 0;
  for (let j = 0; j < N; j++) {
    if (clip[j]) continue;
    const v = S.inside[j], a = A[v], b = B[v];
    if (!DRAW[a] && !DRAW[b]) continue;
    if (solid[v] && S.interior[j] && solid[v - 1] && solid[v + 1] && solid[v - nx] && solid[v + nx] && solid[v - nxy] && solid[v + nxy]) continue;
    P[3 * m] = S.px[j]; P[3 * m + 1] = S.py[j]; P[3 * m + 2] = S.pz[j];
    C[2 * m] = a < MAXCODE ? a : 0; C[2 * m + 1] = b < MAXCODE ? b : 0; m++;
  }
  S.geo.instanceCount = m;
  S.aPos.needsUpdate = true; S.aCode.needsUpdate = true;
  S.drawn = m; S.dirty = false;
}

// ---------------------------------------------------------------- time
function framePair(d, loaded) {
  let i = 0; while (i < NF - 1 && FD[i + 1] <= d) i++;
  let j = Math.min(i + 1, NF - 1);
  let t = j > i ? (d - FD[i]) / (FD[j] - FD[i]) : 0;
  if (j >= loaded) { i = Math.min(i, Math.max(0, loaded - 1)); j = i; t = 0; }
  return [i, j, Math.max(0, Math.min(1, t))];
}
function applyTime() {
  let t = 0;
  for (const S of sockets) {
    if (!S.loaded) continue;
    const [i, j, tt] = framePair(state.day, S.loaded);
    if (i !== S.f0 || j !== S.f1) { S.f0 = i; S.f1 = j; S.dirty = true; }
    t = tt;
  }
  U.uT.value = t;
  const d = Math.floor(state.day + 1e-6);
  $("day-big").textContent = `Day ${d}`;
  $("day-sub").textContent = `week ${Math.floor(d / 7)} · month ${(d / 30.44).toFixed(1)}`;
  const slider = $("day"); if (document.activeElement !== slider) slider.value = d;
  slider.setAttribute("aria-valuetext", `Day ${d}`);
  readout(d);
  drawCharts();
  requestRender();
}
function setPlaying(v) {
  state.playing = v;
  $("icon-play").toggleAttribute("hidden", v); $("icon-pause").toggleAttribute("hidden", !v);
  $("play").setAttribute("aria-label", v ? "Pause" : "Play");
  if (v && state.day >= FD[NF - 1]) state.day = 0;
  lastTs = 0;
}

// ---------------------------------------------------------------- section plane
// Frame of the two sockets: MD runs from the 32 centre to the 33 centre (horizontal), BL is horizontal and
// perpendicular to it, pointing labially (away from the jaw's centroid, which is the origin), UP is superior.
const section = { active: false, normal: [0, 0, 0], offset: 0, MD: new THREE.Vector3(1, 0, 0), BL: new THREE.Vector3(0, 0, 1), UP: new THREE.Vector3(0, 1, 0),
  ref: { md: 0, bl: 0 }, range: { md: [-3, 3], bl: [-3, 3] }, slab: { md: [], bl: [] }, cutPlane: new THREE.Plane() };
function sectionFrame() {
  const a = sockets.find((s) => s.id === "32") || sockets[0], b = sockets.find((s) => s.id === "33") || sockets[sockets.length - 1];
  const md = b.center.clone().sub(a.center); md.y = 0;
  if (md.lengthSq() < 1e-6) md.set(1, 0, 0);
  md.normalize();
  const bl = new THREE.Vector3().crossVectors(md, section.UP).normalize();
  const mid = a.center.clone().add(b.center).multiplyScalar(0.5); mid.y = 0;
  if (bl.dot(mid) < 0) bl.negate();
  section.MD.copy(md); section.BL.copy(bl);
  // extents of the socket boxes along each axis
  const ext = (ax) => {
    let lo = Infinity, hi = -Infinity;
    for (const S of sockets) for (let c = 0; c < 8; c++) {
      const p = new THREE.Vector3(c & 1 ? S.box.max.x : S.box.min.x, c & 2 ? S.box.max.y : S.box.min.y, c & 4 ? S.box.max.z : S.box.min.z);
      const d = p.dot(ax); lo = Math.min(lo, d); hi = Math.max(hi, d);
    }
    return [lo, hi];
  };
  const eMD = ext(md), eBL = ext(bl), eUP = ext(section.UP);
  section.ref.bl = mid.dot(bl);
  section.ref.md = a.center.dot(md);
  section.range.bl = [eBL[0] - section.ref.bl, eBL[1] - section.ref.bl];
  section.range.md = [eMD[0] - section.ref.md, eMD[1] - section.ref.md];
  section.socketMD = sockets.map((S) => { const e = ext1(S, md); return { id: S.id, lo: e[0] - section.ref.md, hi: e[1] - section.ref.md, c: S.center.dot(md) - section.ref.md }; });
  // the slab the jaw and teeth are cut in (clipIntersection: only what lies beyond the cut AND inside the slab goes).
  // Along the cut's own axis the slab is open, so on the bucco-lingual cut the front teeth in the line of sight go too.
  const lim = (ax, lo, hi) => [new THREE.Plane(ax.clone(), -hi), new THREE.Plane(ax.clone().negate(), lo)];
  const up = lim(section.UP, eUP[0] - 5, eUP[1] + 14);
  section.slab = { md: [...lim(md, eMD[0] - 4, eMD[1] + 4), ...up], bl: [...lim(bl, eBL[0] - 8, eBL[1] + 8), ...up] };
}
function ext1(S, ax) {
  let lo = Infinity, hi = -Infinity;
  for (let c = 0; c < 8; c++) {
    const p = new THREE.Vector3(c & 1 ? S.box.max.x : S.box.min.x, c & 2 ? S.box.max.y : S.box.min.y, c & 4 ? S.box.max.z : S.box.min.z);
    const d = p.dot(ax); lo = Math.min(lo, d); hi = Math.max(hi, d);
  }
  return [lo, hi];
}
// the side that is cut away: labial for the mesio-distal plane, mesial for the bucco-lingual one ("flip" swaps it)
function removedDir() {
  if (state.section === "md") return state.flip ? section.BL.clone().negate() : section.BL.clone();
  return state.flip ? section.MD.clone() : section.MD.clone().negate();
}
function applySection() {
  const on = state.section !== "off";
  section.active = on;
  if (on) {
    // the mesio-distal section is a plane along MD: it moves along BL; the bucco-lingual one moves along MD
    const k = state.section, a = k === "md" ? "bl" : "md", ax = k === "md" ? section.BL : section.MD;
    const at = section.ref[a] + state.pos[k];          // plane: ax . p = at
    const r = removedDir(), sgn = r.dot(ax) > 0 ? 1 : -1;
    // removed: sgn * (ax . p - at) > 0
    section.normal = [sgn * ax.x, sgn * ax.y, sgn * ax.z]; section.offset = sgn * at;
    section.cutPlane.set(new THREE.Vector3(-sgn * ax.x, -sgn * ax.y, -sgn * ax.z), sgn * at);
  }
  const planes = on ? [section.cutPlane, ...section.slab[state.section === "md" ? "md" : "bl"]] : [];
  for (const m of [jawFront, jawBack, teethMat]) { m.clippingPlanes = planes; m.clipIntersection = true; m.needsUpdate = true; }
  for (const S of sockets) S.dirty = true;
  // panel
  document.querySelectorAll("[data-section]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.section === state.section));
  $("section-controls").hidden = !on;
  if (on) {
    const k = state.section, [lo, hi] = section.range[k === "md" ? "bl" : "md"], inp = $("section-pos");
    inp.min = (Math.floor(lo * 10) / 10).toFixed(1); inp.max = (Math.ceil(hi * 10) / 10).toFixed(1);
    if (document.activeElement !== inp) inp.value = state.pos[k];
    $("section-out").textContent = sectionLabel();
    const ends = $("section-ends");
    if (k === "md") ends.innerHTML = "<span>lingual</span><span>labial</span>";
    else {
      const w = hi - lo;
      ends.innerHTML = "<span>mesial</span><span>distal</span>" + section.socketMD.map((s) => `<i style="left:${((s.c - lo) / w * 100).toFixed(1)}%">${s.id}</i>`).join("");
    }
    $("section-flip").textContent = k === "md" ? (state.flip ? "Cut the labial side" : "Cut the lingual side") : (state.flip ? "Cut the mesial side" : "Cut the distal side");
  }
  requestRender();
}
function sectionLabel() {
  const k = state.section, p = state.pos[k];
  if (k === "md") return Math.abs(p) < 0.05 ? "centre" : `${Math.abs(p).toFixed(1)} mm ${p > 0 ? "labial" : "lingual"}`;
  const s = section.socketMD.find((s) => p >= s.lo && p <= s.hi);
  return s ? `in ${s.id}` : "between";
}

// ---------------------------------------------------------------- camera presets
let tween = null;
function fitDistance(r) {
  const v = THREE.MathUtils.degToRad(camera.fov), h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
  return r / Math.sin(Math.min(v, h) / 2);
}
function cameraTo(name, instant) {
  if (!sockets.length) return;
  let target, dir, r;
  if (name === "jaw" && !jawBox.isEmpty()) {
    target = jawBox.getCenter(new THREE.Vector3());
    r = jawBox.getSize(new THREE.Vector3()).length() / 2 * 0.92;
    dir = section.BL.clone().add(section.UP.clone().multiplyScalar(0.42)).normalize();  // facing the sockets' labial side
  } else {
    const all = new THREE.Box3(); sockets.forEach((S) => all.union(S.box));
    target = all.getCenter(new THREE.Vector3());
    r = all.getSize(new THREE.Vector3()).length() / 2 * 1.25 + 4;  // some jaw and the neighbouring teeth around the sockets
    dir = state.section !== "off" ? removedDir().add(section.UP.clone().multiplyScalar(0.18)).normalize()
      : section.BL.clone().add(section.UP.clone().multiplyScalar(0.55)).add(section.MD.clone().multiplyScalar(-0.15)).normalize();
  }
  const pos = target.clone().add(dir.multiplyScalar(fitDistance(r)));
  if (instant || reducedMotion) { camera.position.copy(pos); controls.target.copy(target); controls.update(); requestRender(); return; }
  tween = { t0: performance.now(), dur: 700, p0: camera.position.clone(), q0: controls.target.clone(), p1: pos, q1: target };
}
function stepTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.t0) / tween.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const o0 = tween.p0.clone().sub(tween.q0), o1 = tween.p1.clone().sub(tween.q1);
  const len = THREE.MathUtils.lerp(o0.length(), o1.length(), e);
  const d = o0.normalize().lerp(o1.normalize(), e); if (d.lengthSq() < 1e-6) d.copy(o1);
  controls.target.lerpVectors(tween.q0, tween.q1, e);
  camera.position.copy(controls.target).add(d.normalize().multiplyScalar(len));
  controls.update(); requestRender();
  if (k >= 1) tween = null;
}

// ---------------------------------------------------------------- render loop
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  requestRender();
}
new ResizeObserver(resize).observe(stage);
const tagEls = {};
function placeTags() {
  const w = stage.clientWidth, h = stage.clientHeight, v = new THREE.Vector3(), shown = [];
  for (const S of sockets) {
    let el = tagEls[S.id];
    if (!el) {
      el = document.createElement("div"); el.className = "tag";
      el.style.setProperty("--c", `var(--s${S.id}, var(--accent))`);
      el.innerHTML = `<b>${S.id}</b>${SOCKET_LABEL[S.id] || S.arm}`;
      $("tags").appendChild(el); tagEls[S.id] = el;
    }
    v.copy(S.top); v.y += 1.2; v.project(camera);
    // the tag goes when the whole socket is cut away (every corner of its box beyond the plane)
    const [qx, qy, qz] = section.normal, b0 = S.box.min, b1 = S.box.max;
    const cutAway = section.active && Math.min(qx * b0.x, qx * b1.x) + Math.min(qy * b0.y, qy * b1.y) + Math.min(qz * b0.z, qz * b1.z) > section.offset;
    const ok = state.show[S.id] && !cutAway && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    el.hidden = !ok;
    if (ok) shown.push({ el, x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, w: el.offsetWidth });
  }
  // two tags that would overlap move apart sideways
  shown.sort((a, b) => a.x - b.x);
  for (let i = 1; i < shown.length; i++) {
    const a = shown[i - 1], b = shown[i], need = (a.w + b.w) / 2 + 6 - (b.x - a.x);
    if (need > 0 && Math.abs(a.y - b.y) < 26) { a.x -= need / 2; b.x += need / 2; }
  }
  for (const t of shown) t.el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
}
let lastTs = 0, slow = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
  if (state.playing) {
    state.day += dt * state.speed;
    const end = FD[NF - 1];
    if (state.day >= end) { state.day = end; setPlaying(false); }
    applyTime();
    if (dt > 0.05) { if (++slow > 20 && pixelRatio > 0.75) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); slow = 0; } }
    else slow = Math.max(0, slow - 1);
  }
  stepTween(ts);
  if (controls.update()) dirty = true;
  if (!dirty) return;
  dirty = false;
  for (const S of sockets) { S.mesh.visible = !!S.inside && state.show[S.id]; if (S.dirty && S.mesh.visible) rebuild(S); }
  renderer.render(scene, camera);
  placeTags();
}

// ---------------------------------------------------------------- data
function status(t) { $("status").textContent = t || ""; }
async function getJSON(f) {
  const r = await fetch(DATA + f);
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  return r.json();
}
function loadGLB(f) {
  return new Promise((ok, fail) => new THREE.GLTFLoader().load(DATA + f, ok, undefined, (e) => fail(new Error(`${f}: ${e.message || e}`))));
}
function addMeshes(gltf, group, mats) {
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.computeBoundingBox(); jawBox.union(g.boundingBox);
    mats.forEach((m, i) => { const me = new THREE.Mesh(g, m); me.renderOrder = 2 + i; group.add(me); });
  });
}
// frames: (n_frames, nz, ny, nx) uint8, x fastest; streamed, so day 0 shows before the whole file is in
async function loadFrames(S, onFrame) {
  const total = NF * S.nvox;
  const r = await fetch(DATA + S.file);
  if (!r.ok) throw new Error(`${S.file}: HTTP ${r.status}`);
  let stream = r.body;
  if (/\.gz$/.test(S.file) && stream && stream.getReader) {
    // a gzipped file (GitHub Pages serves it as is); a server that already unpacked it sends no gzip magic
    const rd0 = stream.getReader(), first = await rd0.read();
    const head = first.value || new Uint8Array(0), gz = head[0] === 0x1f && head[1] === 0x8b;
    stream = new ReadableStream({
      start(c) { if (head.length) c.enqueue(head); if (first.done) c.close(); },
      async pull(c) { const { done, value } = await rd0.read(); if (done) c.close(); else c.enqueue(value); },
    });
    if (gz) {
      if (!("DecompressionStream" in window)) throw new Error("this browser cannot unpack the compressed frames");
      stream = stream.pipeThrough(new DecompressionStream("gzip"));
    }
  }
  S.frames = new Uint8Array(total);
  let got = 0;
  if (!stream || !stream.getReader) {
    const b = new Uint8Array(await r.arrayBuffer()); S.frames.set(b.subarray(0, total)); got = b.length;
  } else {
    const rd = stream.getReader();
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      const take = Math.min(value.length, total - got);
      if (take > 0) S.frames.set(value.subarray(0, take), got);
      got += value.length;
      const nf = Math.min(NF, Math.floor(got / S.nvox));
      if (nf > S.loaded) { S.loaded = nf; onFrame(S); }
    }
  }
  if (got !== total) throw new Error(`${S.file}: ${got} bytes, expected ${total} (${NF} frames of ${S.nx} × ${S.ny} × ${S.nz})`);
  S.loaded = NF; onFrame(S);
}

// series.json (the case pipeline's format): per socket "days", "whole" {new_bone, residual_graft, stem_cells, soft_tissue,
// cartilage, clot_or_marrow; sum 100}, "core" {new_bone, residual_graft}, "expected" {core_new_bone, core_residual_graft:
// [{day, value, low, high}]}; root "bands" {"x2.5"|"x5": {id: {days, whole_new_bone}}}. Normalized to
// { s: { id: { days, nb, rb, msc, soft, cart, clot, cnb, crb, bands: { nb: [faster, slower] } } }, lit: { id: { nb, rb } } }
function normSeries(raw) {
  const out = { s: {}, lit: {}, seeds: raw.seeds, framesSeed: raw.frames_seed };
  const root = raw.sockets || {};
  const arr = (a) => (Array.isArray(a) ? a.map(Number) : null);
  for (const S of sockets) {
    const o = root[S.id];
    if (!o) continue;
    const W = o.whole || {}, C = o.core || {};
    const e = { days: arr(o.days), nb: arr(W.new_bone), rb: arr(W.residual_graft), msc: arr(W.stem_cells), soft: arr(W.soft_tissue),
      cart: arr(W.cartilage), clot: arr(W.clot_or_marrow), cnb: arr(C.new_bone), crb: arr(C.residual_graft), bands: {} };
    const fast = raw.bands && raw.bands["x2.5"] && raw.bands["x2.5"][S.id], slow = raw.bands && raw.bands["x5"] && raw.bands["x5"][S.id];
    if (fast && slow && fast.whole_new_bone && slow.whole_new_bone)
      e.bands.nb = [{ days: arr(fast.days), v: arr(fast.whole_new_bone) }, { days: arr(slow.days), v: arr(slow.whole_new_bone) }];
    out.s[S.id] = e;
    const X = o.expected || {}, fix = (a) => (Array.isArray(a) ? a.map((q) => ({ day: +q.day, low: +q.low, high: +q.high, mid: q.value != null ? +q.value : null })) : null);
    out.lit[S.id] = { nb: fix(X.core_new_bone) || (LIT_FALLBACK[S.id] || {}).nb || null, rb: fix(X.core_residual_graft) || (LIT_FALLBACK[S.id] || {}).rb || null };
  }
  return out;
}
function valueAt(e, k, d) {
  const a = e && e[k], days = e && e.days;
  if (!a || !days) return null;
  let lo = 0, hi = days.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (days[m] <= d) lo = m; else hi = m - 1; }
  return a[lo];
}

// ---------------------------------------------------------------- readout and charts
const fmt = (x) => x == null || isNaN(x) ? "–" : `${x.toFixed(1)}`;
function readout(d) {
  $("read-title").textContent = `Day ${d}, % of the socket`;
  if (!series) { $("read").innerHTML = ""; return; }
  const ids = sockets.map((S) => S.id);
  const rows = [["New bone", "nb", false], ["virtual core", "cnb", true], ["β-TCP", "rb", false], ["virtual core", "crb", true],
    ["Stem cells", "msc", false], ["Fibrous tissue", "soft", false], ["Cartilage", "cart", false], ["Clot or marrow", "clot", false]];
  const head = `<thead><tr><th></th>${ids.map((id) => `<th scope="col">${id} · ${SOCKET_LABEL[id] || ""}</th>`).join("")}</tr></thead>`;
  // a tissue that never forms in this run (all zero in both sockets) gets no row
  const used = (k) => ids.some((id) => { const a = series.s[id] && series.s[id][k]; return a && a.some((v) => v > 0.05); });
  const body = rows.filter(([, k]) => used(k) || (k === "nb" || k === "cnb")).map(([name, k, sub]) =>
    `<tr><th scope="row" class="${sub ? "sub" : ""}">${name}</th>${ids.map((id) => {
      const e = series.s[id]; const graftless = (k === "rb" || k === "crb") && /empty/i.test(sockets.find((S) => S.id === id).arm || "");
      return `<td>${graftless ? "–" : fmt(valueAt(e, k, d))}</td>`;
    }).join("")}</tr>`).join("");
  $("read").innerHTML = head + `<tbody>${body}</tbody>`;
}
let chartT = 0;
function drawCharts(force) {
  const now = performance.now(); if (!force && now - chartT < 40) return; chartT = now;
  if (!series) return;
  chart("chart-nb", "nb", "cnb", sockets.map((S) => S.id), 60);
  chart("chart-rb", "rb", "crb", sockets.filter((S) => !/empty/i.test(S.arm || "")).map((S) => S.id), 60);
}
function chart(id, k, kc, ids, ymin) {
  const c = $(id), dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  const D = FD[NF - 1] || 182;
  let ymax = ymin;
  for (const sid of ids) {
    const e = series.s[sid]; if (!e) continue;
    for (const kk of [k, kc]) if (e[kk]) for (const v of e[kk]) ymax = Math.max(ymax, v);
    if (e.bands && e.bands[k]) for (const b of e.bands[k]) for (const v of b.v) ymax = Math.max(ymax, v);
    const lit = series.lit[sid] && series.lit[sid][k]; if (lit) for (const L0 of lit) ymax = Math.max(ymax, L0.high);
  }
  ymax = Math.min(100, Math.ceil(ymax / 20) * 20);
  const L = 30, R = 10, T = 6, B = 18, X = (d) => L + (w - L - R) * d / D, Y = (v) => T + (h - T - B) * (1 - v / ymax);
  x.font = `11px ${css("--font-ui") || "sans-serif"}`; x.lineWidth = 1;
  x.strokeStyle = css("--line"); x.fillStyle = css("--muted");
  for (let v = 0; v <= ymax; v += 20) { x.beginPath(); x.moveTo(L, Math.round(Y(v)) + 0.5); x.lineTo(w - R, Math.round(Y(v)) + 0.5); x.stroke(); x.textAlign = "right"; x.fillText(v, L - 5, Y(v) + 4); }
  x.textAlign = "center";
  for (let m = 0; m <= 6; m++) { const d = Math.min(D, m * 30.44); x.fillText(m === 0 ? "0" : `${m} mo`, Math.min(X(d), w - R - 12), h - 4); }
  ids.forEach((sid, n) => {
    const e = series.s[sid]; if (!e) return;
    const col = css(`--s${sid}`) || css("--accent");
    // time-scale band (whole socket at x2.5 and x5 instead of x3.5), when the package has one; each curve has its own days
    const band = e.bands && e.bands[k];
    if (band) {
      const [f, sl] = band;
      x.globalAlpha = 0.13; x.fillStyle = col; x.beginPath(); x.moveTo(X(0), Y(0));
      f.days.forEach((d, i) => x.lineTo(X(d), Y(f.v[i])));
      for (let i = sl.days.length - 1; i >= 0; i--) x.lineTo(X(sl.days[i]), Y(sl.v[i]));
      x.closePath(); x.fill(); x.globalAlpha = 1;
    }
    // literature boxes (human biopsy cores, 3 and 6 months), side by side when both sockets have one
    const lit = series.lit[sid] && series.lit[sid][k];
    if (lit) for (const L0 of lit) {
      const off = ids.length > 1 ? (n === 0 ? -1 : 1) * 4.5 : 0; let cx = X(Math.min(D - 8, L0.day)) + off * (w - L - R) / D;
      const bw = Math.max(6, 7 * (w - L - R) / D);
      cx = Math.min(cx, w - R - bw / 2);
      x.fillStyle = col; x.globalAlpha = 0.16; x.fillRect(cx - bw / 2, Y(L0.high), bw, Y(L0.low) - Y(L0.high)); x.globalAlpha = 1;
      x.strokeStyle = col; x.lineWidth = 1; x.strokeRect(Math.round(cx - bw / 2) + 0.5, Math.round(Y(L0.high)) + 0.5, Math.round(bw), Math.round(Y(L0.low) - Y(L0.high)));
      if (L0.mid != null) { x.beginPath(); x.moveTo(cx - bw / 2, Y(L0.mid)); x.lineTo(cx + bw / 2, Y(L0.mid)); x.stroke(); }
    }
    for (const [kk, dash] of [[k, []], [kc, [4, 3]]]) {
      const a = e[kk]; if (!a) continue;
      x.strokeStyle = col; x.lineWidth = 1.8; x.setLineDash(dash); x.beginPath();
      e.days.forEach((d, i) => (i ? x.lineTo(X(d), Y(a[i])) : x.moveTo(X(d), Y(a[i])))); x.stroke();
    }
    x.setLineDash([]);
  });
  x.strokeStyle = css("--fg"); x.globalAlpha = 0.55; x.lineWidth = 1;
  x.beginPath(); x.moveTo(Math.round(X(state.day)) + 0.5, T); x.lineTo(Math.round(X(state.day)) + 0.5, h - B); x.stroke(); x.globalAlpha = 1;
}
function legend() {
  const line = (col, dash) => `<svg viewBox="0 0 22 10" aria-hidden="true"><path d="M1 5h20" style="stroke:${col}" stroke-width="2" ${dash ? 'stroke-dasharray="4 3"' : ""}/></svg>`;
  const fg = "var(--fg-2)";
  let h = sockets.map((S) => `<span>${line(`var(--s${S.id}, var(--accent))`)}${S.id} · ${SOCKET_LABEL[S.id] || S.arm}</span>`).join("");
  h += `<span>${line(fg)}whole socket</span><span>${line(fg, true)}virtual core</span>`;
  h += `<span style="grid-column:1/-1"><svg viewBox="0 0 22 10" aria-hidden="true"><rect x="7" y="0.5" width="8" height="9" style="fill:none;stroke:${fg}"/></svg>human biopsy cores, 3 and 6 months</span>`;
  if (series && Object.values(series.s).some((e) => e && Object.keys(e.bands).length)) h += `<span style="grid-column:1/-1"><svg viewBox="0 0 22 10" aria-hidden="true"><rect x="1" y="1" width="20" height="8" style="fill:${fg}" opacity="0.25"/></svg>whole socket at time scale ×2.5 to ×5</span>`;
  $("legend").innerHTML = h;
}
for (const id of ["chart-nb", "chart-rb"]) {
  const c = $(id); let down = false;
  const set = (e) => {
    const r = c.getBoundingClientRect(), D = FD[NF - 1] || 182;
    state.day = Math.max(0, Math.min(D, Math.round((e.clientX - r.left - 30) / (r.width - 38) * D)));
    state.touchedTime = true; setPlaying(false); applyTime();
  };
  c.addEventListener("pointerdown", (e) => { down = true; c.setPointerCapture(e.pointerId); set(e); });
  c.addEventListener("pointermove", (e) => { if (down) set(e); });
  c.addEventListener("pointerup", () => { down = false; });
  c.addEventListener("pointercancel", () => { down = false; });
}
new ResizeObserver(() => drawCharts(true)).observe($("chart-nb"));

// ---------------------------------------------------------------- controls
function ticks(short) {
  const D = FD[NF - 1] || 182;
  $("ticks").innerHTML = [0, 1, 2, 3, 4, 5, 6].map((m) => {
    const d = Math.min(D, m * 30.44), last = m === 6;
    return `<span style="left:${(d / D * 100).toFixed(2)}%${last ? ";transform:translateX(-100%)" : m === 0 ? ";transform:none" : ""}">${m === 0 ? "0" : short ? m : `month ${m}`}</span>`;
  }).join("");
}
$("play").addEventListener("click", () => { state.touchedTime = true; setPlaying(!state.playing); });
$("day").addEventListener("input", (e) => { state.touchedTime = true; state.day = +e.target.value; applyTime(); });
$("speed").addEventListener("change", (e) => { state.speed = +e.target.value; });
document.addEventListener("keydown", (e) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (e.code === "Space" && !["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(tag)) { e.preventDefault(); state.touchedTime = true; setPlaying(!state.playing); }
});
document.querySelectorAll("[data-camera]").forEach((b) => b.addEventListener("click", () => cameraTo(b.dataset.camera)));
$("opacity").addEventListener("input", (e) => { state.opacity = +e.target.value; applyJaw(); });
$("show-teeth").addEventListener("change", (e) => { state.teeth = e.target.checked; applyJaw(); });
for (const id of ["32", "33"]) $(`show-${id}`).addEventListener("change", (e) => { state.show[id] = e.target.checked; for (const S of sockets) S.dirty = true; requestRender(); });
document.querySelectorAll("[data-section]").forEach((b) => b.addEventListener("click", () => {
  const was = state.section; state.section = b.dataset.section; if (state.section !== was) state.flip = false; applySection();
  if (state.section !== was) cameraTo("sockets");
}));
$("section-pos").addEventListener("input", (e) => { state.pos[state.section] = +e.target.value; applySection(); });
$("section-flip").addEventListener("click", () => { state.flip = !state.flip; applySection(); cameraTo("sockets"); });
function applyJaw() {
  const o = state.opacity;
  $("opacity-out").textContent = `${Math.round(o * 100)} %`;
  const solid = o >= 0.99;
  for (const m of [jawFront, jawBack]) { m.opacity = o; m.transparent = !solid; m.depthWrite = solid; m.needsUpdate = true; }
  jawGroup.visible = o > 0.01;
  jawGroup.children.forEach((me) => { if (me.material === jawBack) me.visible = !solid; });
  teethGroup.visible = state.teeth;
  requestRender();
}
// a tissue with no voxel in any frame keeps its toggle, dimmed and last, with a short note
function markAbsentTissues() {
  const seen = new Uint8Array(256);
  for (const S of sockets) if (S.frames) for (let i = 0; i < S.frames.length; i++) seen[S.frames[i]] = 1;
  const box = $("tissues");
  box.querySelectorAll("input[data-code]").forEach((i) => {
    if (seen[+i.dataset.code]) return;
    const l = i.closest("label"); l.classList.add("absent"); l.title = "No voxel holds this tissue in this run";
    l.insertAdjacentHTML("beforeend", ' <small>(none in this run)</small>'); box.appendChild(l);
  });
}
function tissueToggles() {
  const codes = manifest && manifest.codes ? Object.keys(manifest.codes).map(Number).filter((c) => TISSUES[c]) : Object.keys(TISSUES).map(Number);
  const ORDER = [4, 5, 1, 2, 3];  // bone and graft first, then the cells
  codes.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  $("tissues").innerHTML = codes.map((c) => `<label class="check"><input type="checkbox" data-code="${c}" checked><i class="swatch" style="background:var(${TISSUES[c].cssVar})"></i>${TISSUES[c].name}</label>`).join("");
  $("tissues").querySelectorAll("input").forEach((i) => i.addEventListener("change", () => {
    state.vis[+i.dataset.code] = i.checked; tissueUniforms(); for (const S of sockets) S.dirty = true; requestRender();
  }));
}

// ---------------------------------------------------------------- top bar, full screen
const top = document.querySelector(".top");
new ResizeObserver(() => document.documentElement.style.setProperty("--top", top.getBoundingClientRect().height + "px")).observe(top);
if (document.fullscreenEnabled) {
  const b = $("fullscreen"); b.hidden = false;
  b.addEventListener("click", () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); });
  document.addEventListener("fullscreenchange", () => { b.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen"; });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) b.click();
  });
}

// ---------------------------------------------------------------- phone layout: bottom sheet
const phone = matchMedia("(max-width: 40rem)");
const sheet = $("sheet"), handle = $("sheet-handle"), sheetBody = $("sheet-body");
const MOVED = [[".timebar", "sheet-time"], [".panel", "sheet-body"], [".notes", "sheet-body"]].map(([s, t]) => {
  const el = document.querySelector(s), mark = document.createComment(` phone layout: ${s} is in the sheet `);
  el.before(mark); return { el, mark, target: $(t) };
});
const sheetClosed = () => handle.offsetHeight + $("sheet-time").offsetHeight + sheet.clientTop;
function writeSheetClosed() { if (phone.matches) document.documentElement.style.setProperty("--sheet-closed", `${sheetClosed()}px`); }
function openSheet(v) { sheet.classList.toggle("open", v); handle.setAttribute("aria-expanded", v); if (!v) sheetBody.scrollTop = 0; }
function layout() {
  const p = phone.matches;
  for (const M of MOVED) { if (p) M.target.append(M.el); else if (M.mark.nextSibling !== M.el) M.mark.after(M.el); }
  sheet.hidden = !p; ticks(p);
  if (!p) { openSheet(false); document.documentElement.style.removeProperty("--sheet-closed"); }
  writeSheetClosed(); drawCharts(true);
}
phone.addEventListener("change", layout);
if (matchMedia("(pointer: coarse)").matches) $("hint").textContent = "One finger: rotate · two fingers: zoom and pan";
new ResizeObserver(writeSheetClosed).observe($("sheet-time"));
let drag = null, dragged = false;
handle.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; drag = { y: e.clientY, h: sheet.getBoundingClientRect().height, moved: false }; dragged = false; handle.setPointerCapture(e.pointerId); });
handle.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dy = drag.y - e.clientY;
  if (!drag.moved && Math.abs(dy) < 6) return;
  drag.moved = true; sheet.classList.add("drag");
  sheet.style.height = `${Math.max(sheetClosed(), Math.min(innerHeight * 0.88, drag.h + dy))}px`;
});
function endDrag() {
  const d = drag; drag = null;
  if (!d || !d.moved) return;
  const h = sheet.getBoundingClientRect().height;
  sheet.classList.remove("drag"); sheet.style.height = "";
  openSheet(h > (sheetClosed() + innerHeight * 0.72) / 2); dragged = true;
}
handle.addEventListener("pointerup", endDrag);
handle.addEventListener("pointercancel", endDrag);
handle.addEventListener("click", () => { if (dragged) { dragged = false; return; } openSheet(!sheet.classList.contains("open")); });
layout();

// ---------------------------------------------------------------- start
ticks(phone.matches); applyJaw(); applyTime(); requestAnimationFrame(loop);
(async () => {
  try {
    manifest = await getJSON("manifest.json");
    if (manifest.version !== 1) throw new Error(`manifest version ${manifest.version}`);
    FD = manifest.frame_days; NF = FD.length;
    $("day").max = FD[NF - 1]; ticks(phone.matches);
    for (const m of manifest.sockets) sockets.push(makeSocket(m));
    U.uVox.value = sockets[0].vox;
    sectionFrame(); applySection(); tissueToggles();
    if (manifest.setting) $("setting").textContent = `Run setting: ${manifest.setting}.`;
    if (manifest.voxel_rule) { $("voxel-rule").textContent = manifest.voxel_rule.replace(/^./, (c) => c.toUpperCase()) + "."; $("voxel-rule-box").hidden = false; }
    getJSON(manifest.series).then((raw) => {
      series = normSeries(raw); legend(); readout(Math.floor(state.day)); drawCharts(true);
      if (series.seeds) $("seeds").textContent = `The charts and the table are the mean of ${series.seeds} runs with different random seeds; the cubes show one of them${series.framesSeed ? ` (seed ${series.framesSeed})` : ""}.`;
    })
      .catch((e) => { $("chart-note").textContent = `The charts could not load (${e.message}).`; });
    legend();
    // the jaw first, then the frames
    const meshes = manifest.meshes || {};
    const [jaw, teeth] = await Promise.all([meshes.mandible ? loadGLB(meshes.mandible) : null, meshes.teeth ? loadGLB(meshes.teeth).catch(() => null) : null]);
    if (jaw) addMeshes(jaw, jawGroup, [jawBack, jawFront]);
    if (teeth) addMeshes(teeth, teethGroup, [teethMat]);
    applyJaw(); resize(); cameraTo("jaw", true);
    $("loading").hidden = true;
    let done = 0;
    status(`Loading the simulation: 0 of ${NF} frames`);
    const onFrame = (S) => {
      if (!S.inside && S.loaded >= 1) indexSocket(S);
      applyTime();
      const n = Math.min(...sockets.map((s) => s.loaded));
      if (n < NF) status(`Loading the simulation: ${n} of ${NF} frames`);
    };
    await Promise.all(sockets.map((S) => loadFrames(S, onFrame).then(() => { done++; })));
    status("");
    markAbsentTissues();
    if (!state.touchedTime && !reducedMotion) { state.day = 0; applyTime(); setPlaying(true); }
  } catch (e) {
    console.error(e);
    const l = $("loading"); l.hidden = false; l.textContent = `Could not load the simulation data: ${e.message}`;
    status("");
  }
})();
})();
