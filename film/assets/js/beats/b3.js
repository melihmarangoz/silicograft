// Beat b3 "Tissue forms" (frames 420-599, 14-20 s, simulated day 30 to 120). Pass 3.
//
// PASS 3 (SPEC P3-1, timeline restructure): the beat moved from 12-18 s (days 30 -> 357) to
// 14-20 s (days 30 -> 120, the film's day track timeline.js dayAt). It now sits between the
// first cell stop (b2, ilik_ucu) and the second (c2, korteks_ucu): it starts on b2's pull-out
// key (14 s, the proximal half of the callus, where ilik_ucu sits), swings out to the
// three-quarter of the half callus (16.6-17.6 s) and ends on c2's dive-in key (20 s, the proximal
// lobe with the cortex corner below the bone axis). The inner keys are the b3 builder's (see
// "Camera" below). The stem-cell fade below moved with the
// beat (16.2-17.4 s); c2, c3, b4 and b6 keep its end look (stemOpacity 0.4) in their macro
// frames. Everything below about pass 2 (day 357 at 15 s, the counts) is pass-2 history.
//
// Pass 2: the one hero move: a pull back from b2's last key (6.5 mm from the proximal bone end) to the
// three-quarter view of the half callus that b4 orbits from, while the voxels run from day 30
// to day 357. The bone lies horizontal (the director's default roll: proximal end on screen
// left, plate on top); the camera ends slightly below the plate's level, looking along the
// bone from the distal side, so the cut face, the bone column under the plate and the bone at
// the cortex ends read, and the middle of the gap stays empty.
//
// Colour (SPEC P2-2): the engine draws the voxels in the run viewer's tissue colours (ivory
// bone, blue cartilage, coral fibrous, amber stem cells), around them the plate steel, the warm
// grey cortex and the red marrow. At day 357 the kept half holds 114,886 stem-cell blocks and
// 10,356 bone blocks, and opaque stem cells leave only about 13 % of the visible voxel surface
// ivory from this camera (most bone lies inside the callus): the callus read as one amber mass
// (tried in pass 2). So the stem-cell emphasis of pass 1 stays, revised:
//
// From 14.2 s to 15.4 s the stem-cell voxels fade to 40 % opacity so the bone inside the callus
// shows through, ivory against amber. Nothing is recoloured or invented: every block keeps its
// data code and palette colour; only the stem-cell blocks become translucent.
//
// How (the engine has no per-code voxel opacity, so this beat adds it at run time):
//  1. state.stemOpacity (an extension this beat introduces, default 1 when absent) is read at
//     render time by a uniform patched into the engine's voxel material (ctx.voxels.material,
//     onBeforeCompile chained onto b2's patch): fragments of instances whose colour is the
//     stem-cell colour get alpha *= stemOpacity. A no-op while stemOpacity is 1.
//  2. The alpha only applies while the voxel material is transparent, which the engine switches
//     on when state.voxelOpacity < 0.999. While stemOpacity < 1 this beat writes voxelOpacity =
//     0.998 (no visible change to the other blocks). The voxel instances are ordered by block
//     index (bi, then bj, then bk), i.e. far to near for a camera on the cut side, so one
//     blended draw composites back to front.
//  3. Pass 2 (shadows): translucent stem cells must not cast full shadows, or every layer behind
//     them sits in their shadow and the stack reads muddy brown (pass 2's first look). The same
//     test scales the stem-cell cubes in the voxel mesh's shadow depth material (b2's, chained,
//     found at render time) from full size at stemOpacity 1 to nothing at 0.4. Plate, screws,
//     bone and the other tissues keep casting.
//  4. The engine culls every block enclosed by six full-size neighbours, so bone embedded in
//     stem-cell blocks is never drawn (7,368 of the 10,356 bone blocks at day 357). This beat
//     draws its own opaque bone-only InstancedMesh (same cube, material look, colour and day
//     interpolation as the engine's voxels; only bone enclosed by bone is culled) while
//     stemOpacity < 1. It casts and receives the key light's shadow (pass 2). Where an engine
//     bone block is drawn, this one is coincident with it, same colour, so it changes nothing.
//
// Also tried in pass 2 and rejected: the run viewer's convention of drawing stem-cell blocks at
// 0.42 of a block (kallus3b.html), with the blocks the engine culls redrawn in an overlay. It
// read as a regular amber lattice with moire, showed little interior bone, and cost 6.5-6.9 s
// per frame in SwiftShader.
//
// Hand-off (pass 3): from 20 s on, the state belongs to c2, then c3 (34 s), then b4. They keep
// stemOpacity at STEM_OPACITY_END (ctx.shared.b3) and voxelOpacity <= 0.998 in their macro
// frames; the bone mesh stays available after this window on the film's day track
// (ctx.dayAt(t), 120 -> 357 over 20-34 s) and is shown whenever the state at render time has
// stemOpacity < 1, voxels on, the half model, and its day. Its material is registered in
// ctx.macroMaterials, so a stop's state.macroClip cuts it with the engine's voxels.
//
// Pure function of t: the day track, the camera keys and the opacity schedule are closed-form;
// the bone mesh instances are memoised per (sampled days, fraction) only.

