// SG-Bone dive: the shared film engine (pass 2).
//
// Owns the renderer, scene, camera, lights, shadows, environment and post-processing; loads
// assets/data through manifest.json; builds the parts (bone ends, marrow, plate, screws,
// callus hull, half versions and cut faces), the voxel system and the field colouring of
// the callus cut face; merges every beat's camera keys into one take (director.js); and
// draws frame t as a pure function of t. See ENGINE.md for the API the beat modules use.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/+esm";
import { RoomEnvironment } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js/+esm";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/EffectComposer.js/+esm";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/RenderPass.js/+esm";
import { BokehPass } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/BokehPass.js/+esm";
import { OutputPass } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/OutputPass.js/+esm";
import { toCreasedNormals } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js/+esm";
import { makeDirector } from "./director.js";
import { makeLabelOverlay, LABEL_CSS_FONT } from "./labels.js";
import { FPS, DURATION, BEAT_IDS, BEATS, dayAt } from "./timeline.js";

export const WIDTH = 1920;
export const HEIGHT = 1080;
// Timeline (pass 3, SPEC P3-1): 52 s, beats b1 b2 b3 c2 c3 b4 b5 b6, the day track dayAt(t).
export { FPS, DURATION, BEAT_IDS, BEATS, dayAt };

// ---------------------------------------------------------------------------------------
// Palette (SPEC PASS 2, P2-2: the run viewer's tissue colours, kallus3b.html). sRGB hex
// strings; THREE.Color converts them to the linear working space. Nothing outside this
// table and the two field maps below may colour the film.
export const PALETTE = Object.freeze({
  ground: "#02071d", // the site's paper (unchanged)
  groundFar: "#0a1430", // fog towards the far plane
  ink: "#e7f0f9", // in-scene marks: load arrows, plane axes
  muted: "#98a9c1",
  accent: "#6bcbf7", // the site accent: ONLY the return arc in b6
  accentDark: "#3483ad", // kept for compatibility; not used by the engine
  bone: "#efe2c4", // new bone (code 2), warm ivory
  cartilage: "#5aa0e0", // code 4, blue
  fibrous: "#e07a8a", // code 5, coral pink
  stemCell: "#d9a43a", // code 1 (MSC), amber
  cortex: "#9c958a", // intact cortex (11), warm bone grey (+-4 % grain in the shader)
  marrow: "#6e3434", // deep red
  plate: "#aab4bf", // steel
  screw: "#8c96a1", // screws, slightly darker so the heads read
  resorption: "#8a8f96", // decision-plane resorption region, neutral grey
  nucleus: "#46337a", // cell nuclei (the cell viewer's nucleus colour)
  keyLight: "#fff1e0",
  rimLight: "#9fc4ff",
  fillLight: "#dfe8ff",
  // Field maps (perceptual, log-scaled): E = viridis, strain = magma 0.15..1.
  fieldLow: "#440154", // viridis 0 (also granulation tissue, 0.2 MPa, on the cut face)
  fieldMid: "#21918c", // viridis 0.5
  fieldHigh: "#fde725", // viridis 1
  strainLow: "#251255", // magma 0.15
  strainMid: "#d5446d", // magma 0.575
  strainHigh: "#fcfdbf", // magma 1
});

// Colour tables of the two field maps: 17 stops each, equally spaced in u (matplotlib
// 3.10 viridis on 0..1 and magma on 0.15..1), interpolated in sRGB.
export const VIRIDIS = Object.freeze([
  "#440154", "#48186a", "#472d7b", "#424086", "#3b528b", "#33638d", "#2c728e", "#26828e", "#21918c",
  "#1fa088", "#28ae80", "#3fbc73", "#5ec962", "#84d44b", "#addc30", "#d8e219", "#fde725",
]);
export const MAGMA = Object.freeze([
  "#251255", "#3d0f71", "#52137c", "#681c81", "#7c2382", "#932b80", "#aa337d", "#bf3a77", "#d5446d",
  "#e75263", "#f4675c", "#fa815f", "#fd9a6a", "#feb47b", "#fecc8f", "#fde5a7", "#fcfdbf",
]);
// Emissive share of the field colour on the cut faces (low values never sink into the ground).
const FIELD_EMISSIVE = 0.22;
// E and strain maps per pixel (pass 3, SPEC P3-3): the element values are rasterised onto a
// FIELD_TEXEL grid on the cut plane and smoothed by a mask-normalised Gaussian of FIELD_SIGMA
// (mm), so long tet triangles at the callus border no longer smear one vertex's value into
// spikes. FIELD_PAD mm of margin around the face's bounding box.
const FIELD_TEXEL = 0.1;
const FIELD_SIGMA = 0.45;
const FIELD_PAD = 0.3;

// Lattice / voxel codes (manifest.codes.lattice) -> palette colour.
const CODE_COLOR = { 1: PALETTE.stemCell, 2: PALETTE.bone, 4: PALETTE.cartilage, 5: PALETTE.fibrous };
// An empty voxel block on the cut face is granulation tissue (0.2 MPa): the low end of the
// E map, so the tissue -> E blend keeps empty regions the same colour.
const EMPTY_TISSUE_COLOR = PALETTE.fieldLow;

// Look constants (P2-3).
const KEY_INTENSITY = 2.6;
const RIM_INTENSITY = 1.4;
const FILL_INTENSITY = 0.3;
const ENV_INTENSITY = 0.6;
const EXPOSURE = 0.9; // base tone-mapping exposure (state.exposure multiplies it)
const STEEL_ENV = 1.1; // the plate's own envMap intensity
const SCREW_ENV = 1.3;
const SHADOW_MAP = 2048;
const CREASE_DEG = 35;

