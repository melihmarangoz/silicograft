// Cell slabs (SPEC P3-2): the cell viewer's slab rendering, ported to the film.
//
// Source: ~/mechanobio-hucre, branch hucre-gorunumu, commit 3b7e79f,
// long_bone/web3d_uygulama/hucre3b.html (three r147, classic scripts). This module keeps its
// look and rules and translates them to three r170 ES modules:
//   hucreMalzemesi, kenarParlamasi, sekilDegistir   -> cellMaterial, rimGlow, shapeShift
//   dokuDeseni, matrisMalzemesi, MATRIS              -> tissuePattern, matrixMaterial, MATRIX
//   roiCoz, kodlar, hucreler, gecis, hucreAni        -> decodeRegion, codesOf, cellsOf, transition, drawCells
//   alanlar, matrisGuncelle                          -> fieldsOf, drawMatrix
//   fibrinKur, fibrinGuncelle                        -> buildClot, drawClot
//
// What differs from the viewer, and why:
// - Every output is a pure function of the fractional day (setDay) and of the wobble clock
//   (setTime, the film time in seconds). The viewer animated with wall-clock state; here every
//   per-day structure is memoised by integer day and never depends on the order of calls.
// - Cell identity: the viewer keyed the per-cell look (shape variant, size spread, wobble phase,
//   colour jitter) by the site a cell is drawn at, so a migrating MSC changed shape when it
//   arrived. The film runs 8 to 35 days per second, so that would flicker. Here every cell carries
//   an identity key along the inferred transitions (stay, move, change type keep the key of the
//   source cell; a division or an appearance gets a new key), chained from a fixed first day
//   (opts.days[0]). The key chain is a pure recurrence from that day, cached per day.
// - Colours follow the film palette where they share a meaning (MSC amber, fibroblast and fibrous
//   matrix coral, chondrocyte and cartilage blue, new bone ivory, cortex grey, plate steel); the
//   viewer's own hues stay for osteoblasts, osteocytes, nuclei, lacunae and the clot.
//   opts.palette = 'viewer' restores the viewer's colours (for side-by-side checks).
// - The slab sits at its true place in the scene (lattice -> model mm -> manifest
//   scene_transform). The viewer's own frame (1 unit = 10 um; X = lattice i, Y = k, Z = j) is
//   kept inside the slab group, which maps it to the scene with one matrix (a mirror, det < 0;
//   three flips the face winding for it).
// - The clot (gel sprites and fibrin threads) is on by default (the viewer starts with it off).
//
// Coordinates: scene millimetres. Lights: the scene's (the film's camera-relative rig); the
// materials add the viewer's rim glow. Nothing here casts or receives shadows.

import { MarchingCubes } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/objects/MarchingCubes.js/+esm";
import { hucreGeometrileri } from "../vendor/hucre_geometri.js";
import { cellGeometriesLod } from "./hucre_geometri_lod.js";

// ---------------------------------------------------------------------------------------------
// Constants (the viewer's values)
// ---------------------------------------------------------------------------------------------
export const MSC = 0, FIB = 1, KON = 2, OB = 3, OC = 4;
export const CELL_TYPES = ["msc", "fibroblast", "chondrocyte", "osteoblast", "osteocyte"];
const TYPE_GEO = ["msc", "fibroblast", "kondrosit", "osteoblast", "osteosit"];
const TYPE_WOBBLE = [0.9, 0.35, 0.12, 0.2, 0.3]; // um, the viewer's "oynama"
const VARIANTS = 3;
const EXAGGERATION = 1.5; // cells drawn at 1.5x true size (same factor for every type)
const UNIT = 10; // viewer units per 100 um lattice step (1 unit = 10 um)
const UNIT_MM = 0.01; // one viewer unit in scene mm
const GEO_SCALE = 0.1 * EXAGGERATION; // geometry is in um -> viewer units
const SITE_JITTER = 3.5; // +-35 um fixed per-site offset
const IS_BONE = (c) => c === 2 || c === 11;
// Levels of detail: tessellation factor per level (level 0 is the vendored geometry) and the
// default on-screen radius (px at 1080 lines) from which a cell uses that level.
const LOD_DETAIL = [1, 0.55, 0.3];
const LOD_PX = [40, 14];
const MC_N = 64, MC_H = 32, MC_STEP = 2; // 2 field samples per lattice step
const MC_SCALE = (MC_H * UNIT) / MC_STEP; // 160 viewer units

// Viewer colours, and the film's (SPEC P2-2) where they share a meaning.
const COLORS = {
  viewer: {
    cells: ["#e7b860", "#e07a8a", "#6fb0e8", "#a46ad8", "#c9b3ea"],
    nucleus: "#46337a", nucleusEmissive: "#1a1030", capsule: "#d6ebfa",
    bone: "#e6d5ad", cartilage: "#9dc2dc", fibrous: "#e39a9a", fibrousSheen: "#ffd8d8", cortex: "#cfc0a0", plate: "#9c9d9e",
    gelMarrow: [0.75, 0.16, 0.2], gelClot: [0.92, 0.42, 0.4], fibrinMarrow: [0.78, 0.3, 0.32], fibrinClot: [0.9, 0.5, 0.48],
  },
  film: {
    cells: ["#d9a43a", "#e07a8a", "#5aa0e0", "#a46ad8", "#c9b3ea"],
    nucleus: "#46337a", nucleusEmissive: "#1a1030", capsule: "#d6ebfa",
    bone: "#efe2c4", cartilage: "#8dbbe6", fibrous: "#e07a8a", fibrousSheen: "#ffd8d8", cortex: "#b3aa9b", plate: "#aab4bf",
    gelMarrow: [0.75, 0.16, 0.2], gelClot: [0.92, 0.42, 0.4], fibrinMarrow: [0.78, 0.3, 0.32], fibrinClot: [0.9, 0.5, 0.48],
  },
};

// ---------------------------------------------------------------------------------------------
// Small helpers (pure)
// ---------------------------------------------------------------------------------------------
function hash(n) {
  n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}
function hashInt(n) {
  n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15;
  return n >>> 0;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Small memo with a size bound; eviction never changes an output (entries are pure).
class Memo {
  constructor(limit) { this.limit = limit; this.map = new Map(); }
  get(k, make) {
    let v = this.map.get(k);
    if (v === undefined) {
      v = make();
      this.map.set(k, v);
      if (this.map.size > this.limit) this.map.delete(this.map.keys().next().value);
    }
    return v;
  }
}

const fileCache = new Map();
function fetchOnce(url, kind) {
  const key = `${kind}:${url}`;
  if (!fileCache.has(key)) {
    fileCache.set(key, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`cells: ${url} -> HTTP ${r.status}`);
      return kind === "json" ? r.json() : r.arrayBuffer();
    }));
  }
  return fileCache.get(key);
}

// ---------------------------------------------------------------------------------------------
// Region data ('MBR2', see assets/data/cells/README.md)
// ---------------------------------------------------------------------------------------------
function decodeRegion(buf, def) {
  const b = new Uint8Array(buf);
  const dv = new DataView(buf);
  if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== "MBR2") throw new Error("cells: not an MBR2 file");
  const nx = dv.getUint16(4, true), ny = dv.getUint16(6, true), nz = dv.getUint16(8, true), nd = dv.getUint16(10, true), M = dv.getUint16(12, true);
  const i0 = dv.getInt16(14, true), j0 = dv.getInt16(16, true), k0 = dv.getInt16(18, true); // box origin, margin included
  let o = 20;
  const days = []; for (let i = 0; i < nd; i++) days.push(dv.getUint16(o + 2 * i, true)); o += 2 * nd;
  for (let i = 1; i < nd; i++) if (days[i] !== days[0] + i) throw new Error("cells: days must be consecutive");
  const N = nx * ny * nz;
  const mask = b.subarray(o, o + N); o += N;
  const half = Math.ceil(N / 2);
  const packed = b.subarray(o, o + nd * half);
  const ii = new Int16Array(N), jj = new Int16Array(N), kk = new Int16Array(N), in0 = new Uint8Array(N), in1 = new Uint8Array(N);
  for (let i = 0, s = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++, s++) {
    ii[s] = i; jj[s] = j; kk[s] = k;
    const inside = (p) => i >= M - p && i < nx - M + p && j >= M - p && j < ny - M + p && k >= M - p && k < nz - M + p;
    in0[s] = inside(0) ? 1 : 0; in1[s] = inside(1) ? 1 : 0;
  }
  return { def, nx, ny, nz, M, N, i0, j0, k0, days, mask, packed, half, ii, jj, kk, in0, in1 };
}

