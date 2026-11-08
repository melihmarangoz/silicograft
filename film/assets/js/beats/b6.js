// Beat b6 "Strain picks the next cell" (frames 1380-1559, 46-52 s, day 357, then the return arc).
//
// Pass 3 (SPEC P3-1): the pass-2 beat played 16 s later (SHIFT); every absolute time is the
// pass-2 time + 16 s. The last frame (52 s) rhymes with b2's first frame (6 s). Frame numbers
// in the comments are pass-2 frames (+480 for pass 3).
//
// Pass 2 (SPEC P2-2, P2-6, P2-7). The one hero move: a pull back from b5's face-on view of the
// strain map (magma) to a wide horizontal frame that holds the half callus (plate on top) and
// the decision plane BELOW it, then a glide back into the gap to b2's first key, so the last
// frame rhymes with b2's first frame. The decision plane leaves the frame through its bottom
// edge on that glide; the azure return arc leads the eye from it up into the stem cells.
//
// What is drawn (all from the run's data, nothing freehand except the plane axes and the arc):
// - The decision plane: x = log |minimum principal strain| from 0.0001 % to 30 %, y = symmetric
//   log hydrostatic pressure from -1 to 1 MPa (linear within +-0.0001 MPa, linscale 0.6, the
//   transform of site_stages.py). The region fills are the Read_stimulus.cpp rule (thresholds
//   from manifest.codes.stimulus_thresholds, first match wins) evaluated per pixel, 20 % of the
//   pass-2 tissue colour (pass 3, P3-3: 14 % read faint); the region rectangles are outlined
//   1 px ink at 40 %; the axes (left
//   and bottom, decade ticks, no labels) are ink. The plane's basis is the camera's own screen
//   basis (right, up, back, roll included) at T_BASIS, so its x axis is horizontal and its y
//   axis vertical on screen whatever the roll; it is fixed in the scene (no billboard), so the
//   camera's small turn around it reads as parallax.
// - Points: all 24,698 callus elements of the day-357 solve (elem_strain_357, elem_hp_357,
//   classed by elem_class_357). Each starts on the cut face (its centroid projected onto the
//   plane scene x = 0) in its own strain colour (magma, the face's map), lifts 3 mm along the
//   face normal (-x) over 20 frames while it turns to its region colour, then flies 50 frames
//   along a quadratic arc that bows 15 % of its chord towards the camera (power3.inOut) to its
//   chart position. Starts are staggered over 30 frames by hashId(element). Elements outside the
//   chart range sit on the chart edge, as in the stage-6 image.
// - Then the strain face dissolves (cutOpacity 1 -> 0, 30 frames power1.inOut) into the day-357
//   voxels right behind it, so the cut shows its tissue again: mostly the amber stem cells with
//   the ivory bone along the plate.
// - The return arc: a 3 px azure (#6bcbf7, the film's only azure) curve from the centre of
//   the bone points on the chart (median chart position of the class-2 elements) back to the
//   stem cell layer (the day-357 stem cell block on the cut nearest to b2's close-up target),
//   drawn over 36 frames.
//
// Pure function of t: every object is set from t alone on every call. The plane basis and the
// bow target come from the director's camera at fixed times (constant, computed in build).

import { makeDirector, cameraBasis } from "../director.js";