import { beat as timelineBeat, dayAt as filmDayAt } from "../timeline.js";

const START = timelineBeat("b3").start; // 14
const END = timelineBeat("b3").end; // 20

// ---------------------------------------------------------------------------------------
// Camera (pass 3). K_IN (= b2's last key, 14 s) and K_OUT (= c2's first key, 20 s) are boundary
// keys of the contract (ENGINE.md, "Pass 3 boundary keys (contract)"): keep them exactly.
//   14 s  K_IN    the proximal half of the half callus from below the plate's level, the
//                 ilik_ucu spot (marrow opening, scene (0, 14.95, 0)) left of centre
//                 (az 14, el -24, 36 mm, target (0, 13.5, -1)).
//   15.5  K_OUT_1 pulling back from the proximal lobe (az 10, el -32, 48 mm, target (0, 9, 1.5)).
//   16.6  K_WIDE_A / 17.6 K_WIDE_B  the three-quarter of the half callus (az 7 -> 5, el -36,
//                 54 -> 56 mm, target y 3 -> 6, z 2.5 -> 2): both lobes from the distal side, the
//                 plate along the top, the bone at the cortex ends and along the plate as it forms
//                 (days ~50-90), the empty middle of the gap.
//   18.7  K_IN_1  gliding in on the proximal lobe (az 4, el -33, 42 mm, target (0, 13, -2)).
//   20 s  K_OUT   the proximal lobe, the cortex corner away from the plate (korteks_ucu,
//                 scene (0, 15.95, -9.05)) just below and left of centre (az 2, el -22,
//                 32 mm, target (0, 16.5, -5.5)): c2 dives from here. The ivory blocks at
//                 this corner (the film's first new bone) mark the region before the dive.
// b3 builder (pass 3): the timeline pass's single 72 mm key at 17 s left the bottom quarter of
// every frame empty (target z -1.5, below the bone's centre) and brought the camera to rest at
// 17 s. The wide is now two keys: the target's y turns round at 16.6 s and the distance at
// 17.6 s, so the camera never stops between the boundaries (planner screen speed 0.04-0.27,
// lowest at 16.75 s), the target sits at z 2-2.5 (bone and plate centred) and 54-56 mm
// with el -36 brings the distal lobe into the right of the frame. Planner cover 0.45-0.55
// over 14-20 s (was 0.38-0.49). Tried and dropped: the callus hull at 0.15 as a skin over the
// empty gap (the half hull is not visible from the cut side; no change in the frame).
// A key from a target and the view direction about it (director.js anglesToDir: azimuth about
// scene y from -x towards +z, elevation towards +y), in degrees and mm.
function keyAt(t, target, azDeg, elDeg, dist, fov) {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  const c = Math.cos(el);
  const u = [-c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
  return { t, target, pos: target.map((v, i) => Math.round((v + u[i] * dist) * 1e3) / 1e3), fov };
}
const K_IN = { t: 14, pos: [-31.911, -1.143, 6.956], target: [0, 13.5, -1], fov: 28 }; // = keyAt(14, [0, 13.5, -1], 14, -24, 36)
const K_OUT_1 = keyAt(15.5, [0, 9, 1.5], 10, -32, 48, 28);
const K_WIDE_A = keyAt(16.6, [0, 3, 2.5], 7, -36, 54, 28);
const K_WIDE_B = keyAt(17.6, [0, 6, 2], 5, -36, 56, 28);
const K_IN_1 = keyAt(18.7, [0, 13, -2], 4, -33, 42, 28);
const K_OUT = { t: 20, pos: [-29.652, 4.513, -4.465], target: [0, 16.5, -5.5], fov: 28 }; // = keyAt(20, [0, 16.5, -5.5], 2, -22, 32)

// ---------------------------------------------------------------------------------------
// Day track (pass 3): the film's (timeline.js dayAt, documented in ENGINE.md "Day track"):
// 30 at 14 s, 120 at 20 s, continuous in value and rate with the stops on either side.
const DAY_END = 357; // the day the bone overlay is warmed for (b4-b6 hold it)
const dayAt = filmDayAt;

// ---------------------------------------------------------------------------------------
// Stem cell opacity: 1 -> 0.4 over 36 frames (power1.inOut) from 16.2 s (pass 3: 2.2 s into
// the beat as in pass 2, now about day 60), then held to the end of the beat; the later macro
// frames keep 0.4.
const STEM_FADE_T0 = START + 2.2;
const STEM_FADE_DUR = 36 / 30;
const STEM_OPACITY_END = 0.4;
function stemOpacityAt(t, util) {
  return util.lerp(1, STEM_OPACITY_END, util.tween(t, STEM_FADE_T0, STEM_FADE_DUR, "power1.inOut"));
}

// ---------------------------------------------------------------------------------------
// Bone-only voxel overlay (see the header, point 3).
const BONE_CODE = 2;
const HALF_BI = 59; // blocks bi <= 59 lie in model x < 0 (the kept half)

function makeBoneVoxels(ctx) {
  const { THREE, voxels, palette } = ctx;
  const [NI, NJ, NK] = voxels.grid;
  const NJK = NJ * NK;
  const cube = voxels.blockMM * 0.95;
  const days = voxels.days;

  // Bone blocks of the kept half per sampled day (sorted, as the source arrays are).
  const boneCache = new Map();
  function boneOfDay(i) {
    if (!boneCache.has(i)) {
      const D = voxels.sampledDay(i);
      let n = 0;
      for (let k = 0; k < D.count; k++) if (D.code[k] === BONE_CODE && Math.floor(D.block[k] / NJK) <= HALF_BI) n++;
      const out = new Uint32Array(n);
      n = 0;
      for (let k = 0; k < D.count; k++) if (D.code[k] === BONE_CODE && Math.floor(D.block[k] / NJK) <= HALF_BI) out[n++] = D.block[k];
      boneCache.set(i, out);
    }
    return boneCache.get(i);
  }

  // Same day blending as the engine (makeVoxels.locate / merge).
  function locate(d) {
    d = Math.min(days[days.length - 1], Math.max(days[0], d));
    let a = 0;
    while (a < days.length - 1 && days[a + 1] <= d) a++;
    if (a === days.length - 1) return { a, b: a, f: 0 };
    const f = (d - days[a]) / (days[a + 1] - days[a]);
    return f <= 1e-9 ? { a, b: a, f: 0 } : { a, b: a + 1, f };
  }

  const material = ctx.materials.voxel.clone();
  material.name = "b3-bone-voxels";
  material.color.set(palette.bone);
  // Shown only while the state at render time asks for translucent stem cells (header).
  const uShow = { value: 0 };
  const showPatch = (sh) => {
    sh.uniforms.uSgB3Show = uShow;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uSgB3Show;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed *= uSgB3Show;");
  };
  material.onBeforeCompile = showPatch;
  material.customProgramCacheKey = () => "sg-b3-bone-voxels";
  // The shadow pass draws with this depth material, so the hidden overlay casts nothing.
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = showPatch;
  depth.customProgramCacheKey = () => "sg-b3-bone-voxels-depth";

  let capacity = 0;
  let mesh = null;
  const group = new THREE.Group();
  group.name = "b3-bone-voxels";
  group.visible = false;
  ctx.model.add(group);
  function ensureCapacity(n) {
    if (mesh && n <= capacity) return;
    capacity = Math.max(16384, Math.ceil(n * 1.25));
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, capacity);
    m.name = "b3-bone-voxels";
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
    m.customDepthMaterial = depth;
    m.count = 0;
    if (mesh) {
      group.remove(mesh);
      mesh.geometry.dispose();
      mesh.dispose();
    }
    mesh = m;
    group.add(m);
  }
  ensureCapacity(0);

  const solid = new Uint8Array(NI * NJ * NK);
  let solidList = new Uint32Array(0);
  let solidN = 0;
  let key = null;
  let builtDay = NaN;
  let blocks = new Uint32Array(0);
  let scales = new Float32Array(0);

  function setDay(d) {
    const { a, b, f } = locate(d);
    const k = `${a}:${b}:${f.toFixed(6)}`;
    builtDay = d;
    if (k === key) return;
    key = k;
    const A = boneOfDay(a);
    const B = a === b ? A : boneOfDay(b);
    const cap = A.length + (a === b ? 0 : B.length);
    if (blocks.length < cap) {
      blocks = new Uint32Array(cap);
      scales = new Float32Array(cap);
      solidList = new Uint32Array(cap);
    }
    // merge: in both -> 1, only earlier -> 1 - f, only later -> f
    let n = 0;
    let i = 0;
    let j = 0;
    if (a === b) {
      for (; i < A.length; i++, n++) {
        blocks[n] = A[i];
        scales[n] = 1;
      }
    } else {
      while (i < A.length || j < B.length) {
        const ba = i < A.length ? A[i] : 0xffffffff;
        const bb = j < B.length ? B[j] : 0xffffffff;
        if (ba === bb) {
          blocks[n] = ba;
          scales[n] = 1;
          i++;
          j++;
        } else if (ba < bb) {
          blocks[n] = ba;
          scales[n] = 1 - f;
          i++;
        } else {
          blocks[n] = bb;
          scales[n] = f;
          j++;
        }
        n++;
      }
    }
    // cull bone blocks enclosed by six full-size bone blocks (never visible)
    for (let q = 0; q < solidN; q++) solid[solidList[q]] = 0;
    solidN = 0;
    for (let q = 0; q < n; q++) {
      if (scales[q] >= 0.999999) {
        solid[blocks[q]] = 1;
        solidList[solidN++] = blocks[q];
      }
    }
    ensureCapacity(n);
    const M = mesh.instanceMatrix.array;
    let m = 0;
    for (let q = 0; q < n; q++) {
      const bl = blocks[q];
      const s = scales[q];
      if (s <= 1e-4) continue;
      const bi = Math.floor(bl / NJK);
      const bj = Math.floor(bl / NK) % NJ;
      const bk = bl % NK;
      if (
        solid[bl] &&
        bi > 0 && bi < NI - 1 && bj > 0 && bj < NJ - 1 && bk > 0 && bk < NK - 1 &&
        solid[bl - NJK] && solid[bl + NJK] && solid[bl - NK] && solid[bl + NK] && solid[bl - 1] && solid[bl + 1]
      )
        continue;
      const sc = cube * s;
      const o = m * 16;
      M[o] = sc; M[o + 1] = 0; M[o + 2] = 0; M[o + 3] = 0;
      M[o + 4] = 0; M[o + 5] = sc; M[o + 6] = 0; M[o + 7] = 0;
      M[o + 8] = 0; M[o + 9] = 0; M[o + 10] = sc; M[o + 11] = 0;
      M[o + 12] = -18 + 0.1 * (3 * bi + 1);
      M[o + 13] = -18 + 0.1 * (3 * bj + 1);
      M[o + 14] = 0.1 * (3 * bk + 1);
      M[o + 15] = 1;
      m++;
    }
    mesh.count = m;
    mesh.instanceMatrix.clearUpdateRanges?.();
    mesh.instanceMatrix.addUpdateRange?.(0, m * 16);
    mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    uShow,
    material,
    setDay,
    get builtDay() {
      return builtDay;
    },
    get count() {
      return mesh ? mesh.count : 0;
    },
  };
}

