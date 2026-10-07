# Stockshark Bot

A chess board where Stockfish 19 at full strength does the calculating and Claude does the planning. Claude picks each move from Stockfish's best candidates, writes a plan you can read on the board, and Stockfish vetoes anything that would throw the game away.

You can play it two ways:

- **Locally, at full strength.** A small Node server (the *bridge*) runs native Stockfish on every core, serves the board at `http://127.0.0.1:8787`, and is an MCP server that Claude Code connects to. Claude (Opus 5.5 if you pick it) plays through MCP tools.
- **As a claude.ai artifact.** The same page runs Stockfish 19 as WebAssembly inside the page and asks Claude through claude.ai's built-in Claude access. No install, slower engine.

See [PLAN.md](PLAN.md) for the full design.

## Quick start: Claude Code + full-strength Stockfish

Needs Node 20 or newer and [Claude Code](https://code.claude.com).

```sh
cd stockshark
npm install
npm run get-stockfish   # recommended: the official native build, several times faster than WebAssembly
claude                  # approve the "stockshark" MCP server when Claude Code asks
```

In Claude Code:

1. Pick the model with `/model` (Opus 5.5 is the strongest planner).
2. Run `/mcp__stockshark__play`. You can add a one-word playing style, for example `/mcp__stockshark__play aggressive`.
3. Open <http://127.0.0.1:8787>, choose **Claude + Stockfish (MCP)** as the opponent and your colour, and move.

Claude waits for your moves, analyses each position with Stockfish, and plays. Its plan and a comment on each move appear in the "Claude's plan" panel; the engine readout shows what Stockfish is looking at while Claude thinks. The project's `.claude/settings.json` pre-approves the `stockshark` tools so a game doesn't stop for a permission prompt on every move.

If Claude Code isn't connected yet, the panel says so, and **Let Stockfish move** plays the engine's move for that turn.

## Without Claude: Stockfish alone

```sh
npm start        # or: npm start -- --open
```

Open <http://127.0.0.1:8787> and pick **Stockfish 19 (max strength)**. Think time goes up to 10 minutes a move, and with **Stockfish thinks on your time too** it keeps searching while you think, so its hash table is warm when your move comes in.

## Other ways to connect Claude

The bridge speaks MCP over stdio and over HTTP. Only one bridge runs at a time: a second stdio launch forwards to the running one, so the board, the engine and the game are always shared.

| Client | Setup |
| --- | --- |
| Claude Code in this folder or the repo root | Nothing: `.mcp.json` registers `stockshark`. |
| Claude Code anywhere | `claude mcp add stockshark -- node /absolute/path/to/stockshark/server/index.mjs --stdio` |
| Claude Code over HTTP | Keep `npm start` running, then `claude mcp add --transport http stockshark http://127.0.0.1:8787/mcp` |
| Claude Desktop | Add to `claude_desktop_config.json`: `{"mcpServers": {"stockshark": {"command": "node", "args": ["/absolute/path/to/stockshark/server/index.mjs", "--stdio"]}}}` |

The MCP tools are `get_game`, `wait_for_my_turn`, `analyze_position`, `make_move`, `set_plan` and `respond_to_draw_offer`, plus the `play` prompt.

## The claude.ai artifact version

```sh
npm run build:artifact
```

This writes `dist/artifact/`: the page, the pieces, and Stockfish 19's 99 MB full-network WebAssembly build split into 14 MB parts (artifact hosting takes files up to 15 MB). The page downloads the parts once, keeps the engine in IndexedDB, and runs it in a worker. Choosing **Claude + Stockfish** there asks claude.ai for permission to use your Claude account on Claude's first move.

## How the team plays

1. Stockfish searches the position for the board's think time and returns its five best moves with scores, win/draw/loss odds and main lines.
2. Claude reads them against its plan from the previous move, can test a line or two with Stockfish, then picks a move and writes an updated plan and a comment for you.
3. Stockfish checks the pick against its best move. The **Stockfish veto** setting decides how close it must be:

| Veto | Claude's move must score | Strength |
| --- | --- | --- |
| Best move only | the same as Stockfish's best | Stockfish's own play; Claude plans and explains |
| Within 0.20 (default) | no more than 0.20 pawns below the best | effectively full strength |
| Within 0.50 | no more than 0.50 pawns below the best | still far beyond human strength |
| Off: Claude decides | anything legal | Claude's judgement, with Stockfish as advisor |

In a forced mate only an equally fast mate passes, and in endings with seven pieces or fewer the Lichess tablebase decides: the move must keep the exact result (and, in a won ending, be the quickest win).

## Settings

Environment variables for the bridge:

| Variable | Default | What it does |
| --- | --- | --- |
| `STOCKSHARK_PORT` | `8787` | Port for the board, the WebSocket and `/mcp`. |
| `STOCKSHARK_THREADS` | all logical cores | Stockfish `Threads`. |
| `STOCKSHARK_HASH_MB` | a quarter of RAM (power of two, 256 MB to 32 GB) | Stockfish `Hash`. |
| `STOCKFISH_PATH` | found automatically | A specific Stockfish binary. |
| `SYZYGY_PATH` | none | Local Syzygy tablebases for Stockfish. |
| `STOCKSHARK_TABLEBASE` | `1` | Set to `0` to stop sending 7-piece-or-fewer positions to `tablebase.lichess.ovh`. |

The engine is found in this order: `STOCKFISH_PATH`, the build from `npm run get-stockfish`, `stockfish` on your `PATH` (Homebrew, apt), then the WebAssembly build from the `stockfish` npm package running inside Node.

## Tests

```sh
npm test
```

Unit tests cover UCI parsing, the veto and move reading; the integration test starts a bridge, plays Claude's side through a real MCP client against a simulated board, and checks the stdio forwarding. It uses whatever Stockfish the bridge finds, so it runs without a native install.

## Licenses

Stockfish is GPLv3 ([source](https://github.com/official-stockfish/Stockfish)); the WebAssembly build is [stockfish.js](https://github.com/nmrugg/stockfish.js), GPLv3. The Cburnett pieces are by Colin M.L. Burnett, GPLv2+. This project is GPL-3.0-or-later.
