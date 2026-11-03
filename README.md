# julius

## Stockshark Bot

[`stockshark/`](stockshark/) is a chess board where Stockfish 19 at full strength calculates and Claude plans, connected over MCP. Start with [`stockshark/README.md`](stockshark/README.md); the design is in [`stockshark/PLAN.md`](stockshark/PLAN.md).

```sh
cd stockshark && npm install && npm run get-stockfish && claude
```

Then run `/mcp__stockshark__play` in Claude Code and open <http://127.0.0.1:8787>.

## Geo Studio

[`geo-studio/`](geo-studio/) is a code engine for vertical (9:16) geography videos: satellite maps,
a 3D globe, a tilted 3D satellite camera with volumetric-looking mushroom clouds, sea-level change
from real bathymetry, true-size country moves, a photo-cutout puppet, karaoke captions and an
audio mix. Run the workflow with the `/geo-video` skill ([`.claude/skills/geo-video/SKILL.md`](.claude/skills/geo-video/SKILL.md));
the code map is in [`geo-studio/CLAUDE.md`](geo-studio/CLAUDE.md).

```sh
cd geo-studio && scripts/setup.sh
node engine/render.mjs 03-nuke-sizes --workers 3   # -> geo-studio/out/03-nuke-sizes.mp4
```
