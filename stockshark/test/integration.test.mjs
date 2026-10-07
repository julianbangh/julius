// The whole loop on a real engine: a fake board on the WebSocket, Claude's side through a
// real MCP client, Stockfish (native if installed, otherwise the npm WASM build) underneath.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { loadConfig, ROOT } from '../server/config.mjs';
import { Bridge } from '../server/bridge.mjs';
import { createHttpServer } from '../server/http.mjs';

const config = loadConfig({ STOCKSHARK_HASH_MB: '64', STOCKSHARK_THREADS: '2', STOCKSHARK_PORT: '0', STOCKSHARK_TABLEBASE: '0' }, []);
let bridge, web, port, page, client;
const inbox = [];

function nextMessage(type, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const look = () => {
      const i = inbox.findIndex(m => m.t === type);
      if (i >= 0) return resolve(inbox.splice(i, 1)[0]);
      if (Date.now() - started > timeoutMs) return reject(new Error(`no ${type} message`));
      setTimeout(look, 25);
    };
    look();
  });
}

const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 180000 });
  return { text: res.content.map(c => c.text).join('\n'), isError: !!res.isError };
};

const game = { id: 'g1', startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [], players: { w: 'you', b: 'stockshark' }, thinkMs: 1500, veto: 20, outcome: null };
const sync = () => page.send(JSON.stringify({ t: 'sync', game }));

before(async () => {
  bridge = new Bridge(config, () => {});
  web = createHttpServer(bridge, config, () => {});
  port = await web.listen(0);
  bridge.url = `http://127.0.0.1:${port}/`;
  page = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: `http://127.0.0.1:${port}` });
  page.on('message', d => inbox.push(JSON.parse(d.toString())));
  await new Promise(r => page.once('open', r));
  page.send(JSON.stringify({ t: 'hello' }));
  await nextMessage('welcome');
  client = new Client({ name: 'stockshark-test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
});

after(async () => {
  await client.close().catch(() => {});
  page.close();
  bridge.shutdown();
  web.close();
});

test('lists the tools and the play prompt', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(t => t.name).sort(), ['analyze_position', 'get_game', 'make_move', 'respond_to_draw_offer', 'set_plan', 'wait_for_my_turn']);
  const { prompts } = await client.listPrompts();
  assert.equal(prompts[0].name, 'play');
  const p = await client.getPrompt({ name: 'play', arguments: { style: 'aggressive' } });
  assert.match(p.messages[0].content.text, /aggressive/);
});

test('rejects foreign origins and hosts', async () => {
  const bad = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { origin: 'https://evil.example' } });
  assert.equal(bad.status, 403);
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'https://evil.example' });
  await new Promise(resolve => ws.once('error', resolve));
  const ok = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal((await ok.json()).app, 'stockshark');
});

test('plays a turn: wait, analyse, veto a bad move, accept a good one', async () => {
  game.moves = ['e2e4'];
  sync();
  const waited = await call('wait_for_my_turn', { timeout_seconds: 10 });
  assert.match(waited.text, /^Your move\./);
  assert.match(waited.text, /ply=1/);

  const analysis = await call('analyze_position', { seconds: 2, multipv: 3 });
  assert.equal(analysis.isError, false, analysis.text);
  assert.match(analysis.text, /^Stockfish/);
  assert.match(analysis.text, /\n1\. \S+/);

  const tested = await call('analyze_position', { seconds: 1, moves: ['e5', 'Nf3'] });
  assert.match(tested.text, /after e5 Nf3/);
  const illegal = await call('analyze_position', { moves: ['Ke2'] });
  assert.equal(illegal.isError, true);

  const vetoed = await call('make_move', { move: 'g5', ply: 1 });
  assert.equal(vetoed.isError, true);
  assert.match(vetoed.text, /Vetoed/);
  await nextMessage('claude_veto');

  const good = analysis.text.match(/\n1\. (\S+)/)[1];
  const played = await call('make_move', { move: good, ply: 1, plan: 'Fight for the centre.', comment: 'Classical.' });
  assert.equal(played.isError, false, played.text);
  assert.match(played.text, /Played/);
  const botMove = await nextMessage('bot_move');
  assert.equal(botMove.gameId, 'g1');
  assert.equal(botMove.ply, 1);
  assert.equal(botMove.plan, 'Fight for the centre.');
  game.moves.push(botMove.uci);
  sync();

  const notYours = await call('make_move', { move: 'Nf3' });
  assert.equal(notYours.isError, true);
  assert.match(notYours.text, /not your turn/);
});

