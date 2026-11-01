/** Core types for agent-mem */

export type ObservationType =
  | "read"
  | "write"
  | "edit"
  | "bash"
  | "search"
  | "decision"
  | "bugfix"
  | "feature"
  | "other";

export interface Observation {
  id?: number;
  sessionId: string;
  project: string;
  type: ObservationType;
  title: string;
  narrative: string;
  files?: string[];
  raw?: string;
  createdAt: string;
  createdAtEpoch: number;
}

export interface SessionSummary {
  id?: number;
  sessionId: string;
  project: string;
  request: string;
  investigated: string;
  learned: string;
  completed: string;
  nextSteps: string;
  notes?: string;
  createdAt: string;
  createdAtEpoch: number;
}

export interface Session {
  id?: number;
  sessionId: string;
  project: string;
  status: "active" | "completed";
  createdAt: string;
  createdAtEpoch: number;
  completedAt?: string;
  completedAtEpoch?: number;
}

export interface SearchResult {
  id: number;
  title: string;
  type: ObservationType;
  project: string;
  createdAt: string;
  score?: number;
}

export interface FullObservation extends Observation {
  id: number;
}
