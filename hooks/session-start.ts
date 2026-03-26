import { resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { pluginRoot, contextDir, brShowLog } from "./paths";

const skillPath = resolve(pluginRoot, "skills/don-cape/SKILL.md");

try {
  mkdirSync(contextDir, { recursive: true });
} catch {
  // ignore
}

if (process.env.CAPE_CLEAR_LOGS) {
  try {
    writeFileSync(brShowLog, "");
  } catch {
    // ignore
  }
}

let skill: string;
try {
  skill = readFileSync(skillPath, "utf-8");
} catch {
  console.log(JSON.stringify({ additionalContext: "cape plugin loaded." }));
  process.exit(0);
}

const context = `The content below is from skills/don-cape/SKILL.md — cape's workflow system:\n\n${skill}`;
console.log(JSON.stringify({ additionalContext: context }));