// ---------------------------------------------------------------------------------------
// Camera. K_IN and K_OUT are boundary keys of the contract (ENGINE.md, "Pass 2 boundary keys"):
// keep them exactly. The inner keys are given by azimuth (about scene y, from -x towards +z),
// elevation (towards +y) and distance about the target, like the planner's candidates.
const SHIFT = 16; // pass 3: the pass-2 beat, 16 s later (timeline.js SHIFT_B456)
const K_IN = { t: 30.0 + SHIFT, pos: [-77.893, -4.082, -3], target: [0, 0, -3], fov: 28 }; // = b5's last key
const K_OUT = { t: 36.0 + SHIFT, pos: [-58.04, -1.31, 23.95], target: [0, 12, 0.5], fov: 28 }; // = b2's first key
function orbitKey(t, target, azDeg, elDeg, dist, extra = {}) {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  const c = Math.cos(el);
  const u = [-c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
  const pos = target.map((v, i) => Math.round((v + u[i] * dist) * 1000) / 1000);
  return { t, pos, target, fov: 28, ...extra };
}
// Wide: the callus and the plane under it while the points fly (QA frame 1000 = 33.33 s).
const K_WIDE = orbitKey(33.0 + SHIFT, [0, -1, -16.5], 6, -5, 129);
// Settled: a slow drift in while the last points land and the face turns back to tissue.
const K_SETTLE = orbitKey(34.5 + SHIFT, [0, 2, -16], 8, -6, 133);
// Approach: the target rises to the gap before the push in ends, so the frame fills with the
// bone and the callus while the plane leaves through the bottom edge.
const K_APPROACH = orbitKey(35.3 + SHIFT, [0, 9.5, -1.5], 17, -10, 80);
export const CAMERA = [K_IN, K_WIDE, K_SETTLE, K_APPROACH, K_OUT];

// ---------------------------------------------------------------------------------------
// Timing (seconds).
const F = (n) => n / 30;
const START = 30 + SHIFT;
const END = 36 + SHIFT;
const PLANE_IN = 30.4 + SHIFT; // the plane enters (18 frames power2.out) as the pull back begins
const LIFT_START = 31.0 + SHIFT; // the first points leave the cut face (frame 930)
const STAGGER = F(30);
const LIFT = F(20);
const FLY = F(50);
const BOW_T = LIFT_START + STAGGER / 2 + LIFT + FLY / 2; // camera at mid-flight: the bow target
const DISSOLVE_IN = 34.45 + SHIFT; // the strain face dissolves into the voxels (30 frames power1.inOut)
const DISSOLVE_DUR = F(30);
const ARC_IN = 34.4 + SHIFT; // the return arc is drawn over 36 frames, complete at 35.6 s (frame 1068)
const ARC_DUR = F(36);

// ---------------------------------------------------------------------------------------
// Decision plane geometry (scene mm). The basis is the camera's screen basis at T_BASIS; the
// centre sits under the callus (screen down = scene -z in the horizontal frame) and a little
// towards the camera, so the chart reads large without crowding the callus.
const T_BASIS = 33.6 + SHIFT;
const PLANE_CENTRE = [-20, -2.5, -28.8];
const PLANE_W = 60;
const PLANE_H = 21;
const POINT_LIFT = 3.0; // mm along the cut face normal
const POINT_SIZE = 0.25; // mm (sprite diameter)
const POINT_ON_PLANE = 0.15; // mm in front of the plane
const ARC_WIDTH_PX = 3; // at 1080p (pass 3, P3-3)
const FILL_ALPHA = 0.2; // region fills (P3-3: 14-20 %)
const EDGE_ALPHA = 0.4; // region outlines, 1 px ink
const ARC_SEGMENTS = 160;
// Where the return arc lands: the stem cell layer in the gap just distal of the proximal bone
// end face (scene y = 15), near the centre of b2's first frame (its target is [0, 12, 0.5]).
// The block must lie in the gap (scene y < STEM_LAYER_YMAX), where no bone cut face covers it.
const STEM_LAYER_HINT = [0, 12.8, 0];
const STEM_LAYER_YMAX = 14.4;

// The plane's frame for a director `at(t)` (pure; also used by the camera planner).
export function planeFrame(at) {
  const k = at(T_BASIS);
  const B = cameraBasis(k.pos, k.target, k.roll);
  return { centre: PLANE_CENTRE.slice(), right: B.right, up: B.up, normal: B.back, width: PLANE_W, height: PLANE_H };
}
// Its four corners in scene mm (counter-clockwise from bottom left).
export function planeCorners(at) {
  const f = planeFrame(at);
  const p = (u, v) => [0, 1, 2].map((i) => f.centre[i] + f.right[i] * u * (PLANE_W / 2) + f.up[i] * v * (PLANE_H / 2));
  return [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)];
}

