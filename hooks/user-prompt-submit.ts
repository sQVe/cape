const input = await Bun.stdin.text();

let prompt = "";
try {
  const data = JSON.parse(input);
  prompt = data.prompt ?? "";
} catch {
  console.log(JSON.stringify({ decision: "approve" }));
  process.exit(0);
}

if (!prompt) {
  console.log(JSON.stringify({ decision: "approve" }));
  process.exit(0);
}

const lower = prompt.toLowerCase();
const skills: string[] = [];
const contexts: string[] = [];

const isManagingBrTasks = /(?:split|merge|archiv).*\bbr-/i.test(lower);
if (!isManagingBrTasks) {
  // \bbr\b is safe: word boundaries prevent matching inside words like "abbreviation"
  const isBeads =
    /\bbr\b|\bbeads?\b|\.beads|issue.*(track|create|log)|track.*(bug|issue|finding|gap|these|them)|what.*(task|work).*next|batch.*(create|issue)|--design.*create|--description.*--design|\bgaps?\b.*\btrack/i.test(
      lower,
    );
  if (isBeads) {
    skills.push("cape:beads");
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

const inProgressTasks = brQuery(["list", "--status", "in_progress", "--type", "task"]);
if (inProgressTasks) {
  contexts.push(
    "<tdd-enforcement>There is an in-progress task. Before writing any production code, write a failing test first. " +
      "RED: write test, watch it fail. GREEN: write minimal code to pass. REFACTOR: clean up while tests stay green. " +
      "Load cape:test-driven-development with the Skill tool before writing any non-test file.</tdd-enforcement>",
  );
}

const bugs = brQuery(["list", "--type", "bug", "--status", "open"]);
const epics = brQuery(["list", "--type", "epic", "--status", "open"]);
const brAvailable = bugs !== null || inProgressTasks !== null || epics !== null;

if (brAvailable) {
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
  contexts.push(`<flow-context>Current phase: ${phase}</flow-context>`);
}

if (skills.length === 0 && contexts.length === 0) {
  console.log(JSON.stringify({ decision: "approve" }));
  process.exit(0);
}

const parts: string[] = [];
if (skills.length > 0) {
  parts.push(`Use the following skill(s): ${skills.join(" ")}`);
}
parts.push(...contexts);

console.log(
  JSON.stringify({
    decision: "approve",
    additionalContext: parts.join("\n\n"),
  }),
);
