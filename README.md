# agent-mem

**Persistent memory for AI coding agents** — capture what the agent does, compress it, and inject relevant context into future sessions.

Inspired by systems like [claude-mem](https://github.com/thedotmack/claude-mem), but kept intentionally smaller so you can understand, extend, and own the whole pipeline.

## Features (v0.3)

| Layer | What it does |
|-------|----------------|
| **Capture** | Record tool uses (Read, Edit, Bash, …) as structured observations |
| **Compress** | Heuristic compressor (swap in an LLM later) |
| **Store** | SQLite + FTS5 full-text search |
| **Progressive disclosure** | Index → search → full detail only when needed |
| **CLI + HTTP worker** | Use from scripts or local tools |
| **Claude Code hooks** | SessionStart / PostToolUse / SessionEnd auto-capture |
| **LLM compressor** | Anthropic / OpenRouter / OpenAI — falls back to heuristic |

## Quick start

```bash
# Requirements: Node.js 20+
git clone https://github.com/Dikaaff/agent-mem.git
cd agent-mem
npm install
npm run build

# Initialize DB
npx tsx src/cli.ts init

# Start a session
SESSION=$(npx tsx src/cli.ts start-session -p my-project)
echo "Session: $SESSION"

# Capture some work
npx tsx src/cli.ts capture -s "$SESSION" -p my-project -t Edit \
  --input "src/auth.ts" \
  --output "Fixed JWT expiry check"

npx tsx src/cli.ts capture -s "$SESSION" -p my-project -t Bash \
  --input "npm test" \
  --output "All 12 tests passed"

# End session with a short summary
npx tsx src/cli.ts end-session -s "$SESSION" -p my-project \
  --request "Fix auth token expiry" \
  --completed "JWT check fixed, tests green" \
  --next "Deploy to staging"

# See priming context (what would be injected next session)
npx tsx src/cli.ts context -p my-project

# Search (Layer 2)
npx tsx src/cli.ts search "JWT" -p my-project

# Full detail (Layer 3)
npx tsx src/cli.ts get 1
```

## LLM compressor

By default the compressor is **offline heuristic** (no API key needed).

To enable LLM compression:

```bash
# Anthropic (default provider when ANTHROPIC_API_KEY is set)
export ANTHROPIC_API_KEY=sk-ant-...
# optional:
export AGENT_MEM_LLM_MODEL=claude-haiku-4-5-20251001

# Or OpenRouter
export OPENROUTER_API_KEY=sk-or-...
export AGENT_MEM_LLM_PROVIDER=openrouter
export AGENT_MEM_LLM_MODEL=anthropic/claude-haiku-4.5

# Or any OpenAI-compatible endpoint
export OPENAI_API_KEY=sk-...
export AGENT_MEM_LLM_PROVIDER=openai
export AGENT_MEM_LLM_BASE_URL=https://api.openai.com/v1
export AGENT_MEM_LLM_MODEL=gpt-4o-mini
```

Check status:

```bash
npx tsx src/cli.ts llm-status
```

Hooks and `capture` (without `--heuristic`) use `compressAuto()`:
LLM when configured, heuristic on failure or if no key.

## Progressive disclosure

1. **Layer 1 – Priming** (`context`)  
   Compact index of recent summaries + observation titles. Cheap to inject every session.

2. **Layer 2 – Search** (`search`)  
   Returns `{ id, title, type }` only (~small token cost).

3. **Layer 3 – Detail** (`get`)  
   Fetch full narrative only for the IDs you care about.

## HTTP worker

```bash
npx tsx src/cli.ts worker
# → http://127.0.0.1:37800
```

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/api/context/:project` | Priming text |
| POST | `/api/sessions/start` | Start session |
| POST | `/api/sessions/end` | End + optional summary |
| POST | `/api/observations` | Capture tool use |
| GET | `/api/search?q=&project=` | Search |
| POST | `/api/observations/get` | `{ ids: number[] }` |

## Claude Code hooks

Hooks live under `src/hooks/claude-code/` and are bundled to `plugin/hooks/*.js`.

```bash
npm run build          # tsc + bundle hooks
# or only hooks:
npm run build:hooks
```

| Event | What happens |
|-------|----------------|
| **SessionStart** | Open session, print priming context (Layer 1) |
| **UserPromptSubmit** | Ensure session row exists |
| **PostToolUse** | Compress tool I/O → save observation |
| **Stop** | Turn boundary (ready for summary later) |
| **SessionEnd** | Complete session + optional summary |

See `plugin/README.md` for local install notes.

## Project layout

```
src/
  types/                # Shared types
  db/                   # SQLite schema, client, store
  services/             # Compressor, context builder, HTTP worker
  hooks/                # Session + capture API
    claude-code/        # Hook entrypoints for Claude Code
  search/               # Progressive disclosure API
  cli.ts
  index.ts
plugin/
  hooks/                # Built JS hooks + hooks.json
scripts/
  build-hooks.mjs
```

Data is stored in `~/.agent-mem/agent-mem.db` (override with `AGENT_MEM_DATA_DIR`).

## Roadmap (ideas)

- [x] Claude Code hooks (basic)
- [x] Real LLM compressor (Claude Haiku / OpenRouter / OpenAI)
- [ ] MCP server for `search` / `get_observations`
- [ ] Optional Chroma / vector search
- [ ] Simple web viewer
- [ ] Cursor / OpenCode adapters

## License

Apache-2.0
