import { mkdirSync, appendFileSync } from "fs";
import { contextDir, editLog } from "./paths";

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
appendFileSync(editLog, `${new Date().toISOString()}|${filePath}\n`);
