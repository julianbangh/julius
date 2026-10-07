// The MCP face of the bridge: the tools Claude calls to play, and the "play" prompt.
// Tool results are plain text written for Claude to read.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VERSION } from './config.mjs';
import { Chess, COLOR_NAME, sanLine } from './game.mjs';
import { formatScore, formatWdl, negate } from './uci.mjs';
import { TB_CATEGORY_TEXT } from './tablebase.mjs';
import { SERVER_INSTRUCTIONS, playPrompt } from './prompt.mjs';

// How each seat reads from Claude's side of the board.
const SEAT_NAME = { you: 'the human', stockshark: 'you (Stockshark 1)', stockfish: 'Stockfish 19 on its own' };
const SEAT_OWNER = { you: "the human's", stockshark: 'yours', stockfish: "Stockfish 19's" };

const text = body => ({ content: [{ type: 'text', text: body }] });
const fail = body => ({ content: [{ type: 'text', text: body }], isError: true });

const big = n => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} G` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(n));
const vetoText = v => (v === null ? 'off (your choice is final)' : v === 0 ? "strict (only Stockfish's best move)" : `moves more than ${(v / 100).toFixed(2)} pawns below Stockfish's best are rejected`);

function sanOf(fen, uci) {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return uci;
  }
}

// Scores from Claude's side of the board.
function forViewer(line, mover, viewer) {
  if (mover === viewer) return { score: line.score, wdl: line.wdl };
  return { score: negate(line.score), wdl: line.wdl ? [line.wdl[2], line.wdl[1], line.wdl[0]] : null };
}

function engineLine(status) {
  if (!status.name) return 'Stockfish';
  const kind = status.backend === 'native' ? 'native' : 'WebAssembly';
  return `${status.name} · ${kind} · ${status.threads} thread${status.threads === 1 ? '' : 's'} · ${status.hashMb} MB hash${status.syzygy ? ' · Syzygy' : ''}`;
}

function describeState(s, { board = true, legal = true } = {}) {
  const out = [];
  if (!s.boardOpen) out.push(`The board is not open. Ask the human to open ${s.boardUrl || 'the Stockshark page'} in a browser and pick Stockshark 1 for White or Black.`);
  else if (!s.claudeColors.length) out.push('Neither side on the board is set to Stockshark 1, so you are not playing. Ask the human to pick Stockshark 1 for White or Black.');
  const status = s.outcome
    ? `Game over: ${s.outcome.result} by ${s.outcome.reason}.`
    : `${COLOR_NAME[s.turn]} to move${s.inCheck ? ' (in check)' : ''}${s.yourTurn ? ': that is you' : ''}.`;
  out.push(`White: ${SEAT_NAME[s.players.w]}. Black: ${SEAT_NAME[s.players.b]}. ${status} Ply ${s.ply}.`);
  if (s.lastMove) out.push(`Last move: ${s.lastMove.san} (${SEAT_OWNER[s.lastMove.by] || 'unknown'}).`);
  out.push(`Moves: ${s.movetext || '(none yet)'}`);
  out.push(`FEN: ${s.fen}`);
  if (board) out.push('Board (White at the bottom; uppercase is White):', s.ascii.trimEnd());
  if (legal && s.legal.length) out.push(`Legal moves (${s.legal.length}): ${s.legal.join(' ')}`);
  if (s.plan) out.push(`Your plan so far${s.claudeColors.length === 2 ? ` as ${COLOR_NAME[s.planColor]}` : ''}: ${s.plan}`);
  if (s.drawOffer) out.push('The human has offered a draw. Answer with respond_to_draw_offer; making a move also declines it.');
  out.push(`Board settings: ${Math.round(s.thinkMs / 1000)} s think time; veto: ${vetoText(s.veto)}.`);
  return out.join('\n');
}

