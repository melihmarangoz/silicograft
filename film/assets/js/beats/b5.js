// Beat b5 "CalculiX loads the leg" (frames 1200-1379, 40-46 s, day 357).
//
// Pass 3 (SPEC P3-1): the pass-2 beat played 16 s later (SHIFT); every absolute time is the
// pass-2 time + 16 s. The frame numbers in the comments are pass-2 frames (+480 for pass 3).
//
// The one hero move: a slight push in (86 -> 78 mm), face-on to the half callus's cut face,
// the bone horizontal (the director's default roll: proximal end screen left, plate on top).
// While the camera closes in, the run's load marks come back beside the callus and pulse
// twice, and the cut face turns from the day-357 stiffness map (viridis) into the strain map
// (magma) of the same FE solution.
//
// Timeline (frames):
//   720-738  the axial arrow enters (18 f power2.out, opacity and scale about its tip); the
//            bending arc follows 6 frames later (726-744)
//   744-768  pulse 1: both marks thicken by 30 % (sine.inOut) ...
//   744-774  ... while the cut face blends E -> strain (30 f power1.inOut)
//   768-792  pulse 1 settles back (sine.inOut)
//   796-820  pulse 2 thickens (frame 820, the QA frame, is its peak) ...
//   820-844  ... and settles
//   844-888  hold: the strain map, the marks at rest
//   888-900  the marks exit (12 f power2.in), so b6 starts on a clean frame
//
// The marks (pass 2, P2-2 and P2-6). b5 builds its own pair (same look as b1's: ink, unlit,
// 0.28 mm line, 3.2 mm head) instead of moving b1's, because the horizontal face-on frame
// needs them in two different places and the arc smaller than b1's:
//   - Axial force, 823 N along -y (manifest load_case.axial_force). Its line of action is
//     the bone axis; the arrow is slid along that line (a force may slide along its line of
//     action without changing the load) from the proximal end face (y = +100, far off the
//     left edge) to the proximal fragment in this frame: it lies on the axis, over the red
//     marrow of the cut, pointing screen right, its tip 0.6 mm short of the bone end at the
//     gap. It reads as "the load pushes the proximal fragment into the gap". 0.5 mm in front
//     of the cut plane so the flat cut faces never cover it.
//   - Bending moment, 9777 N mm about +z (manifest load_case.bending_moment, sense from its
//     vector). +z is screen up here, so the arc lies in the scene x-y plane, the plane the
//     camera looks along. A moment is a free vector: the arc keeps its axis and sense and is
//     drawn in the empty ground below the proximal fragment (screen lower left), where the
//     camera looks down on its plane by about 9 deg and perspective opens it into a flat
//     ellipse (the honest view of that arc from here). Radius 6.5 mm (b1's 12 mm arc does
//     not fit between the callus and the frame edge), the open 90 deg facing the callus.
// Neither mark casts or receives shadows; both are unlit and not tone-mapped, so they keep
// the ink colour exactly.
//
// State written in [40, 46): half, day, voxelOpacity, cutOpacity, hullOpacity, eDayIndex,
// fieldMode, fieldBlend. Own objects: the two marks (hidden outside the window).

const F = (n) => n / 30; // frames -> seconds
const SHIFT = 16; // pass 3: the pass-2 beat, 16 s later (timeline.js SHIFT_B456)
const START = 24 + SHIFT;
const END = 30 + SHIFT;

// Marks (seconds).
const AXIAL_IN = START; // 720
const MOMENT_IN = START + F(6); // 726
const MARKS_OUT = END; // the 12-frame exit ends at 900
const PULSE_FRAMES = 24; // thicken over 24 f, settle over 24 f (sine.inOut each)
const PULSES = [START + F(24), START + F(76)]; // 744, 796 (peaks at 768 and 820)
const PULSE_GAIN = 0.3; // +30 % line and head radius

// Field (seconds).
const BLEND_START = START + F(24); // 744: E -> strain with the first pulse
const BLEND_FRAMES = 30;

