// Beat c2 "Cell stop 2: korteks_ucu" (frames 600-809, 20-27 s, simulated day 120 -> 220). Pass 3.
//
// SPEC P3-1 / P3-2 / P3-4: the film dives from b3's macro view into the cell viewer's region
// `korteks_ucu` (the proximal cortex corner away from the plate, the earliest new bone; slab
// centre in the scene (0, 15.95, -9.05)), stays among the cells while the days run 120 -> 220,
// and pulls back out towards the plate side into the macro view, where c3 takes over.
//
// What the run shows there (roi_korteks_ucu, mid-frontal plane, read from the data, nothing
// added): the intact cortex end fills the top 0.8 mm of the slab (scene z > -8.45, from the
// bone end face y = 15 to the proximal edge); under it, on the periosteal side, a mass of new
// bone cells (code 2: osteoblasts on its surfaces, osteocytes walled in) with stem cells
// around it and in the gap beyond the bone end (y < 15). The one big event of the window is in
// that bone mass: on days ~146-166 its core (scene y 15.2-16.4, z -8.5 -> -9.7) empties (1513
// -> 1102 bone cells; up to 271 empty sites) and from day ~158 to ~178 stem cells fill the new
// cavity (1483 -> 1919 MSCs); a U-shaped bone wall stays, lined by osteoblasts, with the cortex
// as its roof. After day ~180 the slab is almost still. On the day track that is 21.8-24.3 s,
// so the closest moment sits on that core (the cavity opening and filling), framed by the
// cortex above and the bone walls on both sides.
//
// Schedule (seconds; day from timeline.js dayAt):
//   20.0        K_IN, the boundary key (= b3's last key): the proximal lobe, the cortex corner
//               below and left of centre. Day 120.
//   20.0-21.8   dive (32 -> 5.2 mm), turning to azimuth -10 (the side away from the plate);
//               the slab fades in and the macro window opens 20.6-21.4 s (24 frames power2.out)
//               at the corner, so the macro shows where the region sits.
//   21.8        the whole slab: the cortex block, the new bone mass under it, stem cells in
//               the gap beyond the bone end (day 145, the bone still solid).
//   22.6-24.2   among the cells (2.8 -> 1.9 at 23.6 -> 2.3 mm) on the bone core: it empties
//               (day 150-166) and stem cells pour into the cavity (166-180); osteoblasts line
//               the walls, osteocytes sit in the matrix, the cortex is the roof. Below 3.0 mm the
//               clip box grows behind the slab (fully at 2.3 mm), so the cavity shows the ground
//               instead of the shaft's voxel walls. Depth of field on the slab layer below
//               3.4 mm (full below 2.6 mm), mild: the 0.5 mm slab stays sharp, the clot and the
//               macro behind soften.
//   24.2-27.0   pull out towards the plate side to K_OUT (the boundary key, = c3's first key):
//               2.3 mm -> 4.6 (25.0) -> 10.8 (25.75) -> 23 (26.4) -> 44; the walls return as the
//               box shrinks (24.3-24.6), the slab fades back into the voxels and the window
//               closes 25.4-26.2 s. Planner: screen speed at most 0.36 on the dive and 0.62 on
//               the pull-out (26.0 s; the stub had 0.67), bone horizontal, plate up throughout.
//
// State written in [20, 27): day (the film's track), half 1, voxelOpacity 0.998 and
// stemOpacity 0.4 (b3's end look), cutOpacity 0, hullOpacity 0, macroClip, slab; at the close
// range also dof and shadows 0 (while the box is fully grown no macro surface is in view).
// Own objects: the slab (hidden outside the window).

import { beat as timelineBeat, dayAt } from "../timeline.js";
import { pickLabels, labelFade } from "../labels.js";

const W = timelineBeat("c2");
const START = W.start; // 20
const END = W.end; // 27
const REGION = W.region; // 'korteks_ucu'
const DAYS = W.days; // [120, 220]

