/**
 * SessionEnd hook
 * Marks session completed. Optional short summary if payload carries one.
 */

import {
  readStdin,
  parsePayload,
  loadSessionState,
  clearSessionState,
} from "./shared.js";
import { onSessionEnd } from "../capture.js";

async function main() {
  const raw = await readStdin();
  const payload = parsePayload(raw);

  const sessionId = payload.session_id;
  if (!sessionId) {
    process.exit(0);
  }

  const state = loadSessionState(sessionId);
  const project = state?.project || payload.project || "default";

  onSessionEnd(sessionId, {
    project,
    request: typeof payload.prompt === "string" ? payload.prompt.slice(0, 200) : "",
    investigated: "",
    learned: "",
    completed: "",
    nextSteps: "",
  });

  clearSessionState(sessionId);
  process.exit(0);
}

main().catch(() => process.exit(0));
