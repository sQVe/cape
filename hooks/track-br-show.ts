import { mkdirSync, appendFileSync } from "fs";
import { contextDir, brShowLog } from "./paths";
import { parseStdin } from "./io";

const data = await parseStdin<{ tool_input?: { command?: string } }>();
const command = data.tool_input?.command ?? "";

const showMatch = command.match(/\bbr\s+show\s+(\S+)/);
if (!showMatch) {
  process.exit(0);
}

mkdirSync(contextDir, { recursive: true });
appendFileSync(brShowLog, `${showMatch[1]}\n`);
