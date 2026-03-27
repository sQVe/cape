import { mkdirSync, writeFileSync, unlinkSync } from "fs";
import { contextDir, prConfirmationPath } from "./paths";
import { parseStdin } from "./io";

const data = await parseStdin<{ tool_input?: { options?: string[] }; tool_response?: unknown }>();
const options = data.tool_input?.options ?? [];
const response = String(data.tool_response ?? "");

const isPrQuestion = options.some((o) => /create pr|create draft/i.test(o));
if (!isPrQuestion) {
  process.exit(0);
}

const confirmed = /create pr|create draft/i.test(response);

mkdirSync(contextDir, { recursive: true });

if (confirmed) {
  writeFileSync(prConfirmationPath, String(Date.now()));
} else {
  try {
    unlinkSync(prConfirmationPath);
  } catch {
    // file didn't exist — fine
  }
}
