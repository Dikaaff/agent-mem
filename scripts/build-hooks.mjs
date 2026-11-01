/**
 * Compile Claude Code hook entrypoints to plain JS under plugin/hooks/
 * so the host can run them with `node` without tsx.
 */

import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const entries = [
  "session-start",
  "session-init",
  "post-tool-use",
  "stop",
  "session-end",
];

await build({
  entryPoints: entries.map((n) =>
    path.join(root, "src/hooks/claude-code", `${n}.ts`)
  ),
  outdir: path.join(root, "plugin/hooks"),
  outbase: path.join(root, "src/hooks/claude-code"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  external: ["better-sqlite3"],
  logLevel: "info",
});

console.log("✓ Hooks built → plugin/hooks/*.js");
