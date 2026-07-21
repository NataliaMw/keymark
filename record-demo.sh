#!/bin/bash
# Keymark demo recorder.
# ONE-TIME SETUP: grant your terminal (Terminal.app / iTerm) Screen Recording permission:
#   System Settings > Privacy & Security > Screen Recording > enable your terminal, then restart it.
#
# Usage:
#   bash record-demo.sh          # records ~180s of the full screen to keymark-demo.mov
#   bash record-demo.sh 150      # record for 150 seconds instead
#
# While it records, follow VIDEO_SCRIPT.md: click 01 -> 02 -> 03 (Simulate copy ring) -> 04 (Run transplant attack).
# Tip: use the "Run 90-second proof demo" button to auto-advance if you prefer.

set -e
DUR="${1:-180}"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/keymark-demo.mov"

echo "Starting Keymark server..."
( cd "$DIR" && node server.js >/tmp/keymark-record.log 2>&1 & echo $! > /tmp/keymark-record.pid )
sleep 2
if ! curl -s -o /dev/null http://localhost:3000/; then
  echo "Server did not start. Check /tmp/keymark-record.log"; exit 1
fi
echo "Server up at http://localhost:3000"
echo "Open that URL in your browser NOW, then come back — recording starts in 5s."
sleep 5

echo "Recording ${DUR}s to $OUT  (Ctrl-C to stop early)"
# -v video, -V duration seconds, -x no sound cue; captures main display.
screencapture -v -V "$DUR" -x "$OUT" || {
  echo ""
  echo "!! Recording failed. Almost always this is the Screen Recording permission."
  echo "   Grant it: System Settings > Privacy & Security > Screen Recording > your terminal, then restart the terminal and re-run."
}

echo "Stopping server..."
kill "$(cat /tmp/keymark-record.pid 2>/dev/null)" 2>/dev/null || true
[ -f "$OUT" ] && echo "Saved: $OUT  (trim/upload to YouTube, then paste the link into Devpost)"
