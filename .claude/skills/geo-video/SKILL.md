---
name: geo-video
description: Make vertical (9:16, ~60 s) geography Shorts/TikToks with the Geo Studio engine in geo-studio/ — "what if X took over the world", "USA vs China" wars, border wars, explainers (nuke sizes, militaries, oil prices), map tricks (true size, sea level). Use whenever the user asks for a geography/map/war/what-if video, wants a hook + storyline turned into a video, or asks to change Geo Studio. Covers research, script, Artlist voiceover (Mark) + music, word-timed captions, war-first pacing, 3D satellite battles and side-on nukes, a quiet mix, rendering and delivery.
---

# /geo-video — Geo Studio workflow

Geo Studio (`geo-studio/`) is a code engine: every video is a storyboard file `videos/<slug>/video.mjs`
whose `frame(g, T)` draws one frame as a pure function of time. Read `geo-studio/CLAUDE.md` for the
code map before changing the engine.

**The bar: the viewer came to see the thing, so show it from frame 1.** A war video opens on
war (missiles leaving launchers, a fleet at sea), a nuke video opens on the drop. The look is
cinematic, not a video game: real 3D footage, restrained shake, a few well-placed sounds, numbers as
small overlays on the action. Section 3 is the checklist. Don't skip it.

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

## 3. Pacing and feel: the checklist (apply to every video)

User feedback that shaped this: "the start is boring, most people scroll by before that comparison is
done. They want to see a war, and they will get war"; "you went overboard" (game UI, shake, SFX);
"the mushroom clouds should be looked at in 3D"; "the sounds are too much and too loud".

1. **Open on the action.** Frame 1 is already the war or the event: launches, a fleet, a bomb
   falling. The opening line plays over it. No title card, no versus card, no stat comparison before
   the first big visual. A small `headline` pill is fine for explainers; never a full-screen slam.
2. **Stats ride on footage.** A number appears as a `statPill` (kit.mjs) over a live 3D shot: it
   counts up for about 1 s (`countUp`), holds 2–3 s and fades. One pill at a time, at most two per
   scene. Never build a full-screen "tale of the tape" or comparison chart in a war video.
3. **Something changes every 2–3 s:** a cut, a launch, an impact or a reveal. Inside a shot the
   camera drifts slowly (yaw 2–3°/s, pitch +1–2°/s, zoom ±0.05/s). Don't punch in on every beat.
4. **Cinematic, not a game.** Don't use health bars, kill feeds, chapter slams, VS cards, speed
   lines or "K.O." slams unless the user asks for them. One end line at most ("So who wins?").
5. **Shake is subtle.** Use none by default. Conventional hits get 2–5 px and nukes ≤ 9 px, decaying
   as `amp·exp(-t·2.6)`. Keep `flash` ≤ 0.5 and use a white flash only for a real detonation.
6. **Mushroom clouds are seen side-on, in 3D.** As the cloud rises, drop the Ground3D pitch to
   13–35° so the cap stands above the horizon. Pull the zoom out about 0.85 and move `cy` down to
   about 1300 so the whole cloud fits under any card, then lift back up for the radius rings (see
   the video 03 `dip` and the video 11 `nukes` scene). Check that the cap is never clipped by the top
   of the frame.
7. **Density where it pays:** salvos of 20–50 missiles and fleets of about 30 ships, but one focal
   point per shot. Exaggerate unit sizes so they read on a phone.
8. **Sound: fewer and quieter.** Set `sfxGain: 0.5` (a master under voice and music). Give one SFX
   to each real visual event (launch, impact, jet pass, sonar) at gains 0.3–0.6, and nukes 0.4–0.6.
   No SFX on text, pills or counters, and no ticker or riser on every number. Music gain 0.16–0.2.
9. **Soft cuts:** a 0.16 s fade up from 70 % black between scenes (`softCuts(g, T, cuts)`), and a
   0.25 s fade in on frame 0. No whoosh on every cut.
10. **End on a payoff:** a question or a short line, then fade to black.
11. **Look:** consistent team colours (US `#2f7bff`, enemy `#e5484d`), bloom on explosions,
    `finish: { vignette: 0.55, grain: 0.045 }`. Move captions when they collide (`g.caption.y`).

## 4. Music and SFX

- Music: the Artlist catalog is **watermarked** on an AI-credit plan, so generate instead with
  `generate_music` (Lyria 3 Pro, instrumental, 90 s, about 300 credits). Beds in `assets/music/`:
  `war_hype.mp3` (driving trap/orchestral, for wars), `epic_war.mp3`, `dark_nuclear.mp3`,
  `tense_doc.mp3` (news/explainers), `curious.mp3` (map tricks). Set `music: { file, gain 0.16–0.2, start }`.
- SFX (synthesized, `scripts/make_sfx.py`; add new ones there): `nuke boom boom_small impact
  whoosh whoosh_fast click siren whistle pop ticker phone drain launch riser rumble horn cash
  jet gunfire sonar glitch torpedo ko`.