// Slab centre in the scene (slab.js placement, ENGINE.md "Cell slabs"); the camera keys aim at
// it before the slab is built (the keys are static: the planner reads them without a browser).
const CENTRE = [0, 15.95, -9.05];
// The bone core that empties and refills (header), on the cut plane x = 0 (the slab's
// mid-plane): the close-up's target, a little above the core's middle so the cortex's
// underside (z -8.45) stays in the top of the frame as context.
const CORE = [0, 15.8, -8.8];

// Macro clip box around the slab (state.macroClip): the slab is 0.5 x 2.8 x 2.8 mm (scene x, y,
// z) and straddles the cut plane x = 0; the box adds 0.05 mm around it in y and z and runs from
// 0.3 mm in front of the plane to 5.7 mm behind it: a shaft, so neither the first voxel layer
// (scene x 0.05..0.35) cuts through the cells nor the 0.3 mm blocks deeper in stand right behind
// them (through the slab the camera sees the ground, as in the cell viewer).
const CLIP_FRONT = -0.3; // scene x of the box's front face
const CLIP_SIZE = [6.0, 2.9, 2.9];
// At the close range the frame lies inside the slab's footprint (the frame's half width at the
// cut plane is 0.48 x the camera distance, the slab's 1.4 mm), and through the slab the
// camera saw the shaft's walls: 0.3 mm voxel blocks seen edge-on behind the cells (amber
// walls and ivory bars of b3's bone overlay in the first snapshots). There the box grows to
// CLIP_WIDE (deeper and wider than the view cone behind the slab), so the macro falls away
// behind the cells and the cavities show the ground, as in the cell viewer. The growth runs
// while the camera closes from CLIP_GROW_FAR to CLIP_GROW_NEAR mm, where the edges of the
// wider hole are already outside the frame at the cut plane; it reverses on the way out.
// Pass 4: the owner saw large blurry amber voxel blocks in front of the cells from about 21 to
// 25 s: with the box grown only below 3.0 mm, the 0.3 mm callus blocks around the slab-sized
// window (and down the shaft, through the slab) filled the frame's edges at 4-9 mm, out of
// focus at the close range. A ground-coloured backdrop now sits just behind the slab
// (createSlabBackdrop), so through the cells the camera sees the paper ground, not the shaft's
// walls; and the box grows while the camera closes from 8.5 to 6.0 mm (about 21.45-21.7 s; was
// 3.0 to 2.3 mm) and shrinks back from 6.0 to 8.5 mm on the way out (about 25.15-25.4 s), large
// enough that no voxel is left in view below 6 mm (the view cone at the callus's far side,
// 18.7 mm behind the cut plane, is 0.48 x (d + 18.7) mm wide each way), so the voxels are
// switched off there. Above 8.5 mm the voxels frame the window as context. Tried: from 10 mm
// (the slab small on an empty ground, 46 %) and from 6 mm (0.3 mm blocks still large beside
// the cells at 21.6 and 25.2-25.5 s). What stays as context is the macro cortex: the box keeps it whole
// (macroClip.keep) and the slab's own copy of the cortex is not drawn (createSlab hide), so the
// cells sit under the one, real cortex instead of a lighter "brick" (pass-3 Remaining 6).
const CLIP_WIDE = [19.0, 26.0, 18.0];
const CLIP_GROW_FAR = 8.5;
const CLIP_GROW_NEAR = 6.0;
const KEEP = ["cortex_prox"];
function clipBox(grow, open, util) {
  const size = CLIP_SIZE.map((v, i) => util.lerp(v, CLIP_WIDE[i], grow));
  return { centre: [CLIP_FRONT + size[0] / 2, CENTRE[1], CENTRE[2]], size, open, keep: KEEP };
}