// Mark geometry (scene mm). The look matches b1's marks (b1.js LINE_R, HEAD_LEN, HEAD_R).
const LINE_R = 0.14; // 0.28 mm line: about 8 px at 1080p at 78-86 mm
const HEAD_LEN = 3.2;
const HEAD_R = 0.8;
const CAP_R = 1.0; // round tail cap, in units of the line radius
const AXIAL_LEN = 13; // tail to tip
// Projected with the director (pass-2 24-30 s, now 40-46 s), at 1920 x 1080:
//   axial arrow  x 170-563 px, y 460-489 (tail at screen left, tip just short of the bone
//                end face at the gap, 548-582 px)
//   arc          x  84-460 px, y 844-909 (left of the callus's lower outline, 170 px above
//                the bottom edge)
const AXIAL_TIP = [-0.5, 15.6, 0]; // on the bone axis, 0.6 mm proximal of the bone end face (y 15)
const ARC_CENTRE = [0, 25.5, -15]; // below the proximal fragment (cortex z >= -8.5)
const ARC_R = 6.5;
const ARC_SWEEP = (270 * Math.PI) / 180;

// Camera (pass 2): b4's last key (face-on, 86 mm) to b6's first key (78 mm, 3 deg from the
// distal side, the direction b6 pulls back along): the slight push in. Both are boundary
// keys of the contract (ENGINE.md, "Pass 2 boundary keys"); keep them exactly. No inner key:
// the director's PCHIP channels already give an even push that eases into 30 s (where the
// distance turns round into b6's pull back); the planner reads axis 180 deg, plate up,
// at most 0.01 frame widths per second over the window.
const CAMERA = [
  { t: START, pos: [-86, 0, -2], target: [0, 0, -2], fov: 28 }, // = b4's 24 s key
  { t: END, pos: [-77.893, -4.082, -3], target: [0, 0, -3], fov: 28 }, // = b6's 30 s key
];

function pulse(t, util) {
  let p = 0;
  for (const t0 of PULSES) {
    const up = util.tween(t, t0, F(PULSE_FRAMES), "sine.inOut");
    const down = util.tween(t, t0 + F(PULSE_FRAMES), F(PULSE_FRAMES), "sine.inOut");
    p = Math.max(p, up - down);
  }
  return 1 + PULSE_GAIN * p;
}

// A tube whose radius can change without rebuilding it (b1's technique): the centre line is
// kept and positions = centre + normal * radius (TubeGeometry normals are radial).
function makeTube(THREE, curve, segments, radius, material) {
  const geo = new THREE.TubeGeometry(curve, segments, radius, 12, false);
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const centre = new Float32Array(pos.array.length);
  for (let i = 0; i < centre.length; i++) centre[i] = pos.array[i] - nor.array[i] * radius;
  const mesh = new THREE.Mesh(geo, material);
  let cur = radius;
  return {
    mesh,
    setRadius(r) {
      if (Math.abs(r - cur) < 1e-7) return; // memo only: the result depends on r alone
      cur = r;
      const a = pos.array;
      const n = nor.array;
      for (let i = 0; i < a.length; i++) a[i] = centre[i] + n[i] * r;
      pos.needsUpdate = true;
      geo.computeBoundingSphere();
    },
  };
}

// Cone head: base at the origin, tip at HEAD_LEN along local +y.
function makeHead(THREE, material) {
  const g = new THREE.ConeGeometry(HEAD_R, HEAD_LEN, 32, 1, false);
  g.translate(0, HEAD_LEN / 2, 0);
  return new THREE.Mesh(g, material);
}

