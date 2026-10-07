// The hub between the board (a browser tab on a WebSocket), Stockfish, and Claude (MCP
// tools). The board owns the game; the bridge keeps a validated mirror of it, runs engine
// searches for the board, and turns the mirror into the turn-by-turn conversation Claude
// has through the MCP tools.
import { EventEmitter } from 'node:events';
import { EngineService } from './engine.mjs';
import { probeTablebase } from './tablebase.mjs';
import { judgeMove, passingCandidates } from './guard.mjs';
import { Chess, START_FEN, COLOR_NAME, checkFen, replay, findMove, sanLine, movetext, outcomeOf } from './game.mjs';
import { negate, UCI_MOVE } from './uci.mjs';

// Who sits on each side of the board: a person, Stockshark 1 (Claude, through these MCP
// tools, with Stockfish), or Stockfish 19 on its own (searched for the board).
const SEATS = new Set(['you', 'stockshark', 'stockfish']);
const MAX_ANALYSIS_MS = 10 * 60 * 1000;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function blankGame() {
  return {
    id: '', startFen: START_FEN, moves: [], sans: [], chess: new Chess(START_FEN), fen: START_FEN,
    ply: 0, turn: 'w', players: { w: 'you', b: 'stockshark' }, thinkMs: 60000, veto: 20, outcome: null,
  };
}

// Throttle a callback to at most one call per `ms`, always delivering the latest arguments.
function throttle(fn, ms) {
  let last = 0, timer = null, pending = null;
  const fire = () => {
    timer = null;
    last = Date.now();
    const args = pending;
    pending = null;
    fn(...args);
  };
  const wrapped = (...args) => {
    pending = args;
    if (timer) return;
    const wait = Math.max(0, ms - (Date.now() - last));
    timer = setTimeout(fire, wait);
  };
  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer);
      fire();
    }
  };
  return wrapped;
}

export class Bridge extends EventEmitter {
  constructor(config, log = () => {}) {
    super();
    this.config = config;
    this.log = log;
    this.url = '';
    this.engine = new EngineService(config, log);
    this.engine.on('status', () => this.sendWelcome());
    this.page = null;
    this.game = blankGame();
    this.claude = { plans: { w: '', b: '' }, comments: { w: '', b: '' }, sessions: 0, lastSeen: 0, busy: 0 };
    this.waiters = new Set();
    this.drawOffer = null;
    this.reportedEnd = '';
    this.analyses = new Map();
    this.pageSearches = new Map();
  }

  // ---- The board's connection ---------------------------------------------------------

  attachPage(ws) {
    if (this.page && this.page !== ws) this.send(this.page, { t: 'superseded' });
    this.page = ws;
    this.sendWelcome();
    this.notify();
    this.engine.get().catch(err => this.log(`engine: ${err.message}`));
  }

  detachPage(ws) {
    if (this.page !== ws) return;
    this.page = null;
    for (const ctl of this.pageSearches.values()) ctl.abort();
    this.pageSearches.clear();
    this.engine.stopPonder();
    this.emitClaude();
  }

