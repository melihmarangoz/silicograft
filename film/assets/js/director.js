// SG-Bone dive: the camera director (pass 2). Pure functions, no three.js, so the engine,
// the beats and the node planning tool (.hyperframes/camera-plan/plan.mjs) share it.
//
// Keys: { t, pos: [x, y, z], target: [x, y, z], fov?, roll?, near?, hold? } in scene mm and
// degrees. Keys of every beat are merged and sorted by t; two keys at the same t (a beat's
// last key and the next beat's first key) collapse into one, the later beat wins.
//
// Parameterisation (one continuous take over all keys):
//   target                      x, y, z
//   view direction              azimuth about the bone axis (scene y, from -x towards +z)
//                               and elevation (towards +y), of pos - target
//   distance                    log |pos - target|
//   fov, roll                   degrees
//   near                        log (key.near, else 5 % of the key's distance)
// Every channel is a C1 piecewise cubic Hermite in TIME through the key values, with
// Fritsch-Butland (PCHIP) tangents: monotone between keys (no overshoot past a key), the
// velocity is continuous at every key and is zero only where a channel turns round, at a
// `hold: true` key, and at the first and the last key of the film. Positions and targets
// pass through every key exactly. Distance moves evenly in log space, so a 100x dive reads
// as an even zoom; an arc of keys about a target reads as an orbit.
//
// Roll: the camera is aimed with up = +y (lookAt), then rolled about its view axis by
// `roll` degrees (three.js rotateZ). The default, -90, lays the bone axis horizontal:
// scene +y (proximal) to screen left and scene +z (the plate side) to screen top for any
// camera on the -x side of the bone.
//
// The per-key `ease` of pass 1 is ignored (the timing is continuous over the whole take).

export const DEFAULT_ROLL = -90;
export const DEFAULT_FOV = 28;
export const NEAR_FRACTION = 0.05;
export const NEAR_MIN = 0.0005;
export const NEAR_MAX = 25;

const clampN = (x, a, b) => (x < a ? a : x > b ? b : x);

// Merge the beats' keys (same rule as pass 1: same-time keys collapse, the later beat wins).
export function mergeKeys(beats) {
  const raw = [];
  beats.forEach((b, bi) =>
    ((b && b.camera) || []).forEach((k, ki) => raw.push({ ...k, _o: bi * 1000 + ki, _beat: b.id })),
  );
  raw.sort((a, b) => a.t - b.t || a._o - b._o);
  const keys = [];
  for (const k of raw) {
    if (keys.length && Math.abs(keys[keys.length - 1].t - k.t) < 1e-6) keys[keys.length - 1] = k;
    else keys.push(k);
  }
  if (!keys.length) keys.push({ t: 0, pos: [-160, 0, 0], target: [0, 0, 0], fov: DEFAULT_FOV });
  return keys;
}

// Fritsch-Butland tangents (scipy PchipInterpolator): zero at rest keys and where the
// neighbouring slopes differ in sign, else a weighted harmonic mean of the two slopes.
function pchipTangents(ts, ys, rest) {
  const n = ts.length;
  const m = new Float64Array(n);
  if (n < 2) return m;
  const h = [];
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(ts[i + 1] - ts[i]);
    d.push((ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i]));
  }
  for (let i = 1; i < n - 1; i++) {
    if (rest[i]) continue;
    const a = d[i - 1];
    const b = d[i];
    if (a === 0 || b === 0 || Math.sign(a) !== Math.sign(b)) continue;
    const w1 = 2 * h[i] + h[i - 1];
    const w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / a + w2 / b);
  }
  // m[0] = m[n - 1] = 0: the take starts and ends at rest.
  return m;
}

function hermite(t0, t1, y0, y1, m0, m1, t) {
  const h = t1 - t0;
  const s = (t - t0) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * m1;
}

