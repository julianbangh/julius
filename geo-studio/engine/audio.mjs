// Geo Studio audio: voice + ducked music + timed SFX, loudness-normalised for Shorts (-14 LUFS).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './core.mjs';

function resolveAudio(vdir, f) {
  for (const p of [path.join(vdir, 'audio', f), path.join(ROOT, 'assets/sfx', f), path.join(ROOT, 'assets/music', f), f]) if (fs.existsSync(p)) return p;
  throw new Error('audio not found: ' + f);
}

/**
 * mod.music: { file, gain=0.16, start=0 (offset into track), fadeOut=2 }
 * mod.sfx(g): [{ t, file, gain=1 }]
 */
export async function mixAudio({ g, mod, video, out }) {
  const dur = g.duration;
  const inputs = ['-i', video, '-i', path.join(g.vdir, 'audio/voice.wav')];
  const filters = [];
  const mixIn = ['[vo]'];
  filters.push(`[1:a]aresample=48000,volume=1.0,apad=whole_dur=${dur.toFixed(3)},asplit=2[vo][key]`);
  let idx = 2;
  if (mod.music) {
    const m = mod.music;
    inputs.push('-ss', String(m.start || 0), '-i', resolveAudio(g.vdir, m.file));
    const fo = m.fadeOut ?? 2.0;
    filters.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${dur.toFixed(3)},asetpts=N/SR/TB,volume=${m.gain ?? 0.16},afade=t=in:d=0.4,afade=t=out:st=${Math.max(0, dur - fo).toFixed(3)}:d=${fo}[mraw]`);
    filters.push(`[mraw][key]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350:makeup=1[mus]`);
    mixIn.push('[mus]');
    idx++;
  } else filters.push('[key]anullsink');
  const sfx = mod.sfx ? mod.sfx(g) : [];
  for (const s of sfx) {
    if (s.t < 0 || s.t > dur) continue;
    inputs.push('-i', resolveAudio(g.vdir, s.file));
    const ms = Math.round(s.t * 1000);
    const tr = s.dur ? `,atrim=0:${s.dur},afade=t=out:st=${Math.max(0, s.dur - 0.25)}:d=0.25` : '';
    filters.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo${tr},volume=${s.gain ?? 1},adelay=${ms}|${ms}[s${idx}]`);
    mixIn.push(`[s${idx}]`);
    idx++;
  }
  filters.push(`${mixIn.join('')}amix=inputs=${mixIn.length}:normalize=0:dropout_transition=0,atrim=0:${dur.toFixed(3)},alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);
  const fc = path.join(path.dirname(out), `${g.slug}.filter.txt`);
  fs.writeFileSync(fc, filters.join(';\n'));
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex_script', fc, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', out], { stdio: 'inherit' });
}
