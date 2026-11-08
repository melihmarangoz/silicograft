#!/usr/bin/env bash
# film_clips.sh: cut the rendered SG-Bone film into the website's stage clips and their posters.
# The model section (index.html, #model) shows one short looping clip per stage of the model loop.
#
# Usage (from anywhere):
#   site/tools/film_clips.sh FILM.mp4 [options]
#   e.g. site/tools/film_clips.sh film/renders/silicograft-dive.mp4
#        site/tools/film_clips.sh film/renders/silicograft-dive.mp4 --portrait-only
#
# Options:
#   --stages FILE   stage definition (default: film_stages.json beside this script): the film
#                   duration, the stage boundaries in seconds, one poster time per stage
#                   ("still"), optional "holds" ([{at, seconds}]: freeze the frame at film time
#                   'at' for that long inside the clip) and the phone crop ("portrait", below).
#                   Edit that file, not this one, when the film's timing changes.
#   --crf N         H.264 quality of the 720p clips (default 28; lower is sharper and larger).
#   --av1-crf N     AV1 quality of the 1080p clips (default 38). AV1 keeps the burnt-in labels and
#                   the thin cell processes clean at about a third of the H.264 size (measured
#                   2026-11-08: stage 3, 10.9 MB H.264 CRF 24 -> 5.2 MB AV1 CRF 36, SSIM 0.98).
#   --portrait-crf N  H.264 quality of the 4:5 phone clips (default 28).
#   --portrait-only write only the phone clips and their posters (stage-N-portrait.*), straight
#                   into the existing clips/ and stills/ folders: no folder swap, the landscape
#                   clips and posters are not touched, and clips/clips.json is updated in place.
#                   Use it after changing a "portrait" crop. A full run (without this option)
#                   writes the phone clips too, because it replaces the whole folders.
#   --webm          also write a VP9 WebM of each 1080p clip (off by default: on this film VP9 at
#                   equal sharpness was not smaller than H.264, measured 2026-11-08).
#   --threads N     ffmpeg threads (default 6). Clips are encoded one at a time.
#
# Writes, under site/assets/film/:
#   clips/stage-N-av1.mp4    film range of stage N, 1920x1080, AV1 (libaom), no audio, faststart;
#                            served to screens of 60rem and wider whose browser plays AV1
#   clips/stage-N-720.mp4    the same at 1280x720, H.264 high: phones and browsers without AV1
#   clips/stage-N-portrait.mp4  the same film range and holds cropped to 720x900 (4:5), H.264 high:
#                            phones (40rem and narrower) show it full width above the stage text
#   clips/stage-N.webm       (only with --webm) VP9, 1920x1080
#   clips/clips.json         {source, fps, stages: [{stage, title, start, end, frames, files, bytes,
#                            portrait: {file, bytes, poster, crop}}]}
#   stills/stage-N.jpg       the poster of clip N, 1280x720 (the film frame at the stage's "still" time)
#   stills/stage-N-640.jpg   the same at 640x360
#   stills/stage-N-portrait.jpg/.avif/.webp  the poster of the phone clip, 720x900, cropped like
#                            the clip at the "still" time (Pillow: JPEG q90, AVIF q70, WebP q88)
#
# It does not touch the hero files (assets/film/hero*): the hero comes from a separate recording.
# A full run replaces stills/ as a whole, so remake the 1280/1920 AVIF/WebP landscape posters
# afterwards with optimize_images.py --render (see site/DEPLOY.md).
#
# Each clip is re-encoded from an accurate seek, so it starts on the stage's first film frame and
# holds round((end - start) * fps) film frames, plus round(seconds * fps) repeated frames per hold:
# the clips together cover the film once. Keyframes every 2 s keep looping and seeking cheap.
#
# The phone crop ("portrait" in the stage file) is a full-height window of the film, 'w' film
# pixels wide, whose left edge 'x' is one number or moves between keyframes [[film s, x], ...]
# ('ease': "smooth" (default, smoothstep per segment) or "linear"). w = 864 of a 1920x1080 film
# is exactly 4:5 and is scaled to 720x900. A wider window (labels or a diagram wider than 864 px)
# is scaled to 720 wide and padded above and below to 900 with the page colour (--color-paper,
# oklch(14% 0.048 264) = sRGB #02071d). The crop is applied before the holds, so a held frame
# keeps the crop of its film time. Each window was chosen from frames of the film so that the
# burnt-in cell-type labels (stages 2 to 4), the plate, the cells and the strain-plane diagram
# (stage 7) stay whole while they are on screen; its "why" says what it keeps.
#
# Needs ffmpeg, ffprobe and python3, with Pillow >= 11 (AVIF) for the phone posters. Work happens
# in /tmp/silicograft-film-clips (one run at a time, under a lock). In a full run the finished
# folders are copied next to the old ones and swapped in by rename; the old ones are moved into
# the work folder, which is removed at the end. With --portrait-only each finished file is copied
# in as NAME.new and renamed over NAME.
set -euo pipefail

