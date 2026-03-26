import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { extname, basename, dirname } from "path";
import { tddState as statePath } from "./paths";

const testFilePattern =
  /\.(test|spec)\.(ts|tsx|js|jsx)$|_test\.go$|_spec\.lua$|^test_.*\.py$|[\\/]__tests__[\\/]/;

export const isTestFile = (filePath: string): boolean =>
  testFilePattern.test(filePath) || testFilePattern.test(basename(filePath));

const codeExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".go",
  ".py",
  ".rs",
  ".lua",
]);

export const isCodeFile = (filePath: string): boolean =>
  codeExtensions.has(extname(filePath));

const testCommandPattern =
  /(?:^|\s)(?:bun test|npm test|vitest|pytest|go test|cargo test|busted|python -m (?:pytest|unittest))(?:\s|$)/;

export const isTestCommand = (command: string): boolean =>
  testCommandPattern.test(command);

interface TddState {
  phase: string;
  timestamp: number;
}

export const writeTddState = (state: TddState): void => {
  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state));
  } catch {
    // fail open
  }
};

export const readTddState = (): TddState | null => {
  try {
    const raw = readFileSync(statePath, "utf-8");
    return JSON.parse(raw) as TddState;
  } catch {
    return null;
  }
};