// Axes of the chart (site_stages.py decision_plane): x log10 |eps| in [1e-6, 0.3]; y symlog
// HP with linthresh 1e-4 MPa, linscale 0.6, base 10, limited to +-1 MPa (SPEC).
const X0 = 1e-6;
const X1 = 0.3;
const LT = 1e-4;
const LINSCALE_ADJ = 0.6 / (1 - 1 / 10);
const Y1 = 1.0;
const symlog = (y) => {
  const a = Math.abs(y);
  return a <= LT ? (y / LT) * LINSCALE_ADJ : Math.sign(y) * (Math.log10(a / LT) + LINSCALE_ADJ);
};
const YMAX = symlog(Y1);
const LX0 = Math.log10(X0);
const LXR = Math.log10(X1) - LX0;
// Chart coordinates in [0, 1]^2 (clipped to the chart, as the stage-6 image clips).
const chartU = (eps) => Math.min(1, Math.max(0, (Math.log10(Math.max(Math.abs(eps), 1e-30)) - LX0) / LXR));
const chartV = (hp) => Math.min(1, Math.max(0, (symlog(Math.min(Y1, Math.max(-Y1, hp))) / YMAX + 1) / 2));

// Pass 2 (SPEC P2-2): region colours = the tissue palette; resorption = palette.resorption.
const regionHex = (palette) => ({ 1: palette.resorption, 2: palette.bone, 4: palette.cartilage, 5: palette.fibrous });

// ---------------------------------------------------------------------------------------
let plane = null; // { group, fill, edges, axes, toScene(u, v, lift), right, up, normal, centre }
let points = null; // THREE.Points
let arc = null; // THREE.Mesh (screen-space ribbon)
let bowCam = null; // the camera position at BOW_T (constant)

