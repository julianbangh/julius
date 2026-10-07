// Stockfish over UCI. `UciEngine` wraps one engine process; `EngineService` finds the
// strongest engine on this machine, starts it at full strength, restarts it if it dies, and
// runs searches one at a time (a background "ponder" search always gives way).
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { parseInfo, mergeLine, UCI_MOVE } from './uci.mjs';
import { ROOT } from './config.mjs';

const abortError = () => Object.assign(new Error('Search cancelled'), { name: 'AbortError' });

export class UciEngine extends EventEmitter {
  constructor({ command, args = [], backend = 'native', source = '' }) {
    super();
    Object.assign(this, { command, args, backend, source });
    this.name = '';
    this.options = {};
    this.values = {};
    this.alive = false;
    this.current = null;
    this.waiters = [];
    this.stderrTail = [];
  }

  start(timeoutMs = 90000) {
    return new Promise((resolve, reject) => {
      let proc;
      try {
        proc = spawn(this.command, this.args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      } catch (err) {
        reject(err);
        return;
      }
      this.proc = proc;
      this.alive = true;
      proc.once('error', err => {
        this.alive = false;
        this.failAll(err);
        reject(err);
      });
      proc.once('exit', (code, signal) => {
        this.alive = false;
        const tail = this.stderrTail.length ? `: ${this.stderrTail.join(' | ')}` : '';
        const err = new Error(`Stockfish stopped (${signal || `exit code ${code}`})${tail}`);
        this.failAll(err);
        reject(err);
        this.emit('exit', err);
      });
      proc.stdin.on('error', () => {});
      readline.createInterface({ input: proc.stdout }).on('line', line => this.onLine(line));
      readline.createInterface({ input: proc.stderr }).on('line', line => {
        this.stderrTail.push(line);
        if (this.stderrTail.length > 4) this.stderrTail.shift();
      });
      this.send('uci');
      this.waitFor(l => l === 'uciok', timeoutMs).then(() => resolve(this), reject);
    });
  }

  send(cmd) {
    if (/[\r\n]/.test(cmd)) throw new Error('UCI commands are single lines');
    if (!this.alive) throw new Error('Stockfish is not running');
    this.proc.stdin.write(cmd + '\n');
  }

  waitFor(test, timeoutMs) {
    return new Promise((resolve, reject) => {
      const w = { test, resolve, reject };
      w.timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        reject(new Error('Stockfish did not answer in time'));
      }, timeoutMs);
      this.waiters.push(w);
    });
  }

  failAll(err) {
    for (const w of this.waiters.splice(0)) {
      clearTimeout(w.timer);
      w.reject(err);
    }
    if (this.current) {
      const job = this.current;
      this.current = null;
      job.reject(err);
    }
  }

  onLine(line) {
    if (line.startsWith('id name ')) this.name = line.slice(8).trim();
    else if (line.startsWith('option name ')) this.parseOption(line);
    const job = this.current;
    if (job) {
      if (line.startsWith('info ')) {
        const info = parseInfo(line);
        if (info) {
          mergeLine(job.lines, info);
          job.last = info;
          if (job.onInfo) job.onInfo(info, job.lines);
        }
      } else if (line.startsWith('bestmove')) {
        const [, best, , ponder] = line.split(/\s+/);
        this.current = null;
        job.resolve({
          bestmove: best && UCI_MOVE.test(best) ? best : null,
          ponder: ponder && UCI_MOVE.test(ponder) ? ponder : null,
          lines: job.lines.filter(Boolean),
          last: job.last,
          elapsed: Date.now() - job.started,
        });
      }
    }
    for (const w of [...this.waiters]) {
      if (w.test(line)) {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        clearTimeout(w.timer);
        w.resolve(line);
      }
    }
  }

  // "option name Skill Level type spin default 20 min 0 max 20"
  parseOption(line) {
    const m = /^option name (.+?) type (\w+)(.*)$/.exec(line);
    if (!m) return;
    const [, name, type, rest] = m;
    const opt = { type };
    const def = /\bdefault ?(.*?)(?= min | max | var |$)/.exec(rest);
    if (def) opt.default = def[1];
    const min = /\bmin (-?\d+)/.exec(rest);
    const max = /\bmax (-?\d+)/.exec(rest);
    if (min) opt.min = Number(min[1]);
    if (max) opt.max = Number(max[1]);
    this.options[name] = opt;
  }

  // Set an option the engine actually has, clamped to its range. Returns the value used.
  setOption(name, value) {
    const opt = this.options[name];
    if (!opt) return undefined;
    let v = value;
    if (opt.type === 'spin') v = Math.min(opt.max ?? v, Math.max(opt.min ?? v, Math.round(Number(v))));
    if (opt.type === 'check') v = v ? 'true' : 'false';
    if (this.values[name] === String(v)) return v;
    this.send(`setoption name ${name} value ${v}`);
    this.values[name] = String(v);
    return v;
  }

  // Hash allocation for a big table can take a while, so the timeout is generous.
  ready(timeoutMs = 180000) {
    this.send('isready');
    return this.waitFor(l => l === 'readyok', timeoutMs);
  }

  search(params, onInfo) {
    if (!this.alive) return Promise.reject(new Error('Stockfish is not running'));
    if (this.current) return Promise.reject(new Error('Stockfish is busy'));
    const { fen, moves = [], movetime, depth, nodes, infinite, multipv = 1, searchmoves } = params;
    return new Promise((resolve, reject) => {
      this.current = { resolve, reject, onInfo, lines: [], last: null, started: Date.now() };
      try {
        this.setOption('MultiPV', multipv);
        this.send(`position fen ${fen}${moves.length ? ` moves ${moves.join(' ')}` : ''}`);
        let go = 'go';
        if (infinite) go += ' infinite';
        else {
          if (movetime) go += ` movetime ${Math.round(movetime)}`;
          if (depth) go += ` depth ${Math.round(depth)}`;
          if (nodes) go += ` nodes ${Math.round(nodes)}`;
          if (!movetime && !depth && !nodes) go += ' movetime 1000';
        }
        // Stockfish reads every token after "searchmoves" as a move, so it goes last.
        if (searchmoves && searchmoves.length) go += ` searchmoves ${searchmoves.join(' ')}`;
        this.send(go);
      } catch (err) {
        this.current = null;
        reject(err);
      }
    });
  }

  stop() {
    if (this.current && this.alive) this.send('stop');
  }

  quit() {
    if (!this.alive) return;
    try {
      this.send('quit');
    } catch {
      /* already gone */
    }
    setTimeout(() => this.proc && this.proc.kill(), 1500).unref();
  }
}

