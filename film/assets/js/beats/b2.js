// Beat b2 "Cell stop 1: ilik_ucu" (frames 180-419, 6-14 s, simulated day 0 -> 30). Pass 3.
//
// SPEC P3-1 / P3-2: the film dives from the macro scene into the cell viewer's region
// `ilik_ucu` (the marrow-canal opening at the proximal bone end face, scene (0, 14.95, -0.05)),
// stays among the cells while the days run (stem cells divide in the marrow and fill the fibrin
// clot in front of it), and pulls back out into the macro view, which shows where the region sits
// in the callus. This is also the start of the website's hero loop (6.5-16.5 s).
//
// What the region holds (the run, ENGINE.md "Cell slabs"): MSCs only, 777 / 1423 / 2022 on days
// 0 / 9 / 30, in the marrow's seeded bands and growing into the clot; the clot gel (deep red in
// the marrow, pink in the callus) and its fibrin threads. No other cell type, no matrix and no
// cortex or plate inside the slab at days 0-30: nothing else is drawn in it.
//
// Scale hand-off, tissue -> cells -> tissue. All of it is a function of the director's camera
// distance d (ctx.cameraDistance, itself a pure function of t), so the way out mirrors the way in:
//  1. The slab fades in (and the macro clip box opens a window of its size on the cut face) from
//     d = 13 mm to 7.5 mm, and out the same way.
//  2. The engine's 0.3 mm voxel blocks dissolve around the slab: a vertex-shader scale patched
//     onto the engine's voxel material and onto the voxel mesh's shadow depth material shrinks
//     every block by its distance from the slab box (a front that moves outward as the camera
//     closes in) and then all of them (below 4 mm), so 0.3 mm cubes never sit beside 20 um cells.
//     Below 2.4 mm every block has scale 0 and the voxels are switched off (voxelOpacity 0), which
//     also keeps them out of the BokehPass depth (its override material does not carry the patch).
//  3. Behind the window, the marrow: the clip box is only as deep as the slab, and the marrow
//     solid is a closed shell, so through the window the camera would see the canal wall (cortex
//     grey) of the far side, beyond the box (the stub's grey sheet). This beat draws the marrow's
//     own section on the plane just behind the slab (scene x = 0.36, the marrow material, marrow
//     part y >= 15 only), i.e. the cut face moved back by the slab's thickness under the window.
//     Toward the gap (y < 15) nothing is drawn: there the dissolving voxels and then the ground.
//  4. Depth of field at the closest moment only (d < 2.4 mm, voxels off): focus on the camera
//     target (the cell layer where the marrow meets the clot), a fixed f-number look (the
//     aperture scales with 1 / focus).
//
// Schedule (seconds; day from timeline.js dayAt):
//   6.0        K_IN, the boundary key (= b1's last key, = b6's 52 s key): into the half-cut gap.
//   6.0-8.0    dive to the slab (64 -> 5.5 mm), window opens and the slab fades in 7.2-7.7 s.
//   8.0-9.6    closing in on the marrow opening (5.5 -> 2.4 mm), the blocks dissolve; the
//              elevation rises through 0 so the bone end face (a pale band at grazing light
//              from below) closes to a thin edge.
//   9.6-11.6   the close-up (1.8-2.4 mm, day 7 -> 17), depth of field from 9.7 to 11.5 s.
//   11.6-14.0  pull out to K_OUT (the boundary key, = b3's first key), the blocks regrow far to
//              near and the slab fades back into them (12.55-13.0 s), the window closes.
//
// State written in [6, 14): day (the film's track), half 1, voxelOpacity (1, or 0 while every
// block is shrunk away), cutOpacity 0, hullOpacity 0, macroClip, slab, dof (close-up only).
// Own objects (every t): the slab, the marrow backdrop, the voxel shrink uniforms (no-op values
// outside the window).

import { beat as timelineBeat, dayAt } from "../timeline.js";
import { pickLabels, labelFade } from "../labels.js";

const W = timelineBeat("b2");
const START = W.start; // 6
const END = W.end; // 14
const REGION = W.region; // 'ilik_ucu'
const DAYS = W.days; // [0, 30]

// Slab centre and extent in the scene (slab.js placement, ENGINE.md "Cell slabs"); the camera
// keys aim at it before the slab is built (the planner reads the keys without a browser).
const CENTRE = [0, 14.95, -0.05];
const SLAB_HALF = [0.25, 1.4, 1.4];
const BONE_END_Y = 15; // the proximal bone end face (marrow above, the clot below)