function makePlane(ctx, thr, frame) {
  const { THREE, palette } = ctx;
  const right = new THREE.Vector3().fromArray(frame.right);
  const up = new THREE.Vector3().fromArray(frame.up);
  const n = new THREE.Vector3().fromArray(frame.normal); // towards the camera at T_BASIS
  const centre = new THREE.Vector3().fromArray(frame.centre);
  const group = new THREE.Group();
  group.name = "b6_plane";
  // Local frame: x = screen right, y = screen up, z = towards the camera; chart (u, v) ->
  // local ((u - .5) W, (v - .5) H, 0).
  group.matrixAutoUpdate = false;
  group.matrix.makeBasis(right, up, n).setPosition(centre);
  group.matrixWorldNeedsUpdate = true;
  const local = (u, v, z = 0) => [(u - 0.5) * PLANE_W, (v - 0.5) * PLANE_H, z];
  const base = group.matrix.clone();
  const toScene = (u, v, lift = 0, out = new THREE.Vector3()) => out.fromArray(local(u, v, lift)).applyMatrix4(base);

  // Region fills: Read_stimulus.cpp evaluated per fragment from the chart coordinates.
  const hex = regionHex(palette);
  const col = (k) => new THREE.Color(hex[k]); // linear working colour
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(PLANE_W, PLANE_H),
    new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uFill: { value: FILL_ALPHA },
        uRes: { value: col(1) },
        uBone: { value: col(2) },
        uCart: { value: col(4) },
        uFib: { value: col(5) },
        uThr: { value: new THREE.Vector4(thr.res_hp, thr.res_ep, thr.bone_hp, thr.bone_ep) },
        uCartThr: { value: new THREE.Vector2(thr.cart_hp, thr.cart_ep) },
        uAxis: { value: new THREE.Vector4(LX0, LXR, YMAX, LINSCALE_ADJ) },
        uLT: { value: LT },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity, uFill, uLT;
        uniform vec3 uRes, uBone, uCart, uFib;
        uniform vec4 uThr, uAxis;
        uniform vec2 uCartThr;
        varying vec2 vUv;
        void main() {
          float a = pow(10.0, uAxis.x + vUv.x * uAxis.y);           // |min principal strain|
          float ys = (2.0 * vUv.y - 1.0) * uAxis.z;                   // symlog coordinate
          float hp = abs(ys) <= uAxis.w ? ys / uAxis.w * uLT : sign(ys) * uLT * pow(10.0, abs(ys) - uAxis.w);
          vec3 c = uFib;                                               // 5 fibrous (otherwise)
          if (hp < -uCartThr.x && a < uCartThr.y) c = uCart;          // 4 cartilage (original sign)
          if (abs(hp) < uThr.z && a < uThr.w) c = uBone;              // 2 bone
          if (abs(hp) < uThr.x && a < uThr.y) c = uRes;               // 1 resorption
          gl_FragColor = vec4(c, uFill * uOpacity);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  fill.matrixAutoUpdate = false;
  fill.renderOrder = 2;
  group.add(fill);

  // Region rectangles (Read_stimulus.cpp thresholds), outlined 1 px ink at EDGE_ALPHA.
  const segs = [];
  const seg = (u0, v0, u1, v1) => segs.push(...local(u0, v0, 0.05), ...local(u1, v1, 0.05));
  const rect = (e0, e1, h0, h1) => {
    const [u0, u1, v0, v1] = [chartU(e0), chartU(e1), chartV(h0), chartV(h1)];
    seg(u0, v0, u1, v0);
    seg(u1, v0, u1, v1);
    seg(u1, v1, u0, v1);
    seg(u0, v1, u0, v0);
  };
  rect(X0, thr.res_ep, -thr.res_hp, thr.res_hp); // resorption
  rect(X0, thr.bone_ep, -thr.bone_hp, thr.bone_hp); // bone
  rect(X0, thr.cart_ep, -Y1, -thr.cart_hp); // cartilage (HP < -0.15 MPa, |eps| < 15 %)
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
  const edges = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ color: palette.ink, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }),
  );
  edges.matrixAutoUpdate = false;
  edges.renderOrder = 3;
  group.add(edges);

  // Axes: left (strain floor) and bottom (HP = -1 MPa) in ink, decade ticks outward, no labels.
  const ax = [];
  const aseg = (p, q) => ax.push(...p, ...q);
  const TICK = 0.8;
  aseg(local(0, 0, 0.05), local(1, 0, 0.05));
  aseg(local(0, 0, 0.05), local(0, 1, 0.05));
  for (let d = Math.ceil(LX0); d <= Math.floor(Math.log10(X1)); d++) {
    const u = chartU(Math.pow(10, d));
    const p = local(u, 0, 0.05);
    aseg(p, [p[0], p[1] - TICK, p[2]]);
  }
  for (const y of [-1, -0.1, -0.01, -0.001, -LT, 0, LT, 0.001, 0.01, 0.1, 1]) {
    const p = local(0, chartV(y), 0.05);
    aseg(p, [p[0] - TICK, p[1], p[2]]);
  }
  const axGeo = new THREE.BufferGeometry();
  axGeo.setAttribute("position", new THREE.Float32BufferAttribute(ax, 3));
  const axes = new THREE.LineSegments(
    axGeo,
    new THREE.LineBasicMaterial({ color: palette.ink, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }),
  );
  axes.matrixAutoUpdate = false;
  axes.renderOrder = 3;
  group.add(axes);

  group.visible = false;
  return { group, fill, edges, axes, toScene, normal: n, right, up, centre };
}

