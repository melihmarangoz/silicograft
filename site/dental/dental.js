// SilicoGraft Socket View: two extraction sockets (32, 33) in an anonymized lower jaw, six months of simulated healing,
// grafted with beta-TCP or empty, under several loadings (none, natural teeth, a 7-unit bridge, ovate pontics).
// Data contract: data/manifest.json (site/DEPLOY.md, "The dental viewer"). three.js r147 (global THREE) is loaded by
// index.html from ../vendor/three-0.147.0/.
"use strict";
(() => {
const $ = (id) => document.getElementById(id);
const DATA = "data/";
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const query = new URLSearchParams(location.search);

// Tissue codes of the frames (manifest "codes"): colour, cube size (fraction of the voxel) and label.
// Bone and graft fill their voxel; cells are drawn smaller so the tissue around them stays readable.
const TISSUES = {
  1: { name: "Stem cell", color: "#eda100", size: 0.55, cssVar: "--t-msc" },
  2: { name: "Fibroblast", color: "#1baf7a", size: 0.8, cssVar: "--t-fib" },
  3: { name: "Chondrocyte", color: "#7d6cf0", size: 0.8, cssVar: "--t-cho" },
  4: { name: "New bone", color: "#3d8fe6", size: 0.96, cssVar: "--t-bone" },
  5: { name: "β-TCP granule", color: "#e34948", size: 0.96, cssVar: "--t-tcp" },
};
const MAXCODE = 8;
const isGraft = (arm) => /tcp/i.test(arm || "");
const armName = (arm) => (isGraft(arm) ? "β-TCP" : "empty");
const armVar = (arm) => (isGraft(arm) ? "var(--arm-tcp)" : "var(--arm-empty)");
// scenario names for run ids (the "_swapped" twin of each has the graft in the other socket)
const LOADING_NAMES = { baseline: "No load", natural_teeth: "Natural teeth", bridge: "Bridge, pontics clear the tissue",
  ovate_cap: "Bridge, ovate pontic in the socket mouth (clinical)",
  ovate05: "Bridge, pontic pressed 0.5 mm into the tissue (not clinical, upper bound)",
  ovate10: "Bridge, pontic pressed 1.0 mm into the tissue (not clinical, upper bound)" };
const LOADING_SHORT = { baseline: "no load", natural_teeth: "natural teeth", bridge: "bridge", ovate_cap: "bridge, ovate pontics (clinical)",
  ovate05: "pontics pressed 0.5 mm (upper bound)", ovate10: "pontics pressed 1.0 mm (upper bound)" };

const state = {
  day: 0, playing: false, speed: 14, touchedTime: false,
  vis: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true },
  show: { "32": true, "33": true }, teeth: true, bridge: false, opacity: 0.2, opacityBeforeStrain: null,
  strain: false, strainCase: null,
  loading: "baseline", graft: "33", compare: "off",
  section: "off", flip: false, pos: { md: 0, bl: 0 },
};
let manifest = null, FD = [0], NF = 1;
const geoms = [];            // socket geometry (manifest.sockets): id, dims, origin, box
const vsets = new Map();     // frames file -> voxel set (frames, instanced mesh), loaded on demand
const seriesCache = new Map();  // series file -> normalized series (or a promise while loading)
let runs = [], scenarios = [];  // runs from the manifest; scenarios = loading key -> { graft socket id -> run }
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
const teethMat = new THREE.MeshLambertMaterial({ color: 0xeee5d4, side: THREE.DoubleSide });
// zirconia: a cooler white than the natural teeth, glossy, slightly translucent
const bridgeMat = new THREE.MeshPhongMaterial({ color: 0xe4edf6, specular: 0x5a6470, shininess: 70, transparent: true, opacity: 0.8, side: THREE.FrontSide });
const jawGroup = new THREE.Group(), teethGroup = new THREE.Group();
// two bridges: pontics that clear the tissue ("bridge") and ovate pontics in the socket mouths ("bridge_ovate"),
// each loaded the first time a scenario shows it
const bridges = { bridge: { group: new THREE.Group(), state: "" }, bridge_ovate: { group: new THREE.Group(), state: "" } };
scene.add(jawGroup, teethGroup, bridges.bridge.group, bridges.bridge_ovate.group);
const jawBox = new THREE.Box3();
let jawGeom = null;  // the mandible geometry (its vertex order is the order of surface_strain)

// ---------------------------------------------------------------- voxels (instanced cubes, one mesh per frames file)
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

function makeGeom(m) {
  const [nx, ny, nz] = m.dims, vox = m.voxel || 0.2;
  const G = { id: String(m.id), nx, ny, nz, nvox: nx * ny * nz, vox, origin: m.origin };
  G.box = new THREE.Box3(new THREE.Vector3(...m.origin), new THREE.Vector3(m.origin[0] + nx * vox, m.origin[1] + ny * vox, m.origin[2] + nz * vox));
  G.center = G.box.getCenter(new THREE.Vector3());
  G.top = new THREE.Vector3(G.center.x, G.box.max.y, G.center.z);
  return G;
}
const geomOf = (id) => geoms.find((g) => g.id === id);
// a voxel set: one frames file of one socket; its mesh is shared by every run that uses the file
function vset(file, G) {
  let V = vsets.get(file);
  if (V) return V;
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = cube.index; geo.setAttribute("position", cube.attributes.position); geo.setAttribute("normal", cube.attributes.normal);
  geo.instanceCount = 0;
  V = { file, G, frames: null, loaded: 0, inside: null, f0: -1, f1: -1, dirty: true, geo, codes: null, promise: null };
  V.mesh = new THREE.Mesh(geo, voxelMat); V.mesh.frustumCulled = false; V.mesh.visible = false;
  scene.add(V.mesh);
  vsets.set(file, V);
  V.promise = loadFrames(V).catch((e) => { console.error(e); status(`Could not load ${file}: ${e.message}`); });
  return V;
}
// the socket's own voxels (not 255) are taken from frame 0; their centres and whether all six neighbours lie in the box
function indexSet(V) {
  const f = V.frames, { nx, ny, nz, nvox: n } = V.G;
  let N = 0; for (let v = 0; v < n; v++) if (f[v] !== 255) N++;
  const inside = new Uint32Array(N), px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N), interior = new Uint8Array(N);
  const [ox, oy, oz] = V.G.origin, h = V.G.vox;
  let j = 0;
  for (let k = 0, v = 0; k < nz; k++) for (let y = 0; y < ny; y++) for (let i = 0; i < nx; i++, v++) {
    if (f[v] === 255) continue;
    inside[j] = v; px[j] = ox + (i + 0.5) * h; py[j] = oy + (y + 0.5) * h; pz[j] = oz + (k + 0.5) * h;
    interior[j] = i > 0 && i < nx - 1 && y > 0 && y < ny - 1 && k > 0 && k < nz - 1 ? 1 : 0;
    j++;
  }
  Object.assign(V, { inside, px, py, pz, interior, clip: new Uint8Array(N), solid: new Uint8Array(n) });
  V.aPos = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); V.aPos.setUsage(THREE.DynamicDrawUsage);
  V.aCode = new THREE.InstancedBufferAttribute(new Uint8Array(N * 2), 2); V.aCode.setUsage(THREE.DynamicDrawUsage);
  V.geo.setAttribute("aPos", V.aPos); V.geo.setAttribute("aCode", V.aCode);
}
// Fill the instance buffers for the current pair of frames: a voxel is drawn when its tissue is shown in either frame,
// it is not cut away by the section, and not hidden on all six sides by solid (bone or graft) voxels.
function rebuild(V) {
  if (!V.inside) return;
  const n = V.G.nvox, nx = V.G.nx, nxy = V.G.nx * V.G.ny, N = V.inside.length;
  const A = V.frames.subarray(V.f0 * n, V.f0 * n + n), B = V.frames.subarray(V.f1 * n, V.f1 * n + n);
  const solid = V.solid, clip = V.clip, cut = section.active;
  const [qx, qy, qz] = section.normal, q0 = section.offset;
  for (let j = 0; j < N; j++) {
    const v = V.inside[j], a = A[v], b = B[v];
    const c = cut && (qx * V.px[j] + qy * V.py[j] + qz * V.pz[j] > q0) ? 1 : 0;
    clip[j] = c; solid[v] = !c && SOLID[a] && SOLID[b] ? 1 : 0;
  }
  const P = V.aPos.array, C = V.aCode.array;
  let m = 0;
  for (let j = 0; j < N; j++) {
    if (clip[j]) continue;
    const v = V.inside[j], a = A[v], b = B[v];
    if (!DRAW[a] && !DRAW[b]) continue;
    if (solid[v] && V.interior[j] && solid[v - 1] && solid[v + 1] && solid[v - nx] && solid[v + nx] && solid[v - nxy] && solid[v + nxy]) continue;
    P[3 * m] = V.px[j]; P[3 * m + 1] = V.py[j]; P[3 * m + 2] = V.pz[j];
    C[2 * m] = a < MAXCODE ? a : 0; C[2 * m + 1] = b < MAXCODE ? b : 0; m++;
  }
  V.geo.instanceCount = m;
  V.aPos.needsUpdate = true; V.aCode.needsUpdate = true;
  V.dirty = false;
}
function markAllDirty() { for (const V of vsets.values()) V.dirty = true; requestRender(); }

