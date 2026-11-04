---
name: geo-video
description: Make vertical (9:16, ~60 s) geography Shorts/TikToks with the Geo Studio engine in geo-studio/ — "what if X took over the world", "USA vs China" wars, border wars, explainers (nuke sizes, militaries, oil prices), map tricks (true size, sea level). Use whenever the user asks for a geography/map/war/what-if video, wants a hook + storyline turned into a video, or asks to change Geo Studio. Covers research, script, Artlist voiceover (Mark) + music, word-timed captions, dopamine pacing, 3D satellite battles and nukes, rendering and delivery.
---

# /geo-video — Geo Studio workflow

Geo Studio (`geo-studio/`) is a code engine: every video is a storyboard file `videos/<slug>/video.mjs`
whose `frame(g, T)` draws one frame as a pure function of time. Read `geo-studio/CLAUDE.md` for the
code map before changing the engine.

**The bar: every video should feel like a high-retention Short.** Something new hits the screen
every 1–2 seconds, every hit is felt (flash + shake + boom + a number moving), and wars look like
battles, not maps with arrows. Section 3 is the checklist. Don't skip it.

## 0. Setup (each fresh container)

```bash
cd geo-studio && scripts/setup.sh
```
Installs node deps, a Python venv (faster-whisper, OpenCV), Natural Earth + Roman province data,
fonts, and synthesizes the SFX into `assets/sfx/`. Tiles download on demand into `.cache/`.

## 1. Plan the video (ask first if the user wants questions)

For each video settle: **opening line, hook visual, storyline beats, ending/cliffhanger**.
- 9:16, 1080×1920, 30 fps. Aim for 45–65 s.
- Real-world claims must be researched and current: use WebSearch, prefer primary sources
  (DoD, SIPRI, IISS, CSIS, EIA, Statistics Canada, UN). Put a source line in `g.creditText`. If
  sources disagree, use the conservative figure in the voiceover.
- "What if" scenarios are fiction. Keep them playful, not hateful. Anchor them with one or two
  real numbers (troops, ships, ranges, war-game results) so they feel credible. A "realistic"
  brief means real-world capabilities and treaties.
- Write the beats so that each one has a **visual verb**: something fires, fills, sinks, slams,
  counts up, splits or goes dark. If a beat is only a statement, add a counter or a comparison.

## 2. Script → voiceover → timings

1. Write `videos/<slug>/script.txt`: **one line per beat** (each line becomes a caption group and a
   timing anchor `g.L(i)`). Short lines (5–15 words). Use numerals ("$126", "1948"); captions show
   the script's own spelling.
2. Voiceover with Artlist (`generate_voiceover`). **Always use the voice "Mark - Natural
   Conversations"** (young adult American male; find it with `list_voices` query "Mark"), with
   language English and accent American. Don't use any other narrator unless the user asks for one.
   (Videos 01–10 were voiced by "Showtime"; from 11 on, every video uses Mark.) Quote the cost
   first (`get_generation_cost`); it is about 0.2 credits per character. Save the file as
   `videos/<slug>/audio/voice_raw.mp3`.
3. Align:
   ```bash
   .venv/bin/python -I engine/align.py videos/<slug> --tempo 1.12
   ```
   This speeds the voice (Mark reads about 2.2 words/s: use 1.10–1.15), trims pauses, and writes
   `audio/voice.wav` + `timing.json`. It repairs lines the recogniser skipped. Check the printed
   line times.

## 3. Dopamine pacing: the checklist (apply to every video)

1. **Hook ≤ 2 s, already moving on frame 1.** Use a versus card (`versusCard`), a slam
   (`chapterSlam`), a puppet hitting a button, or a globe dive. Never open on a static title.
2. **A new visual event every 1–2 s.** Events include a cut, a slam, a counter, an impact, a
   unit wave or a camera move. Never hold one composition longer than about 2 s without
   something entering, moving or exploding.
3. **The camera never stops.** Use a slow push (+0.03–0.07 zoom/s) and punch-ins on beats
   (`punch(T, beats)` added to the zoom). 3D shots orbit (yaw drift 2–5°/s) and dolly. Cut
   between scenes with a white flash and a whoosh.
4. **Numbers are events.** Every stat counts up (ticker SFX), lands with an impact, and gets a
   bar or comparison. Show versus stats as a "tale of the tape" with ticks and a running score.
5. **Every hit is felt:** explosion + bloom + `flash` + `shake` + boom SFX + a `killFeed` line +
   a health-bar drop (`healthBars` + `healthAt`).
6. **Density beats detail.** Use swarms, not single units: 20–30 jets, 40–60 missiles in a salvo,
   8–10 landing craft, staggered by tens of milliseconds. Use `swarm2D` and `salvo2D`.
7. **At least two 3D hero shots per war video** (Ground3D): a beach landing, a carrier strike, a
   tank battle or a nuke. Flat maps are for context; 3D is the payoff.
8. **Game layer for versus/war videos:** health bars for the whole war, chapter slams
   ("ROUND 1: TAIWAN"), a kill feed, and a "DOUBLE K.O." or winner slam at the end.