function describeEvent(event, s) {
  switch (event) {
    case 'your_turn':
      return `Your move.\n${describeState(s)}\nNext: analyze_position, then make_move with ply=${s.ply}.`;
    case 'draw_offered':
      return `The human offers a draw.\n${describeState(s, { legal: false })}\nAnswer with respond_to_draw_offer (check analyze_position first if you are unsure).`;
    case 'game_over':
      return `The game is over: ${s.outcome ? `${s.outcome.result} by ${s.outcome.reason}` : 'finished'}.\n${describeState(s, { legal: false })}\nGive the human a short summary, then call wait_for_my_turn to wait for the next game.`;
    case 'cancelled':
      return `Stopped waiting.\n${describeState(s, { board: false, legal: false })}`;
    default:
      return `Nothing to do yet${s.boardOpen ? '' : ' (the board is not open)'}. Call wait_for_my_turn again.\n${describeState(s, { board: false, legal: false })}`;
  }
}

function describeAnalysis(a, s, status) {
  const mover = a.chess.turn();
  // "You" is the colour Claude plays; when it plays both, the one to move in the live game.
  const mine = s.claudeColors;
  const viewer = mine.length === 1 ? mine[0] : mine.length === 2 && a.live ? s.turn : mover;
  const out = [];
  const where = a.played.length ? `after ${a.played.join(' ')} (${a.played.length} move${a.played.length === 1 ? '' : 's'} beyond ${a.live ? 'the live game' : 'the given FEN'})` : a.live ? 'in the live game' : 'from the given FEN';
  if (a.outcome) {
    out.push(`Position ${where}: the game is over (${a.outcome.result} by ${a.outcome.reason}).`, `FEN: ${a.fen}`);
    return out.join('\n');
  }
  const top = a.lines[0] || {};
  out.push(`${engineLine(status)} · ${((top.time || a.movetime || 0) / 1000).toFixed(1)} s · depth ${top.depth ?? '?'}/${top.seldepth ?? '?'} · ${big(top.nodes || 0)}nodes · ${big(top.nps || 0)}n/s`);
  out.push(`Position ${where}: ${COLOR_NAME[mover]} to move. Scores are from ${COLOR_NAME[viewer]}'s side${mine.includes(viewer) ? ' (yours)' : ''}: + is good for ${COLOR_NAME[viewer]}.`);
  a.lines.forEach((line, i) => {
    const { score, wdl } = forViewer(line, mover, viewer);
    const first = sanOf(a.fen, line.pv[0]);
    const pv = sanLine(a.fen, line.pv, 12);
    out.push(`${i + 1}. ${first.padEnd(7)} ${formatScore(score).padStart(6)}  ${wdl ? `(${formatWdl(wdl)})` : ''}  d${line.depth}  ${pv}`);
  });
  if (a.tablebase && a.tablebase.moves.length) {
    const best = a.tablebase.moves[0];
    out.push(`Tablebase (perfect play, 7 pieces or fewer): ${COLOR_NAME[mover]} to move has ${TB_CATEGORY_TEXT[a.tablebase.category] || a.tablebase.category}; best move ${best.san}.`);
  }
  out.push(`FEN: ${a.fen}`);
  if (s.drawOffer && a.live) out.push('The human has a draw offer open: answer it with respond_to_draw_offer, or move to decline.');
  return out.join('\n');
}

