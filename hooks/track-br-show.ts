import { mkdirSync, appendFileSync } from "fs";
import { contextDir, brShowLog } from "./paths";

const input = await Bun.stdin.text();

let command = "";
try {
  const data = JSON.parse(input);
  command = data.tool_input?.command ?? "";
} catch {
  process.exit(0);
}

const showMatch = command.match(/\bbr\s+show\s+(\S+)/);
if (!showMatch) {
  process.exit(0);
}

mkdirSync(contextDir, { recursive: true });
appendFileSync(brShowLog, `${showMatch[1]}\n`);
