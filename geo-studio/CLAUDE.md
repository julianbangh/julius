# Geo Studio

Code-driven engine for vertical (1080×1920, 30 fps) geography videos: satellite maps, a textured
3D globe, a tilted 3D satellite "ground" camera, volumetric-looking explosions and mushroom clouds,
sea-level change from real bathymetry, true-size country moves, a photo-cutout puppet, karaoke
captions, and an audio mix with ducking. The `/geo-video` skill (`.claude/skills/geo-video/SKILL.md`
at the repo root) is the workflow; this file is the map of the code.

## Layout

```
engine/
  core.mjs      canvas, fonts, easing, keyframe `track`, rng/noise, colours
  geo.mjs       Web Mercator Camera, Natural Earth countries (Path2D cache), highlights, conquest
                wipe, true-size `moveGeometry` (+ roll)
  tiles.mjs     imagery SOURCES (NASA Blue Marble/Black Marble, Sentinel-2 cloudless, USGS, NAIP,
                NYS orthos, terrain), disk cache in .cache/tiles, parent fallback, LOD
  globe.mjs     per-pixel orthographic Earth (lighting, ocean glint, atmosphere, night lights),
                d3-geo country overlays, globe<->zoom conversion
  fx.mjs        Ground3D (perspective satellite ground, pixel-buffer warp), makeBlast / drawBlast3D /
                blastDecals (flash, fireball, shock ring, stem, rolling cap, collar, base surge,
                cloud shadow), stripedCircle, blast2D, arrow, missile, unitIcon, trail, pulse,
                flash, shake, bloom
  battle.mjs    war kit: low-poly 3D units (tank, apc, launcher, destroyer, carrier, landing, jet,
                sub) with shadows on Ground3D; wakes, craters, ocean, smoke columns, boom3D,
                missile3D, tracer3D, contrails; flat-map frontLine2D / sharedBorder / swarm2D /
                salvo2D / sub2D; game UI (versusCard, chapterSlam, healthBars, killFeed, punch,
                glitch, speedLines, mark)
  terrain.mjs   drawSeaDrop: exposes seafloor for a sea-level drop using Terrarium elevation tiles
  puppet.mjs    photo-head cutout with hinged jaw + drawn body, desk and big red button
  weapons.mjs   cartoon weapon illustrations (grenade ... Tsar Bomba)
  ui.mjs        karaoke captions, headline, labels, flags (flagcdn), stat cards, line chart, grading
  kit.mjs       high-level scene helpers for storyboards (camAt/fitCam, baseMap, hl, conquer,
                globeShot, flags, bigText, tag, drawMoved, loadEnvelope ...)
  render.mjs    CLI: stills, parallel chunk render -> ffmpeg, concat, audio mix
  audio.mjs     voice + ducked music + timed SFX, loudnorm -14 LUFS
  align.py      tempo + pause trim, faster-whisper word timings matched back to script.txt
scripts/        setup.sh, make_sfx.py (procedural SFX), cut_portrait.py (GrabCut cutout parts),
                queue.sh (sequential renders), sheet.py (contact sheets of stills)
videos/<slug>/  script.txt (one caption line per beat), audio/voice_raw.mp3, timing.json, video.mjs
assets/         fonts (OFL), music (Artlist AI generations), sfx (synthesized), people (cutouts),
                flags (cache)
data/           Natural Earth + Roman provinces GeoJSON (fetched by setup.sh, not committed)
out/            renders (not committed)
```

## Commands

```bash
scripts/setup.sh                                   # once per machine/container
.venv/bin/python -I engine/align.py videos/<slug> --tempo 1.15
node engine/render.mjs <slug> --still 1.5,8,20     # check frames -> out/<slug>/stills
python3 -I scripts/sheet.py out/<slug>/stills out/<slug>-sheet.jpg 6 330
node engine/render.mjs <slug> --workers 3          # full render + mix -> out/<slug>.mp4
node engine/render.mjs <slug> --mix                # re-mix audio only
```

## Rules of thumb

- A storyboard (`videos/<slug>/video.mjs`) exports `{ music, sfx(g), setup(g), frame(g, T) }`.
  `frame` must be a pure function of time `T`, because chunks render in parallel processes.
- Sync to speech with `g.L(i)` (line start), `g.Le(i)` (line end) and `g.wt(i, 'word')` (word start).
- Flat maps: keep `zoom >= 2.95` so the vertical frame never shows empty space above the Arctic
  (`camAt` applies `fitCam` automatically).
- Ground3D: yaw = compass bearing of screen-up; 3D positions are km (east, north, up) relative to
  the camera target (`G.kmOf(lon, lat)`); `G.camKm()` is the camera position.
- Ground3D frames cost about 0.6–0.9 s each; flat-map frames 0.1–0.3 s. A 70 s 3D video takes
  about 10 minutes on 3 workers.
- Only public or openly licensed imagery: no Google/Esri tiles. Show `g.creditText`.
- Captions sit at y ≈ 1390. Keep cards and titles above y ≈ 1250 (or set `g.caption.y`).
