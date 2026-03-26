import { isTestCommand, writeTddState } from "./tdd";

const input = await Bun.stdin.text();

let command = "";
try {
  const data = JSON.parse(input);
  command = data.tool_input?.command ?? "";
} catch {
  process.exit(0);
}

if (!isTestCommand(command)) {
  process.exit(0);
}

const phase = process.env.TDD_PHASE === "red" ? "red" : "green";
writeTddState({ phase, timestamp: Date.now() });