function describeVerdict(r, s) {
  const v = r.verdict;
  const fen = v.analysis.fen;
  const bestSan = v.best ? sanOf(fen, v.best.uci) : '?';
  if (!r.ok) {
    const pass = v.passing.map(l => `${sanOf(fen, l.pv[0])} (${formatScore(l.score)})`).join(', ');
    return `Vetoed: ${r.san}. ${v.reason}\nMoves that pass: ${pass || bestSan}.\nPick one (your plan can stay the same) and call make_move again.`;
  }
  const out = [];
  if (v.tablebase) out.push(`Played ${r.san}. The tablebase confirms it keeps ${v.tablebase.chosenResult}.`);
  else if (v.chosen.score && v.loss === 0) out.push(`Played ${r.san}: Stockfish's best move (${formatScore(v.chosen.score)} for you).`);
  else if (v.chosen.score) out.push(`Played ${r.san}: ${formatScore(v.chosen.score)} for you, ${(v.loss / 100).toFixed(2)} below Stockfish's best ${bestSan} (${formatScore(v.best.score)}).`);
  else out.push(`Played ${r.san} (the veto is off, so Stockfish did not score it).`);
  out.push('The board shows your plan and comment.');
  if (s.outcome) out.push(`That ends the game: ${s.outcome.result} by ${s.outcome.reason}. Summarise it for the human, then call wait_for_my_turn for the next game.`);
  else out.push(`${COLOR_NAME[s.turn]} (${SEAT_NAME[s.players[s.turn]]}) is to move. Call wait_for_my_turn.`);
  return out.join('\n');
}

// Progress notifications keep long waits and long searches alive in clients that time out
// idle tool calls. Only possible when the client sent a progress token.
function progressFor(extra) {
  const token = extra && extra._meta ? extra._meta.progressToken : undefined;
  if (token === undefined) return null;
  let n = 0;
  return message => extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: ++n, message } }).catch(() => {});
}

