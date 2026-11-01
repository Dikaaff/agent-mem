/**
 * Capture helpers — call these from agent hooks / wrappers
 */

import { randomUUID } from "node:crypto";
import {
  createSession,
  completeSession,
  addObservation,
  saveSummary,
} from "../db/store.js";
import { compress, compressAuto } from "../services/compressor.js";
import { buildPrimingContext } from "../services/context.js";

export function onSessionStart(project: string, sessionId?: string): string {
  const id = sessionId ?? randomUUID();
  createSession(id, project);
  return id;
}

export function onSessionEnd(
  sessionId: string,
  summary?: {
    project: string;
    request: string;
    investigated: string;
    learned: string;
    completed: string;
    nextSteps: string;
    notes?: string;
  }
): void {
  if (summary) {
    saveSummary({
      sessionId,
      ...summary,
    });
  }
  completeSession(sessionId);
}

/** Sync capture — heuristic only (fast) */
export function captureToolUse(opts: {
  sessionId: string;
  project: string;
  toolName: string;
  toolInput?: string;
  toolOutput?: string;
}): number {
  const compressed = compress({
    toolName: opts.toolName,
    toolInput: opts.toolInput,
    toolOutput: opts.toolOutput,
    project: opts.project,
  });

  return addObservation({
    sessionId: opts.sessionId,
    project: opts.project,
    type: compressed.type,
    title: compressed.title,
    narrative: compressed.narrative,
    files: compressed.files,
    raw: opts.toolOutput?.slice(0, 2000),
  });
}

/** Async capture — uses LLM when configured, else heuristic */
export async function captureToolUseAsync(opts: {
  sessionId: string;
  project: string;
  toolName: string;
  toolInput?: string;
  toolOutput?: string;
}): Promise<number> {
  const compressed = await compressAuto({
    toolName: opts.toolName,
    toolInput: opts.toolInput,
    toolOutput: opts.toolOutput,
    project: opts.project,
  });

  return addObservation({
    sessionId: opts.sessionId,
    project: opts.project,
    type: compressed.type,
    title: compressed.title,
    narrative: compressed.narrative,
    files: compressed.files,
    raw: opts.toolOutput?.slice(0, 2000),
  });
}

export function getSessionPriming(project: string): string {
  return buildPrimingContext(project);
}