// View direction (unit vector from the target to the camera) <-> azimuth and elevation.
export function dirToAngles(u) {
  const el = Math.asin(clampN(u[1], -1, 1));
  const az = Math.atan2(u[2], -u[0]);
  return [az, el];
}
export function anglesToDir(az, el) {
  const c = Math.cos(el);
  return [-c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
}

export function makeDirector(beats, opts = {}) {
  const defaultRoll = opts.defaultRoll ?? DEFAULT_ROLL;
  const keys = mergeKeys(beats);
  const n = keys.length;
  const ts = keys.map((k) => k.t);
  const rest = keys.map((k, i) => i === 0 || i === n - 1 || !!k.hold);
  // Channel values per key.
  const ch = { tx: [], ty: [], tz: [], az: [], el: [], ld: [], fov: [], roll: [], ln: [] };
  let prevAz = null;
  for (const k of keys) {
    const v = [k.pos[0] - k.target[0], k.pos[1] - k.target[1], k.pos[2] - k.target[2]];
    const d = Math.max(Math.hypot(v[0], v[1], v[2]), 1e-6);
    let [az, el] = dirToAngles([v[0] / d, v[1] / d, v[2] / d]);
    if (prevAz !== null) while (az - prevAz > Math.PI) az -= 2 * Math.PI;
    if (prevAz !== null) while (az - prevAz < -Math.PI) az += 2 * Math.PI;
    prevAz = az;
    ch.tx.push(k.target[0]);
    ch.ty.push(k.target[1]);
    ch.tz.push(k.target[2]);
    ch.az.push(az);
    ch.el.push(el);
    ch.ld.push(Math.log(d));
    ch.fov.push(k.fov ?? DEFAULT_FOV);
    ch.roll.push(k.roll ?? defaultRoll);
    ch.ln.push(Math.log(k.near ?? clampN(d * NEAR_FRACTION, NEAR_MIN, NEAR_MAX)));
  }
  const tan = {};
  for (const name of Object.keys(ch)) tan[name] = pchipTangents(ts, ch[name], rest);

  function channel(name, i, t) {
    const y = ch[name];
    return hermite(ts[i], ts[i + 1], y[i], y[i + 1], tan[name][i], tan[name][i + 1], t);
  }

  // Camera at time t: { t, pos, target, fov, roll, near, distance, segment, u }.
  function at(t) {
    let i;
    let u = 0;
    let tc = t;
    if (n === 1 || t <= ts[0]) {
      i = 0;
      tc = ts[0];
    } else if (t >= ts[n - 1]) {
      i = n - 1;
      tc = ts[n - 1];
    } else {
      i = 0;
      while (i < n - 2 && t >= ts[i + 1]) i++;
      u = (t - ts[i]) / (ts[i + 1] - ts[i]);
    }
    let v;
    if (i >= n - 1 || n === 1) {
      const k = Math.min(i, n - 1);
      v = {};
      for (const name of Object.keys(ch)) v[name] = ch[name][k];
    } else {
      v = {};
      for (const name of Object.keys(ch)) v[name] = channel(name, i, tc);
    }
    const target = [v.tx, v.ty, v.tz];
    const dist = Math.exp(v.ld);
    const dir = anglesToDir(v.az, v.el);
    const pos = [target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist];
    return { t, pos, target, fov: v.fov, roll: v.roll, near: Math.exp(v.ln), distance: dist, segment: Math.min(i, n - 1), u };
  }
  return { keys, at, defaultRoll };
}

// Camera basis as three.js builds it (lookAt with up +y, then rotateZ(roll)):
// returns { right, up, back } unit vectors (back = from the target towards the camera).
export function cameraBasis(pos, target, rollDeg) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const nrm = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const z = nrm(sub(pos, target));
  let x = cross([0, 1, 0], z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-9) x = [1, 0, 0];
  x = nrm(x);
  const y = cross(z, x);
  const r = (rollDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const right = [x[0] * c + y[0] * s, x[1] * c + y[1] * s, x[2] * c + y[2] * s];
  const up = [-x[0] * s + y[0] * c, -x[1] * s + y[1] * c, -x[2] * s + y[2] * c];
  return { right, up, back: z };
}

// Project a scene point for a camera (vertical fov in degrees, aspect w/h): returns
// [ndcX, ndcY, depth] (depth > 0 in front of the camera).
export function project(p, cam, aspect = 16 / 9, basis = null) {
  const B = basis || cameraBasis(cam.pos, cam.target, cam.roll);
  const v = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]];
  const x = v[0] * B.right[0] + v[1] * B.right[1] + v[2] * B.right[2];
  const y = v[0] * B.up[0] + v[1] * B.up[1] + v[2] * B.up[2];
  const z = -(v[0] * B.back[0] + v[1] * B.back[1] + v[2] * B.back[2]);
  const f = Math.tan(((cam.fov * Math.PI) / 180) / 2);
  return [x / z / (f * aspect), y / z / f, z];
}
