const input = await Bun.stdin.text();

let command = "";
try {
  const data = JSON.parse(input);
  command = data.tool_input?.command ?? "";
} catch {
  process.exit(0);
}

if (!/\bbr\s+close\b/.test(command)) {
  process.exit(0);
}

const message = [
  "A task was just closed via `br close`.",
  "STOP working immediately. Present a checkpoint summary and wait for user input.",
  "Do not start the next task or make further code changes.",
].join(" ");

console.log(JSON.stringify({ additionalContext: message }));
