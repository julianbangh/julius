# julius

## Stockshark Bot

[`stockshark/`](stockshark/) is a chess board where Stockfish 19 at full strength calculates and Claude plans, connected over MCP. Start with [`stockshark/README.md`](stockshark/README.md); the design is in [`stockshark/PLAN.md`](stockshark/PLAN.md).

```sh
cd stockshark && npm install && npm run get-stockfish && claude
```

Then run `/mcp__stockshark__play` in Claude Code and open <http://127.0.0.1:8787>.

## Bullion Lab

[`gold/`](gold/) charts the price of gold since 1791 and lets you backtest Python trading scripts against it with a pretend balance, all in the browser. See [`gold/README.md`](gold/README.md).

```sh
python3 -m http.server 8000 --directory gold
```

Then open <http://localhost:8000>.
