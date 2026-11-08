// Beat b1 "Defect and load" (frames 0-179, 0-6 s, simulated day 0). Pass 3, camera re-planned in pass 4.
//
// The construct lies horizontal (the director rolls every key by -90 deg: scene +y, the
// proximal end, to screen left; +z, the plate, to screen top). The take (SPEC P3-3):
//   0.0 s  CLOSE on the gap (the owner's choice), seen from above the plate and from the
//          distal side: the plate's top face, both bone ends with the day-0 stem-cell layer
//          (amber voxels of the run) and the gap under the plate fill the frame; the outer
//          screws sit outside it.
//   0-3.0  up the bone to its loaded end, close (pass 4; pass 3 pulled back to 92 mm): the
//          823 N axial arrow (from 1.6 s) and the 270 deg arc of the 9777 N mm bending moment
//          (from 2.0 s) enter at the proximal end, screen left, and read whole about 2.4-4.4 s.
//   3.0-6  the camera follows the load path back down the bone to the gap; the model halves
//          at 4.0 s (frame 120, 18 frames); the arrows stay at the left edge to about 4.6 s and
//          exit at 4.6-5.0 s; the take ends looking into the half-cut gap (the 6 s key,
//          unchanged).
//
// Colour (P2-2): steel plate and darker screws, warm cortex, amber stem cells (code 1 of the
// day-0 voxels), red marrow on the cut faces from 4.0 s, ink arrows. No contact-shadow plane
// (P2-6): the engine's key-light shadows ground the plate on the bone.
//
// Shared: ctx.shared.arrows (see makeArrows) so b5 can move and pulse the arrows. b1 sets
// them for every t (hidden outside 0-6 s); a later beat that calls arrows.set() wins.