W=1920; H=1080     # the large clips
MW=1280; MH=720    # the small clips and the posters
LW=640; LH=360     # the small posters
PW=720; PH=900     # the phone clips and their posters (4:5)
PAD_COLOR=0x02071D # the page colour (tokens.css --color-paper) for letterboxed phone crops
CRF=28
AV1_CRF=38
PORTRAIT_CRF=28
GOP_SECONDS=2
THREADS=6
STILL_Q=3          # mjpeg -q:v (2 best .. 31 worst)

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
site="$(cd "$here/.." && pwd)"
out="$site/assets/film"
stages_json="$here/film_stages.json"

src=""; webm=0; portrait_only=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stages) stages_json="$(realpath "$2")"; shift 2 ;;
    --crf) CRF="$2"; shift 2 ;;
    --av1-crf) AV1_CRF="$2"; shift 2 ;;
    --portrait-crf) PORTRAIT_CRF="$2"; shift 2 ;;
    --portrait-only) portrait_only=1; shift ;;
    --webm) webm=1; shift ;;
    --threads) THREADS="$2"; shift 2 ;;
    -h|--help) sed -n '2,/^set -euo pipefail/{/^set /!p}' "$0"; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) src="$(realpath "$1")"; shift ;;
  esac
done
[[ -n "$src" ]] || { echo "usage: $0 FILM.mp4 [options]  (see --help)" >&2; exit 2; }
[[ -f "$src" ]] || { echo "film not found: $src" >&2; exit 1; }
[[ -f "$stages_json" ]] || { echo "stage file not found: $stages_json" >&2; exit 1; }
for tool in ffmpeg ffprobe python3; do command -v "$tool" >/dev/null || { echo "$tool not found" >&2; exit 1; }; done
python3 -c "from PIL import features; import sys; sys.exit(0 if features.check('avif') else 1)" 2>/dev/null || {
  echo "python3 needs Pillow >= 11 with AVIF for the phone posters" >&2; exit 1; }
if [[ $portrait_only -eq 1 ]]; then
  [[ -d "$out/clips" && -d "$out/stills" ]] || { echo "--portrait-only needs the existing $out/clips and $out/stills" >&2; exit 1; }
fi