  send(ws, msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  sendPage(msg) {
    this.send(this.page, msg);
  }

  sendWelcome() {
    this.sendPage({ t: 'welcome', engine: this.engine.status(), claude: this.claudeStatus(), tablebase: this.config.tablebase });
  }

  claudeStatus() {
    const recent = Date.now() - this.claude.lastSeen < 15 * 60 * 1000;
    return {
      connected: this.claude.sessions > 0 || recent,
      waiting: this.waiters.size > 0,
      busy: this.claude.busy > 0,
      plans: { ...this.claude.plans },
    };
  }

  emitClaude() {
    this.sendPage({ t: 'claude', ...this.claudeStatus() });
  }

  onPageMessage(ws, msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    if (msg.t === 'hello') return this.attachPage(ws);
    if (ws !== this.page) return; // a tab that another tab replaced
    switch (msg.t) {
      case 'sync': return this.sync(msg.game);
      case 'search': return this.pageSearch(msg);
      case 'stop': {
        const ctl = this.pageSearches.get(msg.id);
        if (ctl) ctl.abort();
        return;
      }
      case 'ponder': return this.pagePonder(msg);
      case 'ponder_stop': return this.engine.stopPonder();
      case 'draw_offer': return this.offerDraw(msg);
      default:
    }
  }

  // Replace the mirror with the board's game. Anything invalid is ignored.
  sync(g) {
    if (!g || typeof g !== 'object' || typeof g.id !== 'string' || !Array.isArray(g.moves) || g.moves.length > 1200) return;
    const startFen = typeof g.startFen === 'string' && !checkFen(g.startFen) ? g.startFen : START_FEN;
    let replayed;
    try {
      replayed = replay(startFen, g.moves.map(String));
    } catch (err) {
      this.log(`board sync ignored: ${err.message}`);
      return;
    }
    const prev = this.game;
    const chess = replayed.chess;
    const next = {
      id: g.id.slice(0, 64),
      startFen,
      moves: g.moves.map(String),
      sans: replayed.sans,
      chess,
      fen: chess.fen(),
      ply: g.moves.length,
      turn: chess.turn(),
      players: {
        w: g.players && SEATS.has(g.players.w) ? g.players.w : 'you',
        b: g.players && SEATS.has(g.players.b) ? g.players.b : 'you',
      },
      thinkMs: clamp(Number(g.thinkMs) || 60000, 1000, MAX_ANALYSIS_MS),
      veto: g.veto === null ? null : clamp(Number(g.veto ?? 20), 0, 1000),
      outcome: g.outcome && typeof g.outcome === 'object' ? {
        result: String(g.outcome.result || ''), reason: String(g.outcome.reason || ''),
        winner: g.outcome.winner === 'w' || g.outcome.winner === 'b' ? g.outcome.winner : undefined,
      } : null,
    };
    this.game = next;
    if (next.id !== prev.id) {
      this.drawOffer = null;
      // A reloaded tab keeps its game and hands back the plans it was showing.
      const plans = g.plans && typeof g.plans === 'object' ? g.plans : {};
      for (const c of ['w', 'b']) {
        this.claude.plans[c] = typeof plans[c] === 'string' ? plans[c].slice(0, 1500) : '';
        this.claude.comments[c] = '';
      }
      if (prev.id) this.engine.newGame();
      this.emitClaude();
    } else if (this.drawOffer && this.drawOffer.ply !== next.ply) {
      this.drawOffer = null;
    }
    this.notify();
  }

  pageSearch({ id, fen, moves, movetime, multipv, searchmoves }) {
    if (typeof id !== 'string') return;
    const position = this.validPosition(fen, moves);
    if (!position) return this.sendPage({ t: 'search_error', id, error: 'The position is not valid.' });
    const only = Array.isArray(searchmoves) ? searchmoves.map(String).filter(m => UCI_MOVE.test(m)).slice(0, 30) : [];
    const ctl = new AbortController();
    this.pageSearches.set(id, ctl);
    const onInfo = throttle((info) => this.sendPage({ t: 'search_info', id, info }), 200);
    const params = { ...position, movetime: clamp(Number(movetime) || 1000, 100, MAX_ANALYSIS_MS), multipv: clamp(Number(multipv) || 1, 1, 10), searchmoves: only };
    this.engine.run(params, { onInfo, signal: ctl.signal })
      .then(async result => {
        onInfo.flush();
        let tablebase = null;
        if (this.config.tablebase) {
          const chess = new Chess(position.fen);
          for (const uci of position.moves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
          tablebase = await probeTablebase(chess.fen());
        }
        // In a solved ending the tablebase's first move is perfect play.
        const bestmove = tablebase && tablebase.moves.length ? tablebase.moves[0].uci : result.bestmove;
        this.sendPage({ t: 'search_done', id, bestmove, lines: result.lines, elapsed: result.elapsed, source: bestmove !== result.bestmove ? 'tablebase' : 'stockfish', tablebase: tablebase ? { category: tablebase.category } : null });
      })
      .catch(err => this.sendPage({ t: 'search_error', id, error: err.name === 'AbortError' ? 'cancelled' : err.message }))
      .finally(() => this.pageSearches.delete(id));
  }

  pagePonder({ fen, moves }) {
    const position = this.validPosition(fen, moves);
    if (!position) return;
    const onInfo = throttle((info) => this.sendPage({ t: 'ponder_info', info }), 500);
    this.engine.ponder(position, onInfo);
  }

  // A start FEN plus UCI moves, checked so nothing odd reaches the engine's command line.
  validPosition(fen, moves) {
    const start = typeof fen === 'string' ? fen.trim() : '';
    if (checkFen(start)) return null;
    const list = Array.isArray(moves) ? moves.map(String) : [];
    if (list.length > 1200 || !list.every(m => UCI_MOVE.test(m))) return null;
    try {
      replay(start, list);
    } catch {
      return null;
    }
    return { fen: start, moves: list };
  }

  offerDraw({ gameId }) {
    const g = this.game;
    if (gameId !== g.id || g.outcome || !this.sharks().length) return;
    this.drawOffer = { gameId: g.id, ply: g.ply, seen: false };
    this.notify();
  }

  // ---- Claude's side: the MCP tools call these ------------------------------------------

  // The colours Claude plays: every side set to Stockshark 1.
  sharks() {
    return ['w', 'b'].filter(c => this.game.players[c] === 'stockshark');
  }

  touch() {
    this.claude.lastSeen = Date.now();
  }

  sessionOpened() {
    this.claude.sessions++;
    this.emitClaude();
  }

  sessionClosed() {
    this.claude.sessions = Math.max(0, this.claude.sessions - 1);
    this.emitClaude();
  }

  // The game as Claude needs to see it.
  state() {
    const g = this.game;
    const chess = g.chess;
    const sharks = this.sharks();
    const yourTurn = !!this.page && !g.outcome && g.players[g.turn] === 'stockshark';
    const planColor = sharks.includes(g.turn) ? g.turn : sharks[0] || g.turn;
    const last = g.sans.length ? g.sans[g.sans.length - 1] : '';
    return {
      boardOpen: !!this.page,
      boardUrl: this.url,
      players: { ...g.players },
      gameId: g.id,
      ply: g.ply,
      fen: g.fen,
      turn: g.turn,
      claudeColors: sharks,
      yourTurn,
      lastMove: last ? { san: last, by: g.players[g.turn === 'w' ? 'b' : 'w'] } : null,
      movetext: movetext(g.startFen, g.sans),
      inCheck: chess.inCheck(),
      legal: yourTurn ? chess.moves() : [],
      ascii: chess.ascii(),
      outcome: g.outcome || (g.id ? outcomeOf(chess) : null),
      thinkMs: g.thinkMs,
      veto: g.veto,
      drawOffer: !!(this.drawOffer && this.drawOffer.gameId === g.id),
      plan: this.claude.plans[planColor],
      planColor,
      engine: this.engine.status(),
    };
  }

  // What Claude should hear about right now, if anything.
  pendingEvent() {
    const g = this.game;
    if (!this.page || !g.id || !this.sharks().length) return null;
    if (g.outcome) return this.reportedEnd === g.id ? null : 'game_over';
    if (this.drawOffer && this.drawOffer.gameId === g.id && !this.drawOffer.seen) return 'draw_offered';
    if (g.players[g.turn] === 'stockshark') return 'your_turn';
    return null;
  }

  consume(event) {
    if (event === 'game_over') this.reportedEnd = this.game.id;
    if (event === 'draw_offered' && this.drawOffer) this.drawOffer.seen = true;
    return { event, state: this.state() };
  }

  notify() {
    for (const w of [...this.waiters]) w.check();
    this.emitClaude();
  }

  // Resolve when Claude has something to do: its move, a draw offer, or a finished game.
  waitForTurn({ timeoutMs, signal, onTick }) {
    this.touch();
    const now = this.pendingEvent();
    if (now) return Promise.resolve(this.consume(now));
    return new Promise(resolve => {
      const waiter = {};
      let tick;
      const finish = event => {
        if (waiter.done) return;
        waiter.done = true;
        clearTimeout(timer);
        clearInterval(tick);
        if (signal) signal.removeEventListener('abort', onAbort);
        this.waiters.delete(waiter);
        this.touch();
        this.emitClaude();
        resolve(event === 'timeout' || event === 'cancelled' ? { event, state: this.state() } : this.consume(event));
      };
      waiter.check = () => {
        const ev = this.pendingEvent();
        if (ev) finish(ev);
      };
      const timer = setTimeout(() => finish('timeout'), timeoutMs);
      if (onTick) tick = setInterval(onTick, 20000);
      const onAbort = () => finish('cancelled');
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      this.waiters.add(waiter);
      this.emitClaude();
    });
  }

  // Where a tool's `fen` + `moves` lead: the live game (with its history, so Stockfish sees
  // repetitions) unless a FEN is given, then each move in SAN or UCI.
  resolvePosition({ fen, moves } = {}) {
    let startFen, history, chess;
    if (fen) {
      const err = checkFen(fen);
      if (err) throw new Error(`That FEN is not valid: ${err}`);
      startFen = fen.trim();
      history = [];
      chess = new Chess(startFen);
    } else {
      startFen = this.game.startFen;
      history = [...this.game.moves];
      chess = replay(startFen, history).chess;
    }
    const played = [];
    for (const text of moves || []) {
      const m = findMove(chess, String(text));
      if (!m) {
        const where = played.length ? `after ${played.join(' ')}` : 'in that position';
        throw new Error(`"${text}" is not a legal move ${where}. Legal moves: ${chess.moves().join(' ')}`);
      }
      chess.move(m);
      played.push(m.san);
      history.push(m.lan);
    }
    return { startFen, history, chess, fen: chess.fen(), played, live: !fen };
  }

  // Analyse a position at full strength. Lines come back best first, scores from the side to
  // move's point of view. The live position's analysis is kept for the veto check.
  async analyze(args = {}, { signal, onInfo } = {}) {
    this.touch();
    const pos = this.resolvePosition(args);
    const over = outcomeOf(pos.chess);
    const base = { ...pos, outcome: over, lines: [], tablebase: null };
    if (over) return base;
    const legalCount = pos.chess.moves().length;
    const movetime = args.depth ? undefined : clamp(Math.round((Number(args.seconds) || this.game.thinkMs / 1000) * 1000), 1000, MAX_ANALYSIS_MS);
    const multipv = clamp(Math.round(Number(args.multipv) || 5), 1, Math.min(10, legalCount));
    const forward = throttle(info => this.sendPage({ t: 'claude_analysis', info, fen: pos.fen, played: pos.played }), 300);
    this.claude.busy++;
    this.emitClaude();
    try {
      const result = await this.engine.run(
        { fen: pos.startFen, moves: pos.history, movetime, depth: args.depth ? clamp(Number(args.depth), 1, 99) : undefined, multipv },
        { signal, onInfo: (info, lines) => { forward(info); if (onInfo) onInfo(info, lines); } },
      );
      forward.flush();
      const tablebase = this.config.tablebase ? await probeTablebase(pos.fen) : null;
      const analysis = { ...base, lines: result.lines, bestmove: result.bestmove, movetime: movetime || result.elapsed, multipv, tablebase, at: Date.now() };
      if (pos.live && !pos.played.length) {
        this.analyses.set(pos.fen, analysis);
        if (this.analyses.size > 40) this.analyses.delete(this.analyses.keys().next().value);
      }
      return analysis;
    } finally {
      this.claude.busy--;
      this.emitClaude();
    }
  }

  // Check a move against Stockfish before it is played.
  async vetoCheck(uci, { signal } = {}) {
    const g = this.game;
    let analysis = this.analyses.get(g.fen);
    if (!analysis || !analysis.lines.length) analysis = await this.analyze({ multipv: 3 }, { signal });
    const line = analysis.lines.find(l => l.pv[0] === uci);
    let chosenScore = line ? line.score : null;
    if (!chosenScore && g.veto !== null) {
      this.claude.busy++;
      this.emitClaude();
      try {
        const res = await this.engine.run(
          { fen: g.startFen, moves: g.moves, movetime: clamp(analysis.movetime || 5000, 2000, 30000), multipv: 1, searchmoves: [uci] },
          { signal },
        );
        chosenScore = res.lines[0] ? res.lines[0].score : null;
      } finally {
        this.claude.busy--;
        this.emitClaude();
      }
    }
    const verdict = judgeMove({ lines: analysis.lines, chosen: uci, chosenScore, margin: g.veto, tablebase: analysis.tablebase });
    verdict.passing = passingCandidates(analysis.lines, g.veto);
    verdict.analysis = analysis;
    return verdict;
  }

  // Why Claude cannot move right now, or null.
  moveBlocker() {
    const g = this.game;
    if (!this.page) return `The board is not open. Ask the human to open ${this.url || 'the Stockshark page'}.`;
    if (!this.sharks().length) return 'Neither side on the board is set to Stockshark 1. Ask the human to pick Stockshark 1 for White or Black.';
    if (g.outcome || outcomeOf(g.chess)) return 'The game is over.';
    if (g.players[g.turn] !== 'stockshark') {
      return `It is not your turn: ${COLOR_NAME[g.turn]} (${g.players[g.turn] === 'you' ? 'the human' : 'Stockfish 19'}) is to move. Call wait_for_my_turn.`;
    }
    return null;
  }

  async makeMove({ move, plan, comment, ply }, { signal } = {}) {
    this.touch();
    const blocked = this.moveBlocker();
    if (blocked) return { ok: false, error: blocked };
    const g = this.game;
    if (Number.isInteger(ply) && ply !== g.ply) {
      return { ok: false, error: `The position changed since ply ${ply} (it is now ply ${g.ply}); the human took a move back or started a new game. Call get_game.` };
    }
    const m = findMove(g.chess, move);
    if (!m) return { ok: false, error: `"${move}" is not legal here. Legal moves: ${g.chess.moves().join(' ')}` };
    const startId = g.id, startPly = g.ply;
    const verdict = await this.vetoCheck(m.lan, { signal });
    const blockedNow = this.moveBlocker();
    if (blockedNow) return { ok: false, error: blockedNow };
    if (this.game.id !== startId || this.game.ply !== startPly) {
      return { ok: false, error: 'The position changed while Stockfish was checking the move. Call get_game.' };
    }
    if (!verdict.ok) {
      this.sendPage({ t: 'claude_veto', san: m.san, reason: verdict.reason });
      return { ok: false, vetoed: true, san: m.san, verdict };
    }
    const mover = g.turn;
    if (typeof plan === 'string' && plan.trim()) this.claude.plans[mover] = plan.trim().slice(0, 1500);
    this.claude.comments[mover] = typeof comment === 'string' ? comment.trim().slice(0, 400) : '';
    const evalWhite = verdict.chosen.score ? (mover === 'w' ? verdict.chosen.score : negate(verdict.chosen.score)) : null;
    this.sendPage({
      t: 'bot_move', gameId: g.id, ply: g.ply, uci: m.lan, san: m.san,
      color: mover, plan: this.claude.plans[mover], comment: this.claude.comments[mover], eval: evalWhite, loss: verdict.loss,
      best: verdict.best && verdict.best.uci !== m.lan ? sanLine(g.fen, [verdict.best.uci], 1) : null,
    });
    // Mirror the move right away so an immediate wait_for_my_turn sees the human to move;
    // the board's own sync follows and confirms it.
    this.applyLocal(m.lan);
    if (this.drawOffer) this.drawOffer = null;
    return { ok: true, san: m.san, verdict, state: this.state() };
  }

  applyLocal(uci) {
    const g = this.game;
    try {
      const { chess, sans } = replay(g.startFen, [...g.moves, uci]);
      Object.assign(g, { moves: [...g.moves, uci], sans, chess, fen: chess.fen(), ply: g.ply + 1, turn: chess.turn() });
      const over = outcomeOf(chess);
      if (over) g.outcome = over;
    } catch {
      /* the board will resync */
    }
    this.notify();
  }

  setPlan({ plan, comment }) {
    this.touch();
    const g = this.game, sharks = this.sharks();
    const c = sharks.includes(g.turn) ? g.turn : sharks[0] || g.turn;
    if (typeof plan === 'string' && plan.trim()) this.claude.plans[c] = plan.trim().slice(0, 1500);
    if (typeof comment === 'string') this.claude.comments[c] = comment.trim().slice(0, 400);
    this.sendPage({ t: 'plan', color: c, plan: this.claude.plans[c], comment: this.claude.comments[c] });
    return { ok: true };
  }

  respondToDraw({ accept, message }) {
    this.touch();
    const g = this.game;
    if (!this.drawOffer || this.drawOffer.gameId !== g.id) return { ok: false, error: 'There is no draw offer to answer.' };
    this.drawOffer = null;
    const text = typeof message === 'string' ? message.trim().slice(0, 300) : '';
    this.sendPage({ t: 'draw_answer', gameId: g.id, accept: !!accept, message: text });
    if (accept) {
      g.outcome = { result: '½–½', reason: 'agreement' };
      this.reportedEnd = g.id;
    }
    this.notify();
    return { ok: true, accepted: !!accept };
  }

  shutdown() {
    for (const ctl of this.pageSearches.values()) ctl.abort();
    this.engine.shutdown();
  }
}