9. **Sound on every visual event.** Use the music bed `war_hype.mp3` for wars. Pile SFX onto
   impacts (boom + impact), and use jet, gunfire, sonar, torpedo, glitch, siren and ko where they fit.
10. **End on a payoff:** a question, a slam, a cliffhanger ("Should I make part 2?").
11. **Look:** consistent team colours (US `#2f7bff`, enemy `#e5484d`), glowing highlights,
    bloom on explosions, `finish: { vignette: 0.6, grain: 0.06 }`. Hide captions under
    full-screen slams (`g.caption.hide`) and move them when they collide (`g.caption.y`).

## 4. Music and SFX

- Music: the Artlist catalog is **watermarked** on an AI-credit plan, so generate instead with
  `generate_music` (Lyria 3 Pro, instrumental, 90 s, about 300 credits). Beds in `assets/music/`:
  `war_hype.mp3` (relentless trap/orchestral, best for wars), `epic_war.mp3`, `dark_nuclear.mp3`,
  `tense_doc.mp3` (news/explainers), `curious.mp3` (map tricks). Set `music: { file, gain ~0.18, start }`.
- SFX (synthesized, `scripts/make_sfx.py`; add new ones there): `nuke boom boom_small impact
  whoosh whoosh_fast click siren whistle pop ticker phone drain launch riser rumble horn cash
  jet gunfire sonar glitch torpedo ko`.
- `sfx(g)` returns `[{ t, file, gain, dur }]`. Time them with `g.wt(line, 'word')`.

## 5. Storyboard (`videos/<slug>/video.mjs`)

Structure a long video as **scene functions** chosen by time
(`if (T < g.L(3)) await intro(g, T) else if (...) ...`), with a white-flash cut list. See
`videos/11-usa-vs-china/video.mjs`, the reference for pacing and war visuals.

```js
import { W, H, clamp, ease, env, prog, lerp, camAt, baseMap, hl, conquer, globeShot, loadFlags,
         flagAt, bigText, tag, headline, text, label, zoomFor, Camera } from '../../engine/kit.mjs';
import { healthBars, healthAt, versusCard, chapterSlam, killFeed, punch } from '../../engine/battle.mjs';
export default {
  music: { file: 'war_hype.mp3', gain: 0.2 },
  finish: { vignette: 0.6, grain: 0.06 },
  async setup(g) { await loadFlags(g, ['us', 'cn']); g.hp = [[0, 1], [g.L(3) + 2, 0.8]]; },
  sfx(g) { return [{ t: 0.05, file: 'impact.wav' }, { t: g.wt(1, 'navy'), file: 'ticker.wav' }]; },
  async frame(g, T) {
    const cam = camAt(T, [[0, { lon: 120, lat: 24, zoom: 6.8 }], [6, { lon: 120.3, lat: 24, zoom: 7.1 }]]);
    await baseMap(g, new Camera({ lon: cam.lon, lat: cam.lat, zoom: cam.zoom + punch(T, [1, 2.5]) }), { layers: ['bluemarble', 's2'] });
    versusCard(g.ctx, g.flags.us, g.flags.cn, 'USA', 'CHINA', T, 0);
  },
};
```

### Toolbox (all in `engine/`)
- **Maps** (`kit.mjs`): `camAt` (keyframed flat camera, auto `fitCam`), `baseMap` (imagery + dim +
  borders + credits), `hl`, `conquer` (radial wipe), `fill`, `outline`, `countryLabel`, `pulseAt`;
  10 m borders with `loadCountries('10m')` for close zooms. A `Camera({ ..., cy })` placed off
  centre and clipped gives split screens.
- **Imagery** (`tiles.mjs`): `bluemarble` (NASA, ≤z8), `s2` (Sentinel-2 cloudless, ≤z15, blended
  with *lighten*), `usgs` (US ≤z16), `naip`, `nys` (New York State 30 cm aerial), `blackmarble`
  (night lights), `terrain`.
- **Globe** (`globe.mjs`): `globeShot` or `drawGlobe({ ..., night: 1, light: 0.1 })` for night lights; `globeProjection(view)` to place things on it.
- **3D satellite ground** (`fx.mjs` Ground3D): `G.setup({ lon, lat, zoom, pitch, yaw, layers, cy,
  shakeX, shakeY, hazeMax, skyTop, skyMid, horizonHaze })`. **yaw = compass bearing of screen-up**
  (90 = looking east). All 3D positions are **km (east, north, up) relative to the camera target**;
  `G.kmOf(lon, lat)` converts. Decals go in `await G.draw(ctx, (c, h) => { ... })` (x = e·h.km,
  y = −n·h.km). `layers: []` + `oceanDecal` gives open ocean.
