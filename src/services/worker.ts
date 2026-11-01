/**
 * Minimal local HTTP worker
 * Exposes search + capture endpoints for tooling / MCP later
 */

import express from "express";
import { search, getByIds, timeline } from "../search/api.js";
import {
  captureToolUse,
  onSessionStart,
  onSessionEnd,
  getSessionPriming,
} from "../hooks/capture.js";
import { getDataDir } from "../db/client.js";

const PORT = Number(process.env.AGENT_MEM_PORT || 37800);

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, dataDir: getDataDir() });
});

app.get("/api/context/:project", (req, res) => {
  const text = getSessionPriming(req.params.project);
  res.type("text/plain").send(text);
});

app.post("/api/sessions/start", (req, res) => {
  const { project, sessionId } = req.body;
  if (!project) return res.status(400).json({ error: "project required" });
  const id = onSessionStart(project, sessionId);
  res.json({ sessionId: id });
});

app.post("/api/sessions/end", (req, res) => {
  const { sessionId, summary } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  onSessionEnd(sessionId, summary);
  res.json({ ok: true });
});

app.post("/api/observations", (req, res) => {
  const { sessionId, project, toolName, toolInput, toolOutput } = req.body;
  if (!sessionId || !project || !toolName) {
    return res.status(400).json({ error: "sessionId, project, toolName required" });
  }
  const id = captureToolUse({ sessionId, project, toolName, toolInput, toolOutput });
  res.json({ id });
});

app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "");
  const project = req.query.project ? String(req.query.project) : undefined;
  const type = req.query.type ? String(req.query.type) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  res.json(search(q, { project, type, limit }));
});

app.post("/api/observations/get", (req, res) => {
  const ids = (req.body.ids as number[]) || [];
  res.json(getByIds(ids));
});

app.get("/api/timeline/:project", (req, res) => {
  res.json(timeline(req.params.project));
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`agent-mem worker listening on http://127.0.0.1:${PORT}`);
  console.log(`data dir: ${getDataDir()}`);
});