function makePoints(ctx) {
  const { THREE, data, util, palette } = ctx;
  const el = data.elem;
  const N = el.n;
  const hex = regionHex(palette);
  const start = new Float32Array(N * 3);
  const end = new Float32Array(N * 3);
  const colour = new Float32Array(N * 3);
  const colour0 = new Float32Array(N * 3);
  const delay = new Float32Array(N);
  const c = el.centroid;
  const v = new THREE.Vector3();
  const tmp = new THREE.Color();
  const boneU = [];
  const boneV = [];
  for (let i = 0; i < N; i++) {
    // Centroid (model frame) -> scene, projected onto the cut plane (scene x = 0).
    util.toScene([c[3 * i], c[3 * i + 1], c[3 * i + 2]], v);
    start[3 * i] = -0.02;
    start[3 * i + 1] = v.y;
    start[3 * i + 2] = v.z;
    const u = chartU(el.strain357[i]);
    const w = chartV(el.hp357[i]);
    plane.toScene(u, w, POINT_ON_PLANE, v);
    end[3 * i] = v.x;
    end[3 * i + 1] = v.y;
    end[3 * i + 2] = v.z;
    const k = el.class357[i];
    tmp.set(hex[k] || hex[5]); // linear working colour
    colour[3 * i] = tmp.r;
    colour[3 * i + 1] = tmp.g;
    colour[3 * i + 2] = tmp.b;
    // Start colour: the element's own strain on the face's map (magma 0.15..1, linear).
    util.magma(util.logStrain(el.strain357[i]), tmp);
    colour0[3 * i] = tmp.r;
    colour0[3 * i + 1] = tmp.g;
    colour0[3 * i + 2] = tmp.b;
    delay[i] = util.hashId(i, 0xb6) * STAGGER;
    if (k === 2) {
      boneU.push(u);
      boneV.push(w);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(start, 3));
  geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colour, 3));
  geo.setAttribute("aColor0", new THREE.BufferAttribute(colour0, 3));
  geo.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(-8, 0, -18), 90);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: -1 }, // seconds since LIFT_START
      uLift: { value: new THREE.Vector3(-POINT_LIFT, 0, 0) },
      uCam: { value: new THREE.Vector3(-100, 0, 0) },
      uDur: { value: new THREE.Vector3(LIFT, FLY, F(18)) },
      uPx: { value: 1000 }, // pixels per mm at 1 mm depth
      uSize: { value: POINT_SIZE },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aEnd;
      attribute vec3 aColor;
      attribute vec3 aColor0;
      attribute float aDelay;
      uniform float uT, uPx, uSize;
      uniform vec3 uLift, uCam, uDur;
      varying vec3 vColor;
      float p2out(float x) { return 1.0 - pow(1.0 - x, 3.0); }
      float p3inOut(float x) { return x < 0.5 ? 8.0 * x * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 4.0) / 2.0; }
      void main() {
        float tau = uT - aDelay;
        if (tau < 0.0) { vColor = aColor0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        float lift = p2out(clamp(tau / uDur.x, 0.0, 1.0));
        float s = p3inOut(clamp((tau - uDur.x) / uDur.y, 0.0, 1.0));
        float grow = p2out(clamp(tau / uDur.z, 0.0, 1.0));
        // Strain colour on the face, region colour once lifted (the strain picks the tissue).
        vColor = mix(aColor0, aColor, smoothstep(0.15, 1.0, lift));
        vec3 a = position + uLift * lift;
        vec3 b = aEnd;
        vec3 m = 0.5 * (a + b);
        // Quadratic arc whose midpoint bows 15 % of the chord towards the camera (control point
        // offset 0.30 chord: a quadratic reaches half its control offset at s = 0.5).
        vec3 ctrl = m + normalize(uCam - m) * 0.30 * length(b - a);
        vec3 p = mix(mix(a, ctrl, s), mix(ctrl, b, s), s);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(uSize * uPx / -mv.z, 1.0) * grow;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        if (dot(c, c) > 1.0) discard;
        gl_FragColor = vec4(vColor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = "b6_points";
  pts.frustumCulled = false;
  pts.visible = false;
  boneU.sort((x, y) => x - y);
  boneV.sort((x, y) => x - y);
  const med = (a) => a[a.length >> 1];
  return { pts, boneCentre: [med(boneU), med(boneV)] };
}

// The day-357 stem cell block on the cut face (bi = 59, just behind scene x = 0) in the gap
// nearest to STEM_LAYER_HINT, in scene mm (just in front of the cut face).
function stemLayerPoint(ctx) {
  const { data, util } = ctx;
  const vox = data.vox;
  const di = vox.days.indexOf(357);
  const d = vox.day(di >= 0 ? di : vox.days.length - 1);
  const [, NJ, NK] = vox.grid;
  const hint = util.toModel(STEM_LAYER_HINT);
  let best = null;
  let bestD = Infinity;
  for (let n = 0; n < d.count; n++) {
    if (d.code[n] !== 1) continue;
    const b = d.block[n];
    const bi = Math.floor(b / (NJ * NK));
    if (bi !== 59) continue;
    const bj = Math.floor(b / NK) % NJ;
    const bk = b % NK;
    const my = -18 + 0.1 * (3 * bj + 1);
    const mz = 0.1 * (3 * bk + 1);
    if (mz - 20 >= STEM_LAYER_YMAX) continue; // scene y = model z - 20: keep to the gap
    const dd = (my - hint.y) ** 2 + (mz - hint.z) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = [my, mz];
    }
  }
  if (!best) return STEM_LAYER_HINT.slice();
  const s = util.toScene([-0.05, best[0], best[1]]);
  return [-0.1, s.y, s.z];
}

// A curve drawn as a screen-space ribbon of constant pixel width (WebGL lines are 1 px).
function makeArc(ctx, P) {
  const { THREE, palette } = ctx;
  const n = P.length;
  // Arc length parameter.
  const len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + P[i].distanceTo(P[i - 1]));
  const L = len[n - 1];
  const pos = [];
  const prev = [];
  const next = [];
  const side = [];
  const sArr = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(n - 1, i + 1)];
    for (const sd of [-1, 1]) {
      pos.push(P[i].x, P[i].y, P[i].z);
      prev.push(a.x, a.y, a.z);
      next.push(b.x, b.y, b.z);
      side.push(sd);
      sArr.push(len[i] / L);
    }
  }
  const index = [];
  for (let i = 0; i < n - 1; i++) {
    const k = 2 * i;
    index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aPrev", new THREE.Float32BufferAttribute(prev, 3));
  geo.setAttribute("aNext", new THREE.Float32BufferAttribute(next, 3));
  geo.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  geo.setAttribute("aS", new THREE.Float32BufferAttribute(sArr, 1));
  geo.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(palette.accent) },
      uProgress: { value: 0 },
      uHalf: { value: ARC_WIDTH_PX / 2 },
      uRes: { value: new THREE.Vector2(1920, 1080) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aPrev, aNext;
      attribute float aSide, aS;
      uniform float uHalf;
      uniform vec2 uRes;
      varying float vS, vPx;
      vec2 scr(vec4 c) { return c.xy / c.w * 0.5 * uRes; }
      void main() {
        mat4 pmv = projectionMatrix * modelViewMatrix;
        vec4 c = pmv * vec4(position, 1.0);
        vec2 d = scr(pmv * vec4(aNext, 1.0)) - scr(pmv * vec4(aPrev, 1.0));
        d = length(d) > 1e-6 ? normalize(d) : vec2(1.0, 0.0);
        vec2 nrm = vec2(-d.y, d.x);
        float w = uHalf + 1.0; // one pixel of feather
        c.xy += nrm * aSide * w / (0.5 * uRes) * c.w;
        gl_Position = c;
        vS = aS;
        vPx = aSide * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uProgress, uHalf;
      varying float vS, vPx;
      void main() {
        if (vS > uProgress) discard;
        float a = clamp(uHalf + 0.5 - abs(vPx), 0.0, 1.0);
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide, // the ribbon's winding depends on the screen direction of the curve
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "b6_return_arc";
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.visible = false;
  return mesh;
}

export default {
  id: "b6",
  start: START,
  end: END,
  camera: CAMERA,
  async build(ctx) {
    const { THREE } = ctx;
    const thr = ctx.data.manifest.codes.stimulus_thresholds;
    // The engine builds its director after the beats; the keys are static, so an identical
    // director from the same beats gives the camera at T_BASIS and BOW_T now.
    const at = makeDirector(ctx.beats || [this]).at;
    plane = makePlane(ctx, thr, planeFrame(at));
    ctx.scene.add(plane.group);
    bowCam = at(BOW_T).pos.slice();
    const p = makePoints(ctx);
    points = p.pts;
    points.material.uniforms.uCam.value.fromArray(bowCam);
    ctx.scene.add(points);

    // Return arc: a cubic Bezier from the centre of the bone points (just in front of the
    // chart) up out of the chart towards the camera, over the bone's lower edge, and in onto the
    // stem cell layer of the cut face from the camera side.
    const A = plane.toScene(p.boneCentre[0], p.boneCentre[1], 0.4);
    const B = new THREE.Vector3().fromArray(stemLayerPoint(ctx));
    const P1 = A.clone().addScaledVector(plane.normal, 10).addScaledVector(plane.up, 12);
    const P2 = B.clone().add(new THREE.Vector3(-10, 0, -6)); // in front of the cut face, from below
    const curve = new THREE.CubicBezierCurve3(A, P1, P2, B);
    arc = makeArc(ctx, curve.getPoints(ARC_SEGMENTS));
    ctx.scene.add(arc);
    ctx.shared.b6 = { arcStart: A.toArray(), arcEnd: B.toArray(), boneCentreUV: p.boneCentre, planeCorners: planeCorners(at) };
  },
  update(t, ctx) {
    const { util, THREE } = ctx;
    // The last beat also owns t = 52 exactly (no later beat; a seek to the film's end).
    const inWin = t >= this.start && t <= this.end;
    if (!plane) return;
    if (!inWin) {
      plane.group.visible = false;
      points.visible = false;
      arc.visible = false;
      return;
    }

    // Decision plane: enter (opacity and scale, 18 frames power2.out), stays to the end.
    const a = util.enterExit(t, PLANE_IN, END + 1);
    plane.group.visible = a > 0.001;
    if (plane.group.visible) {
      const sc = util.lerp(0.94, 1, a);
      const g = plane.group;
      g.matrix.makeBasis(plane.right, plane.up, plane.normal).scale(new THREE.Vector3(sc, sc, 1)).setPosition(plane.centre);
      g.matrixWorldNeedsUpdate = true;
      plane.fill.material.uniforms.uOpacity.value = a;
      plane.edges.material.opacity = EDGE_ALPHA * a;
      plane.axes.material.opacity = 0.9 * a;
    }

    // Points.
    const tp = t - LIFT_START;
    points.visible = tp >= 0;
    if (points.visible) {
      const u = points.material.uniforms;
      u.uT.value = tp;
      u.uPx.value = 1080 / (2 * Math.tan((ctx.camera.fov * Math.PI) / 360));
    }

    // Return arc.
    const pr = util.tween(t, ARC_IN, ARC_DUR, "power2.inOut");
    arc.visible = pr > 0;
    arc.material.uniforms.uProgress.value = pr;

    const s = ctx.state;
    s.half = 1;
    s.day = 357;
    // b5 ends with the voxels off: bring them back with the SPEC enter (18 f power2.out)
    // instead of popping them on at frame 900 (they sit behind the opaque strain face).
    // Integration (pass 2): the voxels keep b3's and b4's day-357 look (translucent stem cells
    // over b3's bone overlay, which needs voxelOpacity < 0.999), so the dissolve ends on the
    // same ivory-in-amber callus the viewer saw at 15-18 s instead of a solid amber mass.
    s.voxelOpacity = Math.min(0.998, util.tween(t, START, F(18), "power2.out"));
    const b3 = ctx.shared.b3;
    if (b3 && typeof b3.STEM_OPACITY_END === "number") s.stemOpacity = b3.STEM_OPACITY_END;
    // The strain face dissolves into the tissue voxels behind it once the points have landed.
    s.cutOpacity = 1 - util.tween(t, DISSOLVE_IN, DISSOLVE_DUR, "power1.inOut");
    s.hullOpacity = 0;
    s.eDayIndex = (ctx.data.feDays?.length ?? 118) - 1;
    s.fieldMode = "strain";
    s.fieldBlend = 1;
  },
};
