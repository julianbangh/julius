---
name: geo-video
description: Make vertical (9:16, ~60 s) geography Shorts/TikToks with the Geo Studio engine in geo-studio/ — "what if X took over the world" scenarios, explainers (nuke sizes, militaries, oil prices), map tricks (true size, sea level). Use whenever the user asks for a geography/map/what-if video, wants a hook + storyline turned into a video, or asks to change Geo Studio. Covers research, script, Artlist voiceover + music, word-timed captions, storyboard code, 3D satellite nuke shots, rendering and delivery.
---

# /geo-video — Geo Studio workflow

Geo Studio (`geo-studio/`) is a code engine: every video is a storyboard file `videos/<slug>/video.mjs`
whose `frame(g, T)` draws one frame as a pure function of time. Read `geo-studio/CLAUDE.md` for the
code map before changing the engine.

## 0. Setup (each fresh container)

```bash
cd geo-studio && scripts/setup.sh
```
Installs node deps, a Python venv (faster-whisper, OpenCV), Natural Earth + Roman province data,
fonts, and synthesizes the SFX into `assets/sfx/`. Tiles download on demand into `.cache/`.

## 1. Plan the video (ask first if the user wants questions)

For each video settle: **opening line, hook visual, storyline beats, ending/cliffhanger**.
- 9:16, 1080×1920, 30 fps. Aim for 45–75 s.
- Hook in the first 3 s: a headline pill (`headline`) and something moving (puppet, globe dive,
  pump sign, merging map).
- Real-world claims must be researched and current: use WebSearch, prefer primary sources
  (EIA, SIPRI, IISS, Statistics Canada, UN). Put a source line in `g.creditText`. If sources
  disagree, use the conservative figure in the voiceover.
- "What if" scenarios are fiction. Keep them playful, not hateful. A "realistic" brief means
  real-world capabilities and treaties.

## 2. Script → voiceover → timings

1. Write `videos/<slug>/script.txt`: **one line per beat** (each line becomes a caption group and a
   timing anchor `g.L(i)`). Use numerals ("$126", "1948"); captions show the script's own spelling.
2. Voiceover with Artlist (`generate_voiceover`). The default narrator is **"Showtime"** (American
   male, energetic), English/American. Quote the cost first (`get_generation_cost`); it is about
   0.2 credits per character. Save the file as `videos/<slug>/audio/voice_raw.mp3`.
3. Align:
   ```bash
   .venv/bin/python -I engine/align.py videos/<slug> --tempo 1.15
   ```
   This speeds the voice (Eleven v3 reads slowly: use 1.15, or 1.18 for long scripts), trims
   pauses, and writes `audio/voice.wav` + `timing.json`. It repairs lines the recogniser skipped.
   Check the printed line times.

## 3. Music and SFX

- Music: the Artlist catalog is **watermarked** on an AI-credit plan, so generate instead with
  `generate_music` (Lyria 3 Pro, instrumental, 90 s, about 300 credits). Existing beds are in
  `assets/music/`: `epic_war.mp3` (what-if wars), `dark_nuclear.mp3`, `tense_doc.mp3`
  (news/explainers), `curious.mp3` (map tricks). Reuse them; set `music: { file, gain ~0.16, start }`.
- SFX: Artlist SFX downloads need a separate subscription, so use the synthesized set in
  `assets/sfx/` (`nuke boom boom_small impact whoosh whoosh_fast click siren whistle pop
  ticker phone drain launch riser rumble horn cash`). Add new ones in `scripts/make_sfx.py`.
- `sfx(g)` returns `[{ t, file, gain, dur }]`. Time them with `g.wt(line, 'word')`.

## 4. Storyboard (`videos/<slug>/video.mjs`)

```js
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, hl, conquer, globeShot, loadFlags,
         flagAt, bigText, tag, headline, text, label, drawMoved, mainPolygon, centroidOf } from '../../engine/kit.mjs';
export default {
  music: { file: 'epic_war.mp3', gain: 0.16 },
  async setup(g) { await loadFlags(g, ['us', 'ca']); },
  sfx(g) { return [{ t: g.wt(0, 'world'), file: 'impact.wav' }]; },
  async frame(g, T) {
    const cam = camAt(T, [[0, { lon: -98, lat: 39, zoom: 3.5 }], [g.L(1), { lon: -98, lat: 55, zoom: 3.3 }]]);
    await baseMap(g, cam, { layers: ['bluemarble'], dim: 0.3 });
    hl(g, cam, 'USA', '#2f7bff');
    conquer(g, cam, 'CAN', '#2f7bff', [-79, 44], prog(T, g.L(2), g.L(2) + 3));
  },
};
```
Toolbox (all in `engine/`):
- **Maps:** `camAt` (keyframed flat camera, auto `fitCam`), `baseMap` (imagery + dim + borders +
  credits), `hl` (glowing highlight), `conquer` (radial conquest wipe), `fill`, `outline`,
  `countryLabel`, `pulseAt`; 10 m borders with `loadCountries('10m')` for close zooms.
