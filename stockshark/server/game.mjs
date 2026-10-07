// Chess helpers on top of chess.js: replaying the board's move list, reading moves typed by
// Claude in SAN or UCI, and turning engine lines into readable notation.
import { Chess, validateFen } from 'chess.js';
import { UCI_MOVE } from './uci.mjs';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const COLOR_NAME = { w: 'White', b: 'Black' };

export function checkFen(fen) {
  if (typeof fen !== 'string' || /[\r\n]/.test(fen)) return 'FEN must be a single line of text.';
  const v = validateFen(fen.trim());
  return v.ok ? null : v.error;
}

// Replay UCI moves from a start position. Throws on the first illegal move.
export function replay(startFen, ucis) {
  const chess = new Chess(startFen);
  const sans = [];
  ucis.forEach((uci, i) => {
    if (!UCI_MOVE.test(uci)) throw new Error(`Move ${i + 1} ("${uci}") is not UCI notation.`);
    try {
      sans.push(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
    } catch {
      throw new Error(`Move ${i + 1} ("${uci}") is not legal.`);
    }
  });
  return { chess, sans };
}

// Find the legal move a person or a model meant: SAN ("Nf3", "exd5", "e8=Q+", "O-O"),
// castling written with zeros, or UCI ("g1f3", "e7e8q"). Returns a chess.js Move or null.
export function findMove(chess, text) {
  if (typeof text !== 'string') return null;
  let t = text.trim().replace(/^\d+\.(\.\.)?\s*/, '').replace(/[!?]+$/, '').replace(/[+#]+$/, '');
  t = t.replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O');
  const legal = chess.moves({ verbose: true });
  const lower = t.toLowerCase();
  if (UCI_MOVE.test(lower)) {
    const hit = legal.find(m => m.lan === lower);
    if (hit) return hit;
  }
  const bare = san => san.replace(/[+#]+$/, '');
  return legal.find(m => bare(m.san) === t)
    || legal.find(m => bare(m.san).replace('=', '') === t.replace('=', ''))
    || null;
}

// "15... Nf6 16. Re1 d5" for a UCI line played from `fen`. Stops at the first move that
// does not apply (engines can print a PV that runs past a repetition draw).
export function sanLine(fen, ucis, maxPlies = 16) {
  const chess = new Chess(fen);
  const parts = [];
  for (const uci of ucis.slice(0, maxPlies)) {
    const turn = chess.turn(), number = chess.moveNumber();
    let move;
    try {
      move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      break;
    }
    if (turn === 'w') parts.push(`${number}. ${move.san}`);
    else parts.push(parts.length ? move.san : `${number}... ${move.san}`);
  }
  return parts.join(' ');
}

// "1. e4 e5 2. Nf3" for a whole game.
export function movetext(startFen, sans) {
  const chess = new Chess(startFen);
  let number = chess.moveNumber(), turn = chess.turn();
  const parts = [];
  sans.forEach((san, i) => {
    if (turn === 'w') parts.push(`${number}. ${san}`);
    else parts.push(i === 0 ? `${number}... ${san}` : san);
    if (turn === 'b') number++;
    turn = turn === 'w' ? 'b' : 'w';
  });
  return parts.join(' ');
}

// How the board shows a move number for the move at ply index `i` from a start position.
export function moveLabel(startFen, i, san) {
  const chess = new Chess(startFen);
  const startTurnOffset = chess.turn() === 'w' ? 0 : 1;
  const n = i + startTurnOffset;
  const number = chess.moveNumber() + Math.floor(n / 2);
  return n % 2 === 0 ? `${number}. ${san}` : `${number}... ${san}`;
}

export function pieceCount(fen) {
  return fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
}

// Result of a finished position, or null while the game goes on. Mirrors the board's rules.
export function outcomeOf(chess) {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'b' : 'w';
    return { result: winner === 'w' ? '1–0' : '0–1', reason: 'checkmate', winner };
  }
  if (chess.isStalemate()) return { result: '½–½', reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { result: '½–½', reason: 'insufficient material' };
  if (chess.isThreefoldRepetition()) return { result: '½–½', reason: 'threefold repetition' };
  if (chess.isDrawByFiftyMoves()) return { result: '½–½', reason: 'the fifty-move rule' };
  return null;
}

export { Chess };
