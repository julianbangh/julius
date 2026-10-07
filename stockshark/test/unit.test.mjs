import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseInfo, mergeLine, scoreValue, formatScore, negate } from '../server/uci.mjs';
import { judgeMove, passingCandidates } from '../server/guard.mjs';
import { Chess, START_FEN, findMove, sanLine, movetext, replay, outcomeOf, checkFen } from '../server/game.mjs';
import { assetFor, findBinary } from '../scripts/get-stockfish.mjs';

test('parses Stockfish info lines', () => {
  const info = parseInfo('info depth 24 seldepth 33 multipv 2 score cp -31 upperbound wdl 12 900 88 nodes 1234567 nps 987654 hashfull 41 tbhits 0 time 1250 pv e7e5 g1f3 b8c6');
  assert.deepEqual(info, {
    depth: 24, seldepth: 33, multipv: 2, score: { cp: -31 }, bound: 'upper', wdl: [12, 900, 88],
    nodes: 1234567, nps: 987654, hashfull: 41, tbhits: 0, time: 1250, pv: ['e7e5', 'g1f3', 'b8c6'],
  });
  assert.deepEqual(parseInfo('info depth 30 score mate -4 pv d8h4').score, { mate: -4 });
  assert.equal(parseInfo('info string NNUE evaluation using nn-1a298aa575a0.nnue'), null);
  assert.equal(parseInfo('info currmove e2e4 currmovenumber 1'), null);
  assert.equal(parseInfo('bestmove e2e4'), null);
});

test('keeps the deepest exact line per MultiPV slot', () => {
  const lines = [];
  mergeLine(lines, parseInfo('info depth 10 multipv 1 score cp 20 pv e2e4'));
  mergeLine(lines, parseInfo('info depth 11 multipv 1 score cp 40 lowerbound pv d2d4'));
  mergeLine(lines, parseInfo('info depth 11 multipv 1 score cp 30 pv c2c4'));
  mergeLine(lines, parseInfo('info depth 9 multipv 1 score cp 99 pv a2a3'));
  mergeLine(lines, parseInfo('info depth 11 multipv 2 score cp 10 pv g1f3'));
  assert.equal(lines[0].pv[0], 'c2c4');
  assert.equal(lines[1].pv[0], 'g1f3');
});

test('orders scores: mates beyond centipawns, quick mates first, long defences best', () => {
  const order = [{ mate: 1 }, { mate: 5 }, { cp: 900 }, { cp: 0 }, { cp: -900 }, { mate: -9 }, { mate: -1 }];
  const values = order.map(scoreValue);
  assert.deepEqual([...values].sort((a, b) => b - a), values);
  assert.equal(formatScore({ cp: -123 }), '-1.23');
  assert.equal(formatScore({ cp: 5 }), '+0.05');
  assert.equal(formatScore({ mate: 3 }), '#3');
  assert.deepEqual(negate({ mate: 3 }), { mate: -3 });
});

const lines = [
  { pv: ['e2e4'], score: { cp: 35 } },
  { pv: ['d2d4'], score: { cp: 28 } },
  { pv: ['g1f3'], score: { cp: 10 } },
];

test('the veto passes moves inside the margin and stops the rest', () => {
  assert.equal(judgeMove({ lines, chosen: 'e2e4', chosenScore: lines[0].score, margin: 0 }).ok, true);
  assert.equal(judgeMove({ lines, chosen: 'd2d4', chosenScore: lines[1].score, margin: 0 }).ok, false);
  assert.equal(judgeMove({ lines, chosen: 'd2d4', chosenScore: lines[1].score, margin: 20 }).ok, true);
  const bad = judgeMove({ lines, chosen: 'g1f3', chosenScore: lines[2].score, margin: 20 });
  assert.equal(bad.ok, false);
  assert.equal(bad.loss, 25);
  assert.match(bad.reason, /0\.25 pawns worse/);
  assert.equal(judgeMove({ lines, chosen: 'g2g4', chosenScore: { cp: -300 }, margin: null }).ok, true);
  assert.equal(judgeMove({ lines, chosen: 'g2g4', chosenScore: null, margin: 20 }).ok, false);
  assert.deepEqual(passingCandidates(lines, 20).map(l => l.pv[0]), ['e2e4', 'd2d4']);
});

