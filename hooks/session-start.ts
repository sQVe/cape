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

const brQuery = (args: string[]): string | null => {
  try {
    const result = Bun.spawnSync(["br", ...args], { timeout: 3000 });
    if (result.exitCode !== 0) {
      return null;
    }
    return result.stdout.toString().trim();
  } catch {
    return null;
  }
};

const deriveFlowContext = (): string | null => {
  const bugs = brQuery(["list", "--type", "bug", "--status", "open"]);
  const inProgressTasks = brQuery(["list", "--status", "in_progress", "--type", "task"]);
  const epics = brQuery(["list", "--type", "epic", "--status", "open"]);
  const brAvailable = bugs !== null || inProgressTasks !== null || epics !== null;

  if (!brAvailable) {
    return null;
  }

  let phase: string;
  if (bugs) {
    phase = "debugging";
  } else if (inProgressTasks) {
    phase = "executing";
  } else if (epics) {
    phase = "planning";
  } else {
    phase = "idle";
  }
  return `<flow-context>Current phase: ${phase}</flow-context>`;
};

const flowContext = deriveFlowContext();

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
