import { resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { pluginRoot, contextDir, brShowLog } from "./paths";
import { queryFlowState, deriveFlowContext } from "./br";

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

const flowContext = deriveFlowContext(queryFlowState());

let skill: string;
try {
  skill = readFileSync(skillPath, "utf-8");
} catch {
  const parts = ["cape plugin loaded."];
  if (flowContext) {
    parts.push(flowContext);
  }
  console.log(JSON.stringify({ additionalContext: parts.join("\n\n") }));
  process.exit(0);
}

const parts = [`The content below is from skills/don-cape/SKILL.md — cape's workflow system:\n\n${skill}`];
if (flowContext) {
  parts.push(flowContext);
}
console.log(JSON.stringify({ additionalContext: parts.join("\n\n") }));
