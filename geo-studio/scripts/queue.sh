#!/bin/bash
# Render videos one after another: scripts/queue.sh 02-africa-united 04-oil-prices ...
cd "$(dirname "$0")/.."
while pgrep -f "engine/render.mjs [0-9][0-9]-[a-z-]* --workers" > /dev/null; do sleep 10; done
for s in "$@"; do
  node engine/render.mjs "$s" --workers 3 > "out/${s%%-*}.log" 2>&1 && echo "done $s" || echo "FAILED $s"
done
