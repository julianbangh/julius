// Settings come from environment variables so the same command works from a terminal, from
// `npm start`, and from an MCP client's config file.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VERSION = '1.0.0';

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

export function loadConfig(env = process.env, argv = process.argv.slice(2)) {
  const cpus = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const totalMb = Math.floor(os.totalmem() / 1048576);
  // A quarter of the machine's memory, rounded down to a power of two, 256 MB to 32 GB.
  const autoHash = Math.min(32768, Math.max(256, 2 ** Math.floor(Math.log2(Math.max(1, totalMb / 4)))));
  return {
    host: env.STOCKSHARK_HOST || '127.0.0.1',
    port: int(env.STOCKSHARK_PORT, 8787),
    stdio: argv.includes('--stdio'),
    open: argv.includes('--open'),
    engine: {
      path: env.STOCKFISH_PATH || '',
      threads: Math.max(1, int(env.STOCKSHARK_THREADS, cpus)),
      hashMb: Math.max(16, int(env.STOCKSHARK_HASH_MB, autoHash)),
      syzygyPath: env.SYZYGY_PATH || '',
    },
    // Perfect endgame play from the Lichess 7-piece tablebase (sends ≤7-piece positions to
    // tablebase.lichess.ovh). STOCKSHARK_TABLEBASE=0 turns it off.
    tablebase: env.STOCKSHARK_TABLEBASE !== '0',
  };
}