test('times out quietly, then wakes on the human move', async () => {
  const quiet = await call('wait_for_my_turn', { timeout_seconds: 5 });
  assert.match(quiet.text, /Nothing to do yet/);
  const waiting = call('wait_for_my_turn', { timeout_seconds: 30 });
  await new Promise(r => setTimeout(r, 300));
  const status = inbox.filter(m => m.t === 'claude').pop();
  assert.equal(status.waiting, true);
  game.moves.push('g1f3');
  sync();
  const woke = await waiting;
  assert.match(woke.text, /^Your move\./);
  assert.match(woke.text, /ply=3/);
});

test('a take-back makes a stale move fail', async () => {
  const stale = await call('make_move', { move: 'Nc6', ply: 1 });
  assert.equal(stale.isError, true);
  assert.match(stale.text, /position changed/);
});

test('draw offers reach Claude and the answer reaches the board', async () => {
  page.send(JSON.stringify({ t: 'draw_offer', gameId: 'g1' }));
  const offered = await call('wait_for_my_turn', { timeout_seconds: 10 });
  assert.match(offered.text, /offers a draw/);
  const answer = await call('respond_to_draw_offer', { accept: false, message: 'Not yet.' });
  assert.equal(answer.isError, false);
  const msg = await nextMessage('draw_answer');
  assert.equal(msg.accept, false);
  assert.equal(msg.message, 'Not yet.');
});

test('the board runs its own Stockfish searches through the bridge', async () => {
  page.send(JSON.stringify({ t: 'search', id: 's1', fen: game.startFen, moves: ['e2e4'], movetime: 800, multipv: 1 }));
  const done = await nextMessage('search_done');
  assert.equal(done.id, 's1');
  assert.match(done.bestmove, /^[a-h][1-8][a-h][1-8]/);
  assert.ok(done.lines.length >= 1);
});

test('a second stdio launch forwards to the running bridge', async () => {
  const stdioClient = new Client({ name: 'stockshark-stdio-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(ROOT, 'server', 'index.mjs'), '--stdio'],
    env: { ...process.env, STOCKSHARK_PORT: String(port) },
    stderr: 'pipe',
  });
  await stdioClient.connect(transport);
  const res = await stdioClient.callTool({ name: 'get_game', arguments: {} });
  assert.match(res.content[0].text, /White: the human\. Black: you \(Stockshark 1\)/);
  await stdioClient.close();
});

test('Stockshark can play both sides, keeping a plan for each', async () => {
  Object.assign(game, { id: 'g2', moves: [], players: { w: 'stockshark', b: 'stockshark' } });
  sync();
  const white = await call('wait_for_my_turn', { timeout_seconds: 10 });
  assert.match(white.text, /White: you \(Stockshark 1\)\. Black: you \(Stockshark 1\)/);
  assert.match(white.text, /White to move: that is you/);
  const w = await call('make_move', { move: 'e4', ply: 0, plan: 'White plan.', comment: 'One.' });
  assert.equal(w.isError, false, w.text);
  assert.match(w.text, /Black \(you \(Stockshark 1\)\) is to move/);
  const wMsg = await nextMessage('bot_move');
  assert.equal(wMsg.color, 'w');
  game.moves.push(wMsg.uci);
  sync();
  const black = await call('wait_for_my_turn', { timeout_seconds: 10 });
  assert.match(black.text, /ply=1/);
  assert.doesNotMatch(black.text, /White plan/);
  const b = await call('make_move', { move: 'e5', ply: 1, plan: 'Black plan.' });
  assert.equal(b.isError, false, b.text);
  const bMsg = await nextMessage('bot_move');
  assert.equal(bMsg.color, 'b');
  assert.equal(bMsg.plan, 'Black plan.');
  game.moves.push(bMsg.uci);
  sync();
  const again = await call('wait_for_my_turn', { timeout_seconds: 10 });
  assert.match(again.text, /Your plan so far as White: White plan\./);
});

test('says so when Stockshark is not seated, and names a Stockfish opponent', async () => {
  Object.assign(game, { id: 'g3', moves: [], players: { w: 'you', b: 'you' } });
  sync();
  const none = await call('make_move', { move: 'e4' });
  assert.equal(none.isError, true);
  assert.match(none.text, /Neither side on the board is set to Stockshark 1/);
  Object.assign(game, { id: 'g4', moves: ['e2e4'], players: { w: 'stockfish', b: 'stockshark' } });
  sync();
  const vsEngine = await call('wait_for_my_turn', { timeout_seconds: 10 });
  assert.match(vsEngine.text, /White: Stockfish 19 on its own\. Black: you \(Stockshark 1\)/);
  assert.match(vsEngine.text, /Last move: e4 \(Stockfish 19's\)/);
});
