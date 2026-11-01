/**
 * PostToolUse hook — core capture path
 * Uses LLM compressor when API key is configured.
 */

import {
  readStdin,
  parsePayload,
  projectFromCwd,
  loadSessionState,
  saveSessionState,
  safeString,
} from "./shared.js";
import { onSessionStart, captureToolUseAsync } from "../capture.js";

async function main() {
  const raw = await readStdin();
  const payload = parsePayload(raw);

  const toolName = payload.tool_name || "Unknown";
  if (toolName === "AgentMemSearch" || toolName === "AgentMemGet") {
    process.exit(0);
  }

  const sessionId = payload.session_id || `cc-${Date.now().toString(36)}`;
  let state = loadSessionState(sessionId);
  let project = state?.project || payload.project || projectFromCwd(payload.cwd);

  if (!state) {
    onSessionStart(project, sessionId);
    saveSessionState(sessionId, {
      project,
      startedAt: new Date().toISOString(),
    });
  }

  await captureToolUseAsync({
    sessionId,
    project,
    toolName,
    toolInput: safeString(payload.tool_input),
    toolOutput: safeString(payload.tool_output),
  });

  process.exit(0);
}

main().catch(() => process.exit(0));