// ---------------------------------------------------------------------------------------
// Per-code alpha on the engine's voxel material (see the header, points 1 and 2).
function patchStemAlpha(ctx, readStemOpacity) {
  const { THREE, palette } = ctx;
  const mat = ctx.voxels.material;
  const stem = new THREE.Color(palette.stemCell); // linear, as the engine's instance colours
  const prevCompile = mat.onBeforeCompile;
  const prevKey = Object.prototype.hasOwnProperty.call(mat, "customProgramCacheKey") ? mat.customProgramCacheKey : null;
  const uStemAlpha = {
    get value() {
      return readStemOpacity();
    },
  };
  const uStemColor = { value: new THREE.Vector3(stem.r, stem.g, stem.b) };
  mat.onBeforeCompile = function (sh, renderer) {
    if (typeof prevCompile === "function") prevCompile.call(this, sh, renderer);
    sh.uniforms.uSgStemAlpha = uStemAlpha;
    sh.uniforms.uSgStemColor = uStemColor;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uSgStemColor;\nvarying float vSgStem;")
      .replace(
        "#include <color_vertex>",
        `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          // 1 for a stem-cell block, falling to 0 within the first ~10 % of a colour crossfade
          vSgStem = 1.0 - smoothstep(0.02, 0.08, distance(instanceColor.rgb, uSgStemColor));
        #else
          vSgStem = 0.0;
        #endif`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uSgStemAlpha;\nvarying float vSgStem;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= mix(1.0, uSgStemAlpha, vSgStem);");
  };
  mat.customProgramCacheKey = function () {
    return `${prevKey ? prevKey.call(this) : ""}|sg-b3-stem-alpha`;
  };
  mat.needsUpdate = true;
}

// ---------------------------------------------------------------------------------------
// Stem cells cast less shadow as they fade (see the header, point 3): a vertex scale on the
// voxel mesh's shadow depth material for instances of the stem-cell colour.
function stemShadowPatch(uCast, stemVec) {
  return (sh) => {
    sh.uniforms.uSgB3StemCast = uCast;
    sh.uniforms.uSgB3StemColorD = { value: stemVec };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uSgB3StemCast;\nuniform vec3 uSgB3StemColorD;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING_COLOR
          transformed *= mix(1.0, uSgB3StemCast, 1.0 - smoothstep(0.02, 0.08, distance(instanceColor.rgb, uSgB3StemColorD)));
        #endif`,
      );
  };
}
// Chain a patch once onto a material that may already carry one (b2's depth material).
function chainOnce(mat, patch, keyTag) {
  if (mat.userData.sgB3StemShadow) return;
  mat.userData.sgB3StemShadow = true;
  const prevCompile = mat.onBeforeCompile;
  const prevKey = Object.prototype.hasOwnProperty.call(mat, "customProgramCacheKey") ? mat.customProgramCacheKey : null;
  mat.onBeforeCompile = function (sh, renderer) {
    if (typeof prevCompile === "function") prevCompile.call(this, sh, renderer);
    patch(sh);
  };
  mat.customProgramCacheKey = function () {
    return `${prevKey ? prevKey.call(this) : ""}|${keyTag}`;
  };
  mat.needsUpdate = true;
}