- `sfx(g)` returns `[{ t, file, gain, dur }]`. Time them with `g.wt(line, 'word')`. The
  storyboard's `sfxGain` (default 0.55) scales every SFX; use 0.5. Videos 01–10 were mixed louder:
  re-mix one with `node engine/render.mjs <slug> --mix` after setting `sfxGain`.

## 5. Storyboard (`videos/<slug>/video.mjs`)

Structure a long video as **scene functions** chosen by a cut list
(`if (T < cuts[1]) await coldOpen(g, T); else if (T < cuts[2]) ...`), then `softCuts(g, T, cuts)`.
See `videos/11-usa-vs-china/video.mjs`, the reference for war videos.

```js
import { W, H, clamp, ease, env, zoomFor, statPill, countUp, softCuts } from '../../engine/kit.mjs';
import { Ground3D, bloomBegin, bloomEnd, shake } from '../../engine/fx.mjs';
import { drawUnits3D, missile3D, oceanDecal, wakeDecals, sunGlint } from '../../engine/battle.mjs';
const G = new Ground3D();
export default {
  music: { file: 'war_hype.mp3', gain: 0.2 },
  sfxGain: 0.5,
  finish: { vignette: 0.55, grain: 0.045 },
  sfx(g) { return [{ t: 0.15, file: 'launch.wav', gain: 0.5 }, { t: g.wt(1, 'navy'), file: 'horn.wav', gain: 0.35 }]; },
  async frame(g, T) {
    const cuts = [0, g.L(1) - 0.2];
    if (T < cuts[1]) {                 // frame 1 is already the war: launches at dusk
      G.setup({ lon: 119.55, lat: 25.45, zoom: zoomFor(2.6, W, 25.45) - T * 0.06, pitch: 12 + T * 2.2, yaw: 108,
                layers: ['bluemarble', { src: 's2', comp: 'lighten' }], cy: 1180 });
      await G.draw(g.ctx);
      // drawUnits3D(...launchers), missile3D(...) with bloom
    } else {                           // the fleet, with the stat riding on the shot
      G.setup({ lon: 121.5, lat: 23.5, zoom: zoomFor(5.5, W, 23.5), pitch: 20, yaw: 62, layers: [], cy: 1150 });
      await G.draw(g.ctx, (c, h) => oceanDecal(c, h, T));
      statPill(g.ctx, Math.round(countUp(T, g.wt(1, '370') - 0.6, g.wt(1, '370') + 0.3, 370)) + '+ SHIPS', 'BIGGEST NAVY ON EARTH', 330,
               env(T, g.wt(1, '370') - 0.6, g.L(2) - 0.2, 0.25, 0.3));
    }
    softCuts(g, T, cuts);
  },
};
```

### Toolbox (all in `engine/`)
- **Maps** (`kit.mjs`): `camAt` (keyframed flat camera, auto `fitCam`), `baseMap` (imagery + dim +
  borders + credits), `hl`, `conquer` (radial wipe), `fill`, `outline`, `countryLabel`, `pulseAt`;
  10 m borders with `loadCountries('10m')` for close zooms. A `Camera({ ..., cy })` placed off
  centre and clipped gives split screens.
- **Imagery** (`tiles.mjs`): `bluemarble` (NASA, ≤z8), `s2` (Sentinel-2 cloudless, ≤z15, blended
  with *lighten*), `usgs` (US ≤z16), `naip`, `nys` (New York State 30 cm aerial, leaf-off),
  `blackmarble` (night lights), `terrain`. **Wide shots (zoom < 14) use `s2`.** Zoomed out, USGS is a
  per-state patchwork (different seasons, a black stair-stepped ocean), and NYS stops at the state
  line. Fade `usgs`/`nys` in only for close-ups: `{ src: 'nys', alpha: clamp((zoom - 13.9) / 0.5) }`
  (see video 03).
- **Globe** (`globe.mjs`): `globeShot` or `drawGlobe({ ..., night: 1, light: 0.1 })` for night lights; `globeProjection(view)` to place things on it.
- **3D satellite ground** (`fx.mjs` Ground3D): `G.setup({ lon, lat, zoom, pitch, yaw, layers, cy,
  shakeX, shakeY, hazeMax, skyTop, skyMid, horizonHaze })`. **yaw = compass bearing of screen-up**
  (90 = looking east). All 3D positions are **km (east, north, up) relative to the camera target**;
  `G.kmOf(lon, lat)` converts. Decals go in `await G.draw(ctx, (c, h) => { ... })` (x = e·h.km,
  y = −n·h.km). `layers: []` + `oceanDecal` gives open ocean. The ground is painted into near (full
  res), mid (¼) and far canvases, with the rows nearest the camera first, so low pitches (10–35°)
  stay sharp in the foreground. Imagery beyond its native resolution still looks soft up close, so
  darken the near ground with a gradient at dusk (video 11 cold open).
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
  - Overlays: `statPill`, `countUp` and `softCuts` (kit.mjs), `glitch` (cyber), and `mark('tick'|'cross')`
    (the fonts have no ✔ ✖ ☢ glyphs).
  - Game UI, **only when the user asks for a game look**: `versusCard`, `chapterSlam`, `healthBars` +
    `healthAt`, `killFeed`, `punch`, `speedLines`.
