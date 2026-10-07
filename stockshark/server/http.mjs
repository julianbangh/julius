// One local port serves everything: the board page, its WebSocket, and the MCP endpoint.
// Only loopback names are accepted in the Host header and only this page's origin may
// connect from a browser, so other websites cannot drive the board or the engine.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { ROOT, VERSION } from './config.mjs';
import { createMcpServer } from './mcp.mjs';

const WEB = path.join(ROOT, 'web');
// The page is written the way claude.ai artifacts are (content only); the artifact host
// wraps it in a document skeleton, and so does this server.
// The stockshark-bridge meta tag tells the page to use this server's engine and MCP link.
const PAGE_HEAD = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="stockshark-bridge" content="1"></head><body>';
const PAGE_TAIL = '</body></html>';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon',
};

function reply(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' });
  res.end(body);
}

const json = (res, value, status = 200) => reply(res, status, JSON.stringify(value), 'application/json');

function rpcError(res, status, code, message) {
  json(res, { jsonrpc: '2.0', error: { code, message }, id: null }, status);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Body too large'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function createHttpServer(bridge, config, log) {
  let port = config.port;
  const loopback = ['127.0.0.1', 'localhost', '[::1]'];
  if (!loopback.includes(config.host) && config.host !== '0.0.0.0') loopback.push(config.host);
  const hostOk = host => loopback.some(h => host === `${h}:${port}`);
  const originOk = origin => !origin || loopback.some(h => origin === `http://${h}:${port}`);
  const sessions = new Map();

  async function handleMcp(req, res) {
    const sid = req.headers['mcp-session-id'];
    let transport = sid ? sessions.get(sid) : undefined;
    if (req.method === 'POST') {
      let body;
      try {
        body = await readBody(req, 4 * 1024 * 1024);
      } catch {
        return rpcError(res, 400, -32700, 'Parse error');
      }
      if (!transport) {
        if (sid) return rpcError(res, 404, -32001, 'Session not found');
        if (!isInitializeRequest(body)) return rpcError(res, 400, -32000, 'No session: send initialize first');
        const t = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: id => {
            sessions.set(id, t);
            bridge.sessionOpened();
          },
        });
        t.onclose = () => {
          if (t.sessionId && sessions.delete(t.sessionId)) bridge.sessionClosed();
        };
        await createMcpServer(bridge, { transport: 'http' }).connect(t);
        transport = t;
      }
      return transport.handleRequest(req, res, body);
    }
    if (req.method === 'GET' || req.method === 'DELETE') {
      if (!transport) return rpcError(res, sid ? 404 : 400, -32001, 'Session not found');
      return transport.handleRequest(req, res);
    }
    return reply(res, 405, 'Method not allowed');
  }

  function serveStatic(pathname, res) {
    let rel;
    try {
      rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    } catch {
      return reply(res, 400, 'Bad path');
    }
    const file = path.normalize(path.join(WEB, rel));
    if (!file.startsWith(WEB + path.sep) || rel.split('/').some(part => part.startsWith('.'))) return reply(res, 404, 'Not found');
    fs.readFile(file, (err, data) => {
      if (err) return reply(res, 404, 'Not found');
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-cache',
      });
      res.end(file === path.join(WEB, 'index.html') ? PAGE_HEAD + data.toString('utf8') + PAGE_TAIL : data);
    });
  }

  const server = http.createServer((req, res) => {
    if (!hostOk(req.headers.host)) return reply(res, 403, 'Forbidden host');
    if (!originOk(req.headers.origin)) return reply(res, 403, 'Forbidden origin');
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/mcp') {
      handleMcp(req, res).catch(err => {
        log(`mcp: ${err.message}`);
        if (!res.headersSent) rpcError(res, 500, -32603, 'Internal error');
      });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, 'Method not allowed');
    if (url.pathname === '/api/health') {
      return json(res, { app: 'stockshark', version: VERSION, url: bridge.url, board: !!bridge.page, engine: bridge.engine.status() });
    }
    if (url.pathname === '/favicon.ico') return reply(res, 204, '');
    return serveStatic(url.pathname, res);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 512 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ws' || !hostOk(req.headers.host) || !originOk(req.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', ws => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('message', data => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      bridge.onPageMessage(ws, msg);
    });
    ws.on('close', () => bridge.detachPage(ws));
    ws.on('error', () => {});
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  heartbeat.unref();

  return {
    server,
    listen(p) {
      port = p;
      return new Promise((resolve, reject) => {
        const onError = err => {
          server.off('listening', onListening);
          reject(err);
        };
        const onListening = () => {
          server.off('error', onError);
          port = server.address().port;
          resolve(port);
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(p, config.host === '0.0.0.0' ? '0.0.0.0' : config.host);
      });
    },
    close() {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      for (const t of sessions.values()) t.close().catch(() => {});
      server.close();
    },
  };
}
