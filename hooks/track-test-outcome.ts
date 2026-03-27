import { isTestCommand, writeTddState } from "./tdd";
import { parseStdin } from "./io";

const data = await parseStdin<{ tool_input?: { command?: string } }>();
const command = data.tool_input?.command ?? "";

if (!isTestCommand(command)) {
  process.exit(0);
}

const phase = process.env.TDD_PHASE === "red" ? "red" : "green";
writeTddState({ phase, timestamp: Date.now() });
