import { renameSync, readFileSync, unlinkSync, mkdirSync } from "fs";
import { contextDir, editLog } from "./paths";

mkdirSync(contextDir, { recursive: true });

const processingFile = `${editLog}.processing`;
try {
  renameSync(editLog, processingFile);
} catch {
  process.exit(0);
}

let lines: string[] = [];
try {
  lines = readFileSync(processingFile, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean);
} finally {
  try {
    unlinkSync(processingFile);
  } catch {
    // ignore cleanup failure
  }
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
