// Endgames with seven pieces or fewer are solved. The Lichess tablebase API answers with
// the exact result of every legal move, which beats any search. Failures are quiet: the
// caller just falls back to Stockfish.
import { pieceCount } from './game.mjs';

const cache = new Map();

export async function probeTablebase(fen, { timeoutMs = 5000 } = {}) {
  if (pieceCount(fen) > 7) return null;
  const parts = fen.split(' ');
  if (parts[2] && parts[2] !== '-') return null; // tablebases have no castling rights
  if (cache.has(fen)) return cache.get(fen);
  const url = `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.moves)) return null;
    const answer = { category: data.category, dtz: data.dtz, dtm: data.dtm, moves: data.moves.map(m => ({ uci: m.uci, san: m.san, category: m.category, dtz: m.dtz, dtm: m.dtm })) };
    cache.set(fen, answer);
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return answer;
  } catch {
    return null;
  }
}

// The mover's result for a tablebase category of the position itself (side to move).
export const TB_CATEGORY_TEXT = {
  win: 'a win', 'maybe-win': 'a probable win', 'cursed-win': 'a win that the fifty-move rule turns into a draw',
  draw: 'a draw', 'blessed-loss': 'a loss that the fifty-move rule saves', 'maybe-loss': 'a probable loss', loss: 'a loss', unknown: 'unknown',
};