# One run at a time: the work folder has a fixed name, so it can be removed by its literal path.
exec 9>/tmp/silicograft-film-clips.lock
flock -n 9 || { echo "another film_clips.sh run holds /tmp/silicograft-film-clips.lock" >&2; exit 1; }
rm -rf /tmp/silicograft-film-clips
mkdir -p /tmp/silicograft-film-clips/old /tmp/silicograft-film-clips/clips /tmp/silicograft-film-clips/stills
trap 'rm -rf /tmp/silicograft-film-clips' EXIT
work=/tmp/silicograft-film-clips
ff() { ffmpeg -hide_banner -loglevel error -nostdin -y -threads "$THREADS" "$@"; }
cfg() { python3 -c "import json,sys; c=json.load(open(sys.argv[1])); print($1)" "$stages_json"; }
kb() { echo $(( $(stat -c %s "$1") / 1000 )); }
count_frames() { ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$1"; }

# ---- the stage file and the source film -----------------------------------------------------
cfg_duration="$(cfg 'c["duration"]')"
n_stages="$(cfg 'len(c["stages"])')"
n_bounds="$(cfg 'len(c["boundaries"])')"
[[ $((n_stages + 1)) -eq $n_bounds ]] || { echo "stage file: $n_stages stages need $((n_stages + 1)) boundaries, not $n_bounds" >&2; exit 1; }
read -r -a bounds <<< "$(cfg '" ".join(str(b) for b in c["boundaries"])')"
read -r -a still_times <<< "$(cfg '" ".join(str(s["still"]) for s in c["stages"])')"

probe() { ffprobe -v error -select_streams v:0 -show_entries "$1" -of default=nw=1:nk=1 "$src" | head -1; }
duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$src")"
src_fps="$(probe stream=r_frame_rate)"
src_w="$(probe stream=width)"; src_h="$(probe stream=height)"
fps="$(python3 -c "n, _, d = '$src_fps'.partition('/'); print(float(n) / float(d or 1))")"
python3 -c "import sys; sys.exit(0 if abs($duration - $cfg_duration) < 0.5 else 1)" || {
  echo "the film is $duration s but the stage file says $cfg_duration s: update $stages_json first" >&2; exit 1; }
gop="$(python3 -c "print(round($fps * $GOP_SECONDS))")"
if [[ $portrait_only -eq 1 ]]; then what="$n_stages phone clips, CRF $PORTRAIT_CRF"; else what="$n_stages clips, CRF $CRF"; fi
echo "source: $src (${src_w}x${src_h}, $src_fps fps, $duration s) -> $what"

x264=(-c:v libx264 -preset slow -crf "$CRF" -profile:v high -pix_fmt yuv420p -g "$gop" -movflags +faststart -an)
x264p=(-c:v libx264 -preset slow -crf "$PORTRAIT_CRF" -profile:v high -pix_fmt yuv420p -g "$gop" -movflags +faststart -an)
av1=(-c:v libaom-av1 -crf "$AV1_CRF" -b:v 0 -cpu-used 6 -row-mt 1 -tiles 2x2 -pix_fmt yuv420p -g "$gop" -movflags +faststart -an)

# plan STAGE_INDEX START END: prints four lines for one stage:
#   1. the clip's frame count
#   2. the hold chain (",loop=...,setpts=...,fps=..." or empty), appended after the crop
#   3. the phone filter chain of the clip (",format,crop,scale[,pad]"; the crop's x runs on film time)
#   4. the phone filter chain of its poster (the same crop at the "still" time, in RGB)
plan() {
  python3 - "$stages_json" "$1" "$2" "$3" "$fps" "$src_w" "$src_h" "$PW" "$PH" "$PAD_COLOR" <<'PY'
import json, sys
c = json.load(open(sys.argv[1])); i = int(sys.argv[2]); a, b, fps = map(float, sys.argv[3:6])
sw, sh, pw, ph = map(int, sys.argv[6:10]); pad = sys.argv[10]
st = c["stages"][i]
holds = sorted(st.get("holds", []), key=lambda h: h["at"])
for h in holds:
    assert a < h["at"] < b, f"hold at {h['at']} s is outside stage {i + 1} ({a}-{b} s)"
frames = round((b - a) * fps) + sum(round(h["seconds"] * fps) for h in holds)
# one linear chain: each hold repeats one frame with the loop filter (a split/trim/concat graph dropped
# frames when feeding two encoders), then the timestamps are renumbered
g = ""
added = 0
for h in holds:
    n = round(h["seconds"] * fps)
    g += f",loop=loop={n}:size=1:start={round((h['at'] - a) * fps) + added}"
    added += n
if holds:  # renumber the timestamps and restate the rate: after loop the link has none and the encoder fell back to 25 fps
    g += f",setpts=N/({fps:g}*TB),fps={fps:g}"

# the phone crop: a full-height window, w wide, left edge x (constant or keyframed on film time)
p = st.get("portrait") or {"w": round(sh * pw / ph), "x": (sw - round(sh * pw / ph)) / 2}
w = int(p["w"])
assert round(sh * pw / ph) <= w <= sw, f"stage {i + 1}: portrait w {w} must be {round(sh * pw / ph)}..{sw}"
oh = 2 * round(sh * pw / w / 2)  # scaled height, even; 900 when w is 4:5 of the film height
keys = p["x"] if isinstance(p["x"], list) else [[a, p["x"]]]
assert all(k1[0] > k0[0] for k0, k1 in zip(keys, keys[1:])), f"stage {i + 1}: portrait keyframes must be in time order"
ease = p.get("ease", "smooth")
assert ease in ("smooth", "linear"), f"stage {i + 1}: portrait ease must be smooth or linear"

def crop_x(t0):
    """ffmpeg crop x expression: the keyframes on film time T = t0 + n / fps (n: frame of this input)."""
    T = f"({t0:g}+n/{fps:g})"
    e = f"{keys[0][1]:g}"
    for (ta, xa), (tb, xb) in zip(keys, keys[1:]):
        if xb == xa: continue
        s = f"clip(({T}-{ta:g})/{tb - ta:g},0,1)"
        if ease == "smooth": s = f"{s}*{s}*(3-2*{s})"
        e += f"+({xb - xa:g})*{s}"
    return f"clip({e},0,iw-ow)"

def chain(t0, fmt):
    ch = f",format={fmt},crop=w={w}:h={sh}:x='{crop_x(t0)}':y=0,scale={pw}:{oh}:flags=lanczos"
    if oh < ph: ch += f",pad={pw}:{ph}:0:{(ph - oh) // 2}:color={pad}"
    return ch

print(frames)
print(g)
print(chain(a, "yuv444p"))
print(chain(float(st["still"]), "gbrp"))
PY
}

# ---- clips and posters ----------------------------------------------------------------------
for ((i = 0; i < n_stages; i++)); do
  n=$((i + 1)); a="${bounds[$i]}"; b="${bounds[$((i + 1))]}"; t="${still_times[$i]}"
  planned="$(plan "$i" "$a" "$b")"  # a failed check in the stage file stops the run here
  { read -r frames; read -r holds; read -r pchain; read -r pstill; } <<< "$planned"
  span="$(python3 -c "print($b - $a)")"

  if [[ $portrait_only -eq 0 ]]; then
    ff -ss "$a" -t "$span" -i "$src" \
       -filter_complex "[0:v]setsar=1$holds,split[x][y];[x]scale=$W:$H:flags=lanczos[big];[y]scale=$MW:$MH:flags=lanczos[small]" \
       -map "[big]" -frames:v "$frames" "${av1[@]}" "$work/clips/stage-$n-av1.mp4" \
       -map "[small]" -frames:v "$frames" "${x264[@]}" "$work/clips/stage-$n-720.mp4"
    if [[ $webm -eq 1 ]]; then
      ff -ss "$a" -t "$span" -i "$src" -frames:v "$frames" -an -filter_complex "[0:v]setsar=1$holds,scale=$W:$H:flags=lanczos[big]" -map "[big]" \
         -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -tile-columns 2 -deadline good -cpu-used 2 -g "$gop" \
         -pix_fmt yuv420p "$work/clips/stage-$n.webm"
    fi
    got="$(count_frames "$work/clips/stage-$n-720.mp4")"
    [[ "$got" -eq "$frames" ]] || { echo "clip $n: $got frames, expected $frames" >&2; exit 1; }
    ff -ss "$t" -i "$src" -filter_complex "[0:v]setsar=1,split[x][y];[x]scale=$MW:$MH:flags=lanczos[big];[y]scale=$LW:$LH:flags=lanczos[small]" \
       -map "[big]" -frames:v 1 -q:v "$STILL_Q" "$work/stills/stage-$n.jpg" \
       -map "[small]" -frames:v 1 -q:v "$STILL_Q" "$work/stills/stage-$n-640.jpg"
    echo "clip $n: film $a-$b s, $frames frames, $(kb "$work/clips/stage-$n-av1.mp4") kB (1080p AV1), $(kb "$work/clips/stage-$n-720.mp4") kB (720p), poster at $t s"
  fi

  # the phone clip: crop first (on film time), then the holds, so a held frame keeps its crop
  ff -ss "$a" -t "$span" -i "$src" -filter_complex "[0:v]setsar=1$pchain$holds[p]" \
     -map "[p]" -frames:v "$frames" "${x264p[@]}" "$work/clips/stage-$n-portrait.mp4"
  got="$(count_frames "$work/clips/stage-$n-portrait.mp4")"
  [[ "$got" -eq "$frames" ]] || { echo "phone clip $n: $got frames, expected $frames" >&2; exit 1; }
  ff -ss "$t" -i "$src" -filter_complex "[0:v]setsar=1$pstill[p]" -map "[p]" -frames:v 1 "$work/stills/stage-$n-portrait.png"
  python3 - "$work/stills/stage-$n-portrait.png" "$work/stills/stage-$n-portrait" <<'PY'
import os, sys
from PIL import Image
img = Image.open(sys.argv[1]).convert("RGB"); base = sys.argv[2]
img.save(base + ".jpg", "JPEG", quality=90, optimize=True, progressive=True)
img.save(base + ".avif", "AVIF", quality=70, speed=4)
img.save(base + ".webp", "WEBP", quality=88, method=6)
os.remove(sys.argv[1])
PY
  echo "phone clip $n: $frames frames, $(kb "$work/clips/stage-$n-portrait.mp4") kB (720x900), poster $(kb "$work/stills/stage-$n-portrait.jpg") kB jpg, $(kb "$work/stills/stage-$n-portrait.avif") kB avif"
done

# ---- install (--portrait-only): each new file is copied in as NAME.new and renamed over NAME --
if [[ $portrait_only -eq 1 ]]; then
  install_file() { # folder name
    cp "$work/$1/$2" "$out/$1/$2.new"
    mv "$out/$1/$2.new" "$out/$1/$2"
  }
  for ((i = 0; i < n_stages; i++)); do
    n=$((i + 1))
    install_file clips "stage-$n-portrait.mp4"
    for ext in jpg avif webp; do install_file stills "stage-$n-portrait.$ext"; done
  done
fi

# ---- clips.json -----------------------------------------------------------------------------
# A full run writes it for the new clips folder; --portrait-only rewrites it from the installed
# folder (the landscape entries keep their files and the CRF of the run that made them).
if [[ $portrait_only -eq 1 ]]; then json_dir="$out/clips"; else json_dir="$work/clips"; fi
python3 - "$json_dir" "$stages_json" "$(basename "$src")" "$fps" "$CRF" "$PORTRAIT_CRF" "$portrait_only" <<'PY'
import json, os, sys
folder, stages_json, name, fps, crf, pcrf, portrait_only = sys.argv[1:]
fps = float(fps); crf = int(crf)
old = os.path.join(folder, "clips.json")
if portrait_only == "1" and os.path.exists(old):
    crf = json.load(open(old)).get("crf", crf)
cfg = json.load(open(stages_json))
b = cfg["boundaries"]
stages = []
for i, s in enumerate(cfg["stages"]):
    n = s["stage"]
    files = [f for f in (f"stage-{n}-av1.mp4", f"stage-{n}-720.mp4", f"stage-{n}.webm") if os.path.exists(os.path.join(folder, f))]
    entry = {
        "stage": n, "title": s["title"], "start": b[i], "end": b[i + 1],
        "frames": round((b[i + 1] - b[i]) * fps) + sum(round(h["seconds"] * fps) for h in s.get("holds", [])),
        "holds": s.get("holds", []), "poster": f"stills/stage-{n}.jpg", "posterTime": s["still"],
        "files": files, "bytes": {f: os.path.getsize(os.path.join(folder, f)) for f in files},
    }
    pf = f"stage-{n}-portrait.mp4"
    if os.path.exists(os.path.join(folder, pf)):
        entry["portrait"] = {"file": pf, "bytes": os.path.getsize(os.path.join(folder, pf)),
                             "poster": f"stills/stage-{n}-portrait.jpg",
                             "crop": {k: v for k, v in s.get("portrait", {}).items() if k != "why"}}
    stages.append(entry)
tmp = old + ".new"
with open(tmp, "w") as f:
    json.dump({"source": name, "fps": fps, "crf": crf, "portraitCrf": int(pcrf), "stages": stages}, f, indent=1)
os.replace(tmp, old)
total = sum(sum(s["bytes"].values()) + s.get("portrait", {}).get("bytes", 0) for s in stages)
ptotal = sum(s.get("portrait", {}).get("bytes", 0) for s in stages)
print(f"clips.json: {len(stages)} clips, {total / 1e6:.1f} MB in all, {ptotal / 1e6:.1f} MB of it phone clips")
PY

if [[ $portrait_only -eq 1 ]]; then
  echo "done: phone clips and posters in $out/clips and $out/stills"
  exit 0
fi

# ---- install --------------------------------------------------------------------------------
# A finished folder is copied in as NAME.new, the old NAME is moved into the work folder (removed
# on exit), and NAME.new is renamed to NAME. Nothing under site/ is deleted in place.
mkdir -p "$out"
swap_in() { # name
  local name="$1"
  if [[ -e "$out/$name.new" ]]; then mv "$out/$name.new" "$work/old/$name.new-stale"; fi
  cp -r "$work/$name" "$out/$name.new"
  if [[ -e "$out/$name" ]]; then mv "$out/$name" "$work/old/$name"; fi
  mv "$out/$name.new" "$out/$name"
}
swap_in clips
swap_in stills
echo "done: $out/clips ($(du -sh "$out/clips" | cut -f1)), $out/stills"
