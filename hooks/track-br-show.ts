import { mkdirSync, appendFileSync } from "fs";
import { resolve, dirname } from "path";

const pluginRoot =
  process.env.CLAUDE_PLUGIN_ROOT ?? dirname(dirname(import.meta.path));
const contextDir = resolve(pluginRoot, "hooks/context");
const brShowLog = resolve(contextDir, "br-show-log.txt");

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
