# agent-mem

**Persistent memory for AI coding agents.**

Capture what the agent does, compress it into structured observations, and inject only the context that matters into future sessions — without dumping entire histories into the prompt.

Lightweight alternative to systems like [claude-mem](https://github.com/thedotmack/claude-mem): small enough to read, fork, and own end-to-end.

---

## Why

Coding agents forget everything between sessions. `agent-mem` gives them a durable project memory:

1. **Capture** tool uses as they happen  
2. **Compress** into short observations (heuristic or LLM)  
3. **Recall** via progressive disclosure — index first, full detail on demand  

Result: relevant past work comes back without burning tokens on noise.

---

## Features

| Area | What you get |
|------|----------------|
| **Storage** | SQLite + FTS5 full-text search |
| **Compression** | Offline heuristic, or Anthropic / OpenRouter / OpenAI |
| **Recall** | 3-layer progressive disclosure |
| **CLI** | `init`, session, capture, search, context, worker, mcp |
| **HTTP worker** | Local API for tools and MCP |
| **Claude Code** | SessionStart / PostToolUse / SessionEnd hooks |
| **MCP server** | `search_memory`, `get_observations`, `get_context`, `get_timeline` |

---

## Requirements

- Node.js **20+**

---

## Quick start

```bash
git clone https://github.com/Dikaaff/agent-mem.git
cd agent-mem
npm install

# Create local DB (~/.agent-mem/agent-mem.db)
npx tsx src/cli.ts init

# Start a session and capture work
SESSION=$(npx tsx src/cli.ts start-session -p my-project)

npx tsx src/cli.ts capture -s "$SESSION" -p my-project -t Edit \
  --input "src/auth.ts" \
  --output "Fixed JWT expiry check"

npx tsx src/cli.ts end-session -s "$SESSION" -p my-project \
  --request "Fix auth token expiry" \
  --completed "JWT check fixed" \
  --next "Deploy to staging"

# What the next session would see
npx tsx src/cli.ts context -p my-project

# Search, then fetch full detail
npx tsx src/cli.ts search "JWT" -p my-project
npx tsx src/cli.ts get 1
```

Optional build (TypeScript + Claude Code hooks):

```bash
npm run build
```

---

## Progressive disclosure

| Layer | Command / API | Cost | Role |
|-------|----------------|------|------|
| **1 – Priming** | `context` | Cheap | Titles + recent summaries at session start |
| **2 – Search** | `search` | Small | `{ id, title, type }` hits |
| **3 – Detail** | `get <ids>` | On demand | Full narrative only for chosen IDs |

Agents stay oriented without loading every past observation into context.

---

## LLM compressor

Default is **offline heuristic** (no API key).

Enable an LLM when you want richer titles and narratives:

```bash
# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# OpenRouter
export OPENROUTER_API_KEY=sk-or-...
export AGENT_MEM_LLM_PROVIDER=openrouter
export AGENT_MEM_LLM_MODEL=anthropic/claude-haiku-4.5

# OpenAI-compatible
export OPENAI_API_KEY=sk-...
export AGENT_MEM_LLM_PROVIDER=openai
export AGENT_MEM_LLM_MODEL=gpt-4o-mini
```

```bash
npx tsx src/cli.ts llm-status
```

`capture` and Claude Code hooks use `compressAuto()`: LLM when configured, heuristic on failure or if no key. Force heuristic with `--heuristic`.

---

## Claude Code hooks

| Event | Behavior |
|-------|----------|
| **SessionStart** | Open session, emit priming context |
| **UserPromptSubmit** | Ensure session exists |
| **PostToolUse** | Compress tool I/O → observation |
| **Stop** | Turn boundary (ready for summaries) |
| **SessionEnd** | Complete session |

```bash
npm run build:hooks   # → plugin/hooks/*.js
```

See [`plugin/README.md`](plugin/README.md) for wiring into Claude Code.

---

## HTTP worker

```bash
npx tsx src/cli.ts worker
# http://127.0.0.1:37800
```

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health + data dir |
| `GET` | `/api/context/:project` | Priming text |
| `POST` | `/api/sessions/start` | Start session |
| `POST` | `/api/sessions/end` | End + optional summary |
| `POST` | `/api/observations` | Capture tool use |
| `GET` | `/api/search?q=&project=` | Search |
| `POST` | `/api/observations/get` | Full observations by id |

Override port with `AGENT_MEM_PORT`.

---

## MCP server

Expose memory tools to any MCP-compatible agent (Claude Code, Cursor, etc.).

```bash
npx tsx src/cli.ts mcp
# or
npm run mcp
```

### Tools

| Tool | Layer | Purpose |
|------|-------|---------|
| `search_memory` | 2 | Search observations → `{ id, title, type }` |
| `get_observations` | 3 | Full narrative by id list |
| `get_context` | 1 | Priming text for a project |
| `get_timeline` | 1–2 | Recent summaries + observations (JSON) |

### Claude Code / MCP config example

```json
{
  "mcpServers": {
    "agent-mem": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/agent-mem/src/cli.ts", "mcp"]
    }
  }
}
```

Typical agent flow: `get_context` → `search_memory` → `get_observations` for only the ids that matter.

---

## Configuration

| Variable | Purpose |
|----------|---------|
| `AGENT_MEM_DATA_DIR` | Data directory (default `~/.agent-mem`) |
| `AGENT_MEM_PORT` | Worker port (default `37800`) |
| `AGENT_MEM_LLM_PROVIDER` | `anthropic` \| `openrouter` \| `openai` |
| `AGENT_MEM_LLM_API_KEY` | API key (or provider-specific env vars) |
| `AGENT_MEM_LLM_MODEL` | Model id |
| `AGENT_MEM_LLM_BASE_URL` | Custom OpenAI-compatible base URL |
| `AGENT_MEM_LLM_TIMEOUT_MS` | Request timeout (default `30000`) |

Also accepted: `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`.

---

## Project layout

```
src/
  types/           Shared types
  db/              SQLite schema, client, store
  services/        Compressor, LLM client, context, worker
  hooks/           Capture API + Claude Code entrypoints
  search/          Progressive disclosure API
  mcp/             MCP server (stdio)
  cli.ts           CLI
  index.ts         Library exports
plugin/
  hooks/           Built JS hooks + hooks.json
scripts/
  build-hooks.mjs
```

---

## Roadmap

- [x] SQLite + FTS5 + progressive disclosure  
- [x] CLI + HTTP worker  
- [x] Claude Code hooks (basic)  
- [x] LLM compressor (Anthropic / OpenRouter / OpenAI)  
- [x] MCP server (`search_memory` / `get_observations` / `get_context` / `get_timeline`)  
- [ ] Optional vector search  
- [ ] Simple web viewer  
- [ ] Cursor / OpenCode adapters  

---

## License

[Apache-2.0](LICENSE)