// Cell-type labels (pass 4, SPEC "PASS 4"): the types the run has in this slab on the label
// days (slab.counts: MSCs, osteoblasts and osteocytes; no fibroblast or chondrocyte at days
// 120-220, so neither is named), each on one real cell chosen by labels.js pickLabels.
// The label window is the close range (camera at or under about 2.9 mm, where a cell is 14 px
// or more): in from 22.55 s, 7 frames apart; out by 24.6 s, before the pull-out.
const LABEL_IN = 22.55;
const LABEL_OUT = 24.6;
const LABEL_SPECS = [
  { id: "c2-osteoblast", type: 3, text: "Osteoblast", tIn: LABEL_IN, tOut: LABEL_OUT, region: [180, 260, 1000, 940] },
  { id: "c2-osteocyte", type: 4, text: "Osteocyte", tIn: LABEL_IN + 7 / 30, tOut: LABEL_OUT, region: [920, 260, 1740, 940] },
  { id: "c2-msc", type: 0, text: "Mesenchymal stem cell", tIn: LABEL_IN + 14 / 30, tOut: LABEL_OUT, region: [500, 300, 1420, 960] },
  { id: "c2-fibroblast", type: 1, text: "Fibroblast", tIn: LABEL_IN + 21 / 30, tOut: LABEL_OUT, region: [180, 260, 1740, 960] },
];

// Timing (seconds).
const F = (n) => n / 30;
const SLAB_IN = START + 0.6; // slab fades in and the window opens (24 frames power2.out), camera ~20 mm
const SLAB_IN_DUR = F(24);
const SLAB_OUT = END - 1.6; // slab fades out and the window closes (24 frames power2.in), camera ~7 mm
const SLAB_OUT_DUR = F(24);

// Depth of field at the closest moment (SPEC P3-2: "only at the closest moment of each stop,
// focus on the cell layer"). BokehPass (three r170): blur in uv = |focus - depth| * aperture,
// clamped to maxblur; one uv unit is about 1920 px (the shader's aspect correction makes the
// disc round in pixels). The aperture scales with 1 / focus (a fixed f-number), DOF_K / focus
// at 1.9 mm: 0.3 mm off the focal plane (the slab's half thickness seen obliquely) blurs by
// about 2 px, the shaft walls and voxels 1-5 mm behind by 7-14 px. Unlike pass 2's b2 close-up
// (a 30 um sharp slice) the whole slab stays readable: SPEC P3-4 wants cells of two types,
// the matrix and the cortex in focus.
const DOF_NEAR = 2.6; // full DOF at or below this camera distance (mm)
const DOF_FAR = 3.4; // no DOF above this
const DOF_K = 0.0072; // aperture * focus (mm)
const DOF_MAXBLUR = 0.008;