// Macro clip box (state.macroClip): the slab footprint plus 0.05 mm in y and z, from 0.3 mm in
// front of the cut plane to the marrow backdrop 0.36 mm behind it.
const BACK_X = 0.36;
const CLIP_X0 = -0.3;
const CLIP_CENTRE = [(CLIP_X0 + BACK_X) / 2, CENTRE[1], CENTRE[2]];
const CLIP_SIZE = [BACK_X - CLIP_X0, 2.9, 2.9];

// Hand-off distances (mm, camera to target).
const SLAB_FULL = 7.5; // slab and window fully in below this ...
const SLAB_NONE = 13; // ... gone above this
// Dissolve front: the radius (mm from the slab box) inside which blocks are gone, by distance,
// piecewise linear in log d; FRONT_W is the width of the shrinking band.
const FRONT = [
  [12, -1.2],
  [8, 0.6],
  [5.5, 2.4],
  [3.6, 4.5],
  [2.5, 10],
];
const FRONT_W = 1.2;
const SHAFT_DEPTH = 8; // pass 4: the shrink box runs this far behind the slab (scene +x, mm)
const ALL_OFF = 2.4; // every block at scale 0 below this (global shrink from ALL_ON)
const ALL_ON = 4.2;
// Depth of field (with the voxels off only).
const DOF_ON = 2.35; // ramps in below this ...
const DOF_FULL = 2.0; // ... full below this
const DOF_APERTURE_MM = 0.045; // aperture = DOF_APERTURE_MM / focus: a fixed f-number look
const DOF_MAXBLUR = 0.008;
// Cell-type label (pass 4, SPEC "PASS 4"): the run has only MSCs in this slab at days 0-30
// (slab.counts), so one label. It enters once every voxel block is gone (camera under 2.4 mm,
// 9.55 s) and leaves before the pull-out (out by 11.6 s, camera 2.5 mm). The cell is chosen by
// labels.js pickLabels; with this stop's strong depth of field (DOF_APERTURE_MM) it is the cell
// nearest the focal plane, in the clot just past the marrow opening.
const LABEL_SPECS = [{ id: "b2-msc", type: 0, text: "Mesenchymal stem cell", tIn: 9.55, tOut: 11.6, region: [700, 200, 1600, 900] }];

// ---------------------------------------------------------------------------------------
// Camera. K_IN and K_OUT are boundary keys of the contract (ENGINE.md, "Pass 3 boundary keys
// (contract)"): keep them exactly. Inner keys from a target and the view direction about it
// (azimuth about scene y from -x towards +z, elevation towards +y, distance), as in b1/b3.
function keyAt(t, target, azDeg, elDeg, dist, fov = 28) {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  const c = Math.cos(el);
  const u = [-c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
  return { t, target, pos: target.map((v, i) => Math.round((v + u[i] * dist) * 1e3) / 1e3), fov };
}
const K_IN = { t: 6, pos: [-58.04, -1.31, 23.95], target: [0, 12, 0.5], fov: 28 }; // = b1's 6 s key
const K_OUT = { t: 14, pos: [-31.911, -1.143, 6.956], target: [0, 13.5, -1], fov: 28 }; // = b3's 14 s key
const FOCUS = [0, 14.9, -0.05]; // the marrow opening's edge: cells leaving the marrow for the clot
const CAMERA = [
  K_IN,
  keyAt(7.0, [0, 14, 0.2], 22, -15, 18), // halfway in: the bone end and the gap
  keyAt(8.0, CENTRE, 24, -10, 5.5, 28), // the window: marrow left, clot right
  keyAt(9.0, FOCUS, 27, -3, 3.2, 27),
  keyAt(10.0, FOCUS, 30, 2, 2.0, 26), // the close-up
  keyAt(10.9, [0, 14.85, -0.1], 34, 3, 1.8, 26),
  keyAt(11.7, FOCUS, 31, -1, 2.6, 26),
  keyAt(12.5, [0, 14.6, -0.3], 27, -12, 6.5, 28), // pulling out
  keyAt(13.25, [0, 13.9, -0.7], 19, -20, 17, 28),
  K_OUT,
];

// ---------------------------------------------------------------------------------------
// Voxel shrink patch (hand-off point 2). Engine voxel instances are in the model frame: their
// translation is the block centre in model mm. scale = smoothstep(R, R + W, distance to the slab
// box) * G. Outside the window R = -1e3, G = 1: an exact no-op.
function shrinkPatch(U) {
  return (sh) => {
    sh.uniforms.uSgB2R = U.r;
    sh.uniforms.uSgB2W = U.w;
    sh.uniforms.uSgB2G = U.g;
    sh.uniforms.uSgB2Lo = U.lo;
    sh.uniforms.uSgB2Hi = U.hi;
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uSgB2R;\nuniform float uSgB2W;\nuniform float uSgB2G;\nuniform vec3 uSgB2Lo;\nuniform vec3 uSgB2Hi;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
        {
          vec3 sgC = instanceMatrix[3].xyz;
          vec3 sgQ = max(max(uSgB2Lo - sgC, sgC - uSgB2Hi), vec3(0.0));
          transformed *= smoothstep(uSgB2R, uSgB2R + uSgB2W, length(sgQ)) * uSgB2G;
        }
        #endif`,
      );
  };
}
function chainPatch(mat, patch, tag) {
  const prevCompile = mat.onBeforeCompile;
  const prevKey = Object.prototype.hasOwnProperty.call(mat, "customProgramCacheKey") ? mat.customProgramCacheKey : null;
  mat.onBeforeCompile = function (sh, renderer) {
    if (typeof prevCompile === "function") prevCompile.call(this, sh, renderer);
    patch(sh);
  };
  mat.customProgramCacheKey = function () {
    return `${prevKey ? prevKey.call(this) : ""}|${tag}`;
  };
  mat.needsUpdate = true;
}