// ---------------------------------------------------------------------------------------------
// Shared cell geometry (deterministic: hucreGeometrileri seeds its own PRNG)
// ---------------------------------------------------------------------------------------------
let geoCache = null;
function cellGeometries(THREE) {
  if (!geoCache || geoCache.THREE !== THREE) {
    geoCache = { THREE, levels: LOD_DETAIL.map((detail, l) => l === 0
      ? hucreGeometrileri(THREE, { varyant: VARIANTS, tohum: 7 })
      : cellGeometriesLod(THREE, { varyant: VARIANTS, tohum: 7, detail })) };
  }
  return geoCache.levels;
}

// Radial gel sprite (the viewer's canvas gradient, computed without a canvas).
let gelTexCache = null;
function gelTexture(THREE) {
  if (gelTexCache && gelTexCache.THREE === THREE) return gelTexCache.tex;
  const n = 64, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot(x + 0.5 - 32, y + 0.5 - 32) / 32;
    const a = r <= 0.45 ? 1 - (r / 0.45) * 0.55 : r <= 1 ? 0.45 * (1 - (r - 0.45) / 0.55) : 0;
    const p = (y * n + x) * 4; d[p] = d[p + 1] = d[p + 2] = 255; d[p + 3] = Math.round(a * 255);
  }
  const tex = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  gelTexCache = { THREE, tex };
  return tex;
}

// ---------------------------------------------------------------------------------------------
// Materials and shader tweaks (the viewer's, translated to r170)
// ---------------------------------------------------------------------------------------------
// Medical-animation look: a soft glow at grazing angles, as light scatters through the membrane.
function rimGlow(sh, strength) {
  sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
    float kenar = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.4);
    totalEmissiveRadiance += diffuseColor.rgb * kenar * ${strength.toFixed(2)};`);
}
// Per-instance state iDurum = (round 0..1, phase, wobble amplitude in um, unused); geometry: aUc, aKure.
function shapeShift(m, isCell, rim, timeU) {
  m.onBeforeCompile = (sh) => {
    if (rim) rimGlow(sh, rim);
    sh.uniforms.uZaman = timeU;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
        attribute float aUc; attribute vec3 aKure; attribute vec4 iDurum; uniform float uZaman;`)
      .replace("#include <begin_vertex>", `
        vec3 transformed = mix(position, aKure, iDurum.x);
        float fz = iDurum.y;
        float dalga = sin(uZaman * 1.1 + fz + position.x * 0.31) * cos(uZaman * 0.73 + position.z * 0.37 + fz * 1.7)
                    + 0.5 * sin(uZaman * 2.3 + position.y * 0.6 + fz * 3.1);
        transformed += objectNormal * dalga * iDurum.z * (0.3 + 1.2 * aUc) * (1.0 - iDurum.x);
        transformed += vec3(0.0, sin(uZaman * 0.9 + fz + position.x * 0.12), cos(uZaman * 0.7 + fz)) * aUc * aUc * iDurum.z * 1.6 * (1.0 - iDurum.x);`);
  };
  m.customProgramCacheKey = () => (isCell ? `sg-cell-${rim}` : `sg-nucleus-${rim}`);
  return m;
}
function cellMaterial(THREE, color, timeU) {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.5, metalness: 0, transparent: true, opacity: 0.74,
    clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.6,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.6), sheenRoughness: 0.45,
  });
  return shapeShift(m, true, 0.75, timeU);
}
// Tissue texture without image files: 3D value noise on the slab-local (viewer-unit) position.
// pattern: 0 mottled (woven bone, fibrin-rich), 1 lamellar bands along the bone axis (cortex), 2 brushed (metal)
const NOISE = `
  float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p) { return 0.55 * n3(p) + 0.28 * n3(p * 2.03) + 0.17 * n3(p * 4.11); }`;
