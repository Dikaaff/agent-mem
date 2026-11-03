#!/usr/bin/env node
import { Command } from "commander";
import {
  onSessionStart,
  onSessionEnd,
  captureToolUse,
  getSessionPriming,
} from "./hooks/capture.js";
import { search, getByIds } from "./search/api.js";
import { getDbPath, getDataDir } from "./db/client.js";

const program = new Command();

program
  .name("agent-mem")
  .description("Persistent memory for AI coding agents")
  .version("0.4.0");

program
  .command("init")
  .description("Initialize local database")
  .action(() => {
    getDbPath();
    import("./db/client.js").then(({ getDb }) => {
      getDb();
      console.log("\u2713 Database ready at", getDbPath());
      console.log("  Data dir:", getDataDir());
    });
  });

program
  .command("start-session")
  .description("Start a memory session")
  .requiredOption("-p, --project <name>", "Project name")
  .option("-s, --session <id>", "Optional session id")
  .action((opts) => {
    const id = onSessionStart(opts.project, opts.session);
    console.log(id);
  });

program
  .command("end-session")
  .description("End a memory session")
  .requiredOption("-s, --session <id>", "Session id")
  .option("-p, --project <name>", "Project name")
  .option("--request <text>", "What was requested")
  .option("--completed <text>", "What was completed")
  .option("--next <text>", "Next steps")
  .action((opts) => {
    onSessionEnd(
      opts.session,
      opts.project
        ? {
            project: opts.project,
            request: opts.request || "",
            investigated: "",
            learned: "",
            completed: opts.completed || "",
            nextSteps: opts.next || "",
          }
        : undefined
    );
    console.log("\u2713 Session ended");
  });

program
  .command("capture")
  .description("Capture a tool observation (uses LLM if configured)")
  .requiredOption("-s, --session <id>", "Session id")
  .requiredOption("-p, --project <name>", "Project name")
  .requiredOption("-t, --tool <name>", "Tool name (Read, Edit, Bash, ...)")
  .option("--input <text>", "Tool input")
  .option("--output <text>", "Tool output")
  .option("--heuristic", "Force offline heuristic (skip LLM)")
  .action(async (opts) => {
    const { captureToolUse, captureToolUseAsync } = await import(
      "./hooks/capture.js"
    );
    const id = opts.heuristic
      ? captureToolUse({
          sessionId: opts.session,
          project: opts.project,
          toolName: opts.tool,
          toolInput: opts.input,
          toolOutput: opts.output,
        })
      : await captureToolUseAsync({
          sessionId: opts.session,
          project: opts.project,
          toolName: opts.tool,
          toolInput: opts.input,
          toolOutput: opts.output,
        });
    console.log(`\u2713 Observation #${id} saved`);
  });

program
  .command("llm-status")
  .description("Show LLM compressor configuration")
  .action(async () => {
    const { loadLlmConfig } = await import("./services/llm.js");
    const cfg = loadLlmConfig();
    if (!cfg) {
      console.log("LLM: not configured (using heuristic compressor)");
      console.log(
        "Set AGENT_MEM_LLM_API_KEY or ANTHROPIC_API_KEY / OPENROUTER_API_KEY"
      );
      return;
    }
    console.log("LLM: configured");
    console.log(`  provider: ${cfg.provider}`);
    console.log(`  model:    ${cfg.model}`);
    console.log(`  baseUrl:  ${cfg.baseUrl || "(default)"}`);
    console.log(`  apiKey:   ${cfg.apiKey.slice(0, 8)}\u2026`);
  });

program
  .command("context")
  .description("Print priming context for a project (Layer 1)")
  .requiredOption("-p, --project <name>", "Project name")
  .action((opts) => {
    console.log(getSessionPriming(opts.project));
  });

program
  .command("search")
  .description("Search observations (Layer 2)")
  .argument("[query]", "Search query", "")
  .option("-p, --project <name>", "Filter by project")
  .option("--type <type>", "Filter by type")
  .option("-n, --limit <n>", "Max results", "15")
  .action((query, opts) => {
    const result = search(query, {
      project: opts.project,
      type: opts.type,
      limit: Number(opts.limit),
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("get")
  .description("Get full observations by id (Layer 3)")
  .argument("<ids...>", "Observation ids")
  .action((ids: string[]) => {
    const result = getByIds(ids.map(Number));
    for (const o of result.observations) {
      console.log(o.formatted);
      console.log("---");
    }
  });

program
  .command("worker")
  .description("Start local HTTP worker")
  .action(async () => {
    await import("./services/worker.js");
  });

program
  .command("mcp")
  .description("Start MCP server (stdio) for agent tools")
  .action(async () => {
    const { startMcpServer } = await import("./mcp/server.js");
    await startMcpServer();
  });

program.parse();
