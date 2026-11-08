// Beat c3 "Cell stop 3: plak_alti" (frames 810-1019, 27-34 s, simulated day 220 -> 357). Pass 3.
//
// SPEC P3-1 / P3-2 / P3-4: from the proximal lobe the camera moves along the cut face to the
// plate's bone-facing side and dives into the cell viewer's region `plak_alti` (scene centre
// (0, 9.25, 7.75); the slab's plate strip at its +z edge meets the macro plate face z = 9). Among
// the cells the days run 220 -> 357: the bone band under the plate thickens (bone cells 404 ->
// 1346 in the slab), and from about day 325 (31.4 s on the film's day track) cartilage with
// chondrocytes in lacunae forms on the band's proximal side (24 at day 330, 179 at 340, 387 at
// 350; counted from roi_plak_alti.bin). The closest moment (30.9-31.9 s, days 312-335, 2.25-2.45
// mm) frames the bone/cartilage front under the plate: bone matrix with osteoblasts and
// osteocytes, MSCs in the clot beside it, the first chondrocytes appearing, the plate along the
// top, with a gentle depth of field. Backing off (32.0-32.5 s, days 337-345) shows the whole slab
// with the new cartilage strip (blue matrix, chondrocytes) between the plate and the bone. Then
// the camera pulls out to the three-quarter of the half callus that b4 orbits from (the 34 s
// boundary key), the slab fading back into the voxels.
//
// Where things sit in the slab (lattice data, mid layer i = 180; screen with the director's
// default roll: scene +y = proximal = screen left, +z = plate = screen top):
//   plate strip   z 9.0-9.1 across the whole width (the top edge)
//   bone band     a diagonal from under the plate (y 8.4-9.4 at z 8.5-8.9) down and to the left
//                 (y 9.5-10.4 at z 6.8-7.5)
//   cartilage     chondrocytes on the band's proximal (left) side, y 9.5-10.4, z 6.6-9.0
//   MSCs          everywhere else; the distal, low-z corner (screen lower right) is outside the
//                 callus mask, so the ground shows through it
//
// Schedule (seconds; day = timeline.js dayAt):
//   27.0       K_IN, the boundary key (= c2's last key, 44 mm), day 220.
//   27.0-28.7  dive along the cut face to the plate's underside, 44 -> 6 mm (the whole slab,
//              plate strip on top); the window (macro clip box) opens 27.6-28.4 s while the
//              slab fades in (camera 21 -> 8 mm), framed by the callus voxels.
//   29.0-29.6  the window widens into a deep shaft (see clipBox): the cells on the paper ground,
//              the macro plate above them; voxels switched off once it is fully open.
//   28.7-31.9  among the cells, 6 -> 2.25 mm, the target drifting to the bone/cartilage front
//              under the plate (FRONT); closest 30.9-31.9 s; depth of field below 3.6 mm.
//   31.9-34.0  pull out to K_OUT (the boundary key, = b4's first key, 86 mm): 4.9 mm at 32.4 s
//              (the cartilage strip); the shaft narrows back to the window 32.35-32.95 s, the
//              slab fades and the window closes 32.95-33.75 s (camera 16 -> 74 mm); day 357 at
//              rest at 34 s.
//
// State written in [27, 34): day (the film's track), half 1, voxelOpacity (0.998, 0 while the
// shaft is fully open) and stemOpacity 0.4 (b3's end look, which b4 continues), cutOpacity 0,
// hullOpacity 0, macroClip, slab, dof (closest moment only). Own objects: the slab (hidden
// outside the window).
//
// Pure function of t: every value is computed from t and the director's camera of this frame
// (itself a function of t); the slab's setDay is pure in (day, camera).
//
// Cost (SwiftShader 1920 x 1080 on a remote 16-thread machine, load 5-11, real engine, ms per frame):
// 28.7 s 2600, 29.3 s 2900 (slab + voxels + shadows), 29.8 s 1500, 30.5-31.8 s 1200-1300 (DOF,
// voxels off), 32.2 s 1650, 32.6 s 3050, 33.0 s 2100.

import { beat as timelineBeat, dayAt } from "../timeline.js";
import { pickLabels, labelFade } from "../labels.js";