function tissuePattern(m, pattern, scale, amount, rim, slabInvU) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSgSlabInv = slabInvU;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vDunya;\nuniform mat4 uSgSlabInv;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvDunya = (uSgSlabInv * modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vDunya;" + NOISE)
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 pp = vDunya * ${scale.toFixed(4)};
        float d = ${pattern === 1 ? "0.6 * fbm(vec3(pp.x * 0.35, pp.y * 0.15, pp.z * 0.35)) + 0.4 * (0.5 + 0.5 * sin(pp.x * 6.0 + pp.z * 6.0 + 3.0 * fbm(pp)))"
          : pattern === 2 ? "fbm(vec3(pp.x * 4.0, pp.y * 0.2, pp.z * 4.0))" : "fbm(pp)"};
        diffuseColor.rgb *= ${(1 - amount).toFixed(3)} + ${(2 * amount).toFixed(3)} * d;
        ${pattern === 1 ? "diffuseColor.rgb *= 1.0 - 0.45 * smoothstep(0.80, 0.9, n3(vec3(pp.x * 9.0, pp.y * 4.0, pp.z * 9.0)));  // lacunae" : ""}`);
    if (rim) rimGlow(sh, rim);
  };
  m.customProgramCacheKey = () => `sg-tissue-${pattern}-${scale}-${amount}-${rim}`;
  return m;
}
function matrixMaterial(THREE, o, pattern, scale, amount, rim, slabInvU) {
  return tissuePattern(new THREE.MeshPhysicalMaterial(Object.assign({ transparent: true, depthWrite: false, side: THREE.DoubleSide }, o)), pattern, scale, amount, rim, slabInvU);
}
function makeMatrix(THREE, C, slabInvU) {
  return {
    bone: { codes: [2], iso: 0.42, order: 3, mat: matrixMaterial(THREE, { color: C.bone, roughness: 0.8, opacity: 0.55, clearcoat: 0.1 }, 0, 0.09, 0.22, 0.2, slabInvU) },
    cartilage: { codes: [4], iso: 0.38, order: 4, mat: matrixMaterial(THREE, { color: C.cartilage, roughness: 0.1, opacity: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }, 0, 0.03, 0.08, 0.45, slabInvU) },
    fibrous: { codes: [5], iso: 0.38, order: 4, mat: matrixMaterial(THREE, { color: C.fibrous, roughness: 0.5, opacity: 0.22, sheen: 0.6, sheenColor: new THREE.Color(C.fibrousSheen) }, 1, 0.16, 0.4, 0.35, slabInvU) },
    cortex: { codes: [11], iso: 0.5, order: 4, fixed: true,
      mat: tissuePattern(new THREE.MeshPhysicalMaterial({ color: C.cortex, roughness: 0.7, transparent: true, opacity: 0.92, side: THREE.DoubleSide, clearcoat: 0.12 }), 1, 0.05, 0.3, 0.12, slabInvU) },
    // opaque in the viewer; transparent here (opacity 1, drawn first) so setOpacity needs no recompile
    plate: { codes: [13], iso: 0.5, order: -1, fixed: true,
      mat: tissuePattern(new THREE.MeshStandardMaterial({ color: C.plate, roughness: 0.6, metalness: 0.65, envMapIntensity: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 1 }), 2, 0.05, 0.14, 0, slabInvU) },
  };
}

// ---------------------------------------------------------------------------------------------
// Per-day structures (pure, memoised)
// ---------------------------------------------------------------------------------------------
function offsetsWithin(r) {
  const o = [];
  for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let e = -r; e <= r; e++) { const d2 = a * a + b * b + e * e; if (d2 > 0 && d2 <= r * r) o.push([a, b, e, d2]); }
  return o.sort((p, q) => p[3] - q[3]); // stable sort: ties keep the generation order
}
const OF5 = offsetsWithin(5), OF8 = offsetsWithin(8);
const STAY = 0, MOVE = 1, CHANGE = 2, BIRTH = 3, APPEAR = 4;

function makeDayModel(THREE, R) {
  const codeMemo = new Memo(16), cellMemo = new Map(), transMemo = new Map(), keyMemo = new Map(), fieldMemo = new Memo(4);
  const { nx, ny, nz, N } = R, yz = ny * nz;
  const last = R.days.length - 1;

  function codesOf(d) {
    return codeMemo.get(d, () => {
      const c = new Uint8Array(N);
      const p = R.packed.subarray(d * R.half, (d + 1) * R.half);
      for (let i = 0, s = 0; i < R.half; i++, s += 2) { const v = p[i]; c[s] = v & 15; if (s + 1 < N) c[s + 1] = v >> 4; }
      return c;
    });
  }

  // cells of a day: site, render type, orientation (quaternion)
  function cellsOf(d) {
    let H = cellMemo.get(d);
    if (H) return H;
    const c = codesOf(d);
    const site = [], type = [];
    for (let s = 0; s < N; s++) {
      const v = c[s];
      if (v === 1) { site.push(s); type.push(MSC); }
      else if (v === 5) { site.push(s); type.push(FIB); }
      else if (v === 4) { site.push(s); type.push(KON); }
      else if (v === 2) {
        // an osteoblast when at least 5 of the 26 neighbours are not bone, else an osteocyte
        const i = R.ii[s], j = R.jj[s], k = R.kk[s];
        let out = 0;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) {
          if (!a && !b && !e) continue;
          const i2 = i + a, j2 = j + b, k2 = k + e;
          if (i2 < 0 || j2 < 0 || k2 < 0 || i2 >= nx || j2 >= ny || k2 >= nz) continue;
          if (!IS_BONE(c[i2 * yz + j2 * nz + k2])) out++;
        }
        site.push(s); type.push(out >= 5 ? OB : OC);
      }
    }
    const n = site.length, q = new Float32Array(n * 4), index = new Int32Array(N).fill(-1);
    const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
    const X1 = new THREE.Vector3(1, 0, 0), qa = new THREE.Quaternion();
    for (let h = 0; h < n; h++) {
      const s = site[h], t = type[h], i = R.ii[s], j = R.jj[s], k = R.kk[s];
      index[s] = h;
      const r1 = hash(s * 3 + 1), r2 = hash(s * 3 + 2), r3 = hash(s * 3 + 3);
      if (t === OB) {
        // basal face (-Y) toward the bone: sum of directions to bone sites within 3 steps, nearer ones weigh more
        let gx = 0, gy = 0, gz = 0;
        for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let e = -3; e <= 3; e++) {
          const d2 = a * a + b * b + e * e;
          if (!d2 || d2 > 9) continue;
          const i2 = i + a, j2 = j + b, k2 = k + e;
          if (i2 < 0 || j2 < 0 || k2 < 0 || i2 >= nx || j2 >= ny || k2 >= nz) continue;
          if (IS_BONE(c[i2 * yz + j2 * nz + k2])) { const w = 1 / d2; gx += a * w; gy += e * w; gz += b * w; }
        }
        Y.set(-gx, -gy, -gz); if (Y.lengthSq() < 1e-6) Y.set(r1 - 0.5, r2 - 0.5, r3 - 0.5);
        Y.normalize();
        X.set(r2 - 0.5, r3 - 0.5, r1 - 0.5).cross(Y); if (X.lengthSq() < 1e-6) X.set(1, 0, 0).cross(Y);
        X.normalize(); Z.crossVectors(X, Y);
        m4.makeBasis(X, Y, Z); qq.setFromRotationMatrix(m4);
      } else if (t === FIB) {
        // long axis along the local fibroblast streak (principal axis of fibroblast neighbours), else the bone axis
        let sxx = 0, syy = 0, szz = 0, sxy = 0, sxz = 0, syz = 0, cnt = 0;
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let e = -2; e <= 2; e++) {
          const i2 = i + a, j2 = j + b, k2 = k + e;
          if ((!a && !b && !e) || i2 < 0 || j2 < 0 || k2 < 0 || i2 >= nx || j2 >= ny || k2 >= nz) continue;
          if (c[i2 * yz + j2 * nz + k2] === 5) { const x = a, y = e, z = b; sxx += x * x; syy += y * y; szz += z * z; sxy += x * y; sxz += x * z; syz += y * z; cnt++; }
        }
        if (cnt >= 2) {
          X.set(0.3, 1, 0.2);
          for (let it = 0; it < 10; it++) { const x = sxx * X.x + sxy * X.y + sxz * X.z, y = sxy * X.x + syy * X.y + syz * X.z, z = sxz * X.x + syz * X.y + szz * X.z; X.set(x, y, z).normalize(); }
        } else X.set((r1 - 0.5) * 1.4, 1, (r2 - 0.5) * 1.4).normalize();
        qq.setFromUnitVectors(X1, X);
        qq.multiply(qa.setFromAxisAngle(X1, r3 * Math.PI * 2));
      } else {
        qq.setFromEuler(new THREE.Euler(r1 * Math.PI * 2, r2 * Math.PI * 2, r3 * Math.PI * 2));
      }
      q[h * 4] = qq.x; q[h * 4 + 1] = qq.y; q[h * 4 + 2] = qq.z; q[h * 4 + 3] = qq.w;
    }
    H = { site: Int32Array.from(site), type: Uint8Array.from(type), q, index, n };
    cellMemo.set(d, H);
    return H;
  }

  // Transition d -> d+1: for every cell of day d+1, its kind and its source cell of day d.
  function transition(d) {
    let G = transMemo.get(d);
    if (G) return G;
    const A = cellsOf(d), B = cellsOf(d + 1), cA = codesOf(d), cB = codesOf(d + 1);
    const kind = new Uint8Array(B.n), source = new Int32Array(B.n).fill(-1), used = new Uint8Array(A.n), divides = new Uint8Array(A.n);
    const free = [];
    for (let b = 0; b < B.n; b++) {
      const s = B.site[b], a = A.index[s];
      if (a >= 0) {
        source[b] = a; used[a] = 1;
        kind[b] = (cA[s] === cB[s] && A.type[a] === B.type[b]) ? STAY : CHANGE;
      } else free.push(b);
    }
    // MSC migration: greedy nearest matching of vacated and newly occupied MSC sites
    const pairs = [];
    for (const b of free) {
      if (B.type[b] !== MSC) continue;
      const s = B.site[b], i = R.ii[s], j = R.jj[s], k = R.kk[s];
      let found = 0;
      for (const [x, y, z, d2] of OF5) {
        const i2 = i + x, j2 = j + y, k2 = k + z;
        if (i2 < 0 || j2 < 0 || k2 < 0 || i2 >= nx || j2 >= ny || k2 >= nz) continue;
        const a = A.index[i2 * yz + j2 * nz + k2];
        if (a >= 0 && !used[a] && A.type[a] === MSC) { pairs.push(d2, a, b); if (++found >= 6) break; }
      }
    }
    const order = []; for (let p = 0; p < pairs.length; p += 3) order.push(p);
    order.sort((p, q) => pairs[p] - pairs[q]);
    for (const p of order) {
      const a = pairs[p + 1], b = pairs[p + 2];
      if (used[a] || source[b] >= 0) continue;
      used[a] = 1; source[b] = a; kind[b] = MOVE;
    }
    // the rest: division next to a same-type cell that itself goes on to day d+1, or appearance
    for (const b of free) {
      if (source[b] >= 0) continue;
      const s = B.site[b], i = R.ii[s], j = R.jj[s], k = R.kk[s], t = B.type[b];
      const same = (x) => x === t || ((t === OB || t === OC) && (x === OB || x === OC));
      let parent = -1;
      for (const [x, y, z] of (t === MSC ? OF8 : OF5)) {
        const i2 = i + x, j2 = j + y, k2 = k + z;
        if (i2 < 0 || j2 < 0 || k2 < 0 || i2 >= nx || j2 >= ny || k2 >= nz) continue;
        const a = A.index[i2 * yz + j2 * nz + k2];
        if (a >= 0 && used[a] && same(A.type[a])) { parent = a; break; }
      }
      if (parent >= 0) { source[b] = parent; kind[b] = BIRTH; divides[parent] = 1; }
      else kind[b] = APPEAR;
    }
    const gone = []; for (let a = 0; a < A.n; a++) if (!used[a]) gone.push(a);
    G = { A, B, kind, source, divides, gone };
    transMemo.set(d, G);
    return G;
  }

  // Identity keys of the cells of day d, chained from day d0 (keys there = site index).
  let chainFrom = 0;
  function keysOf(d) {
    if (d <= chainFrom) {
      let K = keyMemo.get(d);
      if (!K) { const H = cellsOf(d); K = Uint32Array.from(H.site); keyMemo.set(d, K); }
      return K;
    }
    let K = keyMemo.get(d);
    if (K) return K;
    let e = d - 1;
    while (e > chainFrom && !keyMemo.has(e)) e--;
    let KA = keysOf(e);
    for (let x = e; x < d; x++) {
      const G = transition(x), KB = new Uint32Array(G.B.n);
      for (let b = 0; b < G.B.n; b++) {
        const a = G.source[b], k = G.kind[b];
        if (k === STAY || k === MOVE || k === CHANGE) KB[b] = KA[a];
        else if (k === BIRTH) KB[b] = hashInt((KA[a] * 31 + G.B.site[b] * 7 + (x + 1) * 7919) >>> 0);
        else KB[b] = hashInt((G.B.site[b] + (x + 1) * 65537) >>> 0);
      }
      keyMemo.set(x + 1, KB);
      KA = KB;
    }
    return KA;
  }

  // smoothed agent density per tissue (only inside the visible slab)
  function fieldsOf(d, MATRIX) {
    return fieldMemo.get(d, () => fieldsFor(codesOf(d), MATRIX, false));
  }
  function fieldsFor(c, MATRIX, fixedOnly) {
    const { M } = R;
    const F = {};
    for (const [name, T] of Object.entries(MATRIX)) {
      if (!!T.fixed !== fixedOnly) continue;
      const raw = new Float32Array(N);
      for (let s = 0; s < N; s++) if (T.codes.includes(c[s])) raw[s] = 1;
      // 3x3x3 smoothing with a heavier centre, then zero outside the slab so surfaces close at its faces
      const sm = new Float32Array(N);
      for (let i = M; i < nx - M; i++) for (let j = M; j < ny - M; j++) for (let k = M; k < nz - M; k++) {
        let top = 0, w = 0;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) {
          const ww = (a || b || e) ? 1 : 6; top += raw[(i + a) * yz + (j + b) * nz + (k + e)] * ww; w += ww;
        }
        sm[i * yz + j * nz + k] = top / w;
      }
      F[name] = sm;
    }
    return F;
  }

  return {
    codesOf, cellsOf, transition, keysOf, fieldsOf, fieldsFor, last,
    setChainFrom(d) { chainFrom = d; keyMemo.clear(); },
    get chainFrom() { return chainFrom; },
  };
}

// ---------------------------------------------------------------------------------------------
// createSlab
// ---------------------------------------------------------------------------------------------
/**
 * @param ctx      the engine ctx (needs THREE and scene; uses data.manifest.scene_transform if present)
 * @param name     'ilik_ucu' | 'korteks_ucu' | 'plak_alti' (any region in assets/data/cells/bolgeler.json with a .bin)
 * @param opts     { days: [d0, d1] (prepare + identity chain start; default the whole run),
 *                   palette: 'film' | 'viewer', clot: true, gel: true, envIntensity: 0.6,
 *                   clipPlanes: [] (extra world planes for every slab object), parent: ctx.scene,
 *                   baseURL: document.baseURI, renderOrder: 0 (added to the viewer's orders),
 *                   hide: [] (pass 4: fixed tissues not drawn, 'cortex' and/or 'plate') }
 */
export async function createSlab(ctx, name, opts = {}) {
  const THREE = ctx.THREE;
  const base = opts.baseURL ?? document.baseURI;
  const [regions, buf] = await Promise.all([
    fetchOnce(new URL("assets/data/cells/bolgeler.json", base).href, "json"),
    fetchOnce(new URL(`assets/data/cells/roi_${name}.bin`, base).href, "bin"),
  ]);
  const def = regions.find((r) => r.ad === name);
  if (!def) throw new Error(`cells: unknown region ${name}`);
  const R = decodeRegion(buf, def);
  const C = COLORS[opts.palette === "viewer" ? "viewer" : "film"];
  const dm = makeDayModel(THREE, R);
  const firstDay = R.days[0], lastDay = R.days[R.days.length - 1];
  const range = opts.days ? [Math.max(firstDay, Math.floor(opts.days[0])), Math.min(lastDay, Math.ceil(opts.days[1]))] : [firstDay, lastDay];
  dm.setChainFrom(range[0] - firstDay);
  const roBase = opts.renderOrder ?? 0;

  // ---- placement: viewer frame (units of 10 um, X = i, Y = k, Z = j, centred) -> model mm -> scene
  const cLat = [R.i0 + (R.nx - 1) / 2, R.j0 + (R.ny - 1) / 2, R.k0 + (R.nz - 1) / 2];
  const cModel = new THREE.Vector3(cLat[0] * 0.1 - 18, cLat[1] * 0.1 - 18, cLat[2] * 0.1);
  const sceneFromModel = new THREE.Matrix4();
  const st = ctx.data?.manifest?.scene_transform;
  if (st?.matrix_rows) {
    const m = st.matrix_rows;
    sceneFromModel.set(m[0][0], m[0][1], m[0][2], m[0][3], m[1][0], m[1][1], m[1][2], m[1][3], m[2][0], m[2][1], m[2][2], m[2][3], 0, 0, 0, 1);
  } else if (ctx.model) {
    ctx.model.updateMatrixWorld(true);
    sceneFromModel.copy(ctx.model.matrixWorld);
  } else {
    sceneFromModel.set(-1, 0, 0, 0, 0, 0, 1, -20, 0, 1, 0, 0, 0, 0, 0, 1); // the film's transform
  }
  const modelFromViewer = new THREE.Matrix4().set(
    UNIT_MM, 0, 0, cModel.x,
    0, 0, UNIT_MM, cModel.y,
    0, UNIT_MM, 0, cModel.z,
    0, 0, 0, 1);
  const sceneFromViewer = new THREE.Matrix4().multiplyMatrices(sceneFromModel, modelFromViewer);
  const centre = new THREE.Vector3().setFromMatrixPosition(sceneFromViewer);
  const group = new THREE.Group();
  group.name = `slab_${name}`;
  group.position.copy(centre);
  const inner = new THREE.Group();
  inner.name = `slab_${name}_viewer_frame`;
  inner.matrixAutoUpdate = false;
  inner.matrix.copy(sceneFromViewer).setPosition(0, 0, 0);
  group.add(inner);

  // half sizes of the visible slab in viewer units (X, Y, Z) and the box in the scene
  const halfV = [(R.nx - 2 * R.M) * UNIT / 2, (R.nz - 2 * R.M) * UNIT / 2, (R.ny - 2 * R.M) * UNIT / 2];
  const box = new THREE.Box3();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) box.expandByPoint(new THREE.Vector3(sx * halfV[0], sy * halfV[1], sz * halfV[2]).applyMatrix4(sceneFromViewer));
  const size = box.getSize(new THREE.Vector3());

  // ---- uniforms and clipping (world planes, refreshed from the group's world matrix)
  const timeU = { value: 0 };
  const slabInvU = { value: new THREE.Matrix4() };
  const localPlanes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfV[0]), new THREE.Plane(new THREE.Vector3(1, 0, 0), halfV[0]),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), halfV[1]), new THREE.Plane(new THREE.Vector3(0, 1, 0), halfV[1]),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), halfV[2]), new THREE.Plane(new THREE.Vector3(0, 0, 1), halfV[2]),
  ];
  const extraPlanes = opts.clipPlanes ? [...opts.clipPlanes] : [];
  const boxPlanes = localPlanes.map((p) => p.clone()).concat(extraPlanes);
  const extraOnly = extraPlanes.length ? [...extraPlanes] : null;
  function syncFrame() {
    group.updateWorldMatrix(true, true);
    for (let i = 0; i < 6; i++) boxPlanes[i].copy(localPlanes[i]).applyMatrix4(inner.matrixWorld);
    slabInvU.value.copy(inner.matrixWorld).invert();
  }

  // ---- materials
  const env = ctx.scene?.environment ?? null;
  const envI = opts.envIntensity ?? 0.6; // the film's scene.environmentIntensity (the viewer used 1; brighter film lights wash the matrix out at 1)
  const allMaterials = [];
  const track = (m, baseOpacity) => { m.userData.sgBaseOpacity = baseOpacity ?? m.opacity; if (env && m.isMeshStandardMaterial) { m.envMap = env; m.envMapIntensity = (m.envMapIntensity ?? 1) * envI; } allMaterials.push(m); return m; };
  const cellMats = C.cells.map((col) => {
    const m = track(cellMaterial(THREE, col, timeU));
    m.clippingPlanes = boxPlanes;
    return m;
  });
  const nucleusMat = track(shapeShift(new THREE.MeshStandardMaterial({ color: C.nucleus, roughness: 0.5, metalness: 0, emissive: C.nucleusEmissive, transparent: true, opacity: 1 }), false, 0.35, timeU));
  nucleusMat.clippingPlanes = boxPlanes;
  const capsuleMat = track(new THREE.MeshPhysicalMaterial({ color: C.capsule, roughness: 0.15, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.1 }));
  capsuleMat.onBeforeCompile = (sh) => rimGlow(sh, 0.9);
  capsuleMat.customProgramCacheKey = () => "sg-capsule";
  capsuleMat.clippingPlanes = boxPlanes;
  const MATRIX = makeMatrix(THREE, C, slabInvU);
  for (const T of Object.values(MATRIX)) { track(T.mat); if (extraOnly) T.mat.clippingPlanes = extraOnly; }
  // keep the scene's environment rotation on our own envMaps (copied at draw time: pure in t)
  const envSync = (renderer, scene, camera, geometry, material) => {
    if (material && material.envMapRotation && scene && scene.environmentRotation) material.envMapRotation.copy(scene.environmentRotation);
  };

  // ---- cell meshes: one InstancedMesh per (type, variant) for the body, one for the nucleus sharing its instances
  const LEVELS = cellGeometries(THREE);
  const lodPx = opts.lodPx ?? LOD_PX;
  const capacity = capacityOf(R, dm);
  const clusters = []; // clusters[type][variant][level]
  const allClusters = [];
  const ownGeometries = [];
  CELL_TYPES.forEach((_, t) => {
    clusters[t] = LEVELS[0][TYPE_GEO[t]].map((g0, v) => LEVELS.map((GL, l) => {
      const g = GL[TYPE_GEO[t]][v];
      const cap = Math.max(16, capacity[t * VARIANTS + v]);
      const state = new Float32Array(cap * 4);
      const stateAttr = new THREE.InstancedBufferAttribute(state, 4); stateAttr.setUsage(THREE.DynamicDrawUsage);
      const gB = g.govde.clone(); gB.setAttribute("iDurum", stateAttr);
      const gN = g.cekirdek.clone(); gN.setAttribute("iDurum", stateAttr);
      ownGeometries.push(gB, gN);
      const body = new THREE.InstancedMesh(gB, cellMats[t], cap);
      body.name = `slab_${name}_${CELL_TYPES[t]}_v${v}_lod${l}`;
      const nucleus = new THREE.InstancedMesh(gN, nucleusMat, cap);
      body.renderOrder = roBase + 6; nucleus.renderOrder = roBase - 1;
      nucleus.instanceMatrix = body.instanceMatrix;
      body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      body.frustumCulled = nucleus.frustumCulled = false;
      body.count = nucleus.count = 0;
      body.setColorAt(0, new THREE.Color(C.cells[t]));
      body.instanceColor.setUsage(THREE.DynamicDrawUsage);
      inner.add(body, nucleus);
      let capsule = null;
      if (g.kapsul) {
        capsule = new THREE.InstancedMesh(g.kapsul, capsuleMat, cap);
        capsule.instanceMatrix = body.instanceMatrix; capsule.frustumCulled = false; capsule.count = 0; capsule.renderOrder = roBase + 2;
        inner.add(capsule);
      }
      // bounding radius in um about the cell origin (body, nucleus, lacuna), plus 5 um for the wobble
      let rad = 0;
      for (const gg of [g.govde, g.cekirdek, g.kapsul]) if (gg) { gg.computeBoundingSphere(); const bs = gg.boundingSphere; rad = Math.max(rad, bs.center.length() + bs.radius); }
      const K = { body, nucleus, capsule, state, stateAttr, n: 0, cap, radius: rad + 5 };
      allClusters.push(K);
      return K;
    }));
  });
  const hsl = C.cells.map((col) => { const o = {}; new THREE.Color(col).getHSL(o); return o; });

  // ---- matrix isosurfaces
  for (const [mname, T] of Object.entries(MATRIX)) {
    const mc = new MarchingCubes(MC_N, T.mat, false, false, T.fixed ? 40000 : 60000);
    mc.name = `slab_${name}_${mname}`;
    mc.scale.setScalar(MC_SCALE);
    mc.isolation = T.iso;
    mc.frustumCulled = false;
    mc.renderOrder = roBase + T.order;
    mc.visible = false;
    T.mc = mc;
    inner.add(mc);
  }

  // ---- clot: gel sprites and fibrin threads on the empty callus / marrow sites of the slab
  const clot = (opts.clot ?? true) ? buildClot(THREE, R, C, opts.gel ?? true, roBase) : null;
  if (clot) {
    for (const o of clot.objects) { inner.add(o); track(o.material, 1); if (extraOnly) o.material.clippingPlanes = extraOnly; }
  }

  inner.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.onBeforeRender = envSync; } });
  (opts.parent ?? ctx.scene)?.add(group);
  syncFrame();

  // ---- the fixed lattice tissues (intact cortex, plate) once
  // opts.hide (pass 4): fixed tissues the beat leaves to the macro scene (c2 'cortex': the
  // macro cortex is the one cortex; c3 'plate': the macro plate). They are never filled and
  // stay invisible (warm() still compiles their programs; nothing is drawn with them).
  const hidden = new Set(opts.hide ?? []);
  {
    const F = dm.fieldsFor(dm.codesOf(0), MATRIX, true);
    for (const [mname, T] of Object.entries(MATRIX)) if (T.fixed && !hidden.has(mname)) fillMC(T.mc, F[mname], null, 0, R);
  }

  // ---- per-frame drawing
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _c = new THREE.Color();
  const X1 = new THREE.Vector3(1, 0, 0);
  const pA = [0, 0, 0], pB = [0, 0, 0];
  const _frustum = new THREE.Frustum(), _sph = new THREE.Sphere(), _pv = new THREE.Matrix4(), _mv = new THREE.Matrix4();
  let cullOn = false, pxPerMM = 0;
  function position(s, out) {
    out[0] = (R.ii[s] - (R.nx - 1) / 2) * UNIT + (hash(s * 5 + 1) - 0.5) * 2 * SITE_JITTER;
    out[1] = (R.kk[s] - (R.nz - 1) / 2) * UNIT + (hash(s * 5 + 2) - 0.5) * 2 * SITE_JITTER;
    out[2] = (R.jj[s] - (R.ny - 1) / 2) * UNIT + (hash(s * 5 + 3) - 0.5) * 2 * SITE_JITTER;
    return out;
  }
  const near = (s) => R.in1[s] === 1;
  const qOf = (H, h, out) => out.set(H.q[h * 4], H.q[h * 4 + 1], H.q[h * 4 + 2], H.q[h * 4 + 3]);
  function add(type, key, x, y, z, q, scale, round) {
    if (scale < 0.02) return;
    const v = Math.floor(hash(key * 13 + 5) * VARIANTS), row = clusters[type][v];
    const sc = GEO_SCALE * scale * (0.9 + 0.2 * hash(key * 11 + 7)); // +-10 % size spread
    // lossless culling: a cell whose bounding sphere misses the clip box or the view frustum draws nothing
    const r = row[0].radius * sc;
    if (Math.abs(x) - r > halfV[0] || Math.abs(y) - r > halfV[1] || Math.abs(z) - r > halfV[2]) return;
    let l = 0;
    if (cullOn) {
      _sph.center.set(x, y, z); _sph.radius = r;
      if (!_frustum.intersectsSphere(_sph)) return;
      // level of detail from the on-screen radius (px at 1080 lines)
      const depth = -(_mv.elements[2] * x + _mv.elements[6] * y + _mv.elements[10] * z + _mv.elements[14]);
      const px = depth > 1e-6 ? (r * UNIT_MM) * pxPerMM / depth : Infinity;
      l = px >= lodPx[0] ? 0 : px >= lodPx[1] ? 1 : 2;
    }
    const K = row[l];
    if (K.n >= K.cap) return;
    const i = K.n++;
    _p.set(x, y, z); _s.setScalar(sc);
    _m.compose(_p, q, _s);
    K.body.setMatrixAt(i, _m);
    const H = hsl[type], h1 = hash(key * 7 + type * 131 + 17), h2 = hash(key + 99);
    _c.setHSL(H.h + (h1 - 0.5) * 0.03, H.s * (0.9 + 0.2 * h1), H.l * (0.92 + 0.14 * h2));
    K.body.setColorAt(i, _c);
    K.state[i * 4] = round; K.state[i * 4 + 1] = hash(key * 7 + 3) * 6.283; K.state[i * 4 + 2] = TYPE_WOBBLE[type]; K.state[i * 4 + 3] = 0;
  }
  function drawCells(g) {
    for (const K of allClusters) K.n = 0;
    const last = dm.last;
    const d = Math.min(Math.floor(g), last), t = g - d;
    if (d >= last || t < 1e-4) {
      const H = dm.cellsOf(d), K = dm.keysOf(d);
      for (let h = 0; h < H.n; h++) {
        if (!near(H.site[h])) continue;
        position(H.site[h], pA); add(H.type[h], K[h], pA[0], pA[1], pA[2], qOf(H, h, _q), 1, 0);
      }
    } else {
      const G = dm.transition(d), { A, B } = G, KA = dm.keysOf(d), KB = dm.keysOf(d + 1);
      const e = smooth(0, 1, t);
      const mitosis = t < 0.45 ? smooth(0.05, 0.45, t) : 1 - smooth(0.45, 0.95, t);
      for (let b = 0; b < B.n; b++) {
        const sb = B.site[b], a = G.source[b], k = G.kind[b];
        const sa = a >= 0 ? A.site[a] : sb;
        if (!near(sb) && !near(sa)) continue;
        position(sb, pB);
        if (k === STAY) {
          add(B.type[b], KB[b], pB[0], pB[1], pB[2], qOf(B, b, _q), 1, G.divides[a] ? mitosis : 0);
        } else if (k === MOVE) {
          position(sa, pA);
          _v.set(pB[0] - pA[0], pB[1] - pA[1], pB[2] - pA[2]);
          // crawl: the long axis turns toward the direction of travel, then settles into the next day's orientation
          if (_v.lengthSq() > 1) {
            _q2.setFromUnitVectors(X1, _v.normalize());
            if (t < 0.5) qOf(A, a, _q).slerp(_q2, smooth(0, 0.3, t));
            else { _q.copy(_q2); _q.slerp(qOf(B, b, _q3), smooth(0.7, 1, t)); }
          } else qOf(B, b, _q);
          add(MSC, KB[b], pA[0] + (pB[0] - pA[0]) * e, pA[1] + (pB[1] - pA[1]) * e, pA[2] + (pB[2] - pA[2]) * e, _q, 1, G.divides[a] ? mitosis : 0);
        } else if (k === CHANGE) {
          // differentiation (or an osteoblast buried by bone becoming an osteocyte): the old form rounds and fades, the new one grows
          add(A.type[a], KA[a], pB[0], pB[1], pB[2], qOf(A, a, _q), 1 - smooth(0.1, 0.6, t), smooth(0, 0.5, t));
          add(B.type[b], KB[b], pB[0], pB[1], pB[2], qOf(B, b, _q), smooth(0.4, 0.95, t), 1 - smooth(0.4, 1, t));
        } else if (k === BIRTH) {
          if (t > 0.45) {
            position(sa, pA);
            const u = smooth(0.45, 1, t);
            add(B.type[b], KB[b], pA[0] + (pB[0] - pA[0]) * u, pA[1] + (pB[1] - pA[1]) * u, pA[2] + (pB[2] - pA[2]) * u, qOf(B, b, _q), 0.75 + 0.25 * u, 1 - u);
          }
        } else {
          add(B.type[b], KB[b], pB[0], pB[1], pB[2], qOf(B, b, _q), smooth(0, 0.8, t), 1 - smooth(0, 1, t));
        }
      }
      for (const a of G.gone) {
        const sa = A.site[a];
        if (!near(sa)) continue;
        position(sa, pA);
        add(A.type[a], KA[a], pA[0], pA[1], pA[2], qOf(A, a, _q), 1 - smooth(0.1, 0.9, t), smooth(0, 0.7, t));
      }
    }
    for (const K of allClusters) {
      K.body.count = K.nucleus.count = K.n;
      if (K.capsule) K.capsule.count = K.n;
      K.body.instanceMatrix.clearUpdateRanges(); K.body.instanceMatrix.addUpdateRange(0, Math.max(1, K.n) * 16); K.body.instanceMatrix.needsUpdate = true;
      K.body.instanceColor.clearUpdateRanges(); K.body.instanceColor.addUpdateRange(0, Math.max(1, K.n) * 3); K.body.instanceColor.needsUpdate = true;
      K.stateAttr.clearUpdateRanges(); K.stateAttr.addUpdateRange(0, Math.max(1, K.n) * 4); K.stateAttr.needsUpdate = true;
    }
  }
  function drawMatrix(g) {
    const last = dm.last, d = Math.min(Math.floor(g), last), t = d >= last ? 0 : g - d;
    const F0 = dm.fieldsOf(d, MATRIX), F1 = t > 0 ? dm.fieldsOf(d + 1, MATRIX) : F0;
    for (const [mname, T] of Object.entries(MATRIX)) {
      if (T.fixed) continue;
      fillMC(T.mc, F0[mname], F1[mname], t, R);
    }
  }
  function drawClot(g) {
    if (!clot) return;
    const last = dm.last, d = Math.min(Math.floor(g), last), t = d >= last ? 0 : g - d;
    const c0 = dm.codesOf(d), c1 = t > 0 ? dm.codesOf(d + 1) : c0;
    const empty = (v) => (v === 0 || v === 1) ? 1 : 0; // clot / granulation where there is no tissue-forming cell
    for (const o of clot.objects) {
      const ca = o.geometry.getAttribute("color"), { sites, stride, maxAlpha } = o.userData;
      for (let n = 0; n < sites.length; n++) {
        const s = sites[n], a = (empty(c0[s]) * (1 - t) + empty(c1[s]) * t) * maxAlpha;
        ca.array[n * stride + 3] = a; if (stride === 8) ca.array[n * 8 + 7] = a;
      }
      ca.needsUpdate = true;
    }
  }

  // ---- prepare the day range (cells, transitions, identity chain) inside the build
  for (let d = range[0] - firstDay; d <= range[1] - firstDay; d++) dm.keysOf(d);

  let lastG = NaN, lastCellsG = NaN, lastCellsCulled = false, opacity = 1, visible = true;
  const slab = {
    name, region: def, group, inner, centre, size, box, days: R.days.slice(), range,
    /** Fractional simulated day (clamped to the run). Pure: same day (and camera) -> same geometry.
     *  camera (optional, the frame's final camera, e.g. ctx.camera in a beat's update): cells outside
     *  its view frustum are skipped (lossless; much cheaper close-ups). */
    setDay(day, camera = null) {
      syncFrame();
      const g = Math.max(0, Math.min(dm.last, day - firstDay));
      if (camera) {
        camera.updateMatrixWorld();
        _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(inner.matrixWorld);
        _frustum.setFromProjectionMatrix(_pv);
        _mv.multiplyMatrices(camera.matrixWorldInverse, inner.matrixWorld);
        pxPerMM = camera.isPerspectiveCamera ? 540 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) : 0;
        cullOn = true;
        drawCells(g);
      } else if (g !== lastCellsG || lastCellsCulled) {
        cullOn = false;
        drawCells(g);
      }
      lastCellsG = g; lastCellsCulled = !!camera;
      if (g === lastG) return;
      lastG = g;
      drawMatrix(g);
      drawClot(g);
    },
    /** Wobble clock in seconds (the film time t). 0 freezes the membranes. */
    setTime(sec) { timeU.value = sec; },
    setOpacity(a) {
      opacity = Math.max(0, Math.min(1, a));
      for (const m of allMaterials) m.opacity = m.userData.sgBaseOpacity * opacity;
      group.visible = visible && opacity > 0.001;
    },
    setVisible(b) { visible = !!b; group.visible = visible && opacity > 0.001; },
    /** Compile every slab program once (call in a beat's build), so the first frame of a stop does not
     *  pay the shader compile. Changes no visible state. */
    warm(renderer, camera) {
      const saved = [];
      group.traverse((o) => { saved.push([o, o.visible]); o.visible = true; });
      for (const T of Object.values(MATRIX)) if (T.fixed && hidden.has(T.mc.name.replace(`slab_${name}_`, ""))) T.mc.visible = false;
      try { renderer.compile(group, camera, ctx.scene ?? null); } finally { for (const [o, v] of saved) o.visible = v; }
    },
    /** View-space depth (mm) of a scene point (default the slab centre) from a camera: BokehPass focus. */
    focusDepth(camera, point = centre) {
      camera.updateMatrixWorld();
      const fwd = new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorld);
      return _v.copy(point).sub(camera.getWorldPosition(new THREE.Vector3())).dot(fwd);
    },
    /** Lattice site (global i, j, k) -> scene position (Vector3). */
    latticeToScene(i, j, k, out = new THREE.Vector3()) {
      return out.set(i * 0.1 - 18, j * 0.1 - 18, k * 0.1).applyMatrix4(sceneFromModel);
    },
    /** The viewer's three cameras ('yuz' face-on, 'egik' oblique, 'yakin' close) in scene coordinates.
     *  up is scene +y (proximal up, as in the viewer); the film's director adds its roll. */
    viewerCamera(view = "egik") {
      const P = { yuz: [600, 20, 0], egik: [470, 230, -380], yakin: [150, 25, 40] }[view];
      const pos = new THREE.Vector3().fromArray(P).applyMatrix4(sceneFromViewer);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(sceneFromViewer);
      return { pos: pos.toArray(), target: centre.toArray(), up: up.toArray(), fov: 32 };
    },
    /** Agents in the visible slab on an integer day, by drawn type. */
    counts(day) {
      const d = Math.max(0, Math.min(dm.last, Math.round(day - firstDay))), H = dm.cellsOf(d);
      const out = { msc: 0, fibroblast: 0, chondrocyte: 0, osteoblast: 0, osteocyte: 0 };
      for (let h = 0; h < H.n; h++) if (R.in0[H.site[h]]) out[CELL_TYPES[H.type[h]]]++;
      return out;
    },
    /** Pass 4 (labels). Drawn type name of a type index ('msc', 'fibroblast', ...). */
    typeName(type) { return CELL_TYPES[type]; },
    /** Pass 4 (labels). Cells of one type that keep their identity, their type and their site on
     *  every integer day d0..d1 (absolute days) inside the visible slab: between those days they
     *  are drawn as 'stay' cells (full size, never moving), so their centre is a fixed scene point.
     *  Returns [{ site, key, ii, jj, kk, pos: Vector3 (scene mm) }], sorted by site. */
    stableCells(type, d0, d1) {
      const a = Math.max(0, Math.min(dm.last, Math.round(d0 - firstDay)));
      const b = Math.max(0, Math.min(dm.last, Math.round(d1 - firstDay)));
      const H0 = dm.cellsOf(a), K0 = dm.keysOf(a);
      let alive = new Map();
      for (let h = 0; h < H0.n; h++) if (H0.type[h] === type && R.in0[H0.site[h]]) alive.set(H0.site[h], K0[h]);
      for (let d = a + 1; d <= b && alive.size; d++) {
        const H = dm.cellsOf(d), K = dm.keysOf(d), next = new Map();
        for (const [s, k] of alive) { const h = H.index[s]; if (h >= 0 && H.type[h] === type && K[h] === k) next.set(s, k); }
        alive = next;
      }
      const out = [];
      for (const [s, k] of [...alive].sort((p, q) => p[0] - q[0])) out.push({ site: s, key: k, ii: R.ii[s], jj: R.jj[s], kk: R.kk[s], pos: this.sitePosition(s) });
      return out;
    },
    /** Pass 4. Scene position (Vector3, mm) of the centre of a cell drawn at a site (with the
     *  site's fixed offset). */
    sitePosition(s, out = new THREE.Vector3()) {
      position(s, pA);
      return out.set(pA[0], pA[1], pA[2]).applyMatrix4(sceneFromViewer);
    },
    /** Pass 4. The cells drawn on an integer day (absolute): { n, site: Int32Array, type:
     *  Uint8Array, pos: Float32Array (scene mm, xyz) }, for label layout and occlusion tests. */
    cellsOn(day) {
      const d = Math.max(0, Math.min(dm.last, Math.round(day - firstDay))), H = dm.cellsOf(d);
      const site = [], type = [], pos = [];
      const v = new THREE.Vector3();
      for (let h = 0; h < H.n; h++) {
        if (!near(H.site[h])) continue;
        this.sitePosition(H.site[h], v);
        site.push(H.site[h]); type.push(H.type[h]); pos.push(v.x, v.y, v.z);
      }
      return { n: site.length, site: Int32Array.from(site), type: Uint8Array.from(type), pos: Float32Array.from(pos) };
    },
    /** Pass 4. Bounding radius (scene mm) of a cell of this type at full size (the largest variant). */
    cellRadius(type) {
      let r = 0;
      for (const v of clusters[type]) r = Math.max(r, v[0].radius);
      return r * GEO_SCALE * 1.1 * UNIT_MM;
    },
    /** Inferred events between integer day d and d + 1 (cells of day d + 1 near the visible slab):
     *  { stay, move, change, birth, appear, gone }. Useful to pick days with visible migration. */
    transitionStats(day) {
      const d = Math.max(0, Math.min(dm.last - 1, Math.floor(day - firstDay))), G = dm.transition(d);
      const out = { stay: 0, move: 0, change: 0, birth: 0, appear: 0, gone: 0 }, names = ["stay", "move", "change", "birth", "appear"];
      for (let b = 0; b < G.B.n; b++) if (R.in0[G.B.site[b]]) out[names[G.kind[b]]]++;
      for (const a of G.gone) if (R.in0[G.A.site[a]]) out.gone++;
      return out;
    },
    /** Draw statistics of the last setDay. */
    stats() {
      let cells = 0; const lod = [0, 0, 0];
      for (const row of clusters) for (const v of row) v.forEach((K, l) => { cells += K.n; lod[l] += K.n; });
      const mc = {}; for (const [mname, T] of Object.entries(MATRIX)) mc[mname] = T.mc.visible ? Math.round(T.mc.count / 3) : 0;
      return { day: lastG + firstDay, cells, lod, triangles: mc };
    },
    materials: allMaterials,
    dispose() {
      group.parent?.remove(group);
      for (const K of allClusters) { K.body.dispose(); K.nucleus.dispose(); K.capsule?.dispose(); }
      for (const g of ownGeometries) g.dispose();
      for (const T of Object.values(MATRIX)) T.mc.geometry.dispose();
      if (clot) for (const o of clot.objects) o.geometry.dispose();
      for (const m of allMaterials) m.dispose();
    },
  };
  slab.setDay(range[0]);
  return slab;
}

// Fill a MarchingCubes field from one (or two blended) lattice fields and polygonise it.
function fillMC(mc, a0, a1, t, R) {
  mc.reset();
  const { nx, ny, nz, M } = R, yz = ny * nz;
  // field sample f (per axis) sits at lattice coordinate centre + (f - MC_H) / MC_STEP
  const centre = [(nx - 1) / 2, (nz - 1) / 2, (ny - 1) / 2];
  const hi = [nx - M - 0.5, nz - M - 0.5, ny - M - 0.5], lo = [M - 0.5, M - 0.5, M - 0.5];
  const f = mc.field;
  const blend = a1 && t > 0;
  let filled = 0;
  for (let fz = 1; fz < MC_N - 1; fz++) {
    const lj = centre[2] + (fz - MC_H) / MC_STEP; if (lj < lo[2] || lj > hi[2]) continue;
    for (let fy = 1; fy < MC_N - 1; fy++) {
      const lk = centre[1] + (fy - MC_H) / MC_STEP; if (lk < lo[1] || lk > hi[1]) continue;
      for (let fx = 1; fx < MC_N - 1; fx++) {
        const li = centre[0] + (fx - MC_H) / MC_STEP; if (li < lo[0] || li > hi[0]) continue;
        const i0 = Math.max(M, Math.min(nx - M - 1, Math.floor(li))), j0 = Math.max(M, Math.min(ny - M - 1, Math.floor(lj))), k0 = Math.max(M, Math.min(nz - M - 1, Math.floor(lk)));
        const i1 = Math.min(nx - M - 1, i0 + 1), j1 = Math.min(ny - M - 1, j0 + 1), k1 = Math.min(nz - M - 1, k0 + 1);
        const ui = Math.max(0, Math.min(1, li - i0)), uj = Math.max(0, Math.min(1, lj - j0)), uk = Math.max(0, Math.min(1, lk - k0));
        const val = blend ? (s) => a0[s] + (a1[s] - a0[s]) * t : (s) => a0[s];
        const v00 = val(i0 * yz + j0 * nz + k0) * (1 - uk) + val(i0 * yz + j0 * nz + k1) * uk;
        const v01 = val(i0 * yz + j1 * nz + k0) * (1 - uk) + val(i0 * yz + j1 * nz + k1) * uk;
        const v10 = val(i1 * yz + j0 * nz + k0) * (1 - uk) + val(i1 * yz + j0 * nz + k1) * uk;
        const v11 = val(i1 * yz + j1 * nz + k0) * (1 - uk) + val(i1 * yz + j1 * nz + k1) * uk;
        const v = (v00 * (1 - uj) + v01 * uj) * (1 - ui) + (v10 * (1 - uj) + v11 * uj) * ui;
        if (v > 0) { f[MC_N * MC_N * fz + MC_N * fy + fx] = v; filled++; }
      }
    }
  }
  mc.visible = filled > 0;
  if (filled) {
    mc.update();
    for (const name of ["position", "normal"]) {
      const at = mc.geometry.getAttribute(name);
      if (at) { at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, mc.count) * 3); }
    }
  }
}

// The largest count(d) + count(d+1) per (type, variant) mesh over the run (the viewer's bound).
function capacityOf(R, dm) {
  const typeOfCode = { 1: [MSC], 5: [FIB], 4: [KON], 2: [OB, OC] };
  const nTypes = CELL_TYPES.length;
  // variants are keyed by identity, not site: bound per type and give every variant that bound
  const most = new Int32Array(nTypes), count = new Int32Array(nTypes), prev = new Int32Array(nTypes);
  for (let d = 0; d < R.days.length; d++) {
    count.fill(0);
    const p = R.packed.subarray(d * R.half, (d + 1) * R.half);
    for (let s = 0; s < R.N; s++) {
      if (!R.in1[s]) continue;
      const v = (s & 1) ? p[s >> 1] >> 4 : p[s >> 1] & 15, T = typeOfCode[v];
      if (T) for (const t of T) count[t]++;
    }
    for (let i = 0; i < nTypes; i++) most[i] = Math.max(most[i], count[i] + prev[i]);
    prev.set(count);
  }
  const out = [];
  for (let t = 0; t < nTypes; t++) for (let v = 0; v < VARIANTS; v++) out.push(most[t] + 16);
  return out;
}

// The clot / granulation tissue of empty sites: a soft reddish gel (one sprite per site) and a few
// thin, slightly curved fibrin strands. Both fade where a tissue-forming cell takes the site.
function buildClot(THREE, R, C, withGel, roBase) {
  const gPos = [], gCol = [], gSite = [], lPos = [], lCol = [], lSite = [];
  const p = [0, 0, 0];
  for (let s = 0; s < R.N; s++) {
    if (R.in0[s] !== 1 || R.mask[s] === 0) continue;
    p[0] = (R.ii[s] - (R.nx - 1) / 2) * UNIT + (hash(s * 5 + 1) - 0.5) * 2 * SITE_JITTER;
    p[1] = (R.kk[s] - (R.nz - 1) / 2) * UNIT + (hash(s * 5 + 2) - 0.5) * 2 * SITE_JITTER;
    p[2] = (R.jj[s] - (R.ny - 1) / 2) * UNIT + (hash(s * 5 + 3) - 0.5) * 2 * SITE_JITTER;
    const marrow = R.mask[s] === 2;
    const gc = marrow ? C.gelMarrow : C.gelClot;
    gPos.push(p[0], p[1], p[2]); gCol.push(gc[0], gc[1], gc[2], 0); gSite.push(s);
    // one strand of three short segments with a gentle bend
    const h = (n) => hash(s * 31 + n);
    let x = p[0] + (h(1) - 0.5) * UNIT, y = p[1] + (h(2) - 0.5) * UNIT, z = p[2] + (h(3) - 0.5) * UNIT;
    let th = h(4) * Math.PI * 2, ph = Math.acos(2 * h(5) - 1);
    const lc = marrow ? C.fibrinMarrow : C.fibrinClot;
    for (let n = 0; n < 3; n++) {
      const L = 2.2 + 1.6 * h(10 + n);
      const x2 = x + Math.sin(ph) * Math.cos(th) * L, y2 = y + Math.sin(ph) * Math.sin(th) * L, z2 = z + Math.cos(ph) * L;
      lPos.push(x, y, z, x2, y2, z2); lCol.push(lc[0], lc[1], lc[2], 0, lc[0], lc[1], lc[2], 0); lSite.push(s);
      x = x2; y = y2; z = z2; th += (h(20 + n) - 0.5) * 1.2; ph += (h(30 + n) - 0.5) * 0.9;
    }
  }
  const objects = [];
  if (withGel) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(gPos, 3));
    const ca = new THREE.Float32BufferAttribute(gCol, 4); ca.setUsage(THREE.DynamicDrawUsage); g.setAttribute("color", ca);
    const gel = new THREE.Points(g, new THREE.PointsMaterial({ size: 26 * UNIT_MM, map: gelTexture(THREE), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, toneMapped: false }));
    gel.userData = { sites: Int32Array.from(gSite), stride: 4, maxAlpha: 0.16 }; gel.renderOrder = roBase + 1; gel.frustumCulled = false;
    objects.push(gel);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.Float32BufferAttribute(lPos, 3));
  const la = new THREE.Float32BufferAttribute(lCol, 4); la.setUsage(THREE.DynamicDrawUsage); lg.setAttribute("color", la);
  const threads = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
  threads.userData = { sites: Int32Array.from(lSite), stride: 8, maxAlpha: 0.13 }; threads.renderOrder = roBase + 1; threads.frustumCulled = false;
  objects.push(threads);
  return { objects };
}

/**
 * Pass 4. A ground-coloured backdrop just behind a slab (scene x = slab centre + depth, facing the
 * camera side -x), over the slab's y-z footprint (z clipped at zMax). Through the translucent slab
 * the camera then sees the paper ground, as in the cell viewer, instead of the macro clip box's
 * side walls (0.3 mm voxel blocks, seen obliquely through the cells as large amber and ivory
 * blocks), while the voxels around the window stay as context. Unlit, not tone-mapped, no fog:
 * it equals the clear colour exactly. Returns { mesh, setOpacity(a) } (a = 0 hides it).
 */
export function createSlabBackdrop(ctx, slab, { depth = 0.36, zMax = Infinity, color = "#02071d" } = {}) {
  const THREE = ctx.THREE;
  const c = slab.centre, s = slab.size;
  const y0 = c.y - s.y / 2, y1 = c.y + s.y / 2, z0 = c.z - s.z / 2, z1 = Math.min(c.z + s.z / 2, zMax);
  const x = c.x + depth;
  const g = new THREE.BufferGeometry();
  // two triangles wound to face -x
  g.setAttribute("position", new THREE.Float32BufferAttribute([x, y0, z0, x, y0, z1, x, y1, z1, x, y0, z0, x, y1, z1, x, y1, z0], 3));
  g.computeVertexNormals();
  const m = new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: false, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.name = `slab_${slab.name}_backdrop`;
  mesh.renderOrder = -2; // before the voxels and the slab (transparent queue), so it hides what lies behind
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.visible = false;
  mesh.frustumCulled = false;
  (ctx.scene).add(mesh);
  return {
    mesh,
    setOpacity(a) {
      m.opacity = Math.max(0, Math.min(1, a));
      mesh.visible = m.opacity > 0.001;
    },
  };
}
