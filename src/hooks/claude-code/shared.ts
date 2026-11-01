/**
 * Shared helpers for Claude Code hook scripts
 *
 * Claude Code hooks receive JSON on stdin and must exit 0 quickly.
 * Heavy work (compress, DB write) is done here but kept fast;
 * for production you may push to a local worker queue instead.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface HookPayload {
  session_id?: string;
  cwd?: string;
  project?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_output?: unknown;
  transcript_path?: string;
  [key: string]: unknown;
}

export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

export function parsePayload(raw: string): HookPayload {
  try {
    return JSON.parse(raw || "{}") as HookPayload;
  } catch {
    return {};
  }
}

/** Infer project name from cwd (folder name) */
export function projectFromCwd(cwd?: string): string {
  if (!cwd) return "default";
  return path.basename(path.resolve(cwd)) || "default";
}

/** Persist active session id so later hooks can find it */
const STATE_DIR = path.join(os.homedir(), ".agent-mem", "state");

export function statePath(sessionId: string): string {
  return path.join(STATE_DIR, `${sessionId}.json`);
}

export function saveSessionState(
  sessionId: string,
  data: { project: string; startedAt: string }
): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(statePath(sessionId), JSON.stringify(data, null, 2));
}

export function loadSessionState(
  sessionId: string
): { project: string; startedAt: string } | null {
  try {
    const p = statePath(sessionId);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function clearSessionState(sessionId: string): void {
  try {
    fs.unlinkSync(statePath(sessionId));
  } catch {
    /* ignore */
  }
}

export function safeString(v: unknown, max = 4000): string {
  if (v == null) return "";
  if (typeof v === "string") return v.slice(0, max);
  try {
    return JSON.stringify(v).slice(0, max);
  } catch {
    return String(v).slice(0, max);
  }
}
