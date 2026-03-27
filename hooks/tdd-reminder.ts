import { existsSync } from "fs";
import { isTestFile, isCodeFile, readTddState } from "./tdd";
import { queryFlowState, deriveFlowContext } from "./br";
import { tddState as statePath } from "./paths";
import { parseStdin } from "./io";

const TDD_STATE_TTL_MS = 10 * 60 * 1000;

const data = await parseStdin<{ tool_input?: { file_path?: string } }>();
const filePath = data.tool_input?.file_path ?? "";

if (!filePath || isTestFile(filePath) || !isCodeFile(filePath)) {
  process.exit(0);
}

try {
  const flowContext = deriveFlowContext(queryFlowState());
  if (!flowContext) {
    process.exit(0);
  }

  const isActivePhase =
    flowContext.includes("executing") || flowContext.includes("debugging");
  if (!isActivePhase) {
    process.exit(0);
  }

  if (existsSync(statePath)) {
    const state = readTddState();
    const isStale =
      state != null && Date.now() - state.timestamp > TDD_STATE_TTL_MS;
    if (!isStale && state?.phase === "red") {
      process.exit(0);
    }
  }

  const reminder = [
    "TDD reminder: you are editing production code without a failing test.",
    "Consider writing or updating a test first, then making it fail, before changing this code.",
  ].join(" ");

  console.log(JSON.stringify({ additionalContext: reminder }));
} catch {
  process.exit(0);
}
