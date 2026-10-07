#!/usr/bin/env node
// Download the latest official Stockfish into bin/ so the bridge can run it natively, with
// every core and a big hash table (several times faster than the WebAssembly copy).
//   npm run get-stockfish             latest release for this computer
//   npm run get-stockfish -- --force  download again even if one is installed
//   npm run get-stockfish -- --url <archive url>   use another build
//
// Since Stockfish 19 the official builds are "universal": one download per platform that
// detects the CPU's features itself. The download is test-run before it is kept.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../server/config.mjs';

const LATEST = 'https://github.com/official-stockfish/Stockfish/releases/latest/download/';

export function assetFor(platform = process.platform, arch = process.arch) {
  const table = {
    linux: { x64: 'stockfish-linux-x86-64-universal.tar.gz', arm64: 'stockfish-linux-arm64-universal.tar.gz', riscv64: 'stockfish-linux-riscv64-universal.tar.gz' },
    darwin: { x64: 'stockfish-macos-universal.tar.gz', arm64: 'stockfish-macos-universal.tar.gz' },
    win32: { x64: 'stockfish-windows-x86-64-universal.zip', arm64: 'stockfish-windows-arm64-universal.zip' },
    android: { arm64: 'stockfish-android-arm64-universal.tar.gz', arm: 'stockfish-android-armv7-neon.tar.gz' },
  };
  return (table[platform] || {})[arch] || null;
}

// The engine inside an unpacked release: prefer the file named like the platform build,
// then a plain "stockfish", then the largest stockfish* file.
export function findBinary(dir, platform = process.platform) {
  const found = [];
  const walk = d => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/^stockfish/i.test(name) && st.size > 500_000 && (platform !== 'win32' || /\.exe$/i.test(name))) found.push({ p, name: name.toLowerCase(), size: st.size });
    }
  };
  walk(dir);
  const rank = f => (f.name.includes('universal') ? 0 : /^stockfish(\.exe)?$/.test(f.name) ? 1 : 2);
  found.sort((a, b) => rank(a) - rank(b) || b.size - a.size);
  return found.length ? found[0].p : null;
}

// A short real search. A build the CPU can't run dies at once.
export function testRun(binary) {
  return new Promise(resolve => {
    let out = '';
    let done = false;
    const proc = spawn(binary, [], { stdio: ['pipe', 'pipe', 'ignore'] });
    const finish = ok => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { proc.kill(); } catch { /* already gone */ }
      resolve(ok ? (/id name (.+)/.exec(out) || [])[1] || 'Stockfish' : null);
    };
    const timer = setTimeout(() => finish(false), 60000);
    proc.on('error', () => finish(false));
    proc.on('exit', () => finish(/bestmove/.test(out)));
    proc.stdout.on('data', d => {
      out += d;
      if (/bestmove/.test(out)) finish(true);
    });
    proc.stdin.on('error', () => {});
    proc.stdin.write('uci\nisready\nposition startpos moves e2e4 e7e5\ngo depth 12\n');
  });
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : '';
  const binDir = path.join(ROOT, 'bin');
  const metaFile = path.join(binDir, 'stockfish.json');

  if (!force && fs.existsSync(metaFile)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      const name = await testRun(path.resolve(ROOT, meta.binary));
      if (name) {
        console.log(`${name} is already installed (${meta.binary}). Use --force to download again.`);
        return;
      }
    } catch { /* reinstall */ }
  }

  const asset = url ? path.basename(new URL(url).pathname) : assetFor();
  if (!asset) {
    throw new Error(`There is no official Stockfish build for ${process.platform}/${process.arch}. Install one with your package manager and set STOCKFISH_PATH; until then Stockshark uses its WebAssembly copy.`);
  }
  const source = url || LATEST + asset;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stockshark-'));
  try {
    process.stdout.write(`Downloading ${asset}… `);
    const res = await fetch(source, { headers: { 'user-agent': 'stockshark' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${source}`);
    const archive = path.join(tmp, asset);
    fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
    console.log(`${(fs.statSync(archive).size / 1e6).toFixed(0)} MB`);

    // Unpack into bin/<asset name>/, keeping the whole folder in case the build ships
    // more than one file.
    const folder = asset.replace(/\.(tar\.gz|tgz|tar|zip)$/, '');
    const dest = path.join(binDir, folder);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    execFileSync('tar', ['-xf', archive, '-C', dest]);
    const binary = findBinary(dest);
    if (!binary) throw new Error(`No Stockfish binary found inside ${asset}.`);
    if (process.platform !== 'win32') fs.chmodSync(binary, 0o755);

    process.stdout.write('Test-running it… ');
    const name = await testRun(binary);
    if (!name) throw new Error("it didn't run on this computer. Set STOCKFISH_PATH to a Stockfish you have, or keep using the WebAssembly copy.");
    const rel = path.relative(ROOT, binary).split(path.sep).join('/');
    fs.writeFileSync(metaFile, JSON.stringify({ binary: rel, name, asset, source, installed: new Date().toISOString() }, null, 2) + '\n');
    console.log(`${name} works.\nInstalled at ${rel}. Restart Stockshark (or Claude Code) to use it.`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(err => {
    console.error(`\n${err.message}`);
    process.exit(1);
  });
}
