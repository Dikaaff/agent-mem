/**
 * Observation compressor
 *
 * 1. compress()      — offline heuristic (always available)
 * 2. compressWithLLM() — uses Anthropic / OpenRouter / OpenAI when configured
 *
 * compressAuto() picks LLM when AGENT_MEM_LLM_API_KEY (or provider keys) is set,
 * otherwise falls back to heuristic.
 */

import type { ObservationType } from "../types/index.js";
import { chat, loadLlmConfig } from "./llm.js";

export interface CompressInput {
  toolName: string;
  toolInput?: string;
  toolOutput?: string;
  project: string;
}

export interface CompressResult {
  type: ObservationType;
  title: string;
  narrative: string;
  files: string[];
}

const TOOL_TYPE_MAP: Record<string, ObservationType> = {
  Read: "read",
  Write: "write",
  Edit: "edit",
  Bash: "bash",
  Grep: "search",
  Glob: "search",
  Task: "other",
};

const VALID_TYPES = new Set<ObservationType>([
  "read",
  "write",
  "edit",
  "bash",
  "search",
  "decision",
  "bugfix",
  "feature",
  "other",
]);

function extractFiles(text: string): string[] {
  const matches = text.match(
    /(?:[\w./-]+\.(?:ts|tsx|js|jsx|py|go|rs|md|json|yml|yaml|toml|css|html|sql))/g
  );
  return [...new Set(matches ?? [])].slice(0, 10);
}

function truncate(s: string, max = 400): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "\u2026" : clean;
}

/** Offline heuristic compressor */
export function compress(input: CompressInput): CompressResult {
  const { toolName, toolInput = "", toolOutput = "" } = input;
  const type = TOOL_TYPE_MAP[toolName] ?? "other";
  const combined = `${toolInput}\n${toolOutput}`;
  const files = extractFiles(combined);

  let title = `${toolName}`;
  let narrative = "";

  if (toolName === "Read") {
    const file = files[0] ?? "file";
    title = `Read ${file}`;
    narrative = `Opened and inspected ${file}.`;
  } else if (toolName === "Edit" || toolName === "Write") {
    const file = files[0] ?? "file";
    title = `${toolName === "Write" ? "Created" : "Edited"} ${file}`;
    narrative = truncate(toolOutput || toolInput || `Modified ${file}`);
  } else if (toolName === "Bash") {
    const cmd = toolInput.split("\n")[0]?.slice(0, 80) || "command";
    title = `Ran: ${cmd}`;
    narrative = truncate(toolOutput || `Executed: ${cmd}`);
  } else if (toolName === "Grep" || toolName === "Glob") {
    title = `Searched: ${truncate(toolInput, 60)}`;
    narrative = truncate(toolOutput || "Search completed");
  } else {
    title = `${toolName} action`;
    narrative = truncate(combined || "Tool executed");
  }

  const lower = combined.toLowerCase();
  if (
    /\b(fix|bug|error|crash|issue)\b/.test(lower) &&
    /fix|resolved|patched/.test(lower)
  ) {
    return { type: "bugfix", title: `Bugfix: ${title}`, narrative, files };
  }
  if (/\b(decided|decision|chose|will use)\b/.test(lower)) {
    return { type: "decision", title: `Decision: ${title}`, narrative, files };
  }

  return { type, title, narrative, files };
}

const SYSTEM_PROMPT = `You compress a single AI coding-agent tool call into a short memory observation.

Return ONLY valid JSON (no markdown fences) with this shape:
{
  "type": "read|write|edit|bash|search|decision|bugfix|feature|other",
  "title": "short title, max 80 chars",
  "narrative": "1-3 sentences of what mattered, max 400 chars",
  "files": ["optional", "file", "paths"]
}

Rules:
- Prefer type decision/bugfix/feature when the content clearly matches.
- Title should be useful in a list (what changed or was learned).
- Narrative: facts only, no filler.
- files: real paths mentioned, max 8.
- Ignore secrets, tokens, passwords — never copy them into title/narrative.`;

function buildUserPrompt(input: CompressInput): string {
  const inputStr = (input.toolInput || "").slice(0, 2500);
  const outputStr = (input.toolOutput || "").slice(0, 2500);
  return [
    `Project: ${input.project}`,
    `Tool: ${input.toolName}`,
    "",
    "Tool input:",
    inputStr || "(empty)",
    "",
    "Tool output:",
    outputStr || "(empty)",
  ].join("\n");
}

function parseLlmJson(text: string): CompressResult | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const obj = JSON.parse(cleaned) as Partial<CompressResult>;
    if (!obj.title || !obj.narrative) return null;
    const type = (
      VALID_TYPES.has(obj.type as ObservationType) ? obj.type : "other"
    ) as ObservationType;
    return {
      type,
      title: String(obj.title).slice(0, 120),
      narrative: String(obj.narrative).slice(0, 600),
      files: Array.isArray(obj.files)
        ? obj.files.map(String).slice(0, 8)
        : [],
    };
  } catch {
    return null;
  }
}

/** LLM compressor — throws if no config or API error */
export async function compressWithLLM(
  input: CompressInput
): Promise<CompressResult> {
  const config = loadLlmConfig();
  if (!config) {
    throw new Error(
      "No LLM config. Set AGENT_MEM_LLM_API_KEY (or ANTHROPIC_API_KEY / OPENROUTER_API_KEY)."
    );
  }

  const text = await chat(config, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(input) },
  ]);

  const parsed = parseLlmJson(text);
  if (parsed) {
    if (parsed.files.length === 0) {
      parsed.files = extractFiles(
        `${input.toolInput || ""}\n${input.toolOutput || ""}`
      );
    }
    return parsed;
  }

  const heuristic = compress(input);
  return {
    ...heuristic,
    narrative: truncate(text, 400) || heuristic.narrative,
  };
}

/**
 * Prefer LLM when configured; otherwise heuristic.
 * Never throws — always returns a usable observation.
 */
export async function compressAuto(
  input: CompressInput
): Promise<CompressResult> {
  const config = loadLlmConfig();
  if (!config) return compress(input);

  try {
    return await compressWithLLM(input);
  } catch (err) {
    console.error(
      "[agent-mem] LLM compress failed, using heuristic:",
      err instanceof Error ? err.message : err
    );
    return compress(input);
  }
}
