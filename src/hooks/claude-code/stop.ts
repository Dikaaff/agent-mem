/**
 * Stop hook — agent finished a response turn
 * Good place to flush / lightweight summary later.
 * For now we just ensure state is consistent.
 */

import { readStdin, parsePayload } from "./shared.js";

async function main() {
  await readStdin(); // drain stdin
  // Future: request partial summary from LLM compressor
  process.exit(0);
}

main().catch(() => process.exit(0));
