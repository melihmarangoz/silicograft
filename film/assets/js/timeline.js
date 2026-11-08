// SG-Bone dive: the film's timeline (pass 3, SPEC P3-1). Pure data and functions, no three.js,
// so the engine, the beats, the camera planner (node) and the website share one definition.
//
//   beat  seconds  content                                              simulated day
//   b1     0-6     defect and load, half cut at 4.0 s                   0
//   b2     6-14    cell stop 1, ilik_ucu (marrow opening)               0 -> 30
//   b3    14-20    macro: tissue forms, three-quarter of the half callus 30 -> 120
//   c2    20-27    cell stop 2, korteks_ucu (proximal cortex corner)     120 -> 220
//   c3    27-34    cell stop 3, plak_alti (under the plate)              220 -> 357
//   b4    34-40    stiffness (pass-2 b4 + 16 s)                          357 (E replay)
//   b5    40-46    strain (pass-2 b5 + 16 s)                             357
//   b6    46-52    decision plane and the return arc (pass-2 b6 + 16 s)  357
//
// 52 s, 1560 frames at 30 fps. Hero loop for the website: 6.5-16.5 s.

export const FPS = 30;
export const DURATION = 52;
export const FRAMES = DURATION * FPS; // 1560

export const BEATS = Object.freeze([
  { id: "b1", start: 0, end: 6, days: [0, 0] },
  { id: "b2", start: 6, end: 14, days: [0, 30], region: "ilik_ucu" },
  { id: "b3", start: 14, end: 20, days: [30, 120] },
  { id: "c2", start: 20, end: 27, days: [120, 220], region: "korteks_ucu" },
  { id: "c3", start: 27, end: 34, days: [220, 357], region: "plak_alti" },
  { id: "b4", start: 34, end: 40, days: [357, 357] },
  { id: "b5", start: 40, end: 46, days: [357, 357] },
  { id: "b6", start: 46, end: 52, days: [357, 357] },
]);
export const BEAT_IDS = Object.freeze(BEATS.map((b) => b.id));
export const BOUNDARIES = Object.freeze([0, 6, 14, 20, 27, 34, 40, 46, 52]);
// Pass 2 -> pass 3: b4, b5 and b6 play 16 s later (every absolute time inside them).
export const SHIFT_B456 = 16;
export const HERO_LOOP = Object.freeze([6.5, 16.5]);

export function beat(id) {
  return BEATS.find((b) => b.id === id) || null;
}

// ---------------------------------------------------------------------------------------
// Day track (SPEC P3-1): monotonic, continuous, and its rate continuous too (C1).
// A piecewise cubic Hermite through the knots (t, day) with the slopes below (days per
// second). The slopes are the Fritsch-Butland (PCHIP) tangents of the knots, so the track
// never overshoots and never runs backwards; they are fixed numbers here so any other
// implementation (the website) reproduces the track exactly:
//
//   t (s)   0    6    14         20          27          34   52
//   day     0    0    30         120         220         357  357
//   slope   0    0    6.176471   14.643304   16.515973   0    0
//
// Between knots i and i+1, with h = t1 - t0 and s = (t - t0) / h:
//   day(t) = (2s^3 - 3s^2 + 1) d0 + (s^3 - 2s^2 + s) h m0 + (-2s^3 + 3s^2) d1 + (s^3 - s^2) h m1
// Before 0 s: day 0; after 52 s: day 357. The day is 0 until 6 s, starts at rest, arrives on
// 357 at rest at 34 s and holds it.
export const DAY_KNOTS = Object.freeze([
  [0, 0, 0],
  [6, 0, 0],
  [14, 30, 6.176471],
  [20, 120, 14.643304],
  [27, 220, 16.515973],
  [34, 357, 0],
  [52, 357, 0],
]);

export function dayAt(t) {
  const K = DAY_KNOTS;
  if (!(t > K[0][0])) return K[0][1];
  if (t >= K[K.length - 1][0]) return K[K.length - 1][1];
  let i = 0;
  while (i < K.length - 2 && t >= K[i + 1][0]) i++;
  const [t0, d0, m0] = K[i];
  const [t1, d1, m1] = K[i + 1];
  const h = t1 - t0;
  const s = (t - t0) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * d0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * d1 + (s3 - s2) * h * m1;
}

// Rate of the day track (days per second), for checks.
export function dayRateAt(t, dt = 1e-4) {
  return (dayAt(t + dt) - dayAt(t - dt)) / (2 * dt);
}

// Inverse of the day track on its rising part (6-34 s): the first time the day reaches d.
export function timeOfDay(d) {
  if (d <= 0) return 6;
  if (d >= 357) return 34;
  let a = 6;
  let b = 34;
  for (let k = 0; k < 60; k++) {
    const m = 0.5 * (a + b);
    if (dayAt(m) < d) a = m;
    else b = m;
  }
  return 0.5 * (a + b);
}
