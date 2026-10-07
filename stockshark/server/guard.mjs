// The veto: Claude picks the move, Stockfish checks it. A move survives when it scores
// within `margin` centipawns of Stockfish's best move, and, in a tablebase ending, keeps
// the same result the best move keeps.
import { scoreValue, formatScore } from './uci.mjs';

// Lichess tablebase categories are given for the side to move AFTER a move, so a move
// leading to the opponent's "loss" wins for the mover. Higher rank = better for the mover.
const TB_RANK = {
  loss: 6, 'maybe-loss': 5, 'blessed-loss': 4, unknown: 3, draw: 3, 'cursed-win': 2, 'maybe-win': 1, win: 0,
};
const TB_RESULT = { 6: 'a win', 5: 'a probable win', 4: 'a win the fifty-move rule turns into a draw', 3: 'a draw', 2: 'a draw (a loss the fifty-move rule saves)', 1: 'a probable loss', 0: 'a loss' };

export const VETO_LEVELS = { strict: 0, tight: 20, loose: 50, off: null };

// lines: engine lines for the position, best first, scores from the mover's point of view.
// chosen: UCI of the move to judge; chosenScore: its score, when known.
// margin: centipawns, or null to never veto.
// tablebase: a lichess tablebase answer for the position, or null.
export function judgeMove({ lines, chosen, chosenScore, margin, tablebase }) {
  const best = lines[0];
  const verdict = {
    ok: true,
    best: best ? { uci: best.pv[0], score: best.score } : null,
    chosen: { uci: chosen, score: chosenScore || null },
    loss: null,
    reason: '',
  };
  if (best && chosenScore) {
    verdict.loss = chosen === best.pv[0] ? 0 : Math.max(0, scoreValue(best.score) - scoreValue(chosenScore));
  }

  const tb = tablebase && Array.isArray(tablebase.moves) && tablebase.moves.length ? tablebase : null;
  if (tb) {
    const top = tb.moves[0];
    const mine = tb.moves.find(m => m.uci === chosen);
    const topRank = TB_RANK[top.category] ?? 3;
    const myRank = mine ? TB_RANK[mine.category] ?? 3 : -1;
    verdict.tablebase = { best: top.uci, bestResult: TB_RESULT[topRank], chosenResult: TB_RESULT[myRank] || 'unknown' };
    if (margin === null) return verdict;
    if (myRank < topRank) {
      verdict.ok = false;
      verdict.reason = `The 7-piece tablebase says ${top.san} keeps ${TB_RESULT[topRank]}, but this move leads to ${TB_RESULT[myRank] || 'a worse result'}.`;
      return verdict;
    }
    // In a won tablebase ending, only the quickest win counts: slower wins can wander into
    // a repetition or the fifty-move rule.
    if (topRank === 6 && chosen !== top.uci && Math.abs(mine.dtz ?? 0) > Math.abs(top.dtz ?? 0)) {
      verdict.ok = false;
      verdict.reason = `This ending is a tablebase win. ${top.san} wins fastest; other moves risk a repetition or the fifty-move rule.`;
      return verdict;
    }
    return verdict;
  }

  if (margin === null || !best) return verdict;
  if (verdict.loss === null) {
    verdict.ok = false;
    verdict.reason = 'Stockfish could not score this move.';
  } else if (verdict.loss > margin) {
    verdict.ok = false;
    verdict.reason = `${formatScore(chosenScore)} is ${(verdict.loss / 100).toFixed(2)} pawns worse than Stockfish's best (${formatScore(best.score)}); the veto allows ${(margin / 100).toFixed(2)}.`;
    if (Math.abs(scoreValue(best.score)) >= 1e5 || Math.abs(scoreValue(chosenScore)) >= 1e5) {
      verdict.reason = `Stockfish's best is ${formatScore(best.score)} and this move is ${formatScore(chosenScore)}; with a forced mate on the board only an equally fast mate passes.`;
    }
  }
  return verdict;
}

// Candidates that would pass the veto, for the message that asks Claude to pick again.
export function passingCandidates(lines, margin) {
  if (!lines.length) return [];
  if (margin === null) return lines;
  const top = scoreValue(lines[0].score);
  return lines.filter(l => top - scoreValue(l.score) <= margin);
}
