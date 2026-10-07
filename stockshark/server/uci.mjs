// Pure helpers for the UCI protocol: parsing engine output and comparing scores.
// No I/O in here, so the same rules apply to the bridge, the MCP tools and the tests.

const NUMERIC = new Set(['depth', 'seldepth', 'multipv', 'nodes', 'nps', 'time', 'hashfull', 'tbhits']);

// Turn one "info ..." line into a plain object, or null when the line carries no search
// result ("info string ...", "info currmove ...", lines without a score).
export function parseInfo(line) {
  const tok = line.trim().split(/\s+/);
  if (tok[0] !== 'info') return null;
  const info = {};
  for (let i = 1; i < tok.length; i++) {
    const key = tok[i];
    if (NUMERIC.has(key)) info[key] = Number(tok[++i]);
    else if (key === 'score') {
      const kind = tok[++i], value = Number(tok[++i]);
      info.score = kind === 'mate' ? { mate: value } : { cp: value };
      if (tok[i + 1] === 'lowerbound' || tok[i + 1] === 'upperbound') info.bound = tok[++i].replace('bound', '');
    } else if (key === 'wdl') {
      info.wdl = [Number(tok[i + 1]), Number(tok[i + 2]), Number(tok[i + 3])];
      i += 3;
    } else if (key === 'pv') {
      info.pv = tok.slice(i + 1);
      break;
    } else if (key === 'string') return null;
    else if (key === 'currmove' || key === 'currmovenumber' || key === 'cpuload') i++;
  }
  if (info.depth === undefined || !info.score) return null;
  info.multipv = info.multipv || 1;
  info.pv = info.pv || [];
  return info;
}

// Keep the best-known line per MultiPV slot: a deeper line replaces a shallower one, and at
// equal depth an exact score replaces a bound.
export function mergeLine(lines, info) {
  const slot = info.multipv - 1;
  const old = lines[slot];
  if (!old || info.depth > old.depth || (info.depth === old.depth && (!info.bound || old.bound))) {
    lines[slot] = info.pv.length || !old ? info : { ...info, pv: old.pv };
  }
  return lines;
}

// One number that orders every outcome from the side to move's point of view: any forced
// mate beats any centipawn score, a quicker mate beats a slower one, and a longer defence
// beats a quicker loss. Mate distances differ by 1000 so a slower mate never passes a
// centipawn margin by accident.
export function scoreValue(score) {
  if (!score) return 0;
  if (score.mate !== undefined) {
    const m = score.mate;
    if (m > 0) return 1e6 - m * 1000;
    if (m < 0) return -1e6 - m * 1000;
    return -1e6;
  }
  return score.cp;
}

// Flip a score to the other side's point of view.
export const negate = score => (score.mate !== undefined ? { mate: -score.mate } : { cp: -score.cp });

// "+0.34", "-1.20", "#5", "#-3" from the point of view the score is already in.
export function formatScore(score) {
  if (!score) return '?';
  if (score.mate !== undefined) return score.mate === 0 ? '#0' : `#${score.mate}`;
  const pawns = score.cp / 100;
  return (pawns > 0 ? '+' : pawns < 0 ? '-' : '') + Math.abs(pawns).toFixed(2);
}

// Per-mille win/draw/loss triple to a short phrase: "win 31% · draw 62% · loss 7%".
export function formatWdl(wdl) {
  if (!wdl) return '';
  const pct = v => `${Math.round(v / 10)}%`;
  return `win ${pct(wdl[0])} · draw ${pct(wdl[1])} · loss ${pct(wdl[2])}`;
}

// UCI move text is 4-5 characters: from, to, optional promotion piece.
export const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