// ---------------------------------------------------------------------------------------
// Utilities (ctx.util). Pure functions only.
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, x) => a + (b - a) * x;
const smoothstep = (a, b, x) => {
  const u = clamp((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Deterministic hash of an integer id to [0, 1).
function hashId(id, seed = 0x9e3779b9) {
  let h = (Math.imul((id | 0) ^ seed, 0x85ebca6b) ^ 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
const ease = {
  linear: (x) => x,
  "none": (x) => x,
  "power1.in": (x) => x * x,
  "power1.out": (x) => 1 - (1 - x) * (1 - x),
  "power1.inOut": (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  "power2.in": (x) => x * x * x,
  "power2.out": (x) => 1 - Math.pow(1 - x, 3),
  "power2.inOut": (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  "power3.in": (x) => x * x * x * x,
  "power3.out": (x) => 1 - Math.pow(1 - x, 4),
  "power3.inOut": (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
  "sine.in": (x) => 1 - Math.cos((x * Math.PI) / 2),
  "sine.out": (x) => Math.sin((x * Math.PI) / 2),
  "sine.inOut": (x) => -(Math.cos(Math.PI * x) - 1) / 2,
};
ease.inOutCubic = ease["power2.inOut"]; // easeInOutCubic == GSAP power2.inOut
ease.get = (name) => (typeof name === "function" ? name : ease[name] || ease.linear);
// Eased progress of a tween that starts at t0 and lasts dur seconds, clamped to [0, 1].
function tween(t, t0, dur, easeName = "linear") {
  if (dur <= 0) return t >= t0 ? 1 : 0;
  return ease.get(easeName)(clamp((t - t0) / dur));
}
// SPEC MOTION enter/exit: opacity/scale factor of an object shown from tIn to tOut.
// Enter: 18 frames power2.out from tIn; exit: 12 frames power2.in ending at tOut.
function enterExit(t, tIn, tOut, enterFrames = 18, exitFrames = 12) {
  if (t < tIn || t >= tOut) return 0;
  const a = tween(t, tIn, enterFrames / FPS, "power2.out");
  const b = 1 - tween(t, tOut - exitFrames / FPS, exitFrames / FPS, "power2.in");
  return Math.min(a, b);
}
const frames = (n) => n / FPS;

// Field maps: u in [0, 1] -> THREE.Color (linear working space), interpolated in sRGB
// between the table stops. map 'E' (default) = viridis, 'strain' = magma 0.15..1.
function srgbArr(hex) {
  const c = new THREE.Color(hex);
  const o = {};
  c.getRGB(o, THREE.SRGBColorSpace);
  return [o.r, o.g, o.b];
}
const _viridisSRGB = VIRIDIS.map(srgbArr);
const _magmaSRGB = MAGMA.map(srgbArr);
function tableColor(table, u, target) {
  u = clamp(u);
  const x = u * (table.length - 1);
  const i = Math.min(table.length - 2, Math.floor(x));
  const f = x - i;
  const a = table[i];
  const b = table[i + 1];
  return target.setRGB(lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f), THREE.SRGBColorSpace);
}
const viridis = (u, target = new THREE.Color()) => tableColor(_viridisSRGB, u, target);
const magma = (u, target = new THREE.Color()) => tableColor(_magmaSRGB, u, target);
function fieldColor(u, target = new THREE.Color(), map = "E") {
  return map === "strain" ? magma(u, target) : viridis(u, target);
}
// SPEC field ranges (log): E 0.2..17000 MPa, |strain| 0.001 %..10 % (1e-5..0.1).
const E_MIN = 0.2;
const E_MAX = 17000;
const STRAIN_MIN = 1e-5;
const STRAIN_MAX = 0.1;
const logE = (E) => clamp(Math.log(Math.max(E, 1e-12) / E_MIN) / Math.log(E_MAX / E_MIN));
const logStrain = (eps) => clamp(Math.log10(Math.max(Math.abs(eps), 1e-30) / STRAIN_MIN) / Math.log10(STRAIN_MAX / STRAIN_MIN));

// ---------------------------------------------------------------------------------------
// Shader chunk extensions (P2-3), switched on per material by defines, so they survive
// Material.clone() and any onBeforeCompile a beat sets on its own clone:
//   SG_BEVEL    voxel cubes: normals bent towards the cube edges and edges darkened a little
//               (a bevelled look without extra geometry)
//   SG_GRAIN    cortex and marrow: +-4 % deterministic noise on colour and roughness
//   SG_BRUSHED  plate: roughness streaks stretched along the plate (model z, the bone axis)
let chunksPatched = false;
function patchShaderChunks() {
  if (chunksPatched) return;
  chunksPatched = true;
  const C = THREE.ShaderChunk;
  C.common += `
#ifdef SG_BEVEL
varying vec3 vSgBox;
varying vec3 vSgAx0;
varying vec3 vSgAx1;
varying vec3 vSgAx2;
#endif
#if defined( SG_GRAIN ) || defined( SG_BRUSHED )
varying vec3 vSgObj;
float sgHash( vec3 p ) {
  p = fract( p * 0.3183099 + 0.1 );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}
float sgNoise( vec3 x ) {
  vec3 i = floor( x );
  vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( sgHash( i ), sgHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ),
                   mix( sgHash( i + vec3( 0.0, 1.0, 0.0 ) ), sgHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
              mix( mix( sgHash( i + vec3( 0.0, 0.0, 1.0 ) ), sgHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ),
                   mix( sgHash( i + vec3( 0.0, 1.0, 1.0 ) ), sgHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
}
#endif
`;
  C.begin_vertex += `
#ifdef SG_BEVEL
vSgBox = position;
vSgAx0 = normalize( normalMatrix * vec3( 1.0, 0.0, 0.0 ) );
vSgAx1 = normalize( normalMatrix * vec3( 0.0, 1.0, 0.0 ) );
vSgAx2 = normalize( normalMatrix * vec3( 0.0, 0.0, 1.0 ) );
#endif
#if defined( SG_GRAIN ) || defined( SG_BRUSHED )
vSgObj = position;
#endif
`;
  C.roughnessmap_fragment += `
#ifdef SG_GRAIN
{
  float sgG = sgNoise( vSgObj * 0.8 ) * 0.6 + sgNoise( vSgObj * 3.3 ) * 0.4;
  float sgK = clamp( ( sgG - 0.5 ) * 2.6, -1.0, 1.0 );
  diffuseColor.rgb *= 1.0 + 0.04 * sgK;
  roughnessFactor = clamp( roughnessFactor * ( 1.0 - 0.04 * sgK ), 0.04, 1.0 );
}
#endif
#ifdef SG_BRUSHED
{
  float sgS = sgNoise( vec3( vSgObj.x * 7.0, vSgObj.y * 7.0, vSgObj.z * 0.15 ) ) * 0.55
            + sgNoise( vec3( vSgObj.x * 19.0, vSgObj.y * 19.0, vSgObj.z * 0.4 ) ) * 0.45;
  roughnessFactor = clamp( roughnessFactor + 0.18 * ( sgS - 0.5 ), 0.08, 1.0 );
  diffuseColor.rgb *= 0.97 + 0.06 * sgS;
}
#endif
`;
  C.normal_fragment_maps += `
#ifdef SG_BEVEL
{
  vec3 sgQ = vSgBox * 2.0;
  vec3 sgA = abs( sgQ );
  float sgM = max( sgA.x, max( sgA.y, sgA.z ) );
  vec3 sgF = step( vec3( sgM - 1e-3 ), sgA );
  vec3 sgE = ( 1.0 - sgF ) * smoothstep( 0.5, 1.0, sgA ) * sign( sgQ );
  vec3 sgN = normalize( sgF * sign( sgQ ) + 0.8 * sgE );
  normal = normalize( vSgAx0 * sgN.x + vSgAx1 * sgN.y + vSgAx2 * sgN.z );
  float sgEdge = max( max( sgE.x * sgE.x, sgE.y * sgE.y ), sgE.z * sgE.z );
  diffuseColor.rgb *= 1.0 - 0.2 * sgEdge;
}
#endif
`;
}

// MeshStandardMaterial whose extra defines (SG_*) survive clone()/copy(): three resets
// `defines` to { STANDARD: '' } in MeshStandardMaterial.copy.
class SgStandardMaterial extends THREE.MeshStandardMaterial {
  constructor(params, sgDefines = {}) {
    super(params);
    this.sgDefines = { ...sgDefines };
    Object.assign(this.defines, this.sgDefines);
  }
  copy(source) {
    super.copy(source);
    this.sgDefines = { ...(source.sgDefines || {}) };
    Object.assign(this.defines, this.sgDefines);
    return this;
  }
}

// three.js ACESFilmicToneMapping (exposure 1), used to find the linear colour that
// tone-maps to a wanted sRGB colour (fog colour; background under post-processing).
function acesFilmic(rgb, exposure = 1, saturate = true) {
  const s = exposure / 0.6;
  const c = [rgb[0] * s, rgb[1] * s, rgb[2] * s];
  const i0 = 0.59719 * c[0] + 0.35458 * c[1] + 0.04823 * c[2];
  const i1 = 0.076 * c[0] + 0.90834 * c[1] + 0.01566 * c[2];
  const i2 = 0.0284 * c[0] + 0.13383 * c[1] + 0.83777 * c[2];
  const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const f0 = fit(i0), f1 = fit(i1), f2 = fit(i2);
  const o = [
    1.60475 * f0 - 0.53108 * f1 - 0.07367 * f2,
    -0.10208 * f0 + 1.10813 * f1 - 0.00605 * f2,
    -0.00327 * f0 - 0.07276 * f1 + 1.07602 * f2,
  ];
  return saturate ? o.map((v) => clamp(v)) : o;
}
// Linear input colour whose ACES-filmic tone mapping is the given sRGB hex (Newton on the
// unclamped curve; the curve's toe is negative near 0, so start above it).
function inverseAces(hex) {
  const target = new THREE.Color(hex); // linear
  const want = [target.r, target.g, target.b];
  let x = want.map((v) => v + 0.02);
  const solve3 = (M, r) => {
    const det =
      M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
      M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
      M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const col = (k) => {
      const A = M.map((row) => row.slice());
      for (let i = 0; i < 3; i++) A[i][k] = r[i];
      return (
        A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
        A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
        A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
      );
    };
    return [col(0) / det, col(1) / det, col(2) / det];
  };
  for (let it = 0; it < 50; it++) {
    const y = acesFilmic(x, 1, false);
    const h = 1e-6;
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; // M[i][j] = d y_i / d x_j
    for (let j = 0; j < 3; j++) {
      const xp = x.slice();
      xp[j] += h;
      const yp = acesFilmic(xp, 1, false);
      for (let i = 0; i < 3; i++) M[i][j] = (yp[i] - y[i]) / h;
    }
    const dx = solve3(M, [want[0] - y[0], want[1] - y[1], want[2] - y[2]]);
    x = x.map((v, i) => Math.max(1e-6, v + dx[i]));
  }
  return new THREE.Color(x[0], x[1], x[2]);
}

// ---------------------------------------------------------------------------------------
// Data loading.
async function fetchBuf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: HTTP ${r.status}`);
  return r.arrayBuffer();
}
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: HTTP ${r.status}`);
  return r.json();
}
function typedView(Ctor, buf, offset, length) {
  if (offset % Ctor.BYTES_PER_ELEMENT === 0) return new Ctor(buf, offset, length);
  return new Ctor(buf.slice(offset, offset + length * Ctor.BYTES_PER_ELEMENT));
}
function parseSurface(buf, entry) {
  const a = entry.arrays;
  const nv = a.position.shape[0];
  const nf = a.index.shape[0];
  return {
    name: entry.part,
    nVertices: nv,
    nFaces: nf,
    position: typedView(Float32Array, buf, a.position.offset, nv * 3),
    normal: typedView(Float32Array, buf, a.normal.offset, nv * 3),
    index: typedView(Uint32Array, buf, a.index.offset, nf * 3),
    faceTag: typedView(Uint8Array, buf, a.face_tag.offset, nf),
    element: a.element ? typedView(Uint32Array, buf, a.element.offset, nf) : null,
    groups: entry.face_groups || [],
    bbox: entry.bbox_mm,
  };
}

async function loadData(baseURL) {
  const dataURL = (f) => new URL(`assets/data/${f}`, baseURL).href;
  const [manifest, summary, voxIndex] = await Promise.all([
    fetchJSON(dataURL("manifest.json")),
    fetchJSON(dataURL("summary.json")),
    fetchJSON(dataURL("vox_index.json")),
  ]);
  const surfNames = [
    "cortex_prox",
    "cortex_dist",
    "marrow_prox",
    "marrow_dist",
    "plate",
    "screws",
    "callus_hull",
  ];
  const surfFiles = [];
  for (const n of surfNames) surfFiles.push(`surf_${n}.bin`, `surf_${n}_half.bin`);
  surfFiles.push("surf_callus_cut.bin");
  const elemFiles = ["elem_centroid.bin", "elem_E_days.bin", "elem_strain_357.bin", "elem_hp_357.bin", "elem_class_357.bin"];
  const all = [...surfFiles, ...elemFiles, "vox_days.bin"];
  const bufs = await Promise.all(all.map((f) => fetchBuf(dataURL(f))));
  const byName = Object.fromEntries(all.map((f, i) => [f, bufs[i]]));
  const surfaces = {};
  for (const f of surfFiles) {
    const entry = manifest.files[f];
    surfaces[entry.part] = parseSurface(byName[f], entry);
  }
  const nEl = manifest.element_fields.n_elements;
  const feDays = manifest.fe_schedule.fe_days;
  const elem = {
    n: nEl,
    centroid: new Float32Array(byName["elem_centroid.bin"]),
    E_q: new Uint16Array(byName["elem_E_days.bin"]),
    E_rows: feDays.length,
    strain357: new Float32Array(byName["elem_strain_357.bin"]),
    hp357: new Float32Array(byName["elem_hp_357.bin"]),
    class357: new Uint8Array(byName["elem_class_357.bin"]),
  };
  const voxDays = manifest.voxels.days.slice();
  const voxRaw = byName["vox_days.bin"];
  const vox = {
    days: voxDays,
    grid: manifest.voxels.grid.shape, // [121, 121, 134]
    blockMM: manifest.voxels.grid.block_mm,
    raw: voxRaw,
    day(i) {
      const e = voxIndex.days[String(voxDays[i])];
      return {
        day: voxDays[i],
        count: e.count,
        block: typedView(Uint32Array, voxRaw, e.offset, e.count),
        code: new Uint8Array(voxRaw, e.code_offset, e.count),
        totals: e,
      };
    },
  };
  return { manifest, summary, voxIndex, surfaces, elem, vox, feDays };
}

// ---------------------------------------------------------------------------------------
// Voxel system: one InstancedMesh of 0.3 mm cubes (5 % gaps, bevel-look material) in the model frame.
// setDay(d) blends the two sampled days around d: blocks only in the earlier day shrink,
// blocks only in the later day grow, blocks whose code changes crossfade their colour.
// Blocks hidden on all six sides by full-size neighbours are culled (they cannot be seen).
function makeVoxels(THREE_, data, materialProto) {
  const [NI, NJ, NK] = data.vox.grid;
  const NJK = NJ * NK;
  const blockMM = data.vox.blockMM;
  const cube = blockMM * 0.95;
  const days = data.vox.days;
  const dayCache = new Map();
  const getDay = (i) => {
    if (!dayCache.has(i)) dayCache.set(i, data.vox.day(i));
    return dayCache.get(i);
  };
  const codeColors = {};
  for (const c of Object.keys(CODE_COLOR)) codeColors[c] = new THREE_.Color(CODE_COLOR[c]);

  const solid = new Uint8Array(NI * NJ * NK); // full-size, shown blocks (for culling)
  const codeGrid = new Uint8Array(NI * NJ * NK); // nearest sampled day's code, all blocks
  let mesh = null;
  let capacity = 0;
  const material = materialProto.clone();
  material.name = "voxels";

  function ensureCapacity(n) {
    if (n <= capacity && mesh) return;
    capacity = Math.max(1024, Math.ceil(n * 1.25));
    const geo = new THREE_.BoxGeometry(1, 1, 1);
    const m = new THREE_.InstancedMesh(geo, material, capacity);
    m.name = "voxels";
    m.instanceMatrix.setUsage(THREE_.DynamicDrawUsage);
    m.instanceColor = new THREE_.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    m.instanceColor.setUsage(THREE_.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    if (mesh) {
      const parent = mesh.parent;
      m.visible = mesh.visible;
      m.renderOrder = mesh.renderOrder;
      m.castShadow = mesh.castShadow;
      m.receiveShadow = mesh.receiveShadow;
      if (parent) {
        parent.remove(mesh);
        parent.add(m);
      }
      mesh.geometry.dispose();
      mesh.dispose();
    }
    mesh = m;
    api.mesh = m;
  }

  // Merge state of the current (day, half) pair.
  let mergedKey = null;
  let mBlock = new Uint32Array(0);
  let mScale = new Float32Array(0);
  let mCodeA = new Uint8Array(0);
  let mCodeB = new Uint8Array(0);
  let mMix = 0;
  let mN = 0;
  let codeKey = null;
  let instKey = null;

  function locate(d) {
    d = clamp(d, days[0], days[days.length - 1]);
    let a = 0;
    while (a < days.length - 1 && days[a + 1] <= d) a++;
    if (a === days.length - 1) return { a, b: a, f: 0 };
    const f = (d - days[a]) / (days[a + 1] - days[a]);
    return f <= 1e-9 ? { a, b: a, f: 0 } : { a, b: a + 1, f };
  }

  function merge(d) {
    const { a, b, f } = locate(d);
    const key = `${a}:${b}:${f.toFixed(6)}`;
    if (key === mergedKey) return;
    mergedKey = key;
    const A = getDay(a);
    const B = getDay(b);
    const cap = A.count + (a === b ? 0 : B.count);
    if (mBlock.length < cap) {
      mBlock = new Uint32Array(cap);
      mScale = new Float32Array(cap);
      mCodeA = new Uint8Array(cap);
      mCodeB = new Uint8Array(cap);
    }
    let n = 0;
    if (a === b) {
      for (let i = 0; i < A.count; i++) {
        mBlock[n] = A.block[i];
        mScale[n] = 1;
        mCodeA[n] = A.code[i];
        mCodeB[n] = A.code[i];
        n++;
      }
    } else {
      let i = 0;
      let j = 0;
      while (i < A.count || j < B.count) {
        const ba = i < A.count ? A.block[i] : 0xffffffff;
        const bb = j < B.count ? B.block[j] : 0xffffffff;
        if (ba === bb) {
          mBlock[n] = ba;
          mScale[n] = 1;
          mCodeA[n] = A.code[i];
          mCodeB[n] = B.code[j];
          i++;
          j++;
        } else if (ba < bb) {
          mBlock[n] = ba;
          mScale[n] = 1 - f;
          mCodeA[n] = A.code[i];
          mCodeB[n] = A.code[i];
          i++;
        } else {
          mBlock[n] = bb;
          mScale[n] = f;
          mCodeA[n] = B.code[j];
          mCodeB[n] = B.code[j];
          j++;
        }
        n++;
      }
    }
    mN = n;
    mMix = f;
    codeKey = null;
    instKey = null;
  }

  function buildCodeGrid() {
    if (codeKey === mergedKey) return;
    codeKey = mergedKey;
    codeGrid.fill(0);
    const useB = mMix >= 0.5;
    for (let i = 0; i < mN; i++) {
      const s = mScale[i];
      // Nearest sampled day: a block that exists only in the farther day is not present.
      if (s < 0.5) continue;
      codeGrid[mBlock[i]] = useB ? mCodeB[i] : mCodeA[i];
    }
  }

  const _c = new THREE_.Color();
  function buildInstances(half) {
    const key = `${mergedKey}|${half ? 1 : 0}`;
    if (key === instKey) return;
    instKey = key;
    solid.fill(0);
    const HALF_BI = 59; // blocks bi <= 59 lie in model x < 0 (the kept half)
    for (let i = 0; i < mN; i++) {
      const b = mBlock[i];
      if (half && Math.floor(b / NJK) > HALF_BI) continue;
      if (mScale[i] >= 0.999999) solid[b] = 1;
    }
    ensureCapacity(mN);
    const M = mesh.instanceMatrix.array;
    const C = mesh.instanceColor.array;
    let n = 0;
    for (let i = 0; i < mN; i++) {
      const b = mBlock[i];
      const bi = Math.floor(b / NJK);
      if (half && bi > HALF_BI) continue;
      const s = mScale[i];
      if (s <= 1e-4) continue;
      const bk = b % NK;
      const bj = Math.floor(b / NK) % NJ;
      if (
        solid[b] &&
        bi > 0 && bi < NI - 1 && bj > 0 && bj < NJ - 1 && bk > 0 && bk < NK - 1 &&
        solid[b - NJK] && solid[b + NJK] && solid[b - NK] && solid[b + NK] && solid[b - 1] && solid[b + 1]
      )
        continue; // interior block, never visible
      const x = -18 + 0.1 * (3 * bi + 1);
      const y = -18 + 0.1 * (3 * bj + 1);
      const z = 0 + 0.1 * (3 * bk + 1);
      const sc = cube * s;
      const o = n * 16;
      M[o] = sc; M[o + 1] = 0; M[o + 2] = 0; M[o + 3] = 0;
      M[o + 4] = 0; M[o + 5] = sc; M[o + 6] = 0; M[o + 7] = 0;
      M[o + 8] = 0; M[o + 9] = 0; M[o + 10] = sc; M[o + 11] = 0;
      M[o + 12] = x; M[o + 13] = y; M[o + 14] = z; M[o + 15] = 1;
      const ca = codeColors[mCodeA[i]] || codeColors[1];
      const cb = codeColors[mCodeB[i]] || ca;
      if (ca === cb) _c.copy(ca);
      else _c.copy(ca).lerp(cb, mMix);
      C[n * 3] = _c.r;
      C[n * 3 + 1] = _c.g;
      C[n * 3 + 2] = _c.b;
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.clearUpdateRanges?.();
    mesh.instanceMatrix.addUpdateRange?.(0, n * 16);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.clearUpdateRanges?.();
    mesh.instanceColor.addUpdateRange?.(0, n * 3);
    mesh.instanceColor.needsUpdate = true;
    api.instanceCount = n;
  }

  let curDay = 0;
  let curHalf = false;
  let curOpacity = 1;
  const api = {
    mesh: null,
    material,
    instanceCount: 0,
    days,
    grid: [NI, NJ, NK],
    blockMM,
    codeColors,
    setDay(d) {
      curDay = d;
    },
    setHalf(h) {
      curHalf = !!h;
    },
    setOpacity(a) {
      curOpacity = clamp(a);
    },
    get day() {
      return curDay;
    },
    // Code (1, 2, 4, 5 or 0 = empty) of a block at the nearest sampled day to the current day.
    codeAt(blockIndex) {
      merge(curDay);
      buildCodeGrid();
      return codeGrid[blockIndex];
    },
    blockIndex(bi, bj, bk) {
      return (bi * NJ + bj) * NK + bk;
    },
    // Model-frame centre of a block.
    blockCentre(bi, bj, bk, out = new THREE_.Vector3()) {
      return out.set(-18 + 0.1 * (3 * bi + 1), -18 + 0.1 * (3 * bj + 1), 0.1 * (3 * bk + 1));
    },
    // Raw blocks of a sampled day index (sorted block_index and code arrays).
    sampledDay: getDay,
    // Called by the engine once per frame after the beats ran.
    apply() {
      const visible = curOpacity > 0.001;
      merge(curDay);
      if (visible) buildInstances(curHalf);
      mesh.visible = visible;
      material.opacity = curOpacity;
      const tr = curOpacity < 0.999;
      if (material.transparent !== tr) {
        material.transparent = tr;
        material.needsUpdate = true;
      }
    },
    ensureCodeGrid() {
      merge(curDay);
      buildCodeGrid();
      return codeGrid;
    },
  };
  ensureCapacity(60000);
  return api;
}

// ---------------------------------------------------------------------------------------
// Field system (P2-4): the callus cut face (surf_callus_cut, normal model +x).
//   tissue  per pixel: the voxel slab next to the cut plane (block bi = 59 just behind it,
//           else bi = 60 which holds the plane) as a 2D code texture (nearest neighbour) at
//           the nearest sampled day; an empty block is granulation tissue (viridis 0).
//   E       per vertex: the area-weighted mean of the incident triangles' log-coded moduli
//           (elem_E_days row eDayIndex, rows interpolated), then viridis per pixel.
//   strain  per vertex: the same mean of log |elem_strain_357|, then magma 0.15..1.
// A one-pixel darker line runs along the boundary edges where the callus meets the cortex
// or the marrow (vertices shared with their cut faces).
function makeFields(THREE_, data, voxels, cutMesh) {
  const surf = data.surfaces.callus_cut;
  const nf = surf.nFaces;
  const nv = surf.nVertices;
  const el = surf.element;
  const P = surf.position;
  const I = surf.index;
  const [, NJ, NK] = voxels.grid;
  const geo = cutMesh.geometry;
  const aE = geo.getAttribute("aE");
  const nEl = data.elem.n;
  const rows = data.elem.E_rows;
  const Eq = data.elem.E_q;
  const strain = data.elem.strain357;

  // Face areas and per-vertex weight sums (area weighting).
  const area = new Float32Array(nf);
  const wsum = new Float32Array(nv);
  for (let f = 0; f < nf; f++) {
    const a = I[f * 3];
    const b = I[f * 3 + 1];
    const c = I[f * 3 + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const A = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    area[f] = A;
    wsum[a] += A;
    wsum[b] += A;
    wsum[c] += A;
  }
  function vertexMean(faceValue, out) {
    out.fill(0);
    for (let f = 0; f < nf; f++) {
      const v = faceValue(f) * area[f];
      out[I[f * 3]] += v;
      out[I[f * 3 + 1]] += v;
      out[I[f * 3 + 2]] += v;
    }
    for (let v = 0; v < nv; v++) out[v] = wsum[v] > 0 ? out[v] / wsum[v] : 0;
    return out;
  }

  // Value in [0, 1] of the log map for an element.
  function eValue(e, idx) {
    idx = clamp(idx, 0, rows - 1);
    const r0 = Math.floor(idx);
    const r1 = Math.min(rows - 1, r0 + 1);
    const w = idx - r0;
    const q = Eq[r0 * nEl + e] * (1 - w) + Eq[r1 * nEl + e] * w;
    return q / 65535; // the uint16 encoding is already log(E / 0.2) / log(17000 / 0.2)
  }
  function strainValue(e) {
    return logStrain(strain[e]);
  }
  // Strain per vertex: static.
  vertexMean((f) => strainValue(el[f]), geo.getAttribute("aS").array);
  geo.getAttribute("aS").needsUpdate = true;

  // Field textures (pass 3): every texel of a FIELD_TEXEL grid on the cut plane (model y, z)
  // takes the element of the triangle that holds its centre; values are smoothed by a
  // Gaussian normalised by the smoothed coverage mask (normalised convolution), so the map
  // is smooth inside, keeps its level up to the outline and never mixes in the ground.
  // Texels just outside the face hold the extrapolated value, so linear filtering at the
  // outline adds no dark rim.
  let fy0 = Infinity, fz0 = Infinity, fy1 = -Infinity, fz1 = -Infinity;
  for (let v = 0; v < nv; v++) {
    fy0 = Math.min(fy0, P[v * 3 + 1]);
    fy1 = Math.max(fy1, P[v * 3 + 1]);
    fz0 = Math.min(fz0, P[v * 3 + 2]);
    fz1 = Math.max(fz1, P[v * 3 + 2]);
  }
  fy0 -= FIELD_PAD;
  fz0 -= FIELD_PAD;
  fy1 += FIELD_PAD;
  fz1 += FIELD_PAD;
  const FW = Math.ceil((fy1 - fy0) / FIELD_TEXEL);
  const FH = Math.ceil((fz1 - fz0) / FIELD_TEXEL);
  const texFace = new Int32Array(FW * FH).fill(-1);
  for (let f = 0; f < nf; f++) {
    const a = I[f * 3], b = I[f * 3 + 1], c = I[f * 3 + 2];
    const ay = (P[a * 3 + 1] - fy0) / FIELD_TEXEL - 0.5, az = (P[a * 3 + 2] - fz0) / FIELD_TEXEL - 0.5;
    const by = (P[b * 3 + 1] - fy0) / FIELD_TEXEL - 0.5, bz = (P[b * 3 + 2] - fz0) / FIELD_TEXEL - 0.5;
    const cy = (P[c * 3 + 1] - fy0) / FIELD_TEXEL - 0.5, cz = (P[c * 3 + 2] - fz0) / FIELD_TEXEL - 0.5;
    const d = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    if (Math.abs(d) < 1e-12) continue;
    const i0 = Math.max(0, Math.ceil(Math.min(ay, by, cy))), i1 = Math.min(FW - 1, Math.floor(Math.max(ay, by, cy)));
    const j0 = Math.max(0, Math.ceil(Math.min(az, bz, cz))), j1 = Math.min(FH - 1, Math.floor(Math.max(az, bz, cz)));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const w1 = ((i - ay) * (cz - az) - (j - az) * (cy - ay)) / d;
        const w2 = ((by - ay) * (j - az) - (bz - az) * (i - ay)) / d;
        if (w1 >= -1e-6 && w2 >= -1e-6 && w1 + w2 <= 1 + 1e-6) texFace[j * FW + i] = f;
      }
  }
  // Separable Gaussian (radius 3 sigma) on a FW x FH float grid, in place via a scratch row.
  const gr = Math.ceil((3 * FIELD_SIGMA) / FIELD_TEXEL);
  const gk = new Float32Array(2 * gr + 1);
  for (let k = -gr; k <= gr; k++) gk[k + gr] = Math.exp(-0.5 * ((k * FIELD_TEXEL) / FIELD_SIGMA) ** 2);
  const scratch = new Float32Array(Math.max(FW, FH));
  function blur(g) {
    for (let j = 0; j < FH; j++) {
      const o = j * FW;
      for (let i = 0; i < FW; i++) {
        let acc = 0;
        for (let k = Math.max(-gr, -i), k1 = Math.min(gr, FW - 1 - i); k <= k1; k++) acc += gk[k + gr] * g[o + i + k];
        scratch[i] = acc;
      }
      g.set(scratch.subarray(0, FW), o);
    }
    for (let i = 0; i < FW; i++) {
      for (let j = 0; j < FH; j++) {
        let acc = 0;
        for (let k = Math.max(-gr, -j), k1 = Math.min(gr, FH - 1 - j); k <= k1; k++) acc += gk[k + gr] * g[(j + k) * FW + i];
        scratch[j] = acc;
      }
      for (let j = 0; j < FH; j++) g[j * FW + i] = scratch[j];
    }
    return g;
  }
  const maskBlur = new Float32Array(FW * FH);
  for (let n = 0; n < FW * FH; n++) maskBlur[n] = texFace[n] >= 0 ? 1 : 0;
  blur(maskBlur);
  const fieldGrid = new Float32Array(FW * FH);
  function fieldTexture() {
    const t = new THREE_.DataTexture(new Uint16Array(FW * FH), FW, FH, THREE_.RedFormat, THREE_.HalfFloatType);
    t.minFilter = THREE_.LinearFilter;
    t.magFilter = THREE_.LinearFilter;
    t.wrapS = THREE_.ClampToEdgeWrapping;
    t.wrapT = THREE_.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    t.unpackAlignment = 2;
    t.needsUpdate = true;
    return t;
  }
  // Fill a field texture from a per-element value u(e) in [0, 1].
  function fillField(tex, elemValue) {
    const g = fieldGrid;
    for (let n = 0; n < FW * FH; n++) {
      const f = texFace[n];
      g[n] = f >= 0 ? elemValue(el[f]) : 0;
    }
    blur(g);
    const out = tex.image.data;
    for (let n = 0; n < FW * FH; n++) {
      const m = maskBlur[n];
      out[n] = THREE_.DataUtils.toHalfFloat(m > 1e-4 ? clamp(g[n] / m) : 0);
    }
    tex.needsUpdate = true;
  }
  const eTex = fieldTexture();
  const sTex = fieldTexture();
  fillField(sTex, strainValue);

  // Tissue code texture (x = bj, y = bk) of the slab next to the cut plane.
  const codeTex = new Uint8Array(NJ * NK);
  const tex = new THREE_.DataTexture(codeTex, NJ, NK, THREE_.RedFormat, THREE_.UnsignedByteType);
  tex.minFilter = THREE_.NearestFilter;
  tex.magFilter = THREE_.NearestFilter;
  tex.wrapS = THREE_.ClampToEdgeWrapping;
  tex.wrapT = THREE_.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  const i59 = voxels.blockIndex(59, 0, 0);
  const i60 = voxels.blockIndex(60, 0, 0);
  function updateTissue(codeGrid) {
    for (let bj = 0; bj < NJ; bj++) {
      for (let bk = 0; bk < NK; bk++) {
        const o = bj * NK + bk;
        codeTex[bk * NJ + bj] = codeGrid[i59 + o] || codeGrid[i60 + o];
      }
    }
    tex.needsUpdate = true;
  }

  const uniforms = cutMesh.material.userData.sgUniforms;
  uniforms.uSgTissue.value = tex;
  uniforms.uSgEMap.value = eTex;
  uniforms.uSgSMap.value = sTex;
  uniforms.uSgFGrid.value.set(fy0, fz0, FW * FIELD_TEXEL, FH * FIELD_TEXEL);
  const PREV = { tissue: "tissue", E: "tissue", strain: "E" };

  let mode = "tissue";
  let blend = 1;
  let eDayIndex = 0;
  let eKey = null;
  let tissueKey = null;
  const api = {
    mesh: cutMesh,
    modes: ["tissue", "E", "strain"],
    tissueTexture: tex,
    eTexture: eTex,
    strainTexture: sTex,
    setMode(m) {
      if (!PREV[m]) throw new Error(`fields.setMode: unknown mode ${m}`);
      mode = m;
    },
    setBlend(a) {
      blend = clamp(a);
    },
    setEDayIndex(i) {
      eDayIndex = clamp(i, 0, rows - 1);
    },
    get mode() {
      return mode;
    },
    eValue,
    strainValue,
    // FE day of a (fractional) E row index.
    eDay(i) {
      const d = data.feDays;
      i = clamp(i, 0, d.length - 1);
      const r0 = Math.floor(i);
      return lerp(d[r0], d[Math.min(d.length - 1, r0 + 1)], i - r0);
    },
    // Weights of the three maps on the face this frame: [tissue, E, strain].
    weights() {
      if (mode === "tissue") return [1, 0, 0];
      if (mode === "E") return [1 - blend, blend, 0];
      return [0, 1 - blend, blend];
    },
    apply(dayKey) {
      const w = api.weights();
      uniforms.uSgW.value.set(w[0], w[1], w[2]);
      if (w[0] > 0) {
        const codeGrid = voxels.ensureCodeGrid();
        if (dayKey !== tissueKey) {
          tissueKey = dayKey;
          updateTissue(codeGrid);
        }
      }
      if (w[1] > 0) {
        const k = eDayIndex.toFixed(5);
        if (k !== eKey) {
          eKey = k;
          vertexMean((f) => eValue(el[f], eDayIndex), aE.array);
          aE.needsUpdate = true;
          fillField(eTex, (e) => eValue(e, eDayIndex));
        }
      }
    },
  };
  return api;
}

// Cut-face material: a lit standard material whose albedo is mixed per pixel from the
// tissue texture and the two field maps (weights from fields.apply), plus an emissive term
// of FIELD_EMISSIVE x the field colour, plus the boundary line.
function makeCutMaterial(THREE_, grid) {
  const lin = (hex) => {
    const c = new THREE_.Color(hex);
    return new THREE_.Vector3(c.r, c.g, c.b);
  };
  const srgb = (hex) => {
    const a = srgbArr(hex);
    return new THREE_.Vector3(a[0], a[1], a[2]);
  };
  const codeCols = [EMPTY_TISSUE_COLOR, CODE_COLOR[1], CODE_COLOR[2], CODE_COLOR[1], CODE_COLOR[4], CODE_COLOR[5]].map(lin);
  const uniforms = {
    uSgTissue: { value: null },
    uSgGrid: { value: new THREE_.Vector4(grid.y0, grid.z0, grid.sy, grid.sz) },
    uSgCodeCol: { value: codeCols },
    uSgW: { value: new THREE_.Vector3(1, 0, 0) },
    uSgViridis: { value: VIRIDIS.map(srgb) },
    uSgMagma: { value: MAGMA.map(srgb) },
    uSgEmissive: { value: FIELD_EMISSIVE },
    uSgEMap: { value: null },
    uSgSMap: { value: null },
    uSgFGrid: { value: new THREE_.Vector4(0, 0, 1, 1) },
  };
  const m = new THREE_.MeshStandardMaterial({
    roughness: 0.6,
    metalness: 0,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -8,
  });
  m.name = "callus_cut";
  m.userData.sgUniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aE;\nattribute float aS;\nattribute float aEdge;\nvarying float vSgE;\nvarying float vSgS;\nvarying float vSgEdge;\nvarying vec2 vSgYZ;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSgE = aE;\nvSgS = aS;\nvSgEdge = aEdge;\nvSgYZ = position.yz;");
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D uSgTissue;
uniform vec4 uSgGrid;
uniform vec3 uSgCodeCol[ 6 ];
uniform vec3 uSgW;
uniform vec3 uSgViridis[ 17 ];
uniform vec3 uSgMagma[ 17 ];
uniform float uSgEmissive;
uniform sampler2D uSgEMap;
uniform sampler2D uSgSMap;
uniform vec4 uSgFGrid;
varying float vSgE;
varying float vSgS;
varying float vSgEdge;
varying vec2 vSgYZ;
vec3 sgToLinear( vec3 c ) {
  return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( vec3( 0.04045 ), c ) );
}
vec3 sgMap( vec3 table[ 17 ], float u ) {
  float x = clamp( u, 0.0, 1.0 ) * 16.0;
  int i = int( min( floor( x ), 15.0 ) );
  return sgToLinear( mix( table[ i ], table[ i + 1 ], x - float( i ) ) );
}
float sgEdgeLine;
vec3 sgField;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  vec2 sgUV = ( vSgYZ - uSgGrid.xy ) / uSgGrid.zw;
  int sgCode = 0;
  if ( all( greaterThanEqual( sgUV, vec2( 0.0 ) ) ) && all( lessThan( sgUV, vec2( 1.0 ) ) ) )
    sgCode = int( texture2D( uSgTissue, sgUV ).r * 255.0 + 0.5 );
  sgCode = clamp( sgCode, 0, 5 );
  vec3 sgTissue = uSgCodeCol[ sgCode ];
  // E and strain per pixel from the smoothed element rasters (pass 3); vSgE / vSgS (the
  // per-vertex means) are kept as attributes but no longer drive the colour.
  vec2 sgFUV = ( vSgYZ - uSgFGrid.xy ) / uSgFGrid.zw;
  vec3 sgE = sgMap( uSgViridis, texture2D( uSgEMap, sgFUV ).r );
  vec3 sgS = sgMap( uSgMagma, texture2D( uSgSMap, sgFUV ).r );
  sgField = sgE * uSgW.y + sgS * uSgW.z + ( sgCode == 0 ? sgTissue * uSgW.x : vec3( 0.0 ) );
  // boundary line: ~1 px where the interpolated boundary flag reaches 1
  float sgPx = ( 1.0 - vSgEdge ) / max( fwidth( vSgEdge ), 1e-5 );
  sgEdgeLine = 1.0 - 0.5 * ( 1.0 - smoothstep( 0.6, 1.4, sgPx ) );
  diffuseColor.rgb = ( sgTissue * uSgW.x + sgE * uSgW.y + sgS * uSgW.z ) * sgEdgeLine;
}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uSgEmissive * sgField * sgEdgeLine;",
      );
  };
  m.customProgramCacheKey = () => "sg-cut-face";
  return m;
}

// ---------------------------------------------------------------------------------------
// Cross-section of a closed surface (model frame) on the plane model x = xc, for the half-cut
// sweep caps. makeSlicer(THREE, surf) -> slice(xc, geometry) fills `geometry` with the
// section's triangles (on x = xc, facing +x). Vertices are welded by position (the export
// splits them at creases), every vertex is classified once (x >= xc or not), so the two
// triangles sharing an edge always agree on its crossing point and the segments close into
// loops even when the plane passes through vertices. Loops are nested by containment (even
// depth: outline, odd: hole) and triangulated with ShapeUtils (earcut).
function makeSlicer(THREE_, surf) {
  const P = surf.position;
  const I = surf.index;
  const nv = surf.nVertices;
  const nf = surf.nFaces;
  const weld = new Int32Array(nv);
  const ids = new Map();
  for (let v = 0; v < nv; v++) {
    const k = `${Math.round(P[v * 3] * 1e4)},${Math.round(P[v * 3 + 1] * 1e4)},${Math.round(P[v * 3 + 2] * 1e4)}`;
    let id = ids.get(k);
    if (id === undefined) {
      id = ids.size;
      ids.set(k, id);
    }
    weld[v] = id;
  }
  const NW = ids.size;
  const pos = new Float32Array(NW * 3);
  for (let v = 0; v < nv; v++) pos.set(P.subarray(v * 3, v * 3 + 3), weld[v] * 3);
  const F = new Int32Array(nf * 3);
  for (let n = 0; n < nf * 3; n++) F[n] = weld[I[n]];
  const side = new Uint8Array(NW);
  let posAttr = null;
  let norAttr = null;
  return function slice(xc, geometry) {
    for (let v = 0; v < NW; v++) side[v] = pos[v * 3] >= xc ? 1 : 0;
    const pt = new Map(); // edge key -> [y, z]
    const adj = new Map(); // edge key -> [edge key, edge key]
    const crossing = (a, b) => {
      const lo = a < b ? a : b;
      const hi = a < b ? b : a;
      const key = lo * NW + hi;
      if (!pt.has(key)) {
        const x0 = pos[lo * 3];
        const x1 = pos[hi * 3];
        const t = x1 !== x0 ? (xc - x0) / (x1 - x0) : 0;
        pt.set(key, [pos[lo * 3 + 1] + t * (pos[hi * 3 + 1] - pos[lo * 3 + 1]), pos[lo * 3 + 2] + t * (pos[hi * 3 + 2] - pos[lo * 3 + 2])]);
      }
      return key;
    };
    const link = (k1, k2) => {
      if (!adj.has(k1)) adj.set(k1, []);
      if (!adj.has(k2)) adj.set(k2, []);
      adj.get(k1).push(k2);
      adj.get(k2).push(k1);
    };
    for (let f = 0; f < nf; f++) {
      const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
      const sa = side[a], sb = side[b], sc = side[c];
      if (sa === sb && sb === sc) continue;
      const ks = [];
      if (sa !== sb) ks.push(crossing(a, b));
      if (sb !== sc) ks.push(crossing(b, c));
      if (sc !== sa) ks.push(crossing(c, a));
      if (ks.length === 2) link(ks[0], ks[1]);
    }
    // Walk the loops (every crossing edge is shared by two faces: degree 2).
    const loops = [];
    const seen = new Set();
    for (const start of adj.keys()) {
      if (seen.has(start)) continue;
      const loop = [];
      let prev = -1;
      let cur = start;
      for (let guard = 0; guard < 1e6; guard++) {
        seen.add(cur);
        const p = pt.get(cur);
        const last = loop[loop.length - 1];
        if (!last || Math.abs(last.x - p[0]) > 1e-7 || Math.abs(last.y - p[1]) > 1e-7) loop.push(new THREE_.Vector2(p[0], p[1]));
        const nb = adj.get(cur);
        const next = nb[0] !== prev ? nb[0] : nb[1];
        prev = cur;
        cur = next;
        if (cur === start || cur === undefined || seen.has(cur)) break;
      }
      if (loop.length >= 3) loops.push(loop);
    }
    // Nesting depth by containment of each loop's first point.
    const inside = (p, poly) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
      }
      return c;
    };
    const areaOf = (poly) => Math.abs(THREE_.ShapeUtils.area(poly));
    const depth = loops.map((l, i) => loops.reduce((d, m, j) => d + (j !== i && inside(l[0], m) ? 1 : 0), 0));
    const tris = [];
    loops.forEach((outer, i) => {
      if (depth[i] % 2) return;
      const holes = [];
      loops.forEach((h, j) => {
        if (depth[j] !== depth[i] + 1 || !inside(h[0], outer)) return;
        // the hole belongs to the smallest outline of this depth that holds it
        const owner = loops.reduce((best, m, k) => (depth[k] === depth[i] && inside(h[0], m) && (best < 0 || areaOf(m) < areaOf(loops[best])) ? k : best), -1);
        if (owner === i) holes.push(h.slice());
      });
      const contour = outer.slice();
      const faces = THREE_.ShapeUtils.triangulateShape(contour, holes);
      const all = contour.concat(...holes);
      for (const [ia, ib, ic] of faces) {
        const A = all[ia], B = all[ib], C = all[ic];
        // normal x = (B - A).y * (C - A).z - (B - A).z * (C - A).y, with (y, z) = (v.x, v.y)
        const nx = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
        const order = nx >= 0 ? [A, B, C] : [A, C, B];
        for (const q of order) tris.push(xc, q.x, q.y);
      }
    });
    const n = tris.length / 3;
    if (!posAttr || posAttr.count < n) {
      const cap = Math.max(1024, Math.ceil(n * 1.5));
      posAttr = new THREE_.BufferAttribute(new Float32Array(cap * 3), 3);
      norAttr = new THREE_.BufferAttribute(new Float32Array(cap * 3), 3);
      for (let v = 0; v < cap; v++) norAttr.array[v * 3] = 1;
      posAttr.setUsage(THREE_.DynamicDrawUsage);
      geometry.setAttribute("position", posAttr);
      geometry.setAttribute("normal", norAttr);
    }
    posAttr.array.set(tris);
    posAttr.needsUpdate = true;
    geometry.setDrawRange(0, n);
    return n;
  };
}

// ---------------------------------------------------------------------------------------
// Geometry builders.
function indexedGeometry(THREE_, s, faceFrom = 0, faceTo = s.nFaces) {
  const g = new THREE_.BufferGeometry();
  g.setAttribute("position", new THREE_.BufferAttribute(s.position, 3));
  g.setAttribute("normal", new THREE_.BufferAttribute(s.normal, 3));
  g.setIndex(new THREE_.BufferAttribute(s.index.subarray(faceFrom * 3, faceTo * 3), 1));
  g.computeBoundingSphere();
  return g;
}
// Smooth surface (P2-3): normals recomputed from the faces with a crease angle, so tubes
// shade round and only real edges (plate rims, screw heads, bone end rims) stay sharp.
function creasedGeometry(THREE_, s, faceFrom = 0, faceTo = s.nFaces) {
  const g = toCreasedNormals(indexedGeometry(THREE_, s, faceFrom, faceTo), THREE_.MathUtils.degToRad(CREASE_DEG));
  g.computeBoundingSphere();
  return g;
}
function cutRange(s) {
  const g = s.groups.find((x) => x.tag === 255);
  return g ? [g.first_face, g.first_face + g.n_faces] : null;
}
// The callus cut face: indexed (shared vertices) with per-vertex field values aE, aS and
// the boundary flag aEdge (see makeFields). The face's element ids stay per face in
// geometry.userData.faceElement.
function cutFaceGeometry(THREE_, s, neighbourKeys) {
  const nv = s.nVertices;
  const g = new THREE_.BufferGeometry();
  g.setAttribute("position", new THREE_.BufferAttribute(s.position, 3));
  g.setAttribute("normal", new THREE_.BufferAttribute(s.normal, 3));
  g.setIndex(new THREE_.BufferAttribute(s.index, 1));
  const aE = new THREE_.BufferAttribute(new Float32Array(nv), 1);
  aE.setUsage(THREE_.DynamicDrawUsage);
  g.setAttribute("aE", aE);
  g.setAttribute("aS", new THREE_.BufferAttribute(new Float32Array(nv), 1));
  // Boundary edges (used by one face) whose two vertices lie on a bone-end cut face.
  const I = s.index;
  const P = s.position;
  const edgeCount = new Map();
  const ek = (a, b) => (a < b ? a * nv + b : b * nv + a);
  for (let f = 0; f < s.nFaces; f++) {
    for (let k = 0; k < 3; k++) {
      const key = ek(I[f * 3 + k], I[f * 3 + ((k + 1) % 3)]);
      edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
    }
  }
  const posKey = (v) => `${Math.round(P[v * 3 + 1] * 1000)},${Math.round(P[v * 3 + 2] * 1000)}`;
  const flag = new Float32Array(nv);
  let shared = 0;
  const boundary = [];
  for (const [key, n] of edgeCount) {
    if (n !== 1) continue;
    const a = Math.floor(key / nv);
    const b = key % nv;
    boundary.push(a, b);
    if (neighbourKeys.has(posKey(a)) && neighbourKeys.has(posKey(b))) {
      flag[a] = 1;
      flag[b] = 1;
      shared++;
    }
  }
  if (shared < 8) for (const v of boundary) flag[v] = 1; // no shared vertices: outline it all
  g.setAttribute("aEdge", new THREE_.BufferAttribute(flag, 1));
  g.userData.faceElement = s.element;
  g.userData.boundaryEdgesOnBone = shared;
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------------------
// Boot: build everything, then return { render(t), ctx }.
export async function boot({ canvas, baseURL = document.baseURI, labels: labelsSvg = null }) {
  patchShaderChunks();
  const data = await loadData(baseURL);
  const st = data.manifest.scene_transform;

  // Renderer.
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
    // No stencil on the canvas: in SwiftShader a depth-stencil default framebuffer cost about
    // 60 % more on EVERY frame (pass 3 bench); the half-cut caps are built on the CPU.
    stencil: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // updated once per frame in render(t)

  const scene = new THREE.Scene();
  const bgDirect = new THREE.Color(PALETTE.ground); // clear colour: not tone mapped
  scene.background = bgDirect;
  scene.fog = new THREE.Fog(inverseAces(PALETTE.groundFar), 100, 600);

  // Environment (RoomEnvironment through PMREM).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = ENV_INTENSITY;
  scene.environmentRotation = new THREE.Euler(0, 0, 0);

  // Camera (vertical fov in degrees).
  const camera = new THREE.PerspectiveCamera(28, WIDTH / HEIGHT, 0.5, 1000);
  camera.filmGauge = 36;

  // Lights. Directions are camera-relative (x right, y up, z towards the viewer, after the
  // roll), so the key stays upper left on screen and the rim behind right for the whole take.
  const keyLight = new THREE.DirectionalLight(PALETTE.keyLight, KEY_INTENSITY);
  const rimLight = new THREE.DirectionalLight(PALETTE.rimLight, RIM_INTENSITY);
  const fillLight = new THREE.DirectionalLight(PALETTE.fillLight, FILL_INTENSITY);
  const lightDirs = [
    [keyLight, new THREE.Vector3(-0.5, 0.8, 0.4).normalize()],
    [rimLight, new THREE.Vector3(0.6, 0.3, -0.8).normalize()],
    [fillLight, new THREE.Vector3(0, -1, 0.15).normalize()],
  ];
  const lightTarget = new THREE.Object3D();
  scene.add(lightTarget);
  for (const [l] of lightDirs) {
    l.target = lightTarget;
    scene.add(l);
  }
  // Soft shadows from the key light; the orthographic frustum is fitted every frame to the
  // region the camera sees around its target (placeCamera).
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  keyLight.shadow.camera = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 800);

  // Model group: scene = R * model + t (manifest.scene_transform).
  const model = new THREE.Group();
  model.name = "model";
  const q = st.three_object3d.quaternion_xyzw;
  model.quaternion.set(q[0], q[1], q[2], q[3]);
  model.position.fromArray(st.three_object3d.position);
  model.updateMatrixWorld(true);
  scene.add(model);
  const toScene = (v, out = new THREE.Vector3()) => out.copy(Array.isArray(v) ? new THREE.Vector3().fromArray(v) : v).applyMatrix4(model.matrixWorld);
  const toModel = (v, out = new THREE.Vector3()) => out.copy(Array.isArray(v) ? new THREE.Vector3().fromArray(v) : v).applyMatrix4(new THREE.Matrix4().copy(model.matrixWorld).invert());

  // Clipping plane for the half cut: keeps scene x >= c (the kept half is scene x >= 0).
  const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e6);

  // Materials (prototypes; each part mesh gets its own clone so opacity is per part).
  // userData.sgReceiveShadow: meshes using a clone of these receive the key light's shadow
  // (set after the beats are built, so beat objects that clone them get it too).
  const shadowed = { sgReceiveShadow: true };
  const materials = {
    cortex: new SgStandardMaterial({ color: PALETTE.cortex, roughness: 0.85, metalness: 0, userData: shadowed }, { SG_GRAIN: "" }),
    marrow: new SgStandardMaterial({ color: PALETTE.marrow, roughness: 0.8, metalness: 0, userData: shadowed }, { SG_GRAIN: "" }),
    // Brushed steel with its own envMap (three ignores envMapIntensity for materials that use
    // scene.environment); rotation follows state.envRotation (applyState).
    steel: new SgStandardMaterial(
      { color: PALETTE.plate, roughness: 0.32, metalness: 0.9, envMap: envTex, envMapIntensity: STEEL_ENV, userData: shadowed },
      { SG_BRUSHED: "" },
    ),
    // Screws: slightly darker steel so the flush heads read against the plate.
    screwSteel: new SgStandardMaterial({ color: PALETTE.screw, roughness: 0.3, metalness: 0.9, envMap: envTex, envMapIntensity: SCREW_ENV, userData: shadowed }),
    hull: new SgStandardMaterial({ color: PALETTE.cortex, roughness: 0.85, metalness: 0, transparent: true, depthWrite: false, opacity: 0.3 }),
    // The cut face lies 0.05 mm in front of the voxel faces behind it: pulled forward in depth
    // (see makeCutMaterial). This prototype is kept for compatibility; callus_cut uses its own.
    cut: new SgStandardMaterial({ roughness: 0.6, metalness: 0, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8, userData: shadowed }),
    // Voxels: bevel-look cubes. A slope-scaled polygon offset keeps their near-edge-on side
    // faces behind the cut face 0.05 mm in front of them.
    voxel: new SgStandardMaterial(
      { roughness: 0.7, metalness: 0, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4, userData: shadowed },
      { SG_BEVEL: "" },
    ),
  };

  const parts = {};
  const partMeta = {}; // name -> { kind: 'full'|'half'|'halfCut', group }
  function addPart(name, geometry, proto, kind, group, shadows = true) {
    const mat = proto.clone();
    mat.name = name;
    if (kind === "full") mat.clippingPlanes = [clipPlane];
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = name;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.userData.baseOpacity = mat.opacity;
    mesh.userData.baseColor = mat.color ? mat.color.clone() : null;
    mesh.userData.baseTransparent = mat.transparent;
    model.add(mesh);
    parts[name] = mesh;
    partMeta[name] = { kind, group };
    return mesh;
  }
  const solidParts = [
    ["cortex_prox", materials.cortex],
    ["cortex_dist", materials.cortex],
    ["marrow_prox", materials.marrow],
    ["marrow_dist", materials.marrow],
    ["plate", materials.steel],
    ["screws", materials.screwSteel],
  ];
  const boneCutKeys = new Set(); // (y, z) of the bone-end cut face vertices, for the cut face's boundary line
  // Half-cut sweep caps (pass 3, SPEC P3-3). While 0 < half < 1 the full solids are clipped at
  // scene x = c and would show as open shells (the plate's top face as a flap, whole screw
  // cylinders through the cut). Each solid gets a cap on the clip plane: its exact cross-
  // section, sliced from the part's own triangles every frame (makeSlicer), in the part's
  // own material, like the exported flat cut faces that take over at half = 1. Every solid
  // surface is closed (each edge shared by two faces), so the section is a set of closed
  // loops; holes (screw holes, the marrow canal) stay holes. Built on the CPU because a
  // stencil-buffer cap needs a depth-stencil canvas, which cost about 60 % more on every
  // frame in SwiftShader (pass 3 bench), or a render target, whose OutputPass tone-maps the
  // ink arrows and the ground differently from the canvas.
  const capParts = [];
  const sweepClip = [clipPlane];
  function addCap(name, surf, proto) {
    const capMat = proto.clone();
    capMat.name = `${name}_cap`;
    const geo = new THREE.BufferGeometry();
    const cap = new THREE.Mesh(geo, capMat);
    cap.name = `${name}_cap`;
    cap.visible = false;
    cap.frustumCulled = false;
    cap.receiveShadow = true;
    cap.castShadow = false;
    model.add(cap);
    capParts.push({ name, cap, slice: makeSlicer(THREE, surf), key: null });
  }
  for (const [name, mat] of solidParts) {
    const full = data.surfaces[name];
    const half = data.surfaces[`${name}_half`];
    addPart(name, creasedGeometry(THREE, full), mat, "full", name);
    parts[name].material.clipShadows = true; // the cut-away half casts no shadow on the cut
    addCap(name, full, mat);
    const cr = cutRange(half);
    if (cr) {
      addPart(`${name}_half`, creasedGeometry(THREE, half, 0, cr[0]), mat, "half", name);
      const cutGeo = indexedGeometry(THREE, half, cr[0], cr[1]); // flat cut faces keep flat normals
      addPart(`${name}_half_cut`, cutGeo, mat, "halfCut", name);
      if (name.startsWith("cortex") || name.startsWith("marrow")) {
        for (let f = cr[0]; f < cr[1]; f++)
          for (let k = 0; k < 3; k++) {
            const v = half.index[f * 3 + k];
            boneCutKeys.add(`${Math.round(half.position[v * 3 + 1] * 1000)},${Math.round(half.position[v * 3 + 2] * 1000)}`);
          }
      }
    } else {
      addPart(`${name}_half`, creasedGeometry(THREE, half), mat, "half", name);
    }
  }
  addPart("callus_hull", creasedGeometry(THREE, data.surfaces.callus_hull), materials.hull, "full", "callus_hull", false);
  addPart("callus_hull_half", creasedGeometry(THREE, data.surfaces.callus_hull_half), materials.hull, "half", "callus_hull", false);
  const [, NJv, NKv] = data.vox.grid;
  const cutMat = makeCutMaterial(THREE, { y0: -18.05, z0: -0.05, sy: 0.3 * NJv, sz: 0.3 * NKv });
  cutMat.userData.sgReceiveShadow = true;
  const cutMesh = new THREE.Mesh(cutFaceGeometry(THREE, data.surfaces.callus_cut, boneCutKeys), cutMat);
  cutMesh.name = "callus_cut";
  cutMesh.castShadow = false;
  cutMesh.receiveShadow = true;
  cutMesh.userData.baseOpacity = 1;
  cutMesh.userData.baseColor = null;
  cutMesh.userData.baseTransparent = false;
  cutMesh.renderOrder = 1;
  model.add(cutMesh);
  parts.callus_cut = cutMesh;
  partMeta.callus_cut = { kind: "halfCut", group: "callus_cut" };

  const voxels = makeVoxels(THREE, data, materials.voxel);
  voxels.mesh.castShadow = true;
  voxels.mesh.receiveShadow = true;
  model.add(voxels.mesh);
  const fields = makeFields(THREE, data, voxels, cutMesh);

  // Post-processing (only used while state.dof is set). No MSAA on the composer target: in
  // SwiftShader 4x samples cost about 1.0-1.4 s per DOF frame (11.5 s: 4.5 -> 3.1 s) and made no
  // visible difference under the bokeh (integration pass 2, side-by-side at 10 and 11.5 s).
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { type: THREE.HalfFloatType, samples: 0 }));
  composer.setPixelRatio(1);
  composer.setSize(WIDTH, HEIGHT);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 100, aperture: 0.0005, maxblur: 0.01 });
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  // Integration pass 3: the DOF frames no longer go through the composer's RenderPass and
  // OutputPass. A half-float render target blends the transparent materials (the slabs' cells,
  // clot gel and fibrin, the translucent voxels) in linear light before OutputPass tone-maps
  // them, while the canvas blends them after the in-shader tone mapping; every switch between
  // the two paths was a pop (mean frame value +13 to +24 per channel at the six DOF on/off
  // frames, 9.6, 11.57, 22.33, 24.7, 30.03 and 32.2 s; the clot gel flared up). Now a DOF frame
  // is drawn exactly as the canvas draws it, into dofTarget: an 8-bit target flagged
  // isXRRenderTarget, which makes three r170 tone-map and sRGB-encode in the shaders, clear to
  // the plain ground colour and store the encoded bytes (WebGLPrograms toneMapping /
  // outputColorSpace, getUnlitUniformColorSpace, getInternalFormat's forceLinearTransfer), so
  // its pixels and its blending match the canvas. The BokehPass composite (its own depth render
  // plus the blur) then reads it and draws to the canvas. No MSAA on the target (the canvas has
  // it): drawing the DOF frame on the canvas and copying it (tried first) cost 0.6-0.9 s more
  // per c2 close-up frame in SwiftShader (3.7-3.9 s at 22.6 and 24.5 s); under the blur the
  // missing MSAA does not show. The composer object stays (ctx.composer) for its sizes; nothing
  // renders it.
  bokeh.setSize(WIDTH, HEIGHT);
  bokeh.renderToScreen = true;
  const dofTarget = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, {
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
    samples: 0,
    depthBuffer: true,
  });
  dofTarget.isXRRenderTarget = true;

  const util = { ease, tween, enterExit, frames, lerp, clamp, smoothstep, mulberry32, hashId, fieldColor, viridis, magma, logE, logStrain, toScene, toModel, FPS };

  function defaultState(t) {
    return {
      day: 0, // simulated day (0..359), voxels and the tissue field
      half: 0, // 0 = whole model, 1 = half model (cut at model x = 0), between: the cut sweeps in
      voxelOpacity: 0,
      fieldMode: "tissue", // 'tissue' | 'E' | 'strain' (the mode being blended TO)
      fieldBlend: 1, // 0 = previous mode (E <- tissue, strain <- E), 1 = fieldMode
      eDayIndex: 0, // fractional row of elem_E_days (fe_days[0] = day 6 ... [117] = day 357)
      envRotation: THREE.MathUtils.degToRad(20) * (clamp(t, 0, DURATION) / DURATION),
      dof: null, // null or { focus (mm from camera), aperture, maxblur }
      // Engine extensions (documented in ENGINE.md):
      cutOpacity: 0, // callus cut face (the field face)
      hullOpacity: 0, // callus hull (outer skin), transparent
      partOpacity: {}, // part name or group name -> opacity multiplier (0 hides)
      halfSpan: null, // mm the cut plane travels while half goes 0 -> 1 (null: 7.6, or 18.5 with the hull)
      exposure: 1, // multiplies the engine's base exposure
      shadows: 1, // 0 turns the key light's shadows off for this frame
      // Pass 3 (cell stops, SPEC P3-2):
      macroClip: null, // null or { centre: [x, y, z], size: [sx, sy, sz], open: 0..1 } (scene mm): a box hole in the macro scene
      slab: null, // null or { name, opacity }: which cell slab the frame shows (written by the stop beats; informational)
    };
  }

  const ctx = {
    THREE,
    scene,
    camera,
    renderer,
    model,
    data,
    palette: PALETTE,
    materials,
    parts,
    voxels,
    fields,
    util,
    state: defaultState(0),
    shared: {},
    clipPlane,
    composer,
    bokeh,
    lights: { key: keyLight, rim: rimLight, fill: fillLight },
    beats: [],
    t: 0,
    // Pass 3: the timeline (52 s) and the macro clip box.
    dayAt, // the film's day track (timeline.js): beats write state.day = ctx.dayAt(t)
    timeline: BEATS,
    macroMaterials: new Set(), // beat materials of macro objects that state.macroClip must cut too (b3's bone overlay)
  };

  // Cell-type labels (pass 4, labels.js): the beats declare this frame's labels with
  // ctx.labels.set(list) (or add) in update(t); the engine resets the list every frame and,
  // after the render, writes them into the SVG overlay of compositions/dive.html. The label font
  // is loaded here, inside the build-ready promise, so the first frame and every text width
  // measured in a beat's build use it.
  try {
    if (typeof document !== "undefined" && document.fonts) await document.fonts.load(LABEL_CSS_FONT, "Mesenchymal stem cell Osteoblast");
  } catch (e) {
    console.warn("[engine] label font did not load", e);
  }
  const labelOverlay = makeLabelOverlay(labelsSvg, THREE);
  ctx.labels = {
    list: [],
    set(list) {
      this.list = Array.isArray(list) ? list.slice() : [];
    },
    add(...items) {
      this.list.push(...items);
    },
    measure: labelOverlay.measure,
    slots: labelOverlay.slots,
  };

  // Beats.
  const mods = await Promise.all(BEAT_IDS.map((id) => import(new URL(`./beats/${id}.js`, import.meta.url).href)));
  const beats = mods.map((m) => m.default);
  ctx.beats = beats;
  // The director before the builds (pass 4): the keys are static module data, and the stop
  // beats choose their labelled cells in build() from the camera of their label windows.
  const director = makeDirector(beats);
  ctx.cameraKeys = director.keys;
  ctx.cameraAt = director.at;
  for (const b of beats) {
    if (b && typeof b.build === "function") await b.build(ctx); // sequential, b1 .. b6
  }
  // Shadows on beat objects that use (clones of) the engine's lit materials.
  scene.traverse((o) => {
    if (!o.isMesh || o.receiveShadow) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m && m.userData && m.userData.sgReceiveShadow)) o.receiveShadow = true;
  });

  const _v = new THREE.Vector3();
  const _cE = new THREE.Color();
  // Parts with their own envMap (steel), whose rotation follows state.envRotation.
  const envMapped = [...Object.values(parts), ...capParts.map((cp) => cp.cap)].filter((m) => m.material && m.material.envMap);
  // Flat cut faces of the bone ends and their modulus from the run (MPa).
  const regionE = data.manifest.codes?.region_material_MPa || {};
  const boneEndE = [];
  for (const [region, names] of [["cortex", ["cortex_prox_half_cut", "cortex_dist_half_cut"]], ["marrow", ["marrow_prox_half_cut", "marrow_dist_half_cut"]]]) {
    const E = Array.isArray(regionE[region]) ? regionE[region][0] : null;
    if (E) for (const n of names) if (parts[n]) boneEndE.push([n, E]);
  }
  function applyPart(mesh, visible, opacity) {
    const mat = mesh.material;
    const op = visible ? opacity * mesh.userData.baseOpacity : 0;
    mesh.visible = op > 0.001;
    if (!mesh.visible) return;
    if (Math.abs(mat.opacity - op) > 1e-6) mat.opacity = op;
    const tr = mesh.userData.baseTransparent || op < 0.999;
    if (mat.transparent !== tr) {
      mat.transparent = tr;
      mat.needsUpdate = true;
    }
  }

  // Macro clip box (pass 3, SPEC P3-2): while a cell stop shows a slab, state.macroClip cuts a
  // box hole into the macro scene so the cut faces, the voxels, the hull and the half skins
  // do not bury the slab. Six world planes with outward normals and clipIntersection: a
  // fragment is discarded only when it lies inside all six (inside the box). Applied to the
  // half model's parts (half skins, flat cut faces, the callus cut face, the half hull), the
  // voxels and ctx.macroMaterials; the full model (half < 1) keeps the half-cut plane only.
  // The shadow pass is not clipped (clipShadows off, as for the voxels during the sweep).
  // open scales the box about its centre along scene y and z (the face's extent), never x,
  // so the hole opens on the cut face like a window: 0 = no hole, 1 = the full box.
  const macroPlanes = [0, 1, 2, 3, 4, 5].map(() => new THREE.Plane());
  const MACRO_NORMALS = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  function macroBox(mc) {
    if (!mc || !(mc.open > 1e-4) || !mc.centre || !mc.size) return null;
    const o = clamp(mc.open);
    const half = [mc.size[0] / 2, (mc.size[1] / 2) * o, (mc.size[2] / 2) * o];
    for (let i = 0; i < 6; i++) {
      const n = MACRO_NORMALS[i];
      const ax = i >> 1;
      const face = mc.centre[ax] + n[ax] * half[ax]; // the box face this plane lies on
      macroPlanes[i].normal.set(n[0], n[1], n[2]);
      macroPlanes[i].constant = -n[ax] * face; // n . p - n . face: < 0 inside
    }
    return macroPlanes;
  }
  function setClip(mat, planes, intersection) {
    if (!mat) return;
    if (mat.clippingPlanes !== planes) mat.clippingPlanes = planes;
    if (mat.clipIntersection !== intersection) mat.clipIntersection = intersection;
  }

  function applyState(s) {
    // Half cut.
    const h = clamp(s.half);
    // The cut plane sweeps from the far side of the bone and plate (|x| <= 7.5 mm) to x = 0,
    // or from the callus edge (18 mm) when the hull is shown.
    const span = s.halfSpan ?? (s.hullOpacity > 0 ? 18.5 : 7.6);
    const c = h <= 0 ? -1e6 : lerp(-span, 0, h);
    clipPlane.constant = -c; // plane: x - c >= 0 is kept
    const po = s.partOpacity || {};
    const boxPlanes = macroBox(s.macroClip);
    const keep = s.macroClip && Array.isArray(s.macroClip.keep) ? s.macroClip.keep : null;
    for (const name of Object.keys(parts)) {
      const meta = partMeta[name];
      const mesh = parts[name];
      let vis;
      if (meta.kind === "full") vis = h < 1;
      else if (meta.kind === "half") vis = h >= 1;
      else vis = h >= 1; // flat cut faces at half = 1; the sweep caps (addCap) draw the cut before
      let op = 1;
      if (meta.group === "callus_hull") op = s.hullOpacity;
      if (meta.group === "callus_cut") {
        op = s.cutOpacity;
        vis = true; // the field face is on the plane x = 0 and only appears through cutOpacity
        if (h <= 0) vis = false;
      }
      if (po[meta.group] !== undefined) op *= po[meta.group];
      if (po[name] !== undefined) op *= po[name];
      applyPart(mesh, vis, op);
      // macroClip.keep (pass 4): parts (by name or group) the box leaves whole, e.g. c2 keeps
      // the macro cortex as the one cortex next to its cells
      const kept = boxPlanes && keep && (keep.includes(name) || keep.includes(meta.group));
      if (meta.kind !== "full") setClip(mesh.material, kept ? null : boxPlanes, !!boxPlanes && !kept);
    }
    // Sweep caps: on the clip plane, model x = -c, while the cut moves.
    const sweeping = h > 0 && h < 1;
    for (const cp of capParts) {
      const full = parts[cp.name];
      const on = sweeping && full.visible;
      cp.cap.visible = on;
      if (on) {
        // The clip keeps scene x >= c, i.e. model x <= -c: the section lies on model x = -c.
        if (cp.key !== -c) {
          cp.key = -c; // memo only: the section is a pure function of c
          cp.slice(-c, cp.cap.geometry);
        }
        const op = full.material.opacity;
        if (cp.cap.material.opacity !== op) cp.cap.material.opacity = op;
        const tr = op < 0.999;
        if (cp.cap.material.transparent !== tr) {
          cp.cap.material.transparent = tr;
          cp.cap.material.needsUpdate = true;
        }
      }
    }
    // Voxels: the whole set, clipped with the solids, until the sweep ends (no pop of the
    // near half at its start); then the kept half alone.
    setClip(voxels.material, sweeping ? sweepClip : boxPlanes, !sweeping && !!boxPlanes);
    for (const m of ctx.macroMaterials) setClip(m, boxPlanes, !!boxPlanes);
    voxels.setHalf(h >= 1);
    voxels.setDay(s.day);
    voxels.setOpacity(s.voxelOpacity);
    voxels.apply();
    // Fields.
    fields.setMode(s.fieldMode);
    fields.setBlend(s.fieldBlend);
    fields.setEDayIndex(s.eDayIndex);
    if (parts.callus_cut.visible) fields.apply(String(s.day));
    // Bone-end cut faces on the E map. The bone ends are not callus elements, but the run
    // gives their modulus (manifest.codes.region_material_MPa: cortex 17000, marrow 2 MPa),
    // so in E mode their flat cut faces take that value on the same log map as the callus
    // face (the cortex reads as the bright top of viridis), with the same emissive share.
    // The run has no strain for them, so they return to their own material colour as the
    // face blends from E to strain.
    const wE = s.fieldMode === "E" ? clamp(s.fieldBlend) : s.fieldMode === "strain" ? 1 - clamp(s.fieldBlend) : 0;
    const wEOn = wE * clamp(s.cutOpacity);
    for (const [name, E] of boneEndE) {
      const m = parts[name];
      if (!m || !m.userData.baseColor) continue;
      m.material.color.copy(m.userData.baseColor);
      m.material.emissive.setRGB(0, 0, 0);
      if (wEOn > 0) {
        viridis(logE(E), _cE);
        m.material.color.lerp(_cE, wEOn);
        m.material.emissive.copy(_cE).multiplyScalar(FIELD_EMISSIVE * wEOn);
      }
    }
    // Environment.
    scene.environmentRotation.set(0, s.envRotation, 0);
    for (const m of envMapped) m.material.envMapRotation.set(0, s.envRotation, 0);
    renderer.toneMappingExposure = EXPOSURE * s.exposure;
    keyLight.castShadow = s.shadows > 0;
  }

  function placeCamera(t) {
    const k = director.at(t);
    camera.position.fromArray(k.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(_v.fromArray(k.target));
    camera.rotateZ(THREE.MathUtils.degToRad(k.roll)); // P2-1: horizontal frame
    camera.fov = k.fov;
    const dist = camera.position.distanceTo(_v);
    camera.near = k.near; // key `near`, else 5 % of the distance (director)
    camera.far = dist + 400;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    scene.fog.near = dist;
    scene.fog.far = dist + 400;
    // Camera-relative lights.
    lightTarget.position.copy(_v);
    lightTarget.updateMatrixWorld();
    for (const [l, d] of lightDirs) {
      l.position.copy(d).applyQuaternion(camera.quaternion).multiplyScalar(300).add(_v);
      l.updateMatrixWorld();
    }
    // Shadow frustum: a square around the target covering what the camera sees there
    // (half diagonal of the view at the target distance, 1.5x for the depth of the scene).
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(k.fov) / 2);
    const R = clamp(Math.hypot(halfH * (WIDTH / HEIGHT), halfH) * 1.5, 2, 180);
    const sc = keyLight.shadow.camera;
    sc.left = -R;
    sc.right = R;
    sc.top = R;
    sc.bottom = -R;
    sc.near = 300 - 260;
    sc.far = 300 + 260;
    sc.updateProjectionMatrix();
    const texel = (2 * R) / SHADOW_MAP;
    keyLight.shadow.normalBias = 1.5 * texel;
    keyLight.shadow.bias = -0.0004;
    ctx.cameraTarget = _v.clone();
    ctx.cameraDistance = dist;
    ctx.cameraRoll = k.roll;
  }

  const stats = { lastMs: 0, maxMs: 0, frames: 0 };
  function render(t) {
    const t0 = performance.now();
    t = clamp(t, 0, DURATION);
    ctx.t = t;
    placeCamera(t);
    ctx.state = defaultState(t);
    ctx.labels.list = [];
    for (const b of beats) if (b && typeof b.update === "function") b.update(t, ctx);
    const s = ctx.state;
    applyState(s);
    renderer.shadowMap.needsUpdate = true; // once per frame, also under the composer
    if (s.dof) {
      // Depth of field (see dofTarget above): the frame drawn as the canvas would draw it, then
      // blurred onto the canvas; same look as the frames around it.
      renderer.setRenderTarget(dofTarget);
      renderer.render(scene, camera);
      bokeh.uniforms.focus.value = s.dof.focus;
      bokeh.uniforms.aperture.value = s.dof.aperture;
      bokeh.uniforms.maxblur.value = s.dof.maxblur ?? 0.01;
      bokeh.render(renderer, null, dofTarget);
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
    stats.labels = labelOverlay.draw(ctx.labels.list, camera, s.dof);
    if (window.__sgDiveDebugSync) {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    stats.lastMs = performance.now() - t0;
    stats.maxMs = Math.max(stats.maxMs, stats.lastMs);
    stats.frames++;
    stats.instances = voxels.instanceCount;
    stats.t = t;
    stats.day = s.day;
    stats.slab = s.slab ? { ...s.slab } : null;
    stats.macroClip = s.macroClip && s.macroClip.open > 1e-4 ? { ...s.macroClip } : null;
  }

  return { render, ctx, stats, director, dayAt };
}
