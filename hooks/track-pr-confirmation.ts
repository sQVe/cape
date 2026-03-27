import { mkdirSync, writeFileSync, unlinkSync } from "fs";
import { contextDir, prConfirmationPath } from "./paths";
import { parseStdin } from "./io";

interface Question {
  question?: string;
  options?: Array<{ label: string }>;
}

const data = await parseStdin<{
  tool_input?: { questions?: Question[]; answers?: Record<string, string> };
}>();

const questions = data.tool_input?.questions ?? [];
const answers = Object.values(data.tool_input?.answers ?? {});

const isPrQuestion = questions.some((q) => /\bpr\b|pull request/i.test(q.question ?? ""));
if (!isPrQuestion) {
  process.exit(0);
}

const rejected = answers.some((a) => /cancel|abort|edit|revise/i.test(a));
const confirmed = answers.length > 0 && !rejected;

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
