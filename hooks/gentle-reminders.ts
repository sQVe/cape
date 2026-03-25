import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const pluginRoot =
  process.env.CLAUDE_PLUGIN_ROOT ?? dirname(dirname(import.meta.path));
const contextDir = resolve(pluginRoot, "hooks/context");
const logFile = resolve(contextDir, "edit-log.txt");

mkdirSync(contextDir, { recursive: true });

let lines: string[] = [];
try {
  lines = readFileSync(logFile, "utf-8").trim().split("\n").filter(Boolean);
} catch (error: unknown) {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    process.exit(0);
  }
  throw error;
}

if (lines.length === 0) {
  process.exit(0);
}

const testPattern = /(test|spec)\.(ts|js|tsx|jsx|py|go|rs|java)$/;
const sourcePattern = /\.(ts|js|tsx|jsx|py|go|rs|java)$/;

const editedFiles = lines.map((line) => line.split("|")[1] ?? "");
const sourceFiles = editedFiles.filter(
  (f) => sourcePattern.test(f) && !testPattern.test(f),
);
const testFiles = editedFiles.filter((f) => testPattern.test(f));

const reminders: string[] = [];

if (sourceFiles.length > 0 && testFiles.length === 0) {
  reminders.push(
    "Source files were edited without any test files. Write a failing test before continuing with production code.",
  );
}

if (reminders.length > 0) {
  console.log(reminders.join("\n"));
}

// Clear the log after each check so reminders reflect the current response cycle
writeFileSync(logFile, "");
