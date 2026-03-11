const input = await Bun.stdin.text();

const promptMatch = input.match(/"prompt"\s*:\s*"([^"]*)"/);
const prompt = promptMatch?.[1] ?? "";

if (!prompt) {
  console.log(JSON.stringify({ decision: "approve" }));
  process.exit(0);
}

const lower = prompt.toLowerCase();
const skills: string[] = [];

const isManagingBrTasks = /(?:split|merge|archiv).*\bbr-/i.test(lower);
if (!isManagingBrTasks) {
  const isBeads =
    /\bbr\b|\bbeads?\b|\.beads|issue.*(track|create|log)|track.*(bug|issue|finding|gap|these|them)|what.*(task|work).*next|batch.*(create|issue)|--design.*create|--description.*--design|\bgaps?\b.*\btrack/i.test(
      lower,
    );
  if (isBeads) {
    skills.push("cape:beads");
  }
}

if (skills.length === 0) {
  console.log(JSON.stringify({ decision: "approve" }));
  process.exit(0);
}

const context = `Use the following skill(s): ${skills.join(" ")}`;
console.log(
  JSON.stringify({ decision: "approve", additionalContext: context }),
);