// ---------------------------------------------------------------------------------------
// Camera. K_IN and K_OUT are boundary keys of the contract (ENGINE.md, "Pass 3 boundary keys
// (contract)"): keep them exactly. Inner keys from a target and the view direction about it
// (azimuth about scene y from -x towards +z, elevation towards +y, distance), as in b1/b3.
// Screen (default roll -90): scene +y (proximal) left, +z (plate) up; azimuth < 0 looks up from
// the side away from the plate, elevation < 0 looks along the bone from the distal side.
function keyAt(t, target, azDeg, elDeg, dist, fov = 28) {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  const c = Math.cos(el);
  const u = [-c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
  return { t, target, pos: target.map((v, i) => Math.round((v + u[i] * dist) * 1e3) / 1e3), fov };
}
const K_IN = { t: 20, pos: [-29.652, 4.513, -4.465], target: [0, 16.5, -5.5], fov: 28 }; // = b3's 20 s key
const K_OUT = { t: 27, pos: [-40.697, -6.483, 2.846], target: [0, 10, 0], fov: 28 }; // = c3's 27 s key
const CAMERA = [
  K_IN,
  keyAt(21.0, [0, 15.9, -8.2], -5, -20, 13), // halfway in: the cortex end, the window opening at its corner
  keyAt(21.8, [0, 15.95, -9.0], -10, -18, 5.2, 30), // the whole slab: cortex block, new bone mass, gap
  keyAt(22.6, [0, 16.0, -8.85], -14, -14, 2.8, 30), // onto the bone core (it starts to empty)
  keyAt(23.6, CORE, -16, -10, 1.9, 30), // closest: the cavity, stem cells pouring in
  keyAt(24.2, [0, 15.9, -8.85], -14, -12, 2.3, 30), // still close, the cavity filled
  keyAt(25.0, [0, 15.4, -8.5], -9, -15, 4.6, 29.5), // pulling out: the slab whole again
  keyAt(25.75, [0, 14.5, -7.2], -4, -18, 10.8, 28.5), // the cortex end around the closing window
  keyAt(26.4, [0, 12.4, -4.2], 0, -21, 23, 28), // the lobe, heading for the plate side
  K_OUT,
];

let slab = null;
let backdrop = null;
let labels = [];

export default {
  id: "c2",
  start: START,
  end: END,
  camera: CAMERA,
  region: REGION,
  async build(ctx) {
    // slab.js imports three's MarchingCubes from the CDN: load it here, not at module top, so
    // the camera planner (node) can import this module for its keys.
    const { createSlab, createSlabBackdrop } = await import(new URL("../cells/slab.js", import.meta.url).href);
    slab = await createSlab(ctx, REGION, { days: DAYS, hide: ["cortex"] });
    slab.setVisible(false);
    slab.warm(ctx.renderer, ctx.camera);
    backdrop = createSlabBackdrop(ctx, slab, { depth: 0.36 });
    labels = pickLabels(ctx, slab, LABEL_SPECS, { days: DAYS, dayAt });
    ctx.shared.c2 = { slab, region: REGION, days: DAYS, core: CORE, labels };
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
    // labels (their fades are 0 outside [tIn, tOut))
    for (const L of labels) {
      const f = labelFade(t, L.tIn, L.tOut, util);
      if (f.alpha > 0) ctx.labels.add({ id: L.id, text: L.text, anchor: L.anchor, offset: L.offset, ...f });
    }
    s.day = dayAt(t);
    s.half = 1;
    // the macro look b3 leaves (translucent stem cells over its bone overlay; the engine
    // makes the voxel material transparent below 0.999, which the stem alpha needs)
    const b3 = ctx.shared.b3;
    if (b3 && typeof b3.STEM_OPACITY_END === "number") s.stemOpacity = b3.STEM_OPACITY_END;
    s.voxelOpacity = 0.998;
    s.cutOpacity = 0;
    s.hullOpacity = 0;
    const dist = ctx.cameraDistance; // a pure function of t through the director
    const grow = open > 0.001 ? util.ease["power1.inOut"](1 - util.smoothstep(CLIP_GROW_NEAR, CLIP_GROW_FAR, dist)) : 0;
    s.macroClip = open > 0.001 ? clipBox(grow, open, util) : null;
    s.slab = open > 0.001 ? { name: REGION, opacity: open } : null;
    // Fully grown, no macro surface is in view (the slab neither casts nor receives shadows):
    // skip the key light's shadow pass, which would still draw every voxel.
    // Integration pass 3: the voxels too (as c3 does): fully grown, the box clips every voxel
    // and b3's overlay out of the view anyway, and since the DOF frames are drawn on the canvas
    // (engine.js, dofColor) their cost is what keeps 22.6-24.5 s under the frame budget.
    if (grow >= 0.999) {
      s.shadows = 0;
      s.voxelOpacity = 0;
    }

    // Depth of field at the closest moment, focused on the camera target (on the slab's
    // mid-plane x = 0), ramped by the camera distance.
    const dofAmt = open > 0.001 ? 1 - util.smoothstep(DOF_NEAR, DOF_FAR, dist) : 0;
    if (dofAmt > 0.001) {
      s.dof = { focus: dist, aperture: (DOF_K * dofAmt) / Math.max(dist, 0.25), maxblur: DOF_MAXBLUR };
    }
  },
};

export { CAMERA as c2CameraKeys, START, END, CORE };