- **Nukes** (`fx.mjs`): `B = makeBlast({ r5, kind: 'nuke'|'conv', seed, lite })`,
  `blastDecals(c, B, tau, h.km)` in decals, then `drawBlast3D(ctx, G.project.bind(G), B, tau, { bloom })`
  between `bloomBegin()` and `bloomEnd()`, then `flash` + `shake`. Radii (5 psi) = 0.458 km·W^(1/3)
  (W in kt); fireball 0.078·W^0.4 km; 3rd-degree burns 0.554·W^0.41 km. Leave a `stripedCircle`.
  View the cloud side-on while it rises (checklist item 6). Several clouds on the horizon: pitch about 13,
  `maxDist: 60000`, blasts spread within ±15° of screen-up and at half speed.
- **Flat-map action** (`fx.mjs`): `arrow`, `missile`, `blast2D`, `unitIcon` ('jet'|'ship'|'carrier'|'tank'), `trail`, `pulse`.
- **True size / sea level / puppet / cards**: `drawMoved(... { roll })`, `drawSeaDrop(ctx, cam, m)`,
  `loadPuppet` + `drawPuppet` (public-domain photos only), `headline`, `statCard`, `bigText`, `tag`,
  `flagAt`, `lineChart`, `drawWeapon`. Captions are automatic (karaoke, y≈1390).

### Recipes
- **Cold open (war):** Ground3D at dusk over the launch site, pitch 12–20 rising slowly, a battery of
  8 launchers (`drawUnits3D` 'launcher') firing staggered `missile3D` with long trails (`trail: 34,
  trailStep: 0.006`), white launch smoke and ground glow. The opening question plays over it.
- **Beach landing / ground battle (3D):** Ground3D at the shoreline, pitch 40–50, yaw facing the
  land, s2 imagery. Landing craft drive in with wakes, and a few take hits (`boom3D` + `smokeColumn`
  + `hit`). Landed craft spawn tanks, defenders fire `tracer3D`, jets pass with `contrail3D`. Add
  `craterDecals` where shells land. Orbit slowly (yaw +3°/s).
- **Naval strike (3D):** `layers: []`, `oceanDecal`, pitch about 26 with sky, `sunGlint`, a carrier
  group with wakes, `missile3D` diving from the sky, `boom3D` r≈0.28 and a big `smokeColumn`.
- **Nuke (3D):** drop the bomb top-down-ish (pitch 58), then dip to a side view while the cloud rises,
  then lift back for the `stripedCircle` rings (video 03).
- **Border war (flat):** `frontLine2D(ctx, sharedBorder(A, B).map(p => cam.toScreen(...p)), T)`,
  `swarm2D` armies on both sides, `salvo2D` across the border, and `conquer` wipes as the front moves.
- **Missile salvo (flat):** zoom 6.5–7, `salvo2D` with n 40–60.
- **Cyber / blackout:** split screen of two `blackmarble` cameras (cy 480 / 1440, clipped), black
  radial discs growing over cities, power % counters, a light `glitch`.

## 6. Check, render, deliver

```bash
node engine/render.mjs <slug> --still 1.5,6,12,20,35,50     # one still per beat, at least
python3 -I scripts/sheet.py out/<slug>/stills out/<slug>-sheet.jpg 7 280
node engine/render.mjs <slug> --workers 3                    # -> out/<slug>.mp4
scripts/queue.sh 02-x 03-y                                   # several, one after another
```
Look at the contact sheet before each full render, checking for:
- a first frame that isn't already action;
- text colliding with captions or cards, and labels stacking;
- an empty Arctic;
- imagery seams or patchwork (state lines, season changes, blurry stripes);
- mushroom caps clipped at the top of the frame;
- units that are too small, clipped at the frame edge or bunched in a corner;
- static stretches longer than about 3 s.

After the render, check loudness: the mix is normalised to −14 LUFS, but SFX should sit clearly
under the voice.

After rendering, pull 3–4 frames from the MP4 with ffmpeg and check them, then send the MP4 with
SendUserFile. Renders are not committed (too large). Commit storyboards, scripts, timings and engine
changes. Voice and music files stay out of the public repo (Artlist licence).

## Current videos

`01-usa-takeover` (puppet hook) · `02-africa-united` · `03-nuke-sizes` (3D NYC aerial) ·
`04-oil-prices` · `05-biggest-military` · `06-iceland-takeover` · `07-mercator-lie` ·
`08-sea-level-drop` · `09-roman-empire` · `10-canada-border` · `11-usa-vs-china` (the reference
for war videos: dusk launch cold open, fleet and carrier group with stat pills, Taiwan salvo, 3D beach
landing, carrier strike, subs, cyber split screen, CSIS war-game card, side-on nukes on the horizon,
soft cuts, quiet mix). Copy the closest one when starting a new video.
