/** Public API */

export * from "./types/index.js";
export {
  onSessionStart,
  onSessionEnd,
  captureToolUse,
  captureToolUseAsync,
  getSessionPriming,
} from "./hooks/capture.js";
export { search, getByIds, timeline } from "./search/api.js";
export {
  compress,
  compressWithLLM,
  compressAuto,
} from "./services/compressor.js";
export { loadLlmConfig } from "./services/llm.js";
export { getDb, getDataDir, getDbPath } from "./db/client.js";
export { startMcpServer } from "./mcp/server.js";