export function createMcpServer(bridge, { transport = 'http' } = {}) {
  const server = new McpServer({ name: 'stockshark', title: 'Stockshark', version: VERSION }, { instructions: SERVER_INSTRUCTIONS });
  // Clients without progress support drop idle calls after 5 minutes (HTTP) or 30 (stdio).
  const idleCapSeconds = transport === 'stdio' ? 1500 : 270;

  server.registerTool('get_game', {
    title: 'Get the game',
    description: 'The live game on the Stockshark board: whether the board is open, who plays White and Black (you are Stockshark 1), whose turn it is, the move list, FEN, an ASCII board, legal moves when it is your turn, your saved plan, and the board\'s think time and veto setting.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => {
    bridge.touch();
    const s = bridge.state();
    return text(`${describeState(s)}\nEngine: ${engineLine(s.engine)}${s.engine.error ? ` (last error: ${s.engine.error})` : ''}\nBoard URL: ${s.boardUrl}`);
  });

  server.registerTool('wait_for_my_turn', {
    title: 'Wait for my turn',
    description: 'Block until you have something to do in the live game: your move ("your_turn"), a draw offer from the human ("draw_offered") or a finished game ("game_over"). Returns the position, move list, legal moves and your saved plan. Returns "timeout" if nothing happens in time; then call it again.',
    inputSchema: {
      timeout_seconds: z.number().int().min(5).max(3600).optional().describe('Seconds to wait before returning "timeout" (default 240).'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ timeout_seconds }, extra) => {
    const progress = progressFor(extra);
    const seconds = Math.min(timeout_seconds ?? 240, progress ? 3600 : idleCapSeconds);
    const { event, state } = await bridge.waitForTurn({
      timeoutMs: seconds * 1000,
      signal: extra.signal,
      onTick: progress ? () => progress('Waiting for the human to move') : null,
    });
    return text(describeEvent(event, state));
  });

  server.registerTool('analyze_position', {
    title: 'Analyse with Stockfish',
    description: 'Run Stockfish 19 at full strength (every core, big hash) on the live game, or on the position after a few extra moves you want to test, or on any FEN. Returns the best candidate moves with scores from your side, win/draw/loss odds, depth and the main line for each. In endings with 7 pieces or fewer it also reports the tablebase result.',
    inputSchema: {
      moves: z.array(z.string().max(12)).max(40).optional().describe('Moves to play first, in SAN or UCI, starting from the live game (or from `fen`). Use it to test a plan, e.g. ["Nf5", "g6", "Nh6+"].'),
      fen: z.string().max(100).optional().describe('Analyse this FEN instead of the live game.'),
      seconds: z.number().min(1).max(600).optional().describe("Thinking time in seconds. Defaults to the board's think time."),
      multipv: z.number().int().min(1).max(10).optional().describe('How many candidate moves to return (default 5).'),
      depth: z.number().int().min(1).max(99).optional().describe('Search to this depth instead of for a set time.'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (args, extra) => {
    const progress = progressFor(extra);
    const capped = { ...args };
    if (!progress && (capped.seconds ?? bridge.game.thinkMs / 1000) > idleCapSeconds) capped.seconds = idleCapSeconds;
    let lastSent = 0;
    const onInfo = info => {
      if (!progress || Date.now() - lastSent < 5000) return;
      lastSent = Date.now();
      progress(`depth ${info.depth} · ${formatScore(info.score)} · ${big(info.nodes || 0)}nodes`);
    };
    try {
      const analysis = await bridge.analyze(capped, { signal: extra.signal, onInfo });
      return text(describeAnalysis(analysis, bridge.state(), bridge.engine.status()));
    } catch (err) {
      return fail(err.name === 'AbortError' ? 'Analysis cancelled.' : err.message);
    }
  });

  server.registerTool('make_move', {
    title: 'Make my move',
    description: "Play your move on the board. Stockfish first checks it: a move that scores too far below Stockfish's best (see the board's veto setting) is rejected with the moves that would pass. Include your updated plan and a comment; both are shown on the board as Stockshark's plan.",
    inputSchema: {
      move: z.string().min(2).max(12).describe('Your move in SAN (Nf3, exd5, O-O, e8=Q) or UCI (g1f3).'),
      plan: z.string().max(1500).optional().describe('Your strategic plan in two to four sentences: the goal, the route, what to watch for. Shown on the board and handed back to you next turn.'),
      comment: z.string().max(400).optional().describe('One short, friendly sentence to the human about this move.'),
      ply: z.number().int().min(0).optional().describe('The ply number from wait_for_my_turn, so a take-back cannot misplace your move.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (args, extra) => {
    try {
      const r = await bridge.makeMove(args, { signal: extra.signal });
      if (r.error) return fail(r.error);
      return r.ok ? text(describeVerdict(r, r.state)) : fail(describeVerdict(r, bridge.state()));
    } catch (err) {
      return fail(err.name === 'AbortError' ? 'Move check cancelled; nothing was played.' : err.message);
    }
  });

  server.registerTool('set_plan', {
    title: 'Update my plan',
    description: 'Show a new plan or comment on the board without moving, for example while you think during a long analysis.',
    inputSchema: {
      plan: z.string().max(1500).optional().describe('Your strategic plan in two to four sentences.'),
      comment: z.string().max(400).optional().describe('A short note to the human.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async args => {
    bridge.setPlan(args);
    return text('The board shows it.');
  });

  server.registerTool('respond_to_draw_offer', {
    title: 'Answer a draw offer',
    description: "Accept or decline the human's draw offer. Accepting ends the game as a draw.",
    inputSchema: {
      accept: z.boolean().describe('true to accept the draw, false to play on.'),
      message: z.string().max(300).optional().describe('A short reply shown to the human.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async args => {
    const r = bridge.respondToDraw(args);
    if (!r.ok) return fail(r.error);
    return text(r.accepted ? 'Draw agreed. The game is over; call wait_for_my_turn for the next game.' : 'Declined. Play on: call wait_for_my_turn.');
  });

  server.registerPrompt('play', {
    title: 'Play chess on the Stockshark board',
    description: 'Play as Stockshark 1 on the board: you plan, Stockfish 19 calculates and vetoes blunders.',
    argsSchema: {
      style: z.string().max(200).optional().describe('Optional playing style for your plans, e.g. "aggressive kingside attacks".'),
    },
  }, ({ style }) => ({
    messages: [{ role: 'user', content: { type: 'text', text: playPrompt(style) } }],
  }));

  return server;
}
