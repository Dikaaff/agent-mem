/**
 * SessionStart hook
 * - Ensures DB is ready
 * - Injects priming context (Layer 1) into stdout for Claude Code to consume
 */

import {
  readStdin,
  parsePayload,
  projectFromCwd,
  saveSessionState,
} from "./shared.js";
import { onSessionStart, getSessionPriming } from "../capture.js";

async function main() {
  const raw = await readStdin();
  const payload = parsePayload(raw);

  const sessionId =
    payload.session_id || `cc-${Date.now().toString(36)}`;
  const project = payload.project || projectFromCwd(payload.cwd);

  onSessionStart(project, sessionId);
  saveSessionState(sessionId, {
    project,
    startedAt: new Date().toISOString(),
  });

  const priming = getSessionPriming(project);

  if (priming.trim()) {
    process.stdout.write(
      JSON.stringify({
        sessionId,
        project,
        context: priming,
      })
    );
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