// ---------------------------------------------------------------------------------------
// Camera (pass 4). K2 is a boundary key of the contract (ENGINE.md, "Pass 3 boundary keys"):
// keep it exactly. Inner keys from a target and the view direction about it (azimuth about
// the bone from -x towards +z, elevation towards +y, distance to the target, as in b2).
// Pass 4 (the owner: about half of the opening was still empty ground): the camera stays CLOSE
// and looks up the bone from the distal side and from above the plate (elevation -36 to -48,
// azimuth 24-32), so the plate's top face, the screw heads and the bone near the camera fill the
// frame while the far end with the load marks stays in it. Planner covered share 0.62-0.73
// from 0 to 5.0 s (pass 3: 0.40-0.51), 0.53 at 5.5 s on the way into the fixed 6 s key (0.47);
// bone horizontal and plate up throughout; screen speed at most 0.62 frame widths per second.
//   K0  0.0 s  az 32, el -40, 46 mm, target on the gap: the plate on top, both bone ends with
//              their day-0 stem-cell rims, the gap under the plate; the outer screws outside.
//   Km  1.5 s  az 31, el -42, 60 mm, fov 30, target y 36: travelling up the bone (wider lens so
//              the move stays calm).
//   K1  3.0 s  az 30, el -44, 60 mm, target y 78: the loaded end and both load marks, the bone
//              filling the right of the frame.
//   K1b 4.2 s  az 28, el -48, 60 mm, target y 60: heading back while the model halves (4.0-4.6
//              s); the marks still in frame to about 4.6 s.
//   K1c 4.9 s  az 26, el -44, 60 mm, fov 28.5, target y 38, and
//   K1d 5.5 s  az 24, el -36, 60 mm, target y 21: down the half model into the gap, distance
//              rising monotonically to the 6 s key (64 mm), so there is no push-pull before the
//              dive.
function keyAt(t, target, azDeg, elDeg, dist, fov = 28) {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  const c = Math.cos(el);
  const u = [-c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
  return { t, target, pos: target.map((v, i) => Math.round((v + u[i] * dist) * 1e3) / 1e3), fov };
}
const K0 = keyAt(0.0, [0, -1, 5], 32, -40, 46); // close on the gap and both bone ends, plate on top
const Km = keyAt(1.5, [0, 36, 4.7], 31, -42, 60, 30); // up the bone
const K1 = keyAt(3.0, [0, 78, 4.5], 30, -44, 60); // the loaded end and the load marks
const K1b = keyAt(4.2, [0, 60, 4], 28, -48, 60); // the half cut, heading back
const K1c = keyAt(4.9, [0, 38, 3], 26, -44, 60, 28.5); // down the half model
const K1d = keyAt(5.5, [0, 21, 2], 24, -36, 60); // into the gap
const K2 = { t: 6.0, pos: [-58.04, -1.31, 23.95], target: [0, 12, 0.5], fov: 28 }; // into the half-cut gap (= b2's first key)

// ---------------------------------------------------------------------------------------
// Timing (seconds).
const F = (n) => n / 30;
const CUT_START = F(120); // the model halves at frame 120 (4.0 s)
const CUT_FRAMES = 18;
const AXIAL_IN = F(48); // the axial arrow enters as the proximal end comes into frame
const MOMENT_IN = F(60); // then the bending arc
const MARKS_OUT = 5.0; // both exit (12 frames power2.in, ending here: 4.6-5.0 s) as they slide off the left edge (pass 4; was 5.3)

// Arrow sizes (mm): thin, precise ink marks. A 0.28 mm line (about 6-8 px at 1080p where
// they read, 75-95 mm away) with a slender 3.2 mm head. Lengths are fixed sizes, not scaled by
// the load values.
const LINE_R = 0.14;
const HEAD_LEN = 3.2;
const HEAD_R = 0.8;
const CAP_R = 1.0; // the round tail cap, in units of the line radius
const AXIAL_LEN = 13; // tail to tip
const ARC_R = 12; // the arc ends (45 deg either side of the bone) clear the cortex (7.5 x 8.5) by 1 mm
const ARC_SWEEP = (270 * Math.PI) / 180;

// Day-0 stem-cell voxels (the run's initial MSC layer at both bone ends).
const VOXEL_OPACITY = 1;

// Every b1 key looks from the distal side, so the loaded end face (normal +y) faces away
// from the camera and an arrow whose tip touches its centre hides its head behind the bone.
// In b1 the axial arrow therefore stands off the face along its line of action, just far
// enough that, seen from K1 (where the marks read), its tip meets the bone's silhouette.
// Cortex end-face half axes (scene x, z) and the silhouette margin:
const END_FACE = [7.5, 8.5];
const STANDOFF_MARGIN = 1.08;
function axialStandoff(cameraPos, faceY) {
  const n = Math.hypot(cameraPos[0] / END_FACE[0], cameraPos[2] / END_FACE[1]);
  const s0 = Math.min(0.5, STANDOFF_MARGIN / Math.max(n, 1e-6));
  const behind = Math.max(0, faceY - cameraPos[1]);
  return (s0 * behind) / (1 - s0);
}

// A tube whose radius can change without rebuilding it: the tube centre line is kept and
// positions = centre + normal * radius (TubeGeometry normals are radial).
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
      if (Math.abs(r - cur) < 1e-7) return; // memo only
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

function makeArrows(ctx) {
  const { THREE, palette, data } = ctx;
  const lc = data.manifest.load_case;
  const P = new THREE.Vector3().fromArray(lc.axial_force.application_point_scene_mm);
  const dir = new THREE.Vector3().fromArray(lc.axial_force.vector_scene_N).normalize(); // -y
  const Pm = new THREE.Vector3().fromArray(lc.bending_moment.application_point_scene_mm);
  const axisVec = new THREE.Vector3().fromArray(lc.bending_moment.vector_scene_Nmm);
  const sense = Math.sign(axisVec.dot(new THREE.Vector3().fromArray(lc.bending_moment.axis_scene))) || 1;
  const axis = axisVec.clone().normalize(); // +z, the moment vector's own direction

  // Flat ink (P2-2): unlit, not tone-mapped, no fog, so the marks keep #e7f0f9 exactly.
  const mk = () =>
    new THREE.MeshBasicMaterial({ color: palette.ink, toneMapped: false, fog: false, transparent: true, opacity: 1, depthWrite: true });
  const axialMat = mk();
  const momentMat = mk();
  axialMat.name = "b1-axial-arrow";
  momentMat.name = "b1-moment-arrow";

  const root = new THREE.Group();
  root.name = "b1-load-arrows";

  // Axial force: local frame at the application point (the tip), shaft back along -dir.
  const axialG = new THREE.Group();
  axialG.name = "axial";
  axialG.position.copy(P);
  const base = dir.clone().multiplyScalar(-HEAD_LEN); // head base, relative to the tip
  const tail = dir.clone().multiplyScalar(-AXIAL_LEN);
  const shaft = makeTube(THREE, new THREE.LineCurve3(tail, base), 1, LINE_R, axialMat);
  const axialHead = makeHead(THREE, axialMat);
  axialHead.position.copy(base);
  axialHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const axialCap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), axialMat);
  axialCap.position.copy(tail);
  axialG.add(shaft.mesh, axialHead, axialCap);

  // Bending moment: a 270 deg arc in the plane normal to the moment axis, centred on the
  // application point, its open 90 deg facing the bone (along the axial force), its head
  // following the right-hand sense of the moment.
  const momentG = new THREE.Group();
  momentG.name = "moment";
  momentG.position.copy(Pm);
  const e1 = dir.clone().addScaledVector(axis, -dir.dot(axis)).normalize(); // towards the bone
  const e2 = new THREE.Vector3().crossVectors(axis, e1); // e1 -> e2 turns positively about the axis
  const th0 = Math.PI / 4; // arc from 45 deg to 315 deg past e1
  const th1 = th0 + ARC_SWEEP;
  const headAng = HEAD_LEN / ARC_R; // the head chord spans this angle at the end of the arc
  // Positive sense: travel th0 -> th1, head at th1; negative: the reverse.
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
  const arc = makeTube(THREE, new ArcCurve(), 200, LINE_R, momentMat);
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

  const setOpacity = (mat, a) => {
    mat.opacity = a;
    const tr = a < 0.999;
    if (mat.transparent !== tr) {
      mat.transparent = tr;
      mat.needsUpdate = true;
    }
  };

  const api = {
    group: root,
    axial: { group: axialG, material: axialMat, tip: P.clone(), direction: dir.clone(), value_N: lc.axial_force.value_N, length: AXIAL_LEN },
    moment: { group: momentG, material: momentMat, centre: Pm.clone(), axis: axis.clone(), value_Nmm: lc.bending_moment.value_Nmm, radius: ARC_R },
    applicationPoint: P.clone(),
    lineRadius: LINE_R,
    headLength: HEAD_LEN,
    headRadius: HEAD_R,
    // Set the whole look for this frame (call it every frame from update; the last call wins).
    //   axial, moment: opacity 0..1 (0 hides)
    //   axialScale, momentScale: uniform scale about the tip / the arc centre (enter motion)
    //   thickness: line and head radius multiplier (b5 pulses it; 1 = the 0.28 mm line)
    //   standoff: mm the axial arrow's tip stays off the application point, back along its
    //             line of action (b1 only; default 0 = the tip on the point)
    set({ axial = 0, moment = 0, axialScale = 1, momentScale = 1, thickness = 1, standoff = 0 } = {}) {
      axialG.position.copy(P).addScaledVector(dir, -standoff);
      axialG.visible = axial > 0.001;
      momentG.visible = moment > 0.001;
      root.visible = axialG.visible || momentG.visible;
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
  return api;
}

let arrows = null;
let standoff = 0;

export default {
  id: "b1",
  start: 0,
  end: 6,
  camera: [K0, Km, K1, K1b, K1c, K1d, K2],
  async build(ctx) {
    arrows = makeArrows(ctx);
    ctx.scene.add(arrows.group);
    ctx.shared.arrows = arrows;
    standoff = axialStandoff(K1.pos, arrows.applicationPoint.y);
  },
  update(t, ctx) {
    const { util } = ctx;
    const inWin = t >= this.start && t < this.end;

    // Own objects, for every t (hidden outside the window).
    if (inWin) {
      const a = util.enterExit(t, AXIAL_IN, MARKS_OUT);
      const m = util.enterExit(t, MOMENT_IN, MARKS_OUT);
      arrows.set({ axial: a, moment: m, axialScale: util.lerp(0.7, 1, a), momentScale: util.lerp(0.85, 1, m), thickness: 1, standoff });
    } else {
      arrows.set({ axial: 0, moment: 0 });
    }

    if (!inWin) return;
    const s = ctx.state;
    s.day = 0;
    // The model halves at frame 120: the engine's clip plane sweeps the near half away
    // (scene x -7.6 -> 0) over 18 frames while the flat cut faces appear.
    s.half = util.tween(t, CUT_START, util.frames(CUT_FRAMES), "power2.inOut");
    // The run's day-0 stem cells (amber) at both bone ends, for the whole beat; b2 grows
    // them from here (it must continue at full opacity at 6 s).
    s.voxelOpacity = VOXEL_OPACITY;
    s.cutOpacity = 0;
    s.hullOpacity = 0;
  },
};