function makeMarks(ctx) {
  const { THREE, palette, data } = ctx;
  const lc = data.manifest.load_case;
  const dir = new THREE.Vector3().fromArray(lc.axial_force.vector_scene_N).normalize(); // -y
  const axisVec = new THREE.Vector3().fromArray(lc.bending_moment.vector_scene_Nmm);
  const sense = Math.sign(axisVec.dot(new THREE.Vector3().fromArray(lc.bending_moment.axis_scene))) || 1;
  const axis = axisVec.clone().normalize(); // +z

  const mk = (name) => {
    const m = new THREE.MeshBasicMaterial({ color: palette.ink, toneMapped: false, fog: false, transparent: true, opacity: 0, depthWrite: true });
    m.name = name;
    return m;
  };
  const axialMat = mk("b5-axial-arrow");
  const momentMat = mk("b5-moment-arrow");

  const root = new THREE.Group();
  root.name = "b5-load-marks";

  // Axial force: local frame at the tip, shaft back along -dir.
  const axialG = new THREE.Group();
  axialG.name = "b5-axial";
  axialG.position.fromArray(AXIAL_TIP);
  const base = dir.clone().multiplyScalar(-HEAD_LEN);
  const tail = dir.clone().multiplyScalar(-AXIAL_LEN);
  const shaft = makeTube(THREE, new THREE.LineCurve3(tail, base), 1, LINE_R, axialMat);
  const axialHead = makeHead(THREE, axialMat);
  axialHead.position.copy(base);
  axialHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const axialCap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), axialMat);
  axialCap.position.copy(tail);
  axialG.add(shaft.mesh, axialHead, axialCap);

  // Bending moment: a 270 deg arc in the plane normal to the moment axis, its open 90 deg
  // facing along the axial force (towards the callus), its head following the right-hand
  // sense of the moment (the same construction as b1's arc).
  const momentG = new THREE.Group();
  momentG.name = "b5-moment";
  momentG.position.fromArray(ARC_CENTRE);
  const e1 = dir.clone().addScaledVector(axis, -dir.dot(axis)).normalize();
  const e2 = new THREE.Vector3().crossVectors(axis, e1); // e1 -> e2 turns positively about the axis
  const th0 = Math.PI / 4;
  const th1 = th0 + ARC_SWEEP;
  const headAng = HEAD_LEN / ARC_R;
  const thStart = sense > 0 ? th0 : th1;
  const thEnd = sense > 0 ? th1 : th0;
  const thShaftEnd = thEnd - Math.sign(thEnd - thStart) * headAng;
  const onArc = (th, out = new THREE.Vector3()) =>
    out.copy(e1).multiplyScalar(Math.cos(th) * ARC_R).addScaledVector(e2, Math.sin(th) * ARC_R);
  class ArcCurve extends THREE.Curve {
    getPoint(u, target = new THREE.Vector3()) {
      return onArc(thStart + (thShaftEnd - thStart) * u, target);
    }
  }
  const arc = makeTube(THREE, new ArcCurve(), 160, LINE_R, momentMat);
  const arcHead = makeHead(THREE, momentMat);
  const hb = onArc(thShaftEnd);
  const ht = onArc(thEnd);
  arcHead.position.copy(hb);
  arcHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ht.clone().sub(hb).normalize());
  const arcCap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), momentMat);
  arcCap.position.copy(onArc(thStart));
  momentG.add(arc.mesh, arcHead, arcCap);

  root.add(axialG, momentG);
  root.visible = false;
  root.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });

  const setOpacity = (mat, a) => {
    mat.opacity = a;
    const tr = a < 0.999;
    if (mat.transparent !== tr) {
      mat.transparent = tr;
      mat.needsUpdate = true;
    }
  };

  return {
    group: root,
    // The whole look for one frame (a function of its arguments only).
    set({ axial = 0, moment = 0, axialScale = 1, momentScale = 1, thickness = 1 } = {}) {
      axialG.visible = axial > 0.001;
      momentG.visible = moment > 0.001;
      root.visible = axialG.visible || momentG.visible;
      if (!root.visible) return;
      setOpacity(axialMat, axial);
      setOpacity(momentMat, moment);
      axialG.scale.setScalar(Math.max(axialScale, 1e-3));
      momentG.scale.setScalar(Math.max(momentScale, 1e-3));
      shaft.setRadius(LINE_R * thickness);
      arc.setRadius(LINE_R * thickness);
      for (const h of [axialHead, arcHead]) h.scale.set(thickness, 1, thickness);
      for (const c of [axialCap, arcCap]) c.scale.setScalar(CAP_R * LINE_R * thickness);
    },
  };
}

let marks = null;

export default {
  id: "b5",
  start: START,
  end: END,
  camera: CAMERA,
  async build(ctx) {
    marks = makeMarks(ctx);
    ctx.scene.add(marks.group);
    ctx.shared.b5 = { marks };
  },
  update(t, ctx) {
    const { util } = ctx;
    const inWin = t >= this.start && t < this.end;

    // Own objects, for every t (hidden outside the window).
    if (marks) {
      if (inWin) {
        const a = util.enterExit(t, AXIAL_IN, MARKS_OUT);
        const m = util.enterExit(t, MOMENT_IN, MARKS_OUT);
        marks.set({
          axial: a,
          moment: m,
          axialScale: util.lerp(0.6, 1, a),
          momentScale: util.lerp(0.8, 1, m),
          thickness: pulse(t, util),
        });
      } else {
        marks.set({ axial: 0, moment: 0 });
      }
    }

    if (!inWin) return;
    const s = ctx.state;
    s.half = 1;
    s.day = 357;
    s.voxelOpacity = 0; // b4 faded the voxels out behind the opaque face
    s.cutOpacity = 1;
    s.hullOpacity = 0;
    s.eDayIndex = (ctx.data.feDays?.length ?? 118) - 1; // the day-357 E map b4 ends on
    s.fieldMode = "strain";
    s.fieldBlend = util.tween(t, BLEND_START, F(BLEND_FRAMES), "power1.inOut");
  },
};