test('with a mate on the board only an equally fast mate passes', () => {
  const mating = [{ pv: ['d1h5'], score: { mate: 2 } }, { pv: ['d1f3'], score: { mate: 4 } }];
  assert.equal(judgeMove({ lines: mating, chosen: 'd1f3', chosenScore: { mate: 4 }, margin: 50 }).ok, false);
  assert.equal(judgeMove({ lines: mating, chosen: 'd1h5', chosenScore: { mate: 2 }, margin: 0 }).ok, true);
});

test('the tablebase overrides scores in solved endings', () => {
  const tablebase = { category: 'win', moves: [
    { uci: 'c2c6', san: 'Qc6', category: 'loss', dtz: -12 },
    { uci: 'c2c1', san: 'Qc1', category: 'loss', dtz: -16 },
    { uci: 'c2c3', san: 'Qc3', category: 'draw', dtz: 0 },
  ] };
  const l = [{ pv: ['c2c6'], score: { cp: 2000 } }];
  assert.equal(judgeMove({ lines: l, chosen: 'c2c6', chosenScore: { cp: 2000 }, margin: 20, tablebase }).ok, true);
  const slower = judgeMove({ lines: l, chosen: 'c2c1', chosenScore: { cp: 1990 }, margin: 20, tablebase });
  assert.equal(slower.ok, false);
  assert.match(slower.reason, /wins fastest/);
  const drawn = judgeMove({ lines: l, chosen: 'c2c3', chosenScore: { cp: 0 }, margin: 20, tablebase });
  assert.equal(drawn.ok, false);
  assert.match(drawn.reason, /tablebase/);
});

test('reads moves the way people and models write them', () => {
  const chess = new Chess(START_FEN);
  assert.equal(findMove(chess, 'Nf3').lan, 'g1f3');
  assert.equal(findMove(chess, 'g1f3').lan, 'g1f3');
  assert.equal(findMove(chess, '1. e4!').lan, 'e2e4');
  assert.equal(findMove(chess, 'Ke2'), null);
  const castle = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(findMove(castle, '0-0').san, 'O-O');
  assert.equal(findMove(castle, 'O-O-O+')?.san ?? findMove(castle, 'O-O-O').san, 'O-O-O');
  const promo = new Chess('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
  assert.equal(findMove(promo, 'e8Q').lan, 'e7e8q');
  assert.equal(findMove(promo, 'e7e8n').san, 'e8=N');
});

test('writes engine lines and games in standard notation', () => {
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  assert.equal(sanLine(afterE4, ['e7e5', 'g1f3', 'b8c6']), '1... e5 2. Nf3 Nc6');
  assert.equal(sanLine(afterE4, ['e7e5', 'e1e8']), '1... e5');
  const { sans } = replay(START_FEN, ['e2e4', 'e7e5', 'g1f3']);
  assert.equal(movetext(START_FEN, sans), '1. e4 e5 2. Nf3');
  assert.throws(() => replay(START_FEN, ['e2e5']), /not legal/);
  assert.throws(() => replay(START_FEN, ['e2e4\nquit']), /not UCI/);
});

test('recognises finished games and bad FENs', () => {
  const mated = replay(START_FEN, ['f2f3', 'e7e5', 'g2g4', 'd8h4']).chess;
  assert.deepEqual(outcomeOf(mated), { result: '0–1', reason: 'checkmate', winner: 'b' });
  assert.equal(outcomeOf(new Chess(START_FEN)), null);
  assert.equal(checkFen(START_FEN), null);
  assert.ok(checkFen('not a fen'));
  assert.ok(checkFen(`${START_FEN}\nquit`));
});

test('picks the official universal build for each platform', () => {
  assert.equal(assetFor('linux', 'x64'), 'stockfish-linux-x86-64-universal.tar.gz');
  assert.equal(assetFor('darwin', 'arm64'), 'stockfish-macos-universal.tar.gz');
  assert.equal(assetFor('win32', 'x64'), 'stockfish-windows-x86-64-universal.zip');
  assert.equal(assetFor('sunos', 'x64'), null);
});

test('finds the engine inside an unpacked release', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));
  fs.mkdirSync(path.join(dir, 'stockfish', 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'stockfish', 'src', 'stockfish-source.tar'), Buffer.alloc(900_000));
  fs.writeFileSync(path.join(dir, 'stockfish', 'stockfish-linux-x86-64-universal'), Buffer.alloc(600_000));
  fs.writeFileSync(path.join(dir, 'stockfish', 'README.md'), 'hi');
  assert.match(findBinary(dir, 'linux'), /stockfish-linux-x86-64-universal$/);
  fs.rmSync(dir, { recursive: true, force: true });
});