const beat = {
  id: "b3",
  start: START,
  end: END,
  camera: [K_IN, K_OUT_1, K_WIDE_A, K_WIDE_B, K_IN_1, K_OUT],

  async build(ctx) {
    const { util } = ctx;
    // state.stemOpacity of the frame being drawn (read at render time, after every beat ran)
    const readStemOpacity = () => {
      const v = ctx.state ? ctx.state.stemOpacity : undefined;
      return typeof v === "number" ? util.clamp(v) : 1;
    };
    patchStemAlpha(ctx, readStemOpacity);

    // Stem-cell shadows (header, point 3): 1 = full cubes at stemOpacity 1, 0 at the end value.
    const { THREE, palette } = ctx;
    const stemLin = new THREE.Color(palette.stemCell); // linear, as the engine's instance colours
    const uCast = {
      get value() {
        return util.clamp((readStemOpacity() - STEM_OPACITY_END) / (1 - STEM_OPACITY_END));
      },
    };
    const shadowPatch = stemShadowPatch(uCast, new THREE.Vector3(stemLin.r, stemLin.g, stemLin.b));
    let ownDepth = null;
    // b2 assigns the voxel mesh's depth material in its update (and the engine may regrow the
    // mesh), so the patch is attached at render time: scene.onBeforeRender runs inside
    // renderer.render before the shadow map is drawn. Idempotent.
    const attachShadowPatch = () => {
      const vm = ctx.voxels && ctx.voxels.mesh;
      if (!vm) return;
      if (vm.customDepthMaterial) {
        chainOnce(vm.customDepthMaterial, shadowPatch, "sg-b3-stem-shadow");
      } else {
        if (!ownDepth) {
          ownDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
          chainOnce(ownDepth, shadowPatch, "sg-b3-stem-shadow");
        }
        vm.customDepthMaterial = ownDepth;
      }
    };
    const prevHook = ctx.scene.onBeforeRender;
    ctx.scene.onBeforeRender = function (...args) {
      if (typeof prevHook === "function") prevHook.apply(this, args);
      attachShadowPatch();
    };

    const bone = makeBoneVoxels(ctx);
    // The bone overlay draws only when the frame's state matches what it was built for.
    Object.defineProperty(bone.uShow, "value", {
      get() {
        const s = ctx.state;
        if (!s) return 0;
        if (readStemOpacity() >= 0.999) return 0;
        if (!(s.voxelOpacity > 0.001) || !(s.half > 0)) return 0;
        if (Math.abs((s.day ?? 0) - bone.builtDay) > 1e-3) return 0;
        return 1;
      },
    });
    // the macro clip box of the cell stops cuts the overlay with the engine's voxels
    if (ctx.macroMaterials) ctx.macroMaterials.add(bone.material);
    // warm the day-357 merge inside the build promise (the heaviest one)
    bone.setDay(DAY_END);
    this._b3 = { bone };
    ctx.shared.b3 = { STEM_OPACITY_END, stemOpacityAt: (t) => stemOpacityAt(t, util), dayAt, bone };
  },

  update(t, ctx) {
    const B = this._b3;
    const { util } = ctx;
    const inWindow = t >= START && t < END;

    // Bone overlay: before the window never; in the window while the stem cells fade;
    // after it at day 357, gated at render time by the state (see uShow).
    if (B) {
      if (t < START) {
        B.bone.group.visible = false;
      } else if (inWindow) {
        const show = stemOpacityAt(t, util) < 0.999;
        B.bone.group.visible = show;
        if (show) B.bone.setDay(dayAt(t));
      } else {
        // after the window: the film's day (120 -> 357 over the stops c2 and c3, then 357),
        // the same value the later beats write to state.day
        B.bone.group.visible = true;
        B.bone.setDay(dayAt(t));
      }
    }

    if (!inWindow) return;
    const s = ctx.state;
    s.half = 1;
    s.day = dayAt(t);
    const stem = stemOpacityAt(t, util);
    s.stemOpacity = stem;
    // the engine makes the voxel material transparent below 0.999 (needed for the stem alpha)
    s.voxelOpacity = stem < 0.999 ? 0.998 : 1;  },
};

export default beat;
export { dayAt, stemOpacityAt, STEM_OPACITY_END, START, END };
