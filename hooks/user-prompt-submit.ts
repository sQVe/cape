import { queryFlowState, deriveFlowContext } from "./br";

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

const state = queryFlowState();
const flowContext = deriveFlowContext(state);
if (flowContext) {
  contexts.push(flowContext);
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
