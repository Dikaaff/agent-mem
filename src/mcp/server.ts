/**
 * MCP server for agent-mem
 *
 * Exposes progressive-disclosure memory tools so agents (Claude Code, Cursor, etc.)
 * can search and load past observations on demand.
 *
 * Transport: stdio (default MCP style)
 *
 * Tools:
 *   - search_memory
 *   - get_observations
 *   - get_context
 *   - get_timeline
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { search, getByIds, timeline } from "../search/api.js";
import { getSessionPriming } from "../hooks/capture.js";

const server = new Server(
  {
    name: "agent-mem",
    version: "0.4.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_memory",
      description:
        "Search past agent observations (Layer 2). Returns compact hits: id, title, type, project, createdAt. Use get_observations next to load full narratives for relevant ids.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (keywords). Empty string returns recent items.",
          },
          project: {
            type: "string",
            description: "Optional project name filter",
          },
          type: {
            type: "string",
            description:
              "Optional type filter: read|write|edit|bash|search|decision|bugfix|feature|other",
          },
          limit: {
            type: "number",
            description: "Max results (default 15)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_observations",
      description:
        "Load full observation detail by id (Layer 3). Pass ids from search_memory results.",
      inputSchema: {
        type: "object",
        properties: {
          ids: {
            type: "array",
            items: { type: "number" },
            description: "Observation ids to fetch",
          },
        },
        required: ["ids"],
      },
    },
    {
      name: "get_context",
      description:
        "Get compact priming context for a project (Layer 1): recent session summaries + observation title index. Use at session start.",
      inputSchema: {
        type: "object",
        properties: {
          project: {
            type: "string",
            description: "Project name",
          },
        },
        required: ["project"],
      },
    },
    {
      name: "get_timeline",
      description:
        "Recent session summaries and observations for a project (structured JSON).",
      inputSchema: {
        type: "object",
        properties: {
          project: {
            type: "string",
            description: "Project name",
          },
          limit: {
            type: "number",
            description: "Max observations (default 40)",
          },
        },
        required: ["project"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    if (name === "search_memory") {
      const result = search(String(a.query ?? ""), {
        project: a.project ? String(a.project) : undefined,
        type: a.type ? String(a.type) : undefined,
        limit: a.limit != null ? Number(a.limit) : 15,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === "get_observations") {
      const ids = Array.isArray(a.ids)
        ? (a.ids as unknown[]).map((x) => Number(x)).filter((n) => !Number.isNaN(n))
        : [];
      const result = getByIds(ids);
      const text =
        result.observations.length === 0
          ? "No observations found for those ids."
          : result.observations.map((o) => o.formatted).join("\n\n---\n\n");
      return {
        content: [{ type: "text", text }],
      };
    }

    if (name === "get_context") {
      const project = String(a.project ?? "default");
      const text = getSessionPriming(project);
      return {
        content: [{ type: "text", text }],
      };
    }

    if (name === "get_timeline") {
      const project = String(a.project ?? "default");
      const limit = a.limit != null ? Number(a.limit) : 40;
      const result = timeline(project, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Do not write to stdout — it is the MCP channel.
  console.error("agent-mem MCP server running on stdio");
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("mcp/server.ts") ||
    process.argv[1].endsWith("mcp/server.js") ||
    process.argv[1].endsWith("src/mcp/server.ts"));

if (isDirectRun) {
  startMcpServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