// Piecewise linear in log(d) through FRONT (d descending), clamped at the ends.
function frontRadius(d) {
  const ld = Math.log(Math.max(d, 1e-4));
  if (d >= FRONT[0][0]) return FRONT[0][1];
  for (let i = 1; i < FRONT.length; i++) {
    const [d1, r1] = FRONT[i];
    if (d >= d1) {
      const [d0, r0] = FRONT[i - 1];
      const x = (Math.log(d0) - ld) / (Math.log(d0) - Math.log(d1));
      return r0 + (r1 - r0) * x;
    }
  }
  return FRONT[FRONT.length - 1][1];
}

const beat = {
  id: "b2",
  start: START,
  end: END,
  camera: CAMERA,
  region: REGION,
  _b2: null,

  async build(ctx) {
    const { THREE } = ctx;
    // slab.js imports three's MarchingCubes from the CDN: load it here, not at module top, so
    // the camera planner (node) can import this module for its keys.
    const { createSlab } = await import(new URL("../cells/slab.js", import.meta.url).href);
    const slab = await createSlab(ctx, REGION, { days: DAYS });
    slab.setVisible(false);
    slab.warm(ctx.renderer, ctx.camera);

    // Voxel shrink: the slab box in the model frame (the engine's voxel instance frame).
    // Pass 4: the box reaches SHAFT_DEPTH mm behind the slab (scene +x), so the blocks the
    // camera sees THROUGH the slab (the stem-cell layer at the bone end and the clot behind the
    // window, 0.4-8 mm deep) shrink with the front too; in pass 3 they stayed whole and stood
    // behind the cells as large amber blocks (7.6-8.5 and 12.0-12.8 s).
    const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
    const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < 8; i++) {
      const p = ctx.util.toModel([
        CENTRE[0] + (i & 1 ? SLAB_HALF[0] + SHAFT_DEPTH : -SLAB_HALF[0]),
        CENTRE[1] + (i & 2 ? 1 : -1) * SLAB_HALF[1],
        CENTRE[2] + (i & 4 ? 1 : -1) * SLAB_HALF[2],
      ]);
      lo.min(p);
      hi.max(p);
    }
    const U = { r: { value: -1e3 }, w: { value: 1 }, g: { value: 1 }, lo: { value: lo }, hi: { value: hi } };
    const patch = shrinkPatch(U);
    chainPatch(ctx.voxels.material, patch, "sg-b2-shrink");
    // The voxel mesh's shadow depth material (b3 chains its stem-cell shadow patch onto it).
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    chainPatch(depth, patch, "sg-b2-shrink-depth");

    // Marrow backdrop (hand-off point 3): the marrow's section on the plane x = BACK_X under the
    // window, in model coordinates (scene x = -model x, y = model z - 20, z = model y), facing the
    // camera side (model +x). It reaches 1.2 mm past the window in y and z (hidden behind the
    // marrow's cut face there) so oblique rays through the window's edges still land on it.
    const y0 = BONE_END_Y;
    const y1 = CENTRE[1] + SLAB_HALF[1] + 1.2;
    const z0 = CENTRE[2] - SLAB_HALF[2] - 1.2;
    const z1 = CENTRE[2] + SLAB_HALF[2] + 1.2;
    const g = new THREE.PlaneGeometry(z1 - z0, y1 - y0); // local x -> model y (scene z), local y -> model z (scene y)
    g.rotateY(Math.PI / 2); // normal +z -> +x; local x -> -z
    // after rotateY(90 deg): (x, y, z) -> (z, y, -x); map local (y, -x) to model (z, y)
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const ly = pos.getY(i); // along scene y
      const lz = -pos.getZ(i); // along scene z
      const sy = (y0 + y1) / 2 + ly;
      const sz = (z0 + z1) / 2 + lz;
      pos.setXYZ(i, -BACK_X, sz, sy + 20);
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const backMat = ctx.materials.marrow.clone();
    backMat.side = THREE.FrontSide;
    const back = new THREE.Mesh(g, backMat);
    back.name = "b2_marrow_backdrop";
    back.receiveShadow = true;
    back.castShadow = false;
    back.visible = false;
    ctx.model.add(back);

    // BokehPass depth (hand-off point 4): the pass draws the whole scene with one override depth
    // material, which turns the clot's gel sprites (Points) and fibrin threads (LineSegments) into
    // opaque squares and lines in the depth buffer, so the blur broke up into square patches.
    // Points and lines are left out of the depth render (they take the depth behind them); their
    // colour is unaffected (it comes from the RenderPass before). Applies to every DOF frame.
    const bokeh = ctx.bokeh;
    if (bokeh && !bokeh.userData?.sgSkipPointsInDepth) {
      bokeh.userData = bokeh.userData || {};
      bokeh.userData.sgSkipPointsInDepth = true;
      const render0 = bokeh.render;
      const hidden = [];
      bokeh.render = function (...args) {
        hidden.length = 0;
        ctx.scene.traverseVisible((o) => {
          if (o.isPoints || o.isLine) hidden.push(o);
        });
        for (const o of hidden) o.visible = false;
        try {
          return render0.apply(this, args);
        } finally {
          for (const o of hidden) o.visible = true;
          hidden.length = 0;
        }
      };
    }

    const labels = pickLabels(ctx, slab, LABEL_SPECS, { days: DAYS, dayAt });
    this._b2 = { slab, U, depth, back, labels };
    ctx.shared.b2 = { slab, region: REGION, days: DAYS, labels };
  },

  update(t, ctx) {
    const B = this._b2;
    const { util } = ctx;
    const inWin = t >= START && t < END;
    const d = ctx.cameraDistance;

    const slabOn = inWin ? util.ease["power1.inOut"](1 - util.smoothstep(SLAB_FULL, SLAB_NONE, d)) : 0;
    const radius = inWin ? frontRadius(d) : -1e3;
    const global = inWin ? util.smoothstep(ALL_OFF, ALL_ON, d) : 1;
    const voxOn = global > 1e-4;
    const dofAmt = inWin && !voxOn ? 1 - util.smoothstep(DOF_FULL, DOF_ON, d) : 0;

    // Own objects, for every t.
    if (B) {
      const { slab, U, depth, back } = B;
      U.r.value = radius;
      U.w.value = FRONT_W;
      U.g.value = global;
      const vm = ctx.voxels && ctx.voxels.mesh;
      if (vm && vm.customDepthMaterial !== depth) vm.customDepthMaterial = depth;
      const on = slabOn > 0.001;
      slab.setVisible(on);
      back.visible = on;
      if (on) {
        slab.setOpacity(slabOn);
        slab.setTime(t);
        slab.setDay(util.clamp(dayAt(t), DAYS[0], DAYS[1]), ctx.camera);
      }
    }

    if (!inWin) return;
    const s = ctx.state;
    s.day = dayAt(t);
    s.half = 1;
    s.voxelOpacity = voxOn ? 1 : 0;
    s.cutOpacity = 0;
    s.hullOpacity = 0;
    s.macroClip = slabOn > 0.001 ? { centre: CLIP_CENTRE, size: CLIP_SIZE, open: slabOn } : null;
    s.slab = slabOn > 0.001 ? { name: REGION, opacity: slabOn } : null;
    for (const L of B ? B.labels : []) {
      const f = labelFade(t, L.tIn, L.tOut, util);
      if (f.alpha > 0) ctx.labels.add({ id: L.id, text: L.text, anchor: L.anchor, offset: L.offset, ...f });
    }
    if (dofAmt > 0.001) {
      const focus = d;
      s.dof = { focus, aperture: (DOF_APERTURE_MM * dofAmt) / Math.max(focus, 0.25), maxblur: DOF_MAXBLUR };
    }
  },
};

export default beat;
export { CAMERA as b2CameraKeys, START, END };
