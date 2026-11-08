#!/bin/bash
# Join the two captured parts into the seamless hero loop and encode the site's files.
# Usage: encode.sh <frames_dir> <out_dir>             the landscape hero (tour parts callus, cells)
#        encode.sh --portrait <frames_dir> <out_dir>  the portrait hero for phones (phone-callus, phone-cells)
#   <frames_dir>/callus/f0000.png ... and <frames_dir>/cells/f0000.png ..., 30 fps: 14.0 s and 16.5 s
#   (landscape, 1920x1080) or 11.5 s and 13.5 s (portrait, 720x1440).
# The parts are joined by a 0.5 s crossfade. For the loop, the result starts 0.5 s in and its last 0.5 s
# crossfades into its own first 0.5 s, so the last frame leads straight into frame 0 (29.5 s landscape,
# 24.0 s portrait).
set -euo pipefail
PORTRAIT=0
if [ "${1:-}" = "--portrait" ]; then PORTRAIT=1; shift; fi
F=$1
O=$2
mkdir -p "$O"
if [ $PORTRAIT = 1 ]; then
  LEN_A=11.5
  LEN_B=13.5
  MASTER="$O/master-portrait.mp4"
else
  LEN_A=14.0
  LEN_B=16.5
  MASTER="$O/master.mp4"
fi
X=0.5
OFF1=$(python3 -c "print($LEN_A - $X)")
TOTAL=$(python3 -c "print($LEN_A + $LEN_B - $X)")
OFF2=$(python3 -c "print($TOTAL - $X - $X)")

# 1. master: near-lossless, every later file is cut from it
ffmpeg -hide_banner -loglevel warning -y \
  -framerate 30 -i "$F/callus/f%04d.png" -framerate 30 -i "$F/cells/f%04d.png" \
  -filter_complex "[0:v]format=yuv420p,settb=AVTB,setpts=N/30/TB[a];[1:v]format=yuv420p,settb=AVTB,setpts=N/30/TB[b];\
[a][b]xfade=transition=fade:duration=$X:offset=$OFF1,split[o1][o2];\
[o1]trim=start=$X,setpts=PTS-STARTPTS[m];[o2]trim=end=$X,setpts=PTS-STARTPTS[h];\
[m][h]xfade=transition=fade:duration=$X:offset=$OFF2,fps=30[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 10 -pix_fmt yuv420p "$MASTER"

if [ $PORTRAIT = 1 ]; then
  # 2. the phone file: H.264 High 720x1440 (the frames' own size), CRF 28, a keyframe every 2 s, and its poster
  #    (frame 0, Pillow: JPEG quality 90, AVIF quality 70, WebP quality 88) for the page's <picture>
  ffmpeg -hide_banner -loglevel warning -y -i "$MASTER" -an -c:v libx264 -preset slow -crf 28 -profile:v high \
    -pix_fmt yuv420p -g 60 -movflags +faststart "$O/hero-portrait.mp4"
  ffmpeg -hide_banner -loglevel warning -y -i "$MASTER" -frames:v 1 -f image2pipe -c:v png - |
    python3 -c '
import io, sys
from PIL import Image
img = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB")
assert img.size == (720, 1440), img.size
base = sys.argv[1]
img.save(base + ".jpg", "JPEG", quality=90, optimize=True, progressive=True)
img.save(base + ".avif", "AVIF", quality=70, speed=4)
img.save(base + ".webp", "WEBP", quality=88, method=6)
' "$O/hero-portrait-poster"
  ls -l "$O"
  echo "hero-portrait.mp4: $(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=width,height,nb_read_frames,r_frame_rate,profile -of csv=p=0 "$O/hero-portrait.mp4")"
  exit 0
fi

# 2. the site's files: AV1 1080p for large screens that play AV1, H.264 720p for everything else
#    (3.0 MB and 2.5 MB instead of the 7 MB H.264 1080p of the first version; AV1 CRF 54 keeps
#    the UI text as sharp as the source, SSIM 0.990)
ffmpeg -hide_banner -loglevel warning -y -i "$MASTER" -an -c:v libaom-av1 -crf 54 -b:v 0 \
  -cpu-used 6 -row-mt 1 -tiles 2x2 -pix_fmt yuv420p -g 60 -movflags +faststart "$O/hero-av1.mp4"
ffmpeg -hide_banner -loglevel warning -y -i "$MASTER" -an -vf "scale=1280:720:flags=lanczos" \
  -c:v libx264 -preset slow -crf 28 -profile:v high -pix_fmt yuv420p -g 60 -movflags +faststart "$O/hero.mp4"
ffmpeg -hide_banner -loglevel warning -y -i "$MASTER" -frames:v 1 -update 1 -q:v 4 "$O/hero-poster.jpg"
ls -l "$O"
for f in hero-av1.mp4 hero.mp4; do
  echo "$f: $(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=width,height,nb_read_frames,r_frame_rate -of csv=p=0 "$O/$f")"
done