const isExecutable = p => {
  try {
    if (!fs.statSync(p).isFile()) return false;
    if (process.platform !== 'win32') fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

// Every engine this machine could run, strongest first: an explicit STOCKFISH_PATH, the
// binary `npm run get-stockfish` downloaded, a stockfish on the PATH, then the WASM build
// from the `stockfish` npm package running inside Node (slower, but always there).
export function engineCandidates(config) {
  const exe = process.platform === 'win32' ? 'stockfish.exe' : 'stockfish';
  const natives = [];
  if (config.engine.path) natives.push([config.engine.path, 'STOCKFISH_PATH']);
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'bin', 'stockfish.json'), 'utf8'));
    if (meta.binary) natives.push([path.resolve(ROOT, meta.binary), 'npm run get-stockfish']);
  } catch {
    /* nothing downloaded */
  }
  natives.push([path.join(ROOT, 'bin', exe), 'bin/']);
  for (const dir of (process.env.PATH || '').split(path.delimiter)) if (dir) natives.push([path.join(dir, exe), 'PATH']);
  for (const p of ['/usr/games/stockfish', '/opt/homebrew/bin/stockfish', '/usr/local/bin/stockfish']) natives.push([p, 'system']);
  const seen = new Set();
  const list = [];
  for (const [p, source] of natives) {
    const abs = path.resolve(p);
    if (seen.has(abs) || !isExecutable(abs)) continue;
    seen.add(abs);
    list.push({ command: abs, args: [], backend: 'native', source });
  }
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve('stockfish/package.json');
    const { buildVersion } = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const js = path.join(path.dirname(pkgPath), 'bin', `stockfish-${buildVersion}.js`);
    if (fs.existsSync(js)) list.push({ command: process.execPath, args: [js], backend: 'wasm', source: 'stockfish npm package' });
  } catch {
    /* package not installed */
  }
  return list;
}

export class EngineService extends EventEmitter {
  constructor(config, log = () => {}) {
    super();
    this.config = config;
    this.log = log;
    this.engine = null;
    this.starting = null;
    this.queue = [];
    this.running = null;
    this.ponderCtl = null;
    this.lastError = null;
  }