- **Imagery** (`tiles.mjs` SOURCES): `bluemarble` (NASA, global ≤z8), `s2` (Sentinel-2 cloudless,
  global ≤z15, blended with *lighten* automatically), `usgs` (US ≤z16), `naip` (US aerial),
  `nys` (New York State 30 cm aerial), `blackmarble` (night lights), `terrain` (elevation).
- **Globe:** `globeShot(g, {cx, cy, R, lon, lat}, [{id, color}])`. Dive into a city: grow `R`
  exponentially, then cross-fade (white flash) to a map or Ground3D at `globeToZoom(R, lat)`.
- **3D satellite ground + nukes** (`fx.mjs`):
  `G = new Ground3D(); G.setup({lon, lat, zoom, pitch: 58, yaw, layers, cy, shakeX, shakeY})`,
  then `await G.draw(ctx, (c, h) => { stripedCircle(c, km * h.km); blastDecals(c, B, tau, h.km); })`,
  then `drawBlast3D(ctx, G.project.bind(G), B, tau, { bloom })` with `B = makeBlast({ r5, kind: 'nuke' | 'conv', seed })`.
  Wrap in `bloomBegin()` / `bloomEnd()`, finish with `flash(ctx, fl)` and `shake(T, amp)`.
  Blast radii (5 psi): 0.458 km·W^(1/3) (W in kt); fireball 0.078·W^0.4 km; 3rd-degree burns
  0.554·W^0.41 km. Leave a faint `stripedCircle` after every blast for comparison.
  Drop the `bluemarble` layer once zoom ≥ 8.6 over coasts (its navy ocean shows through USGS gaps).
- **Flat-map action:** `arrow` (tapered invasion arrow), `missile` (arc + trail), `blast2D`,
  `unitIcon` ('jet' | 'ship' | 'carrier' | 'tank'), `trail`, `pulse`.
- **True size:** `drawMoved(g, cam, mainPolygon(c.geometry), centroidOf(c.geometry), [lon, lat], { roll })`.
- **Sea level:** `await drawSeaDrop(ctx, cam, metres)` after `baseMap` (real bathymetry).
- **Puppet hook:** `scripts/cut_portrait.py <photo> assets/people/<name>` (GrabCut head + jaw;
  edit OUTLINE/MOUTH for a new photo), then `loadPuppet(name)` + `drawPuppet(ctx, P, x, y, s,
  { t, pop, slam, talk: g.amp(T), press })`. Call `loadEnvelope(g)` in setup to lip-flap with
  the voice. Use public-domain photos only (official US government portraits via the Library of Congress).
- **Cards/UI:** `headline`, `statCard`, `bigText`, `tag`, `label`, `flagAt` (flagcdn), `lineChart`,
  `drawWeapon` (cartoon weapons). Captions are automatic (karaoke, y≈1390); hide with
  `g.caption.hide = true` or move with `g.caption.y`.

## 5. Check, render, deliver

```bash
node engine/render.mjs <slug> --still 1.5,6,12,20,35,50     # look at EVERY beat
python3 -I scripts/sheet.py out/<slug>/stills out/<slug>-sheet.jpg 6 330
node engine/render.mjs <slug> --workers 3                    # -> out/<slug>.mp4
scripts/queue.sh 02-x 03-y                                   # several, one after another
```
Look at contact sheets before each full render: watch for text overlapping captions, empty
Arctic space, labels stacking, seams between imagery sources, and unreadable small icons.
After rendering, pull 2–3 frames from the MP4 with ffmpeg and check them, then send the MP4
with SendUserFile. Renders are not committed (they're too large); commit storyboards, scripts,
voice files, timings and engine changes.

## Current videos

`01-usa-takeover` (puppet hook, conquest, globe) · `02-africa-united` · `03-nuke-sizes`
(3D NYC aerial, 9 weapons) · `04-oil-prices` (Brent chart 2026) · `05-biggest-military` ·
`06-iceland-takeover` (realistic, Cod Wars) · `07-mercator-lie` · `08-sea-level-drop` ·
`09-roman-empire` · `10-canada-border`. Copy the closest one when starting a new video.
