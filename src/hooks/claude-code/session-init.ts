/**
 * UserPromptSubmit hook
 * Ensures session exists and records that a prompt was submitted.
 */

import {
  readStdin,
  parsePayload,
  projectFromCwd,
  loadSessionState,
  saveSessionState,
} from "./shared.js";
import { onSessionStart } from "../capture.js";

async function main() {
  const raw = await readStdin();
  const payload = parsePayload(raw);

  const sessionId = payload.session_id || `cc-${Date.now().toString(36)}`;
  let project = payload.project || projectFromCwd(payload.cwd);

  const existing = loadSessionState(sessionId);
  if (!existing) {
    onSessionStart(project, sessionId);
    saveSessionState(sessionId, {
      project,
      startedAt: new Date().toISOString(),
    });
  } else {
    project = existing.project;
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
