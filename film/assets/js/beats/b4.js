// Beat b4 "Tissue sets the stiffness" (frames 1020-1199, 34-40 s, day 357).
//
// Pass 3 (SPEC P3-1): the pass-2 beat played 16 s later (SHIFT); every absolute time below is
// the pass-2 time + 16 s, so the beat looks exactly as in pass 2. The frame numbers in the
// comments are pass-2 frames (+480 for pass 3).
//
// The one hero move of this beat, and the only orbit of the film: 25 deg around the half
// callus's cut face, from b3's three-quarter view (looking along the bone from the distal
// side, elevation -25 deg) to face-on (camera on -x). The bone stays horizontal (the
// director's default roll), plate on top.
//
// What the cut face does (all on parts.callus_cut; colours only from the run's data):
//   1. frames 540-558  hand-off from voxels to the per-pixel tissue face. The face enters
//      only where the slab at the cut holds bone, cartilage or fibrous tissue: there it
//      lies 0.05 mm in front of the opaque voxel faces of the same colour, so nothing
//      changes but the bevel. Where the slab holds stem cells (which b3 left translucent
//      at 40 %) or is empty, the face stays fully transparent, so the bone b3 showed through
//      the stem cells stays visible. This needs a per-code alpha the engine's cut material
//      does not have; this beat adds it (see "Cut-face alpha").
//   2. frames 558-588  tissue -> E (viridis), 30 f power1.inOut, at the first FE row
//      (day 6). The stem-cell and empty pixels gain opacity with the same blend, so the
//      whole face turns into the stiffness map at once and is opaque when the blend ends.
//   3. frames 588-708  E replays the FE days 6 -> 357 (rows 0 -> 117) linearly over 120 f.
//   4. frames 678-690  the voxels behind the (now opaque) face exit (12 f power2.in), once
//      the orbit is within a few degrees of face-on, so no block peeks past the face's
//      outline while they go.
//   5. frames 708-719  holds on the day-357 E map, face-on (b5 blends it to strain).
// No text, no scale bar: the site writes the colour scale beside the frames.
//
// State written in [34, 40): half, day, cutOpacity, voxelOpacity, stemOpacity (b3's
// extension), fieldMode, fieldBlend, eDayIndex. Own objects: none (one shader patch).

const F = (n) => n / 30; // frames -> seconds
const SHIFT = 16; // pass 3: the pass-2 beat, 16 s later (timeline.js SHIFT_B456)
const START = 18 + SHIFT;
const END = 24 + SHIFT;

// Field timing (seconds).
const FACE_IN = START; // solid-tissue pixels of the face enter (18 f, power2.out)
const FACE_IN_FRAMES = 18;
const BLEND_START = START + F(18); // tissue -> E
const BLEND_FRAMES = 30;
const REPLAY_START = BLEND_START + F(BLEND_FRAMES); // E rows 0 -> last
const REPLAY_FRAMES = 120;
const VOX_OUT = START + F(138); // 22.6 s: voxel exit start (12 f, power2.in)
const VOX_OUT_FRAMES = 12;
// The engine makes a part transparent only while its opacity is < 0.999; the per-code
// alpha needs a transparent face, so the face stays at this opacity until the blend ends.
const SEE_THROUGH = 0.998;

// ---------------------------------------------------------------------------------------
// Camera (pass 2): the film's single orbit, 25 deg about the cut face's centre. The
// director interpolates azimuth, elevation and log distance about the target, so keys on
// an arc give a true arc. Elevation -25 -> 0 deg and azimuth 3 -> 0 deg, distance 92 -> 86
// mm; the inner keys sit at the quarter points of a sine.inOut angular progress (20 s:
// el -18.75, az 2.0, 90 mm; 22 s: el -6.25, az 1.0, 88 mm) so the orbit starts and ends
// gently. The first key (= b3's last) and the last key (= b5's first) are boundary keys of
// the contract (ENGINE.md, "Pass 2 boundary keys"); keep them exactly.
const FOV = 28;
const CAMERA = [
  // Integration pass 2: a constant 86 mm radius (was 92 -> 90 -> 88 -> 86 mm), same angles,
  // so the orbit is a true arc and the 18 s frame fills more of the frame.
  { t: 18 + SHIFT, pos: [-77.836, -35.345, 2.079], target: [0, 1, -2], fov: FOV },
  { t: 20 + SHIFT, pos: [-81.386, -26.977, 0.842], target: [0, 0.667, -2], fov: FOV },
  { t: 22 + SHIFT, pos: [-85.476, -9.029, -0.508], target: [0, 0.333, -2], fov: FOV },
  { t: 24 + SHIFT, pos: [-86, 0, -2], target: [0, 0, -2], fov: FOV },
];

