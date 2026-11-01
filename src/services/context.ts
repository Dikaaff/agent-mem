/**
 * Context injection helpers (Progressive Disclosure Layer 1)
 */

import { getContextIndex } from "../db/store.js";
import type { SessionSummary, SearchResult } from "../types/index.js";

export function buildPrimingContext(project: string, limit = 25): string {
  const { summaries, observations } = getContextIndex(project, limit);

  const parts: string[] = [];

  parts.push("## Agent Memory (previous context)\n");
  parts.push(
    "This is a compact index of past work. Use search tools to fetch full details when needed.\n"
  );

  if (summaries.length > 0) {
    parts.push("### Recent Session Summaries\n");
    for (const s of summaries) {
      parts.push(`- **${s.createdAt.slice(0, 10)}** — ${s.request}`);
      if (s.completed) parts.push(`  - Done: ${s.completed}`);
      if (s.nextSteps) parts.push(`  - Next: ${s.nextSteps}`);
    }
    parts.push("");
  }

  if (observations.length > 0) {
    parts.push("### Recent Observations (id → title)\n");
    const byType = new Map<string, SearchResult[]>();
    for (const o of observations) {
      const list = byType.get(o.type) ?? [];
      list.push(o);
      byType.set(o.type, list);
    }
    for (const [type, items] of byType) {
      parts.push(`**${type}**`);
      for (const item of items.slice(0, 8)) {
        parts.push(`  - [#${item.id}] ${item.title}`);
      }
    }
    parts.push("");
  }

  if (summaries.length === 0 && observations.length === 0) {
    parts.push("_No previous memory for this project yet._\n");
  }

  return parts.join("\n");
}

export function formatObservationDetail(obs: {
  id: number;
  type: string;
  title: string;
  narrative: string;
  files?: string[];
  createdAt: string;
}): string {
  const lines = [
    `### Observation #${obs.id}`,
    `- **Type**: ${obs.type}`,
    `- **Title**: ${obs.title}`,
    `- **When**: ${obs.createdAt}`,
  ];
  if (obs.files?.length) {
    lines.push(`- **Files**: ${obs.files.join(", ")}`);
  }
  lines.push("", obs.narrative);
  return lines.join("\n");
}
