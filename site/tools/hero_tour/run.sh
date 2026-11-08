#!/bin/bash
# Run one part of the tour on the capture machine. Usage: run.sh <part> <outdir> [tour.mjs options]
# Node in ~/node, puppeteer-core in node_modules next to this script, and a Chrome headless shell: $CHROME, or
# the first one found where `npx @puppeteer/browsers install chrome-headless-shell@stable --path ~/hero/chs`
# (2026-11-08, portrait) or hyperframes (2026-11-08, landscape) put it.
unset DISPLAY WAYLAND_DISPLAY
export PATH=$HOME/node/bin:$PATH
if [ -z "${CHROME:-}" ]; then
  CHROME=$(ls $HOME/hero/chs/chrome-headless-shell/*/chrome-headless-shell-linux64/chrome-headless-shell \
    $HOME/.cache/hyperframes/chrome/chrome-headless-shell/*/chrome-headless-shell-linux64/chrome-headless-shell 2>/dev/null | head -1)
  export CHROME
fi
cd "$(dirname "$0")"
exec node tour.mjs "$@"
