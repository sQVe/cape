import { mkdirSync, appendFileSync } from "fs";
import { resolve, dirname } from "path";

const pluginRoot =
  process.env.CLAUDE_PLUGIN_ROOT ?? dirname(dirname(import.meta.path));
const contextDir = resolve(pluginRoot, "hooks/context");
const logFile = resolve(contextDir, "edit-log.txt");

const input = await Bun.stdin.text();

let filePath = "";
try {
  const data = JSON.parse(input);
  filePath = data.tool_input?.file_path ?? "";
} catch {
  process.exit(0);
}

if (!filePath) {
  process.exit(0);
}

mkdirSync(contextDir, { recursive: true });
appendFileSync(logFile, `${new Date().toISOString()}|${filePath}\n`);
