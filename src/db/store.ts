import { getDb } from "./client.js";
import type {
  Observation,
  Session,
  SessionSummary,
  SearchResult,
  FullObservation,
  ObservationType,
} from "../types/index.js";

function now() {
  const d = new Date();
  return {
    iso: d.toISOString(),
    epoch: Math.floor(d.getTime() / 1000),
  };
}

// ─── Sessions ───────────────────────────────────────────────

export function createSession(sessionId: string, project: string): Session {
  const db = getDb();
  const t = now();
  db.prepare(
    `INSERT OR IGNORE INTO sessions (session_id, project, status, created_at, created_at_epoch)
     VALUES (?, ?, 'active', ?, ?)`
  ).run(sessionId, project, t.iso, t.epoch);

  return {
    sessionId,
    project,
    status: "active",
    createdAt: t.iso,
    createdAtEpoch: t.epoch,
  };
}

export function completeSession(sessionId: string): void {
  const db = getDb();
  const t = now();
  db.prepare(
    `UPDATE sessions SET status = 'completed', completed_at = ?, completed_at_epoch = ?
     WHERE session_id = ?`
  ).run(t.iso, t.epoch, sessionId);
}

// ─── Observations ──────────────────────────────────────────

export function addObservation(
  obs: Omit<Observation, "id" | "createdAt" | "createdAtEpoch">
): number {
  const db = getDb();
  const t = now();
  const result = db
    .prepare(
      `INSERT INTO observations
       (session_id, project, type, title, narrative, files, raw, created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      obs.sessionId,
      obs.project,
      obs.type,
      obs.title,
      obs.narrative,
      obs.files ? JSON.stringify(obs.files) : null,
      obs.raw ?? null,
      t.iso,
      t.epoch
    );
  return Number(result.lastInsertRowid);
}

export function getObservation(id: number): FullObservation | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM observations WHERE id = ?`)
    .get(id) as any;
  if (!row) return null;
  return mapObservation(row);
}

export function getObservationsByIds(ids: number[]): FullObservation[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM observations WHERE id IN (${placeholders})`)
    .all(...ids) as any[];
  return rows.map(mapObservation);
}

function mapObservation(row: any): FullObservation {
  return {
    id: row.id,
    sessionId: row.session_id,
    project: row.project,
    type: row.type as ObservationType,
    title: row.title,
    narrative: row.narrative,
    files: row.files ? JSON.parse(row.files) : undefined,
    raw: row.raw ?? undefined,
    createdAt: row.created_at,
    createdAtEpoch: row.created_at_epoch,
  };
}

// ─── Summaries ────────────────────────────────────────────

export function saveSummary(
  summary: Omit<SessionSummary, "id" | "createdAt" | "createdAtEpoch">
): void {
  const db = getDb();
  const t = now();
  db.prepare(
    `INSERT OR REPLACE INTO session_summaries
     (session_id, project, request, investigated, learned, completed, next_steps, notes, created_at, created_at_epoch)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    summary.sessionId,
    summary.project,
    summary.request,
    summary.investigated,
    summary.learned,
    summary.completed,
    summary.nextSteps,
    summary.notes ?? null,
    t.iso,
    t.epoch
  );
}

export function getRecentSummaries(
  project: string,
  limit = 5
): SessionSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM session_summaries
       WHERE project = ?
       ORDER BY created_at_epoch DESC
       LIMIT ?`
    )
    .all(project, limit) as any[];

  return rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    project: r.project,
    request: r.request,
    investigated: r.investigated,
    learned: r.learned,
    completed: r.completed,
    nextSteps: r.next_steps,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    createdAtEpoch: r.created_at_epoch,
  }));
}

// ─── Search (Progressive Disclosure Layer 2) ────────────────

export function searchObservations(
  query: string,
  opts: { project?: string; type?: string; limit?: number } = {}
): SearchResult[] {
  const db = getDb();
  const limit = opts.limit ?? 20;

  if (query.trim()) {
    let sql = `
      SELECT o.id, o.title, o.type, o.project, o.created_at,
             bm25(observations_fts) AS score
      FROM observations_fts
      JOIN observations o ON o.id = observations_fts.rowid
      WHERE observations_fts MATCH ?
    `;
    const params: any[] = [query];

    if (opts.project) {
      sql += ` AND o.project = ?`;
      params.push(opts.project);
    }
    if (opts.type) {
      sql += ` AND o.type = ?`;
      params.push(opts.type);
    }

    sql += ` ORDER BY score LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      project: r.project,
      createdAt: r.created_at,
      score: r.score,
    }));
  }

  let sql = `SELECT id, title, type, project, created_at FROM observations WHERE 1=1`;
  const params: any[] = [];
  if (opts.project) {
    sql += ` AND project = ?`;
    params.push(opts.project);
  }
  if (opts.type) {
    sql += ` AND type = ?`;
    params.push(opts.type);
  }
  sql += ` ORDER BY created_at_epoch DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    project: r.project,
    createdAt: r.created_at,
  }));
}

/** Layer 1: compact index for session priming */
export function getContextIndex(
  project: string,
  limit = 30
): { summaries: SessionSummary[]; observations: SearchResult[] } {
  const summaries = getRecentSummaries(project, 5);
  const observations = searchObservations("", { project, limit });
  return { summaries, observations };
}
