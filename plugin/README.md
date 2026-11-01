# agent-mem Claude Code plugin

This folder is the Claude Code plugin surface.

## Hooks

| Event | Script | Role |
|-------|--------|------|
| SessionStart | `session-start.js` | Create session + emit priming context |
| UserPromptSubmit | `session-init.js` | Ensure session exists |
| PostToolUse | `post-tool-use.js` | Capture & compress every tool call |
| Stop | `stop.js` | Turn boundary (placeholder) |
| SessionEnd | `session-end.js` | Mark session complete |

Build hooks from TypeScript:

```bash
npm run build:hooks
```

## Install into Claude Code (manual)

1. Build the project: `npm install && npm run build`
2. Point Claude Code at this plugin directory, **or** copy `plugin/` into your Claude plugins folder and register `hooks/hooks.json`.
3. Restart Claude Code.

Exact marketplace packaging can be added later (`/plugin marketplace add ...`). For local use, registering the hooks path is enough to start capturing.

## Environment

- Data: `~/.agent-mem/`
- Override: `AGENT_MEM_DATA_DIR`
