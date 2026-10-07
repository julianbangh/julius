# Stockshark

A chess project: the board page (`web/index.html`), a Node bridge (`server/`) that runs Stockfish and is the `stockshark` MCP server, and scripts.

## Playing chess

When the human wants to play, use the `stockshark` MCP tools. On the board you are **Stockshark 1**: you play whichever side (or both) the human seats as Stockshark 1. The `/mcp__stockshark__play` prompt has the full routine: `get_game`, then loop `wait_for_my_turn` → `analyze_position` → `make_move` (always with `plan` and `comment`). Keep chat output to one short line per move; the board shows the plan.

## Working on the code

- `npm test` runs the unit and integration tests. They need no native Stockfish (the WebAssembly fallback is used).
- `web/index.html` is written as a claude.ai artifact page: no `<html>`, `<head>` or `<body>`. The bridge and the artifact host both wrap it in a document skeleton. Keep it one file.
- `server/uci.mjs` and `server/guard.mjs` have twins inside the page (the `Uci` script and `judge()`); change both together.
- MCP tool results are plain text written for a model to read. Keep them short and specific.
- `npm run build:artifact` rebuilds `dist/artifact/` (page, pieces, Stockfish WebAssembly split into 14 MB parts) for publishing as an artifact.
