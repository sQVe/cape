import { resolve, dirname } from "path";
import { readFileSync } from "fs";

const pluginRoot =
  process.env.CLAUDE_PLUGIN_ROOT ?? dirname(dirname(import.meta.path));
const skillPath = resolve(pluginRoot, "skills/don-cape/SKILL.md");

let skill: string;
try {
  skill = readFileSync(skillPath, "utf-8");
} catch {
  console.log(JSON.stringify({ additionalContext: "cape plugin loaded." }));
  process.exit(0);
}

const context = `The content below is from skills/don-cape/SKILL.md — cape's workflow system:\n\n${skill}`;
console.log(JSON.stringify({ additionalContext: context }));
