/**
 * LLM client abstraction for observation compression.
 *
 * Providers:
 * - anthropic  → Anthropic Messages API (Claude)
 * - openrouter → OpenRouter (OpenAI-compatible)
 * - openai     → OpenAI or any compatible base URL
 *
 * Config via env (no secrets in code):
 *   AGENT_MEM_LLM_PROVIDER=anthropic|openrouter|openai
 *   AGENT_MEM_LLM_API_KEY=...
 *   AGENT_MEM_LLM_MODEL=claude-haiku-4-5-20251001
 *   AGENT_MEM_LLM_BASE_URL=https://openrouter.ai/api/v1   (optional)
 */

export type LlmProvider = "anthropic" | "openrouter" | "openai";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function loadLlmConfig(): LlmConfig | null {
  const apiKey =
    process.env.AGENT_MEM_LLM_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";

  if (!apiKey) return null;

  const provider = (process.env.AGENT_MEM_LLM_PROVIDER ||
    (process.env.OPENROUTER_API_KEY
      ? "openrouter"
      : process.env.OPENAI_API_KEY
        ? "openai"
        : "anthropic")) as LlmProvider;

  const defaults: Record<LlmProvider, string> = {
    anthropic: "claude-haiku-4-5-20251001",
    openrouter: "anthropic/claude-haiku-4.5",
    openai: "gpt-4o-mini",
  };

  return {
    provider,
    apiKey,
    model: process.env.AGENT_MEM_LLM_MODEL || defaults[provider],
    baseUrl: process.env.AGENT_MEM_LLM_BASE_URL,
    timeoutMs: Number(process.env.AGENT_MEM_LLM_TIMEOUT_MS || 30_000),
  };
}

export async function chat(
  config: LlmConfig,
  messages: LlmMessage[]
): Promise<string> {
  if (config.provider === "anthropic") {
    return chatAnthropic(config, messages);
  }
  return chatOpenAICompatible(config, messages);
}

async function chatAnthropic(
  config: LlmConfig,
  messages: LlmMessage[]
): Promise<string> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");

  const base = config.baseUrl || "https://api.anthropic.com";
  const res = await fetchWithTimeout(
    `${base}/v1/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 400,
        system: system || undefined,
        messages: rest.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      }),
    },
    config.timeoutMs ?? 30_000
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Anthropic: empty response");
  return text;
}

async function chatOpenAICompatible(
  config: LlmConfig,
  messages: LlmMessage[]
): Promise<string> {
  const base =
    config.baseUrl ||
    (config.provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : "https://api.openai.com/v1");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/agent-mem/agent-mem";
    headers["X-Title"] = "agent-mem";
  }

  const res = await fetchWithTimeout(
    `${base}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        max_tokens: 400,
        temperature: 0.2,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    },
    config.timeoutMs ?? 30_000
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("LLM: empty response");
  return text;
}

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}