// ---------------------------------------------------------------- runs, scenarios and the view
// key of a run: its loading (the "_swapped" twin shares it); the grafted socket tells the twins apart
const loadingKey = (r) => (r.id === "swapped" ? "baseline" : r.id.replace(/_swapped$/, ""));
const graftedSocket = (r) => Object.keys(r.arms).find((k) => isGraft(r.arms[k]));
function setupRuns() {
  runs = manifest.runs && manifest.runs.length ? manifest.runs
    : [{ id: "baseline", label: "", loading: "none", arms: Object.fromEntries(manifest.sockets.map((s) => [String(s.id), s.arm])),
      frames: Object.fromEntries(manifest.sockets.map((s) => [String(s.id), s.frames])), series: manifest.series }];
  const by = new Map();
  for (const r of runs) {
    const k = loadingKey(r);
    if (!by.has(k)) by.set(k, { key: k, runs: {} });
    by.get(k).runs[graftedSocket(r) || "none"] = r;
  }
  scenarios = [...by.values()];
}
const scenario = () => scenarios.find((s) => s.key === state.loading) || scenarios[0];
// the run of the current loading with the graft in socket g (falls back to the other twin if there is none)
function runFor(g) { const s = scenario(); return s.runs[g] || Object.values(s.runs)[0]; }
const hasBridge = (key) => /bridge|ovate/.test(key);
// the ovate scenarios show the bridge with ovate pontics when the package has it
const bridgeKind = (key) => (/ovate/.test(key) && manifest.meshes && manifest.meshes.bridge_ovate ? "bridge_ovate" : "bridge");
function ensureBridge(kind) {
  const B = bridges[kind], file = manifest && manifest.meshes && manifest.meshes[kind];
  if (!file || B.state) return;
  B.state = "loading";
  loadGLB(file).then((g) => { addMeshes(g, B.group, [bridgeMat], false); B.state = "ready"; applyJaw(); })
    .catch((e) => { B.state = "failed"; console.error(e); status(`Could not load the bridge (${e.message}).`); });
}
// What is on screen: panes, each with its sockets ({ G, run, V }). Normal: one pane, both sockets of the current run.
// Compare: two panes, the chosen socket empty (left or top) and grafted (right or bottom), under the same loading.
function view() {
  if (!scenarios.length || !geoms.length) return [];
  if (state.compare !== "off") {
    const sid = state.compare, other = geoms.map((g) => g.id).find((id) => id !== sid);
    return [runFor(other), runFor(sid)].map((r) => ({ cols: [col(sid, r)] }));
  }
  const r = runFor(state.graft);
  return [{ cols: geoms.map((g) => col(g.id, r)) }];
}
function col(sid, run) {
  const G = geomOf(sid);
  return { sid, G, run, arm: run.arms[sid], V: vset(run.frames[sid], G) };
}
const columns = () => view().flatMap((p) => p.cols);

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
  for (const c of columns()) {
    const V = c.V; if (!V.loaded) continue;
    const [i, j, tt] = framePair(state.day, V.loaded);
    if (i !== V.f0 || j !== V.f1) { V.f0 = i; V.f1 = j; V.dirty = true; }
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
function ext1(G, ax) {
  let lo = Infinity, hi = -Infinity;
  for (let c = 0; c < 8; c++) {
    const p = new THREE.Vector3(c & 1 ? G.box.max.x : G.box.min.x, c & 2 ? G.box.max.y : G.box.min.y, c & 4 ? G.box.max.z : G.box.min.z);
    const d = p.dot(ax); lo = Math.min(lo, d); hi = Math.max(hi, d);
  }
  return [lo, hi];
}
function sectionFrame() {
  const a = geomOf("32") || geoms[0], b = geomOf("33") || geoms[geoms.length - 1];
  const md = b.center.clone().sub(a.center); md.y = 0;
  if (md.lengthSq() < 1e-6) md.set(1, 0, 0);
  md.normalize();
  const bl = new THREE.Vector3().crossVectors(md, section.UP).normalize();
  const mid = a.center.clone().add(b.center).multiplyScalar(0.5); mid.y = 0;
  if (bl.dot(mid) < 0) bl.negate();
  section.MD.copy(md); section.BL.copy(bl);
  const ext = (ax) => { let lo = Infinity, hi = -Infinity; for (const G of geoms) { const e = ext1(G, ax); lo = Math.min(lo, e[0]); hi = Math.max(hi, e[1]); } return [lo, hi]; };
  const eMD = ext(md), eBL = ext(bl), eUP = ext(section.UP);
  section.ref.bl = mid.dot(bl);
  section.ref.md = a.center.dot(md);
  section.range.bl = [eBL[0] - section.ref.bl, eBL[1] - section.ref.bl];
  section.range.md = [eMD[0] - section.ref.md, eMD[1] - section.ref.md];
  section.socketMD = geoms.map((G) => { const e = ext1(G, md); return { id: G.id, lo: e[0] - section.ref.md, hi: e[1] - section.ref.md, c: G.center.dot(md) - section.ref.md }; });
  // the slab the jaw, teeth and bridge are cut in (clipIntersection: only what lies beyond the cut AND inside the slab goes).
  // Along the cut's own axis the slab is open, so on the bucco-lingual cut the front teeth in the line of sight go too.
  const lim = (ax, lo, hi) => [new THREE.Plane(ax.clone(), -hi), new THREE.Plane(ax.clone().negate(), lo)];
  const up = lim(section.UP, eUP[0] - 5, eUP[1] + 16);
  section.slab = { md: [...lim(md, eMD[0] - 4, eMD[1] + 4), ...up], bl: [...lim(bl, eBL[0] - 8, eBL[1] + 8), ...up] };
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
  for (const m of [jawFront, jawBack, teethMat, bridgeMat]) { m.clippingPlanes = planes; m.clipIntersection = true; m.needsUpdate = true; }
  markAllDirty();
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
}
function sectionLabel() {
  const k = state.section, p = state.pos[k];
  if (k === "md") return Math.abs(p) < 0.05 ? "centre" : `${Math.abs(p).toFixed(1)} mm ${p > 0 ? "labial" : "lingual"}`;
  const s = section.socketMD.find((s) => p >= s.lo && p <= s.hi);
  return s ? `in ${s.id}` : "between";
}

// ---------------------------------------------------------------- camera presets
let tween = null;
function paneAspect() { const r = paneRects(view().length)[0]; return r[2] / r[3]; }
function fitDistance(r) {
  const v = THREE.MathUtils.degToRad(camera.fov), h = 2 * Math.atan(Math.tan(v / 2) * paneAspect());
  return r / Math.sin(Math.min(v, h) / 2);
}
function cameraTo(name, instant) {
  if (!geoms.length) return;
  let target, dir, r;
  if (name === "jaw" && !jawBox.isEmpty()) {
    target = jawBox.getCenter(new THREE.Vector3());
    r = jawBox.getSize(new THREE.Vector3()).length() / 2 * 0.92;
    dir = section.BL.clone().add(section.UP.clone().multiplyScalar(0.42)).normalize();  // facing the sockets' labial side
  } else {
    const all = new THREE.Box3();
    (state.compare !== "off" ? [geomOf(state.compare)] : geoms).forEach((G) => all.union(G.box));
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
// pane rectangles in CSS pixels from the top left: two panes side by side on a wide stage, stacked on a tall one
function paneRects(n) {
  const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
  if (n < 2) return [[0, 0, w, h]];
  return w >= h ? [[0, 0, w / 2, h], [w / 2, 0, w / 2, h]] : [[0, 0, w, h / 2], [0, h / 2, w, h / 2]];
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  paneOverlays();
  requestRender();
}
new ResizeObserver(resize).observe(stage);
// pane labels and the rule between the panes (compare mode)
function paneOverlays() {
  const P = view(), R = paneRects(P.length), box = $("panes");
  if (P.length < 2) { box.innerHTML = ""; return; }
  const wide = R[1][0] > 0;
  box.innerHTML = P.map((p, i) => {
    const c = p.cols[0], [x, y, w, h] = R[i];
    return `<div class="pane-label" style="--c:${armVar(c.arm)};left:${x + w / 2}px;top:${y + h - 34}px">Socket ${c.sid} · ${armName(c.arm)}</div>`;
  }).join("") + (wide ? `<div class="pane-rule" style="left:${R[1][0] - 0.5}px;top:0;bottom:0;width:1px"></div>`
    : `<div class="pane-rule" style="top:${R[1][1] - 0.5}px;left:0;right:0;height:1px"></div>`);
}
const tagEls = new Map();
function placeTags(P, R) {
  const v = new THREE.Vector3(), shown = [], used = new Set();
  P.forEach((p, pi) => {
    const [x0, y0, w, h] = R[pi];
    for (const c of p.cols) {
      const key = `${pi}:${c.sid}`; used.add(key);
      let el = tagEls.get(key);
      if (!el) { el = document.createElement("div"); el.className = "tag"; $("tags").appendChild(el); tagEls.set(key, el); }
      el.style.setProperty("--c", armVar(c.arm));
      el.innerHTML = `<b>${c.sid}</b>${armName(c.arm)}`;
      // anchored under the socket's apex, clear of the crowns and the bridge's pontics
      v.set(c.G.center.x, c.G.box.min.y - 0.8, c.G.center.z); v.project(camera);
      // the tag goes when the whole socket is cut away (every corner of its box beyond the plane)
      const [qx, qy, qz] = section.normal, b0 = c.G.box.min, b1 = c.G.box.max;
      const cutAway = section.active && Math.min(qx * b0.x, qx * b1.x) + Math.min(qy * b0.y, qy * b1.y) + Math.min(qz * b0.z, qz * b1.z) > section.offset;
      const ok = (P.length > 1 || state.show[c.sid]) && !cutAway && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      el.hidden = !ok;
      if (ok) shown.push({ el, pi, x: x0 + (v.x + 1) / 2 * w, y: y0 + (1 - v.y) / 2 * h, w: el.offsetWidth });
    }
  });
  for (const [k, el] of tagEls) if (!used.has(k)) el.hidden = true;
  // two tags of a pane that would overlap move apart sideways
  shown.sort((a, b) => a.pi - b.pi || a.x - b.x);
  for (let i = 1; i < shown.length; i++) {
    const a = shown[i - 1], b = shown[i], need = (a.w + b.w) / 2 + 6 - (b.x - a.x);
    if (a.pi === b.pi && need > 0 && Math.abs(a.y - b.y) < 26) { a.x -= need / 2; b.x += need / 2; }
  }
  for (const t of shown) t.el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, 0)`;
}
function render() {
  const P = view(), R = paneRects(P.length), H = stage.clientHeight;
  for (const V of vsets.values()) V.mesh.visible = false;
  renderer.setScissorTest(P.length > 1);
  P.forEach((p, i) => {
    const [x, y, w, h] = R[i];
    for (const V of vsets.values()) V.mesh.visible = false;
    for (const c of p.cols) {
      const on = !!c.V.inside && (P.length > 1 || state.show[c.sid]);
      c.V.mesh.visible = on;
      if (on && c.V.dirty) rebuild(c.V);
    }
    renderer.setViewport(x, H - y - h, w, h); renderer.setScissor(x, H - y - h, w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  });
  placeTags(P, R);
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
  render();
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
function addMeshes(gltf, group, mats, box) {
  const out = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.computeBoundingBox(); if (box) jawBox.union(g.boundingBox);
    mats.forEach((m, i) => { const me = new THREE.Mesh(g, m); me.renderOrder = 2 + i; group.add(me); });
    out.push(g);
  });
  return out;
}
// a stream of the file's bytes; a .gz file (GitHub Pages serves it as is) is unpacked, unless the server already did
async function openStream(file) {
  const r = await fetch(DATA + file);
  if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
  let stream = r.body;
  if (!stream || !stream.getReader) return { buf: new Uint8Array(await r.arrayBuffer()) };
  if (/\.gz$/.test(file)) {
    const rd0 = stream.getReader(), first = await rd0.read();
    const head = first.value || new Uint8Array(0), gz = head[0] === 0x1f && head[1] === 0x8b;
    stream = new ReadableStream({
      start(c) { if (head.length) c.enqueue(head); if (first.done) c.close(); },
      async pull(c) { const { done, value } = await rd0.read(); if (done) c.close(); else c.enqueue(value); },
    });
    if (gz) {
      if (!("DecompressionStream" in window)) throw new Error("this browser cannot unpack the compressed data");
      stream = stream.pipeThrough(new DecompressionStream("gzip"));
    }
  }
  return { stream };
}
// frames: (n_frames, nz, ny, nx) uint8, x fastest; streamed, so day 0 shows before the whole file is in
async function loadFrames(V) {
  const total = NF * V.G.nvox, n = V.G.nvox;
  V.frames = new Uint8Array(total);
  const src = await openStream(V.file);
  let got = 0;
  const progress = () => {
    const nf = Math.min(NF, Math.floor(got / n));
    if (nf > V.loaded) { V.loaded = nf; if (!V.inside) indexSet(V); onFrames(); }
  };
  if (src.buf) { V.frames.set(src.buf.subarray(0, total)); got = src.buf.length; progress(); }
  else {
    const rd = src.stream.getReader();
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      const take = Math.min(value.length, total - got);
      if (take > 0) V.frames.set(value.subarray(0, take), got);
      got += value.length;
      progress();
    }
  }
  if (got !== total) throw new Error(`${V.file}: ${got} bytes, expected ${total} (${NF} frames of ${V.G.nx} × ${V.G.ny} × ${V.G.nz})`);
  V.loaded = NF;
  V.codes = new Uint8Array(256); for (let i = 0; i < total; i++) V.codes[V.frames[i]] = 1;
  onFrames();
}
function onFrames() {
  const cs = columns(), n = Math.min(...cs.map((c) => c.V.loaded));
  status(n < NF ? `Loading the simulation: ${n} of ${NF} frames` : "");
  if (n >= NF) markAbsentTissues();
  applyTime();
}

// series (the case pipeline's format): per socket "days", "whole" {new_bone, residual_graft, stem_cells, soft_tissue,
// cartilage, clot_or_marrow; sum 100}, "core" {new_bone, residual_graft}, "expected" {core_new_bone, core_residual_graft:
// [{day, value, low, high}]}; root "bands" {"x2.5"|"x5": {id: {days, whole_new_bone}}}. Normalized to
// { s: { id: { days, nb, rb, msc, soft, cart, clot, cnb, crb, bands: { nb: [faster, slower] } } }, lit: { id: { nb, rb } } }
function normSeries(raw) {
  const out = { s: {}, lit: {}, seeds: raw.seeds, framesSeed: raw.frames_seed };
  const root = raw.sockets || {};
  const arr = (a) => (Array.isArray(a) ? a.map(Number) : null);
  for (const G of geoms) {
    const o = root[G.id];
    if (!o) continue;
    const W = o.whole || {}, C = o.core || {};
    const e = { days: arr(o.days), nb: arr(W.new_bone), rb: arr(W.residual_graft), msc: arr(W.stem_cells), soft: arr(W.soft_tissue),
      cart: arr(W.cartilage), clot: arr(W.clot_or_marrow), cnb: arr(C.new_bone), crb: arr(C.residual_graft), bands: {} };
    const fast = raw.bands && raw.bands["x2.5"] && raw.bands["x2.5"][G.id], slow = raw.bands && raw.bands["x5"] && raw.bands["x5"][G.id];
    if (fast && slow && fast.whole_new_bone && slow.whole_new_bone)
      e.bands.nb = [{ days: arr(fast.days), v: arr(fast.whole_new_bone) }, { days: arr(slow.days), v: arr(slow.whole_new_bone) }];
    out.s[G.id] = e;
    const X = o.expected || {}, fix = (a) => (Array.isArray(a) ? a.map((q) => ({ day: +q.day, low: +q.low, high: +q.high, mid: q.value != null ? +q.value : null })) : null);
    out.lit[G.id] = { nb: fix(X.core_new_bone), rb: fix(X.core_residual_graft) };
  }
  return out;
}
function seriesFor(file) {
  const s = seriesCache.get(file);
  if (s && !s.then) return s;
  if (!s) seriesCache.set(file, getJSON(file).then((raw) => { seriesCache.set(file, normSeries(raw)); legend(); readout(Math.floor(state.day)); drawCharts(true); seedsNote(); })
    .catch((e) => { seriesCache.delete(file); $("chart-note").textContent = `The charts could not load (${e.message}).`; }));
  return null;
}
function valueAt(e, k, d) {
  const a = e && e[k], days = e && e.days;
  if (!a || !days) return null;
  let lo = 0, hi = days.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (days[m] <= d) lo = m; else hi = m - 1; }
  return a[lo];
}
// chart and table columns: per column the socket, its arm and its series entry
function chartCols() {
  return columns().map((c) => { const S = seriesFor(c.run.series); return { ...c, e: S && S.s[c.sid], lit: S && S.lit[c.sid] }; });
}

// ---------------------------------------------------------------- readout and charts
const fmt = (x) => x == null || isNaN(x) ? "–" : `${x.toFixed(1)}`;
function readout(d) {
  const cs = chartCols(), cmp = state.compare !== "off";
  $("read-title").textContent = cmp ? `Day ${d}, % of socket ${state.compare}` : `Day ${d}, % of the socket`;
  if (!cs.some((c) => c.e)) { $("read").innerHTML = ""; return; }
  const rows = [["New bone", "nb", false], ["virtual core", "cnb", true], ["β-TCP", "rb", false], ["virtual core", "crb", true],
    ["Stem cells", "msc", false], ["Fibrous tissue", "soft", false], ["Cartilage", "cart", false], ["Clot or marrow", "clot", false]];
  const head = `<thead><tr><th></th>${cs.map((c) => `<th scope="col">${c.sid} · ${armName(c.arm)}</th>`).join("")}</tr></thead>`;
  // a tissue that never forms in these runs (all zero) gets no row
  const used = (k) => cs.some((c) => { const a = c.e && c.e[k]; return a && a.some((v) => v > 0.05); });
  const body = rows.filter(([, k]) => used(k) || k === "nb" || k === "cnb").map(([name, k, sub]) =>
    `<tr><th scope="row" class="${sub ? "sub" : ""}">${name}</th>${cs.map((c) => {
      const graftless = (k === "rb" || k === "crb") && !isGraft(c.arm);
      return `<td>${graftless ? "–" : fmt(valueAt(c.e, k, d))}</td>`;
    }).join("")}</tr>`).join("");
  $("read").innerHTML = head + `<tbody>${body}</tbody>`;
}
let chartT = 0;
function drawCharts(force) {
  const now = performance.now(); if (!force && now - chartT < 40) return; chartT = now;
  const cs = chartCols();
  chart("chart-nb", "nb", "cnb", cs, 60);
  chart("chart-rb", "rb", "crb", cs.filter((c) => isGraft(c.arm)), 60);
}
function chart(id, k, kc, cs, ymin) {
  const c = $(id), dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  const D = FD[NF - 1] || 182;
  let ymax = ymin;
  for (const q of cs) {
    const e = q.e; if (!e) continue;
    for (const kk of [k, kc]) if (e[kk]) for (const v of e[kk]) ymax = Math.max(ymax, v);
    if (e.bands && e.bands[k]) for (const b of e.bands[k]) for (const v of b.v) ymax = Math.max(ymax, v);
    const lit = q.lit && q.lit[k]; if (lit) for (const L0 of lit) ymax = Math.max(ymax, L0.high);
  }
  ymax = Math.min(100, Math.ceil(ymax / 20) * 20);
  const L = 30, R = 10, T = 6, B = 18, X = (d) => L + (w - L - R) * d / D, Y = (v) => T + (h - T - B) * (1 - v / ymax);
  x.font = `11px ${css("--font-ui") || "sans-serif"}`; x.lineWidth = 1;
  x.strokeStyle = css("--line"); x.fillStyle = css("--muted");
  for (let v = 0; v <= ymax; v += 20) { x.beginPath(); x.moveTo(L, Math.round(Y(v)) + 0.5); x.lineTo(w - R, Math.round(Y(v)) + 0.5); x.stroke(); x.textAlign = "right"; x.fillText(v, L - 5, Y(v) + 4); }
  x.textAlign = "center";
  for (let m = 0; m <= 6; m++) { const d = Math.min(D, m * 30.44); x.fillText(m === 0 ? "0" : `${m} mo`, Math.min(X(d), w - R - 12), h - 4); }
  cs.forEach((q, n) => {
    const e = q.e; if (!e) return;
    const col = css(isGraft(q.arm) ? "--arm-tcp" : "--arm-empty");
    // time-scale band (whole socket at x2.5 and x5 instead of x3.5), when the series has one; each curve has its own days
    const band = e.bands && e.bands[k];
    if (band) {
      const [f, sl] = band;
      x.globalAlpha = 0.13; x.fillStyle = col; x.beginPath(); x.moveTo(X(0), Y(0));
      f.days.forEach((d, i) => x.lineTo(X(d), Y(f.v[i])));
      for (let i = sl.days.length - 1; i >= 0; i--) x.lineTo(X(sl.days[i]), Y(sl.v[i]));
      x.closePath(); x.fill(); x.globalAlpha = 1;
    }
    // literature boxes (human biopsy cores, 3 and 6 months), side by side when both columns have one
    const lit = q.lit && q.lit[k];
    if (lit) for (const L0 of lit) {
      const off = cs.length > 1 ? (n === 0 ? -1 : 1) * 4.5 : 0; let cx = X(Math.min(D - 8, L0.day)) + off * (w - L - R) / D;
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
  const fg = "var(--fg-2)", cs = chartCols();
  let h = cs.map((c) => `<span>${line(armVar(c.arm))}${c.sid} · ${armName(c.arm)}</span>`).join("");
  h += `<span>${line(fg)}whole socket</span><span>${line(fg, true)}virtual core</span>`;
  h += `<span style="grid-column:1/-1"><svg viewBox="0 0 22 10" aria-hidden="true"><rect x="7" y="0.5" width="8" height="9" style="fill:none;stroke:${fg}"/></svg>human biopsy cores, 3 and 6 months</span>`;
  if (cs.some((c) => c.e && Object.keys(c.e.bands).length)) h += `<span style="grid-column:1/-1"><svg viewBox="0 0 22 10" aria-hidden="true"><rect x="1" y="1" width="20" height="8" style="fill:${fg}" opacity="0.25"/></svg>whole socket at time scale ×2.5 to ×5</span>`;
  $("legend").innerHTML = h;
}
function seedsNote() {
  const S = seriesFor(runFor(state.graft).series);
  if (!S || !S.seeds) { $("seeds").textContent = ""; return; }
  $("seeds").textContent = S.seeds > 1
    ? `In this scenario the charts and the table are the mean of ${S.seeds} runs with different random seeds; the cubes show one of them${S.framesSeed ? ` (seed ${S.framesSeed})` : ""}.`
    : `This scenario was run with one random seed${S.framesSeed ? ` (seed ${S.framesSeed})` : ""}; the charts, the table and the cubes all come from it.`;
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

// ---------------------------------------------------------------- strain map on the jaw surface
// log colour scale 10-3,000 µε; the stops are placed in log space (0 = 10 µε, 1 = 3,000 µε)
const S_LO = 10, S_HI = 3000, BAND = [1500, 3000];
const STOPS = [[10, "#4a5a9a"], [30, "#3d88b3"], [100, "#38b2a3"], [300, "#9fd06a"], [1000, "#f3c74a"], [1500, "#f08a3e"], [3000, "#d8344f"]]
  .map(([v, c]) => [Math.log10(v / S_LO) / Math.log10(S_HI / S_LO), new THREE.Color(c)]);
const logPos = (v) => Math.max(0, Math.min(1, Math.log10(Math.max(v, S_LO) / S_LO) / Math.log10(S_HI / S_LO)));
function strainColor(v, out) {
  const t = logPos(v);
  let i = 1; while (i < STOPS.length - 1 && STOPS[i][0] < t) i++;
  const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i];
  return out.copy(c0).lerp(c1, Math.max(0, Math.min(1, (t - t0) / (t1 - t0))));
}
let strainData = null, strainPromise = null;
// float16 -> float32
function half(h) {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
  if (e === 0) return s * f * 5.960464477539063e-8;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * Math.pow(2, e - 15);
}
async function loadStrain() {
  const meta = manifest.surface_strain, [nc, nv] = meta.shape;
  const src = await openStream(meta.file);
  let bytes;
  if (src.buf) bytes = src.buf;
  else bytes = new Uint8Array(await new Response(src.stream).arrayBuffer());
  if (bytes.length !== nc * nv * 2) throw new Error(`${meta.file}: ${bytes.length} bytes, expected ${nc * nv * 2}`);
  const u16 = new Uint16Array(bytes.buffer, bytes.byteOffset, nc * nv), out = new Float32Array(nc * nv);
  for (let i = 0; i < out.length; i++) out[i] = half(u16[i]);
  strainData = { nc, nv, values: out };
}
async function applyStrain() {
  const on = state.strain && jawGeom;
  $("strain-controls").hidden = !state.strain; $("strain-legend").hidden = !on;
  if (on && !strainData) {
    if (!strainPromise) strainPromise = loadStrain().catch((e) => { strainPromise = null; $("strain-note").textContent = `The strain data could not load (${e.message}).`; });
    status("Loading the strain map…"); await strainPromise; status("");
    if (!strainData) return;
  }
  if (on && strainData.nv !== jawGeom.attributes.position.count) { $("strain-note").textContent = "The strain data does not match the jaw mesh."; return; }
  for (const m of [jawFront, jawBack]) { m.vertexColors = !!on; m.color.set(on ? 0xffffff : (m === jawFront ? 0xd9ccb0 : 0xb9ab90)); m.needsUpdate = true; }
  if (on) {
    const cases = manifest.surface_strain.cases, ci = Math.max(0, cases.findIndex((c) => c.id === state.strainCase));
    const vals = strainData.values.subarray(ci * strainData.nv, (ci + 1) * strainData.nv);
    let attr = jawGeom.attributes.color;
    if (!attr) { attr = new THREE.BufferAttribute(new Float32Array(strainData.nv * 3), 3); jawGeom.setAttribute("color", attr); }
    const c = new THREE.Color();
    for (let i = 0; i < strainData.nv; i++) { strainColor(vals[i], c); attr.setXYZ(i, c.r, c.g, c.b); }
    attr.needsUpdate = true;
    let mx = 0; for (const v of vals) if (v > mx) mx = v;
    const cs = cases[ci];
    $("sl-case").textContent = `${cs.model[0].toUpperCase() + cs.model.slice(1)}: ${cs.load}. Highest value ${Math.round(mx).toLocaleString("en-US")} µε.`;
  }
  requestRender();
}
function strainLegend() {
  const grad = STOPS.map(([t, c]) => `#${c.getHexString()} ${(t * 100).toFixed(1)}%`).join(", ");
  $("sl-bar").style.background = `linear-gradient(90deg, ${grad})`;
  const b0 = logPos(BAND[0]) * 100, b1 = logPos(BAND[1]) * 100;
  Object.assign($("sl-band").style, { left: `${b0}%`, width: `${b1 - b0}%` });
  $("sl-band").title = "About 1,500 to 3,000 µε: the band where bone starts to be overloaded (Frost's mechanostat)";
  $("sl-ticks").innerHTML = [10, 30, 100, 300, 1000, 3000].map((v) => `<span style="left:${(logPos(v) * 100).toFixed(1)}%">${v >= 1000 ? `${v / 1000}k` : v}</span>`).join("");
}
function strainSetup() {
  const meta = manifest.surface_strain;
  if (!meta || !meta.cases || !meta.cases.length) return;
  $("strain-row").hidden = false;
  const groups = [...new Set(meta.cases.map((c) => c.model))];
  $("strain-case").innerHTML = groups.map((g) => `<optgroup label="${g[0].toUpperCase() + g.slice(1)}">${meta.cases.filter((c) => c.model === g)
    .map((c) => `<option value="${c.id}">${c.load.split(",")[0].replace(/^./, (m) => m.toUpperCase())}</option>`).join("")}</optgroup>`).join("");
  $("strain-note").textContent = [meta.support, meta.note].filter(Boolean).map((t) => t.replace(/^./, (m) => m.toUpperCase())).join(". ") + ".";
  strainLegend();
}
// the load case that fits the scenario: chewing on 34 with the bridge in the bridge scenarios, without it otherwise
function defaultStrainCase() {
  const cases = manifest.surface_strain.cases, want = hasBridge(state.loading) ? "bridge_chew34" : "nobridge_chew34";
  return (cases.find((c) => c.id === want) || cases[0]).id;
}

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
$("opacity").addEventListener("input", (e) => { state.opacity = +e.target.value; state.opacityBeforeStrain = null; applyJaw(); });
$("show-teeth").addEventListener("change", (e) => { state.teeth = e.target.checked; applyJaw(); });
$("show-bridge").addEventListener("change", (e) => { state.bridge = e.target.checked; applyJaw(); });
$("show-strain").addEventListener("change", (e) => {
  state.strain = e.target.checked;
  // the colours read best on an opaque jaw; the opacity comes back when the map is switched off
  if (state.strain) { if (!state.strainCase) state.strainCase = defaultStrainCase(); $("strain-case").value = state.strainCase; state.opacityBeforeStrain = state.opacity; state.opacity = 1; }
  else if (state.opacityBeforeStrain != null) { state.opacity = state.opacityBeforeStrain; state.opacityBeforeStrain = null; }
  $("opacity").value = state.opacity; applyJaw(); applyStrain();
});
$("strain-case").addEventListener("change", (e) => { state.strainCase = e.target.value; applyStrain(); });
for (const id of ["32", "33"]) $(`show-${id}`).addEventListener("change", (e) => { state.show[id] = e.target.checked; requestRender(); });
document.querySelectorAll("[data-section]").forEach((b) => b.addEventListener("click", () => {
  const was = state.section; state.section = b.dataset.section; if (state.section !== was) state.flip = false; applySection();
  if (state.section !== was) cameraTo("sockets");
}));
$("section-pos").addEventListener("input", (e) => { state.pos[state.section] = +e.target.value; applySection(); });
$("section-flip").addEventListener("click", () => { state.flip = !state.flip; applySection(); cameraTo("sockets"); });
$("loading-sel").addEventListener("change", (e) => { state.loading = e.target.value; state.bridge = hasBridge(state.loading); applyScenario(); });
document.querySelectorAll("[data-graft]").forEach((b) => b.addEventListener("click", () => { state.graft = b.dataset.graft; applyScenario(); }));
document.querySelectorAll("[data-compare]").forEach((b) => b.addEventListener("click", () => {
  const was = state.compare; state.compare = b.dataset.compare; applyScenario();
  if (was !== state.compare) cameraTo(state.compare === "off" ? "jaw" : "sockets");
}));
function applyJaw() {
  const o = state.opacity;
  $("opacity-out").textContent = `${Math.round(o * 100)} %`;
  const solid = o >= 0.99;
  for (const m of [jawFront, jawBack]) { m.opacity = o; m.transparent = !solid; m.depthWrite = solid; m.needsUpdate = true; }
  jawGroup.visible = o > 0.01;
  jawGroup.children.forEach((me) => { if (me.material === jawBack) me.visible = !solid; });
  teethGroup.visible = state.teeth;
  const kind = manifest ? bridgeKind(state.loading) : "bridge";
  if (state.bridge && manifest) ensureBridge(kind);
  for (const k in bridges) bridges[k].group.visible = state.bridge && k === kind && bridges[k].state === "ready";
  $("show-bridge").checked = state.bridge;
  requestRender();
}
// a tissue with no voxel in any frame on screen keeps its toggle, dimmed and last, with a short note
function markAbsentTissues() {
  const seen = new Uint8Array(256);
  for (const c of columns()) if (c.V.codes) for (let i = 0; i < 256; i++) seen[i] |= c.V.codes[i];
  const box = $("tissues");
  box.querySelectorAll("input[data-code]").forEach((i) => {
    const l = i.closest("label"), absent = !seen[+i.dataset.code];
    l.classList.toggle("absent", absent); l.title = absent ? "No voxel holds this tissue in the runs shown" : "";
    const sm = l.querySelector("small");
    if (absent && !sm) l.insertAdjacentHTML("beforeend", " <small>(none in these runs)</small>");
    if (!absent && sm) sm.remove();
  });
  [...box.children].sort((a, b) => (a.classList.contains("absent") - b.classList.contains("absent")) || (+a.dataset.order - +b.dataset.order)).forEach((l) => box.appendChild(l));
}
function tissueToggles() {
  const codes = manifest && manifest.codes ? Object.keys(manifest.codes).map(Number).filter((c) => TISSUES[c]) : Object.keys(TISSUES).map(Number);
  const ORDER = [4, 5, 1, 2, 3];  // bone and graft first, then the cells
  codes.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  $("tissues").innerHTML = codes.map((c, i) => `<label class="check" data-order="${i}"><input type="checkbox" data-code="${c}" checked><i class="swatch" style="background:var(${TISSUES[c].cssVar})"></i>${TISSUES[c].name}</label>`).join("");
  $("tissues").querySelectorAll("input").forEach((i) => i.addEventListener("change", () => {
    state.vis[+i.dataset.code] = i.checked; tissueUniforms(); markAllDirty();
  }));
}
function scenarioSetup() {
  $("loading-sel").innerHTML = scenarios.map((s) => `<option value="${s.key}">${LOADING_NAMES[s.key] || s.key}</option>`).join("");
  const twins = scenarios.some((s) => Object.keys(s.runs).length > 1);
  document.querySelectorAll("[data-graft]").forEach((b) => { b.disabled = !twins; });
  document.querySelectorAll("[data-compare]").forEach((b) => { if (b.dataset.compare !== "off") b.disabled = !twins; });
}
let lastBridgeness = null;
// after a change of loading, graft socket or compare: the controls, labels, notes, charts and the voxel sets to load
function applyScenario() {
  if (!scenarios.some((s) => s.key === state.loading)) state.loading = scenarios[0].key;
  $("loading-sel").value = state.loading;
  const r = runFor(state.graft), cmp = state.compare !== "off";
  const note = $("loading-note");
  note.textContent = cmp ? `Socket ${state.compare}, empty and with β-TCP; loading: ${r.loading === "none" ? "none" : r.loading}.`
    : `${r.label ? r.label[0].toUpperCase() + r.label.slice(1) : ""}${r.loading && r.loading !== "none" ? `. Loading: ${r.loading}` : ""}.`;
  // runs[].clinical: whether the scenario is done this way in practice, or an upper bound
  if (typeof r.clinical === "boolean") {
    const b = document.createElement("strong"); b.className = r.clinical ? "clin yes" : "clin no";
    b.textContent = r.clinical ? "Clinical: placed as in practice. " : "Not clinical practice: an upper bound. ";
    note.prepend(b);
  }
  document.querySelectorAll("[data-graft]").forEach((b) => { b.setAttribute("aria-pressed", b.dataset.graft === state.graft); if (cmp) b.disabled = true; else b.disabled = !scenarios.some((s) => Object.keys(s.runs).length > 1); });
  document.querySelectorAll("[data-compare]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.compare === state.compare));
  $("sockets-group").hidden = cmp;
  for (const G of geoms) {
    const arm = r.arms[G.id];
    if ($(`lab-${G.id}`)) $(`lab-${G.id}`).textContent = `${G.id} · ${armName(arm)}`;
    if ($(`sw-${G.id}`)) $(`sw-${G.id}`).style.background = armVar(arm);
  }
  $("scen-badge").textContent = cmp ? `${LOADING_SHORT[state.loading] || state.loading} · socket ${state.compare}, empty vs β-TCP`
    : `${LOADING_SHORT[state.loading] || state.loading} · β-TCP in ${state.graft}`;
  applyJaw();
  // a strain map on screen follows the scenario's model (with or without the bridge) when that changes
  if (state.strain && manifest.surface_strain && lastBridgeness !== hasBridge(state.loading)) { state.strainCase = defaultStrainCase(); $("strain-case").value = state.strainCase; applyStrain(); }
  lastBridgeness = hasBridge(state.loading);
  for (const c of columns()) c.V.dirty = true;   // also starts loading the frames of the columns shown
  paneOverlays(); onFrames(); legend(); seedsNote(); drawCharts(true);
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
// The URL may name the starting state, e.g. ?loading=bridge&graft=32&compare=33&strain=bridge_chew34&day=91&section=md
ticks(phone.matches); applyJaw(); requestAnimationFrame(loop);
(async () => {
  try {
    manifest = await getJSON("manifest.json");
    if (![1, 2].includes(manifest.version)) throw new Error(`manifest version ${manifest.version}`);
    FD = manifest.frame_days; NF = FD.length;
    $("day").max = FD[NF - 1]; ticks(phone.matches);
    for (const m of manifest.sockets) geoms.push(makeGeom(m));
    U.uVox.value = geoms[0].vox;
    setupRuns(); scenarioSetup();
    if (query.has("loading")) state.loading = query.get("loading");
    if (["32", "33"].includes(query.get("graft"))) state.graft = query.get("graft");
    if (["32", "33"].includes(query.get("compare"))) state.compare = query.get("compare");
    if (["md", "bl"].includes(query.get("section"))) state.section = query.get("section");
    if (query.has("day")) { state.day = Math.max(0, Math.min(FD[NF - 1], +query.get("day") || 0)); state.touchedTime = true; }
    state.bridge = hasBridge(state.loading);
    sectionFrame(); applySection(); tissueToggles();
    if (manifest.setting) $("setting").textContent = `Run setting: ${manifest.setting}.`;
    if (manifest.voxel_rule) { $("voxel-rule").textContent = manifest.voxel_rule.replace(/^./, (c) => c.toUpperCase()) + "."; $("voxel-rule-box").hidden = false; }
    if (manifest.surface_strain) strainSetup();
    applyScenario();
    // the jaw first, then the frames (applyScenario has already asked for those of the scenario shown)
    const meshes = manifest.meshes || {};
    if (meshes.bridge) $("bridge-row").hidden = false;
    const [jaw, teeth] = await Promise.all([meshes.mandible ? loadGLB(meshes.mandible) : null,
      meshes.teeth ? loadGLB(meshes.teeth).catch(() => null) : null]);
    if (jaw) jawGeom = addMeshes(jaw, jawGroup, [jawBack, jawFront], true)[0] || null;
    if (teeth) addMeshes(teeth, teethGroup, [teethMat], true);
    applyJaw(); resize(); cameraTo(state.compare !== "off" || state.section !== "off" ? "sockets" : "jaw", true);
    $("loading").hidden = true;
    if (query.has("strain") && manifest.surface_strain) {
      const id = query.get("strain"), ok = manifest.surface_strain.cases.some((c) => c.id === id);
      state.strainCase = ok ? id : defaultStrainCase(); $("show-strain").checked = true; $("show-strain").dispatchEvent(new Event("change"));
    }
    await Promise.all(columns().map((c) => c.V.promise));
    onFrames();
    if (!state.touchedTime && !reducedMotion) { state.day = 0; applyTime(); setPlaying(true); }
  } catch (e) {
    console.error(e);
    const l = $("loading"); l.hidden = false; l.textContent = `Could not load the simulation data: ${e.message}`;
    status("");
  }
})();
})();