- **Battle kit** (`battle.mjs`):
  - 3D units: `drawUnits3D(ctx, G, [{ kind: 'tank'|'apc'|'launcher'|'destroyer'|'carrier'|'landing'|'jet'|'sub', team: 'us'|'cn'|'neutral', e, n, u, heading, size, hit }])`.
    These are lit low-poly models with cast shadows. Exaggerate sizes 10–40× (a tank 0.13–0.2 km,
    a landing ship 0.3 km, a carrier 0.75 km, a jet 0.25 km at u ≈ 0.5).
  - Ground decals: `wakeDecals`, `craterDecals`, `boomDecal`, `oceanDecal`.
  - Effects: `boom3D` (lite particle blast; `water: true` makes a splash), `missile3D` (smoke
    trail), `tracer3D` (muzzle flash + tracer), `contrail3D`, `smokeColumn` (burning wreck or
    city, drifting in the wind), `sunGlint`.
  - Flat-map war: `frontLine2D` (burning front with flames and artillery bursts), `sharedBorder(cA, cB)`
    (real border line between two countries; feed it to `frontLine2D` for border wars), `swarm2D`
    (unit columns along a path), `salvo2D` (staggered missile salvo with blasts), `sub2D` (sub + sonar).
  - Game UI: `versusCard`, `chapterSlam`, `healthBars` + `healthAt(T, [[t, hp], ...])`, `killFeed`,
    `punch`, `glitch` (cyber), `speedLines`, `mark('tick'|'cross')`. The fonts have no ✔ ✖ ☢ glyphs, so draw them with `mark`.
- **Nukes** (`fx.mjs`): `B = makeBlast({ r5, kind: 'nuke'|'conv', seed, lite })`,
  `blastDecals(c, B, tau, h.km)` in decals, then `drawBlast3D(ctx, G.project.bind(G), B, tau, { bloom })`
  between `bloomBegin()` and `bloomEnd()`, then `flash` + `shake`. Radii (5 psi) = 0.458 km·W^(1/3)
  (W in kt); fireball 0.078·W^0.4 km; 3rd-degree burns 0.554·W^0.41 km. Leave a `stripedCircle`.
  Drop `bluemarble` at zoom ≥ 8.6 over coasts.
- **Flat-map action** (`fx.mjs`): `arrow`, `missile`, `blast2D`, `unitIcon` ('jet'|'ship'|'carrier'|'tank'), `trail`, `pulse`.
- **True size / sea level / puppet / cards**: `drawMoved(... { roll })`, `drawSeaDrop(ctx, cam, m)`,
  `loadPuppet` + `drawPuppet` (public-domain photos only), `headline`, `statCard`, `bigText`, `tag`,
  `flagAt`, `lineChart`, `drawWeapon`. Captions are automatic (karaoke, y≈1390).

### Recipes
- **Beach landing / ground battle (3D):** Ground3D at the shoreline, pitch 45–50, yaw facing the
  land, s2 imagery. Landing craft drive in with wakes, and some take hits (`boom3D` + `smokeColumn`
  + `hit`). Landed craft spawn tanks, defenders fire `tracer3D`, jets strafe with `contrail3D` and
  fire `missile3D`. Add `craterDecals` where shells land and water splashes offshore. Finish with
  a slam, kill-feed lines and a health-bar drop.
- **Naval strike (3D):** `layers: []`, `oceanDecal`, pitch 30 with sky, `sunGlint`, a carrier
  group with wakes, `missile3D` diving from the sky, `boom3D` r≈0.28 and a big `smokeColumn`.
- **Border war (flat):** `frontLine2D(ctx, sharedBorder(A, B).map(p => cam.toScreen(...p)), T)`,
  `swarm2D` armies on both sides, `salvo2D` across the border, `conquer` wipes as the front moves,
  and health bars.
- **Missile salvo (flat):** zoom 6.5–7, `salvo2D` with n 40–60, then kill feed + shake.
- **Cyber / blackout:** split screen of two `blackmarble` cameras (cy 480 / 1440, clipped), black
  radial discs growing over cities, power % counters, `glitch` bursts.

## 6. Check, render, deliver

```bash
node engine/render.mjs <slug> --still 1.5,6,12,20,35,50     # one still per beat, at least
python3 -I scripts/sheet.py out/<slug>/stills out/<slug>-sheet.jpg 7 280
node engine/render.mjs <slug> --workers 3                    # -> out/<slug>.mp4
scripts/queue.sh 02-x 03-y                                   # several, one after another
```
Look at the contact sheet before each full render, checking for:
- text colliding with captions or the health bars;
- an empty Arctic, and labels stacking;
- imagery seams;
- units that are too small, clipped at the frame edge or bunched in a corner;
- static stretches longer than about 2 s.

After rendering, pull 3–4 frames from the MP4 with ffmpeg and check them, then send the MP4 with
SendUserFile. Renders are not committed (too large). Commit storyboards, scripts, timings and engine
changes. Voice and music files stay out of the public repo (Artlist licence).

## Current videos

`01-usa-takeover` (puppet hook) · `02-africa-united` · `03-nuke-sizes` (3D NYC aerial) ·
`04-oil-prices` · `05-biggest-military` · `06-iceland-takeover` · `07-mercator-lie` ·
`08-sea-level-drop` · `09-roman-empire` · `10-canada-border` · `11-usa-vs-china` (the reference
for war videos: VS card, tale of the tape, salvo, 3D beach landing, 3D carrier strike, subs, cyber
split screen, war-game results, nukes, double K.O.). Copy the closest one when starting a new video.
