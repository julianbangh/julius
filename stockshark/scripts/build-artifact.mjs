#!/usr/bin/env node
// Build dist/artifact: the board page as a self-contained claude.ai artifact. Stockfish 19
// runs inside the page as WebAssembly; the 99 MB full-strength build is split into parts
// small enough for artifact hosting (15 MB per file) and reassembled by the page.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from '../server/config.mjs';

const OUT = path.join(ROOT, 'dist', 'artifact');
const PART_BYTES = 14 * 1000 * 1000;

const require = createRequire(import.meta.url);
const pkgPath = require.resolve('stockfish/package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const bin = path.join(path.dirname(pkgPath), 'bin');
const v = pkg.buildVersion;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'engine'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'pieces'), { recursive: true });

fs.copyFileSync(path.join(ROOT, 'web', 'index.html'), path.join(OUT, 'index.html'));
for (const f of fs.readdirSync(path.join(ROOT, 'web', 'pieces'))) {
  fs.copyFileSync(path.join(ROOT, 'web', 'pieces', f), path.join(OUT, 'pieces', f));
}
fs.copyFileSync(path.join(ROOT, 'web', 'engine', 'sf-loader.js'), path.join(OUT, 'engine', 'sf-loader.js'));
fs.copyFileSync(path.join(path.dirname(pkgPath), 'Copying.txt'), path.join(OUT, 'engine', 'COPYING.txt'));

function addBuild(name, label) {
  const js = `stockfish-${v}-${name}.js`;
  const wasm = fs.readFileSync(path.join(bin, `stockfish-${v}-${name}.wasm`));
  fs.copyFileSync(path.join(bin, js), path.join(OUT, 'engine', js));
  const parts = [];
  for (let i = 0, offset = 0; offset < wasm.length; i++, offset += PART_BYTES) {
    const file = `sf${v}-${name}.part${i}.bin`;
    fs.writeFileSync(path.join(OUT, 'engine', file), wasm.subarray(offset, offset + PART_BYTES));
    parts.push(`engine/${file}`);
  }
  return { label, js, parts, bytes: wasm.length };
}

const manifest = {
  version: pkg.version,
  builds: {
    full: addBuild('single', `Stockfish ${v} · full NNUE`),
    lite: addBuild('lite-single', `Stockfish ${v} lite`),
  },
};
fs.writeFileSync(path.join(OUT, 'engine', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

let total = 0;
const files = [];
const walk = dir => {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else {
      const size = fs.statSync(p).size;
      total += size;
      files.push([path.relative(OUT, p), size]);
    }
  }
};
walk(OUT);
for (const [f, size] of files) console.log(`${(size / 1e6).toFixed(2).padStart(7)} MB  ${f}`);
console.log(`${files.length} files, ${(total / 1e6).toFixed(1)} MB in ${path.relative(process.cwd(), OUT) || OUT}`);
