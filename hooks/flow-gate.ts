import { brQuery } from "./br";
import { parseStdin, deny } from "./io";

const data = await parseStdin<{ tool_input?: { skill?: string } }>();
const skill = data.tool_input?.skill ?? "";

if (!skill) {
  process.exit(0);
}

const gatedSkills = ["execute-plan", "finish-epic", "fix-bug"];
const skillName = skill.replace(/^cape:/, "");

if (!gatedSkills.includes(skillName)) {
  process.exit(0);
}

if (skillName === "execute-plan") {
  const epics = brQuery(["list", "--type", "epic", "--status", "open"]);
  if (epics === null) {
    process.exit(0);
  }
  if (!epics) {
    deny(
      "No open epic exists. Load cape:brainstorm to explore the problem, then cape:write-plan to create an epic.",
    );
  }
  const ready = brQuery(["ready"]);
  if (ready === null) {
    process.exit(0);
  }
  if (!ready) {
    deny(
      "No ready tasks. All tasks under the open epic are either in-progress or blocked. Use cape:expand-task or create a new task with cape:beads.",
    );
  }
}

if (skillName === "finish-epic") {
  const output = brQuery(["epic", "status", "--json"]);
  if (output === null) {
    process.exit(0);
  }
  try {
    const epics = JSON.parse(output) as Array<{
      epic: { id: string };
      total_children: number;
      closed_children: number;
    }>;
    for (const entry of epics) {
      const open = entry.total_children - entry.closed_children;
      if (open > 0) {
        deny(
          `Epic ${entry.epic.id} still has ${open} open task(s). Close all tasks before running cape:finish-epic.`,
        );
      }
    }
  } catch {
    process.exit(0);
  }
}

if (skillName === "fix-bug") {
  const bugs = brQuery(["list", "--type", "bug", "--status", "open"]);
  if (bugs === null) {
    process.exit(0);
  }
  if (!bugs) {
    deny(
      "No open bug exists. Load cape:debug-issue to investigate the problem first, then create a bug with cape:beads.",
    );
  }
}