// ---------------------------------------------------------------------------------------
// Cut-face alpha (an extension of the engine's cut material, chained onto its
// onBeforeCompile). Per fragment the voxel code of the slab at the cut is looked up again
// (the engine's uSgTissue / uSgGrid / vSgYZ, the same nearest-neighbour texel the albedo
// uses) and the fragment alpha is multiplied by
//   uSgB4Alpha.x  for bone, cartilage and fibrous tissue (codes 2, 4, 5),
//   uSgB4Alpha.y  for stem cells (1, 3) and empty blocks / outside the grid (0).
// Both are 1 outside this beat's window, which makes the patch a no-op. The alpha only
// shows while the material is transparent (cutOpacity < 0.999, see SEE_THROUGH); the
// engine draws the face after the voxels (renderOrder 1), so it composites over them.
function patchCutAlpha(ctx) {
  const { THREE } = ctx;
  const mesh = ctx.parts.callus_cut;
  if (!mesh || !mesh.material) return null;
  const mat = mesh.material;
  const uAlpha = { value: new THREE.Vector2(1, 1) };
  const prevCompile = mat.onBeforeCompile;
  const prevKey = Object.prototype.hasOwnProperty.call(mat, "customProgramCacheKey") ? mat.customProgramCacheKey : null;
  mat.onBeforeCompile = function (sh, renderer) {
    if (typeof prevCompile === "function") prevCompile.call(this, sh, renderer);
    if (!sh.fragmentShader.includes("uSgTissue")) return; // the engine's patch is missing
    sh.uniforms.uSgB4Alpha = uAlpha;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec2 uSgB4Alpha;")
      .replace(
        "#include <alphatest_fragment>",
        `if ( uSgB4Alpha.x < 1.0 || uSgB4Alpha.y < 1.0 ) {
  vec2 sgB4UV = ( vSgYZ - uSgGrid.xy ) / uSgGrid.zw;
  int sgB4Code = 0;
  if ( all( greaterThanEqual( sgB4UV, vec2( 0.0 ) ) ) && all( lessThan( sgB4UV, vec2( 1.0 ) ) ) )
    sgB4Code = int( texture2D( uSgTissue, sgB4UV ).r * 255.0 + 0.5 );
  bool sgB4Solid = sgB4Code == 2 || sgB4Code == 4 || sgB4Code == 5;
  diffuseColor.a *= sgB4Solid ? uSgB4Alpha.x : uSgB4Alpha.y;
}
#include <alphatest_fragment>`,
      );
  };
  mat.customProgramCacheKey = function () {
    return `${prevKey ? prevKey.call(this) : "sg-cut-face"}|sg-b4-alpha`;
  };
  mat.needsUpdate = true;
  return uAlpha;
}

export default {
  id: "b4",
  start: START,
  end: END,
  camera: CAMERA,
  async build(ctx) {
    this._uAlpha = patchCutAlpha(ctx);
  },
  update(t, ctx) {
    const { util } = ctx;
    const inWindow = t >= this.start && t < this.end;
    const uAlpha = this._uAlpha;

    // Per-code alpha: a function of t alone, reset to the no-op outside the window.
    const solidIn = util.tween(t, FACE_IN, F(FACE_IN_FRAMES), "power2.out");
    const blend = util.tween(t, BLEND_START, F(BLEND_FRAMES), "power1.inOut");
    if (uAlpha) {
      if (inWindow && blend < 1) uAlpha.value.set(solidIn, blend);
      else uAlpha.value.set(1, 1);
    }
    if (!inWindow) return;

    const s = ctx.state;
    s.half = 1;
    s.day = 357;
    // The face: see-through while the per-code alpha works, opaque once the blend is done.
    s.cutOpacity = !uAlpha ? solidIn : blend < 1 ? SEE_THROUGH : 1;
    // Voxels: b3's look (translucent stem cells over its bone overlay) until they leave
    // behind the opaque face. The engine makes the voxel material transparent below 0.999,
    // which b3's stem-cell alpha needs.
    s.voxelOpacity = Math.min(SEE_THROUGH, 1 - util.tween(t, VOX_OUT, F(VOX_OUT_FRAMES), "power2.in"));
    const b3 = ctx.shared.b3;
    if (b3 && typeof b3.STEM_OPACITY_END === "number") s.stemOpacity = b3.STEM_OPACITY_END;
    // Tissue -> E, then the E replay over the FE days (rows are 3 days apart, so linear in
    // the row index is linear in days: 6 + 3 * row).
    s.fieldMode = "E";
    s.fieldBlend = blend;
    const lastRow = (ctx.data.feDays?.length ?? 118) - 1;
    s.eDayIndex = lastRow * util.tween(t, REPLAY_START, F(REPLAY_FRAMES), "linear");
  },
};