  // The running engine, starting (or restarting) it on demand.
  get() {
    if (this.engine && this.engine.alive) return Promise.resolve(this.engine);
    if (!this.starting) {
      this.starting = this.launch().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  async launch() {
    const candidates = engineCandidates(this.config);
    if (!candidates.length) throw new Error('No Stockfish found. Run "npm run get-stockfish" or set STOCKFISH_PATH.');
    let lastErr;
    for (const c of candidates) {
      const engine = new UciEngine(c);
      try {
        await engine.start();
        await this.configure(engine);
        engine.on('exit', err => {
          this.lastError = err.message;
          this.log(`engine: ${err.message}`);
          this.emit('status', this.status());
        });
        this.engine = engine;
        this.lastError = null;
        this.log(`engine: ${engine.name} (${c.backend}, ${c.source}) · ${engine.values.Threads || 1} threads · ${engine.values.Hash || '?'} MB hash`);
        this.emit('status', this.status());
        return engine;
      } catch (err) {
        lastErr = err;
        this.log(`engine: ${c.command} failed: ${err.message}`);
        engine.quit();
      }
    }
    this.lastError = lastErr ? lastErr.message : 'unknown error';
    this.emit('status', this.status());
    throw lastErr;
  }

  // Full strength: every core, a big hash table, no skill limit, win/draw/loss output.
  async configure(engine) {
    const { threads, hashMb, syzygyPath } = this.config.engine;
    engine.setOption('Threads', threads);
    engine.setOption('Hash', hashMb);
    engine.setOption('UCI_LimitStrength', false);
    engine.setOption('Skill Level', 20);
    engine.setOption('Ponder', false);
    engine.setOption('UCI_ShowWDL', true);
    if (syzygyPath) engine.setOption('SyzygyPath', syzygyPath);
    await engine.ready();
  }

  status() {
    const e = this.engine;
    return {
      ready: !!(e && e.alive),
      starting: !!this.starting,
      name: e ? e.name : '',
      backend: e ? e.backend : '',
      source: e ? e.source : '',
      threads: e ? Number(e.values.Threads || 1) : this.config.engine.threads,
      hashMb: e ? Number(e.values.Hash || 0) : this.config.engine.hashMb,
      syzygy: !!(e && e.values.SyzygyPath),
      error: this.lastError,
    };
  }

  // Queue one search. A search for the board or for Claude stops any ponder search first.
  run(params, { onInfo, signal, kind = 'search' } = {}) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {
        reject(abortError());
        return;
      }
      const job = { params, onInfo, signal, kind, resolve, reject };
      if (signal) {
        signal.addEventListener('abort', () => {
          const i = this.queue.indexOf(job);
          if (i >= 0) {
            this.queue.splice(i, 1);
            reject(abortError());
          } else if (this.running === job && this.engine) this.engine.stop();
        }, { once: true });
      }
      if (kind !== 'ponder') {
        for (const queued of this.queue.filter(j => j.kind === 'ponder')) {
          this.queue.splice(this.queue.indexOf(queued), 1);
          queued.reject(abortError());
        }
        if (this.running && this.running.kind === 'ponder' && this.engine) this.engine.stop();
      }
      this.queue.push(job);
      this.pump();
    });
  }

  async pump() {
    if (this.running || !this.queue.length) return;
    const job = this.queue.shift();
    this.running = job;
    try {
      const engine = await this.get();
      if (job.signal && job.signal.aborted) throw abortError();
      job.resolve(await engine.search(job.params, job.onInfo));
    } catch (err) {
      job.reject(err);
    } finally {
      this.running = null;
      this.pump();
    }
  }

  get busy() {
    return !!(this.running && this.running.kind !== 'ponder') || this.queue.some(j => j.kind !== 'ponder');
  }

  // Think on the opponent's time: an open-ended search whose work stays in the hash table.
  ponder(params, onInfo, maxMs = 15 * 60 * 1000) {
    this.stopPonder();
    if (this.busy) return;
    const ctl = new AbortController();
    this.ponderCtl = ctl;
    const timer = setTimeout(() => ctl.abort(), maxMs);
    this.run({ ...params, infinite: true, multipv: 1 }, { kind: 'ponder', signal: ctl.signal, onInfo })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }

  stopPonder() {
    if (this.ponderCtl) this.ponderCtl.abort();
    this.ponderCtl = null;
  }

  async newGame() {
    this.stopPonder();
    if (!this.engine || !this.engine.alive || this.running) return;
    try {
      this.engine.send('ucinewgame');
      await this.engine.ready();
    } catch {
      /* the next search restarts the engine if needed */
    }
  }

  shutdown() {
    this.stopPonder();
    if (this.engine) this.engine.quit();
  }
}
