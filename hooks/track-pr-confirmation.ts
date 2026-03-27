import { mkdirSync, writeFileSync, unlinkSync } from "fs";
import { contextDir, prConfirmationPath } from "./paths";
import { parseStdin } from "./io";

interface Question {
  options?: Array<{ label: string }>;
}

const data = await parseStdin<{
  tool_input?: { questions?: Question[] };
  tool_response?: unknown;
}>();

const labels = (data.tool_input?.questions ?? []).flatMap((q) =>
  (q.options ?? []).map((o) => o.label),
);
const response = String(data.tool_response ?? "");

const isPrQuestion = labels.some((l) => /create pr|create draft/i.test(l));
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
