/**
 * Search API — Progressive Disclosure
 *
 * Layer 1: getContextIndex / buildPrimingContext  (compact, auto-injected)
 * Layer 2: search()                              (~50-100 tokens / result)
 * Layer 3: getByIds()                            (full detail on demand)
 */

import {
  searchObservations,
  getObservationsByIds,
  getContextIndex,
} from "../db/store.js";
import { formatObservationDetail } from "../services/context.js";

export function search(
  query: string,
  opts: { project?: string; type?: string; limit?: number } = {}
) {
  const results = searchObservations(query, opts);
  return {
    count: results.length,
    results: results.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      project: r.project,
      createdAt: r.createdAt,
    })),
    hint: "Use getByIds([id, ...]) to fetch full narrative for relevant items.",
  };
}

export function getByIds(ids: number[]) {
  const obs = getObservationsByIds(ids);
  return {
    count: obs.length,
    observations: obs.map((o) => ({
      id: o.id,
      type: o.type,
      title: o.title,
      narrative: o.narrative,
      files: o.files,
      createdAt: o.createdAt,
      formatted: formatObservationDetail(o),
    })),
  };
}

export function timeline(project: string, limit = 40) {
  const { summaries, observations } = getContextIndex(project, limit);
  return { summaries, observations };
}