const W = timelineBeat("c3");
const START = W.start; // 27
const END = W.end; // 34
const REGION = W.region; // 'plak_alti'
const DAYS = W.days; // [220, 357]

// Slab centre in the scene (slab.js placement, ENGINE.md "Cell slabs"); the camera keys aim at
// it before the slab is built (the keys are static: the planner reads them without a browser).
const CENTRE = [0, 9.25, 7.75];
// The bone/cartilage front under the plate (see the header): the close-up's target, on the cut
// plane, so the frame holds the cartilage (left), the bone band (centre right) and the plate
// strip with the macro plate (top).
const FRONT = [0, 9.7, 8.45];

// Macro clip box around the slab (state.macroClip, ENGINE.md "Macro clip box (pass 3)"), a
// shaft from 0.3 mm in front of the cut plane (CLIP_X0) to CLIP_X1 behind it. During the dive
// and the pull-out it is the slab's y-z footprint plus 0.05 mm (a window in the cut face the size
// of the slab, framed by the voxels). Among the cells it widens away from the plate (towards +-y
// and -z; its plate-side face stays just below the macro plate's face). Why: through the
// transparent slab the camera looks down the shaft, and with the oblique view and the wide lens
// (rays at the frame edge spread 0.5-0.75 mm per mm of depth) the slab-sized shaft let them hit
// its walls, so 0.3 mm voxel blocks (each the size of ten cells) and b3's opaque bone overlay
// stood behind the cells as white and amber walls (snapshots 29.8-32.4 s, first build). Fading
// the voxels out instead left b3's opaque overlay in place (it would pop off at voxelOpacity 0).
// The wide shaft, 19 mm deep and 22 mm wide (past the callus), leaves the cells on the paper
// ground as in the cell viewer, with the plate above them. The widening (pass 4: by camera
// distance, see GROW_FAR) reads as the window's edges sliding out of (and back into) the frame.
// Pass 4: a ground-coloured backdrop just behind the slab (createSlabBackdrop) hides the shaft's
// walls while the window is slab-sized, so the voxels frame the window but never show through
// the cells.
const CLIP_X0 = -0.3;
const CLIP_X1 = 18.7;
// The plate-side face just below the macro plate's bone-facing face (z 9): a box reaching above it
// (the stub's 9.2) clipped that face, and through the opened plate the camera saw voxels beside it.
const CLIP_Z1 = 8.98;
const FOOT = 1.45; // half the footprint (2.9 mm) in y and z
const GROW_Y_LO = 11.0; // extra mm towards -y (distal); pass 4: was 8 (a wider view cone at 6 mm)
const GROW_Y_HI = 11.0; // extra mm towards +y (proximal: the camera looks up the bone axis). Tried 4.2
// (stopping short of the bone end face at y 15): the callus voxels around the bone end then
// walled the left third of the frame.
const GROW_Z_LO = 8.0; // extra mm towards -z (away from the plate)
// Pass 4: the shaft grew on the clock at 29.0-29.6 s (camera 5.2 -> 4.2 mm), so from about
// 28.3 s the 0.3 mm callus blocks around the slab-sized window, large and blurry at 6-9 mm,
// stood in front of and behind the cells (the owner's note for c2; the same here). It now grows
// with the camera distance, from 6.0 to 4.4 mm (about 28.7-29.4 s), and shrinks back from 4.4
// to 6.0 mm on the way out (about 32.35-32.5 s). Earlier (10 -> 6.5 mm, first try) the slab
// floated small on an empty ground (58-67 % of the frame at 28.4-28.8 s).
const GROW_FAR = 6.0;
const GROW_NEAR = 4.4;
function growAt(t, util, dist) {
  return util.ease["power1.inOut"](1 - util.smoothstep(GROW_NEAR, GROW_FAR, dist));
}
function clipBox(t, open, util, dist) {
  const g = growAt(t, util, dist);
  const y0 = CENTRE[1] - FOOT - g * GROW_Y_LO;
  const y1 = CENTRE[1] + FOOT + g * GROW_Y_HI;
  const z0 = CENTRE[2] - FOOT - g * GROW_Z_LO;
  const z1 = CLIP_Z1;
  return {
    centre: [(CLIP_X0 + CLIP_X1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    size: [CLIP_X1 - CLIP_X0, y1 - y0, z1 - z0],
    open,
  };
}

// Timing (seconds).
const F = (n) => n / 30;
// Cell-type labels (pass 4, SPEC "PASS 4"): the types the run has in this slab on the label days
// (slab.counts), each on one real cell chosen by labels.js pickLabels. The close range is
// 30.1-32.3 s (camera at or under about 3.4 mm, then backing off to 4.9 mm at 32.4 s, where the
// cartilage strip reads). Chondrocytes exist only from day 325 (31.4 s) and fibroblasts from day
// 325 too (1-15 in the slab): their labels come last (31.75-32.55 s, days 331-347), and pickLabels
// drops either if the data has none on any day of its window or no cell of it stays put and in
// frame for the whole window. Everything is out by 32.4 s (camera 4.9 mm), as the box narrows
// and before the pull-out speeds up.
const LABEL_IN = 30.1;
const LABEL_OUT = 32.4;
const LATE_IN = 31.75; // day 331: from here enough chondrocytes stay put (23 to day 347)
const LATE_OUT = 32.55; // the new type stays 0.15 s longer (the box narrows from 32.35 s)
const LABEL_SPECS = [
  { id: "c3-osteoblast", type: 3, text: "Osteoblast", tIn: LABEL_IN, tOut: LABEL_OUT, region: [180, 180, 1740, 960] },
  { id: "c3-osteocyte", type: 4, text: "Osteocyte", tIn: LABEL_IN + 7 / 30, tOut: LABEL_OUT, region: [180, 180, 1740, 960] },
  { id: "c3-msc", type: 0, text: "Mesenchymal stem cell", tIn: LABEL_IN + 14 / 30, tOut: LABEL_OUT, region: [180, 180, 1740, 960] },
  { id: "c3-chondrocyte", type: 2, text: "Chondrocyte", tIn: LATE_IN, tOut: LATE_OUT, region: [180, 180, 1740, 960] },
  { id: "c3-fibroblast", type: 1, text: "Fibroblast", tIn: LATE_IN + 7 / 30, tOut: LATE_OUT, region: [180, 180, 1740, 960] },
];

const SLAB_IN = 27.6; // slab fades in and the window opens (24 frames power2.out), camera 21 -> 8 mm
const SLAB_IN_DUR = F(24);
const SLAB_OUT = 32.95; // slab fades out and the window closes (24 frames power2.in), camera 16 -> 74 mm
const SLAB_OUT_DUR = F(24);

// Depth of field at the closest moment (SPEC P3-2: focus on the cell layer). BokehPass blur (uv)
// = |depth - focus| * aperture, clamped to maxblur. The aperture scales with 1 / focus (a lens at
// a fixed f-number: the blur depends on the depth ratio). DOF_K = 0.012 keeps the slab's own
// depth (about +-0.6 mm at these angles) within 3-6 px, so cells of every type, the matrix and
// the plate strip stay readable, while the cut face and the voxels a few mm off the focal plane
// soften. Ramps in from DOF_FAR to DOF_NEAR (camera distance, mm).
const DOF_FAR = 3.6;
const DOF_NEAR = 2.6;
const DOF_K = 0.012;
const DOF_MAXBLUR = 0.008;

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
const K_IN = { t: 27, pos: [-40.697, -6.483, 2.846], target: [0, 10, 0], fov: 28 }; // = c2's 27 s key
const K_OUT = { t: 34, pos: [-77.836, -35.345, 2.079], target: [0, 1, -2], fov: 28 }; // = b4's 34 s key (pass-2 18 s)
const CAMERA = [
  K_IN,
  keyAt(27.8, [0, 9.6, 5.2], 9, -20, 16), // along the cut face to the plate's underside
  keyAt(28.7, CENTRE, 13, -18, 6.0, 30), // the whole slab, plate strip on top
  keyAt(29.8, [0, 9.4, 7.95], 14, -15, 3.9, 30), // among the cells, bone band and MSCs
  keyAt(30.7, [0, 9.55, 8.3], 12, -12, 2.7, 30), // closing on the front under the plate
  keyAt(31.3, FRONT, 10, -10, 2.25, 30), // closest: the bone band, the plate strip on top
  keyAt(31.8, FRONT, 8, -10, 2.45, 30), // closest, drifting: the first chondrocytes (day 333)
  keyAt(32.4, [0, 9.35, 8.1], 7, -12, 4.9, 29.5), // backing off: the cartilage strip (day 343)
  keyAt(33.0, [0, 8.0, 6.5], 6, -16, 18, 28.5), // the slab under the plate in the cut face
  keyAt(33.25, [0, 6.6, 4.7], 5, -19, 32, 28.2), // the plate's underside in the cut face
  keyAt(33.5, [0, 4.3, 2.0], 4, -22, 54, 28), // the proximal lobe and the plate
  K_OUT,
];

let slab = null;
let backdrop = null;
let labels = [];

export default {
  id: "c3",
  start: START,
  end: END,
  camera: CAMERA,
  region: REGION,
  async build(ctx) {
    // slab.js imports three's MarchingCubes from the CDN: load it here, not at module top, so
    // the camera planner (node) can import this module for its keys.
    const { createSlab, createSlabBackdrop } = await import(new URL("../cells/slab.js", import.meta.url).href);
    // Pass 4: the slab's own plate strip is not drawn (hide); the macro plate (never clipped,
    // the box stops at z 8.98) is the one plate. In pass 3 the strip hung under it as a second,
    // rounded steel bar (27.9-28.9 and 32.4-33.0 s).
    slab = await createSlab(ctx, REGION, { days: DAYS, hide: ["plate"] });
    slab.setVisible(false);
    slab.warm(ctx.renderer, ctx.camera);
    backdrop = createSlabBackdrop(ctx, slab, { depth: 0.36, zMax: CLIP_Z1 });
    labels = pickLabels(ctx, slab, LABEL_SPECS, { days: DAYS, dayAt });
    ctx.shared.c3 = { slab, region: REGION, days: DAYS, labels };
  },
  update(t, ctx) {
    const { util } = ctx;
    const inWin = t >= START && t < END;
    const open = inWin
      ? util.tween(t, SLAB_IN, SLAB_IN_DUR, "power2.out") * (1 - util.tween(t, SLAB_OUT, SLAB_OUT_DUR, "power2.in"))
      : 0;

    // Own objects, for every t.
    if (slab) {
      const on = open > 0.001;
      slab.setVisible(on);
      if (on) {
        slab.setOpacity(open);
        slab.setTime(t);
        slab.setDay(util.clamp(dayAt(t), DAYS[0], DAYS[1]), ctx.camera);
      }
    }
    if (backdrop) backdrop.setOpacity(open);

    if (!inWin) return;
    const s = ctx.state;
    s.day = dayAt(t);
    s.half = 1;
    // the macro look b3 leaves (translucent stem cells over its bone overlay; the engine
    // makes the voxel material transparent below 0.999, which the stem alpha needs)
    const b3 = ctx.shared.b3;
    if (b3 && typeof b3.STEM_OPACITY_END === "number") s.stemOpacity = b3.STEM_OPACITY_END;
    // While the shaft is fully open no voxel (nor b3's bone overlay) is left in the frame: the
    // camera sees the slab, the plate and the ground. Switching them off then saves their draw
    // and their shadow pass (about 0.5-1 s of a 3.5 s frame); nothing visible changes.
    const dist = ctx.cameraDistance;
    s.voxelOpacity = open > 0.001 && growAt(t, util, dist) >= 0.999 ? 0 : 0.998;
    s.cutOpacity = 0;
    s.hullOpacity = 0;
    s.macroClip = open > 0.001 ? clipBox(t, open, util, dist) : null;
    s.slab = open > 0.001 ? { name: REGION, opacity: open } : null;
    for (const L of labels) {
      const f = labelFade(t, L.tIn, L.tOut, util);
      if (f.alpha > 0) ctx.labels.add({ id: L.id, text: L.text, anchor: L.anchor, offset: L.offset, ...f });
    }

    // Depth of field at the closest moment, focused on the camera target (on the slab's mid
    // plane, so the focal plane runs through the cell layer).
    const dofAmt = open > 0.001 ? 1 - util.smoothstep(DOF_NEAR, DOF_FAR, dist) : 0;
    if (dofAmt > 0.001) {
      s.dof = { focus: dist, aperture: (DOF_K * dofAmt) / Math.max(dist, 0.25), maxblur: DOF_MAXBLUR };
    }
  },
};
