#!/usr/bin/env node
// Stockshark bridge.
//   npm start          serve the board on http://127.0.0.1:8787 with MCP at /mcp
//   node server/index.mjs --stdio
//                      the same, plus MCP over stdio for clients that launch servers
//                      themselves (Claude Code's .mcp.json, Claude Desktop). If a bridge is
//                      already running, this process forwards MCP to it so there is only
//                      ever one board and one engine.
import { spawn } from 'node:child_process';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadConfig } from './config.mjs';
import { Bridge } from './bridge.mjs';
import { createHttpServer } from './http.mjs';
import { createMcpServer } from './mcp.mjs';

const config = loadConfig();
// In stdio mode stdout carries MCP messages, so every log line goes to stderr.
const log = msg => process.stderr.write(`[stockshark] ${msg}\n`);

async function isStockshark(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    const body = await res.json();
    return body && body.app === 'stockshark';
  } catch {
    return false;
  }
}

// Forward MCP between this process's stdio and a bridge that is already running.
async function proxy(port) {
  log(`sharing the board that is already running at http://127.0.0.1:${port}/`);
  const local = new StdioServerTransport();
  const remote = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  local.onmessage = msg => {
    remote.send(msg).catch(err => {
      log(`proxy: ${err.message}`);
      if (msg.id !== undefined && msg.method) {
        local.send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: `Stockshark bridge unreachable: ${err.message}` } }).catch(() => {});
      }
    });
  };
  remote.onmessage = msg => {
    if (msg.result && typeof msg.result.protocolVersion === 'string') remote.setProtocolVersion(msg.result.protocolVersion);
    local.send(msg).catch(() => {});
  };
  remote.onerror = err => log(`proxy: ${err.message}`);
  local.onclose = () => {
    remote.close().finally(() => process.exit(0));
  };
  await remote.start();
  await local.start();
}

function openBrowser(url) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch {
    /* no browser to open */
  }
}

async function main() {
  const bridge = new Bridge(config, log);
  const web = createHttpServer(bridge, config, log);
  let port = config.port;
  for (let attempt = 0; ; attempt++) {
    try {
      port = await web.listen(port);
      break;
    } catch (err) {
      if (err.code !== 'EADDRINUSE' || attempt >= 10) throw err;
      if (await isStockshark(port)) {
        if (config.stdio) return proxy(port);
        log(`Stockshark is already running at http://127.0.0.1:${port}/`);
        if (config.open) openBrowser(`http://127.0.0.1:${port}/`);
        process.exit(0);
      }
      port++;
    }
  }
  bridge.url = `http://127.0.0.1:${port}/`;
  log(`board: ${bridge.url}  ·  MCP over HTTP: ${bridge.url}mcp${config.stdio ? '  ·  MCP over stdio' : ''}`);

  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    bridge.shutdown();
    web.close();
    setTimeout(() => process.exit(0), 300).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // With `npm start`, start Stockfish now so the first move doesn't wait for the hash table
  // to be allocated. Launched by an MCP client, wait until a board opens: Claude Code may
  // start this server in a session that never plays.
  if (!config.stdio) bridge.engine.get().catch(err => log(`engine: ${err.message}`));

  if (config.stdio) {
    const server = createMcpServer(bridge, { transport: 'stdio' });
    server.server.onclose = shutdown;
    await server.connect(new StdioServerTransport());
    process.stdin.on('end', shutdown);
    bridge.sessionOpened();
  }
  if (config.open) openBrowser(bridge.url);
}

main().catch(err => {
  log(`fatal: ${err.stack || err.message}`);
  process.exit(1);
});
