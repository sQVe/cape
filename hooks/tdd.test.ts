import { describe, it, expect, afterEach, afterAll } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

const tmpDir = mkdtempSync(join(tmpdir(), "tdd-test-"));
mkdirSync(join(tmpDir, "hooks", "context"), { recursive: true });
process.env.CLAUDE_PLUGIN_ROOT = tmpDir;

const { isTestFile, isCodeFile, isTestCommand, writeTddState, readTddState } =
  await import("./tdd");

const stateFile = join(tmpDir, "hooks", "context", "tdd-state.json");

afterEach(() => {
  try {
    unlinkSync(stateFile);
  } catch {}
});

afterAll(() => {
  delete process.env.CLAUDE_PLUGIN_ROOT;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("tdd", () => {
  describe("isTestFile", () => {
    it("returns true for .test.ts files", () => {
      expect(isTestFile("src/foo.test.ts")).toBe(true);
    });

    it("returns true for .spec.tsx files", () => {
      expect(isTestFile("components/Bar.spec.tsx")).toBe(true);
    });

    it("returns true for _test.go files", () => {
      expect(isTestFile("pkg/handler_test.go")).toBe(true);
    });

    it("returns true for _spec.lua files", () => {
      expect(isTestFile("tests/parser_spec.lua")).toBe(true);
    });

    it("returns true for test_foo.py files", () => {
      expect(isTestFile("tests/test_handler.py")).toBe(true);
    });

    it("returns true for files in __tests__ directory", () => {
      expect(isTestFile("src/__tests__/foo.ts")).toBe(true);
    });

    it("returns false for regular source files", () => {
      expect(isTestFile("src/foo.ts")).toBe(false);
    });

    it("returns false for test utility files", () => {
      expect(isTestFile("src/test-utils.ts")).toBe(false);
    });

    it("returns false for regular python files", () => {
      expect(isTestFile("src/handler.py")).toBe(false);
    });
  });

  describe("isCodeFile", () => {
    it("returns true for .ts files", () => {
      expect(isCodeFile("src/foo.ts")).toBe(true);
    });

    it("returns true for .go files", () => {
      expect(isCodeFile("pkg/main.go")).toBe(true);
    });

    it("returns true for .py files", () => {
      expect(isCodeFile("app.py")).toBe(true);
    });

    it("returns true for .rs files", () => {
      expect(isCodeFile("src/main.rs")).toBe(true);
    });

    it("returns true for .lua files", () => {
      expect(isCodeFile("plugin/init.lua")).toBe(true);
    });

    it("returns true for .tsx files", () => {
      expect(isCodeFile("App.tsx")).toBe(true);
    });

    it("returns true for .jsx files", () => {
      expect(isCodeFile("App.jsx")).toBe(true);
    });

    it("returns true for .js files", () => {
      expect(isCodeFile("index.js")).toBe(true);
    });

    it("returns false for .json files", () => {
      expect(isCodeFile("package.json")).toBe(false);
    });

    it("returns false for .md files", () => {
      expect(isCodeFile("README.md")).toBe(false);
    });

    it("returns false for .yaml files", () => {
      expect(isCodeFile("config.yaml")).toBe(false);
    });

    it("returns false for .css files", () => {
      expect(isCodeFile("styles.css")).toBe(false);
    });

    it("returns false for .html files", () => {
      expect(isCodeFile("index.html")).toBe(false);
    });
  });

  describe("isTestCommand", () => {
    it("returns true for bun test", () => {
      expect(isTestCommand("bun test")).toBe(true);
    });

    it("returns true for bun test with args", () => {
      expect(isTestCommand("bun test hooks/tdd.test.ts")).toBe(true);
    });

    it("returns true for npm test", () => {
      expect(isTestCommand("npm test")).toBe(true);
    });

    it("returns true for vitest", () => {
      expect(isTestCommand("npx vitest run")).toBe(true);
    });

    it("returns true for pytest", () => {
      expect(isTestCommand("pytest tests/")).toBe(true);
    });

    it("returns true for go test", () => {
      expect(isTestCommand("go test ./...")).toBe(true);
    });

    it("returns true for cargo test", () => {
      expect(isTestCommand("cargo test")).toBe(true);
    });

    it("returns true for busted", () => {
      expect(isTestCommand("busted spec/")).toBe(true);
    });

    it("returns true for python -m pytest", () => {
      expect(isTestCommand("python -m pytest tests/")).toBe(true);
    });

    it("returns true for python -m unittest", () => {
      expect(isTestCommand("python -m unittest discover")).toBe(true);
    });

    it("returns false for bun run build", () => {
      expect(isTestCommand("bun run build")).toBe(false);
    });

    it("returns false for echo test", () => {
      expect(isTestCommand("echo test")).toBe(false);
    });

    it("returns false for git status", () => {
      expect(isTestCommand("git status")).toBe(false);
    });
  });

  describe("writeTddState / readTddState", () => {
    it("writes and reads state back", () => {
      writeTddState({ phase: "red", timestamp: 1000 });
      const state = readTddState();
      expect(state).toEqual({ phase: "red", timestamp: 1000 });
    });

    it("writes state to hooks/context/tdd-state.json", () => {
      writeTddState({ phase: "green", timestamp: 2000 });
      const raw = readFileSync(stateFile, "utf-8");
      expect(JSON.parse(raw)).toEqual({ phase: "green", timestamp: 2000 });
    });

    it("returns null when state file is missing", () => {
      expect(readTddState()).toBeNull();
    });

    it("returns null when state file is corrupted", () => {
      writeFileSync(stateFile, "not json{{{");
      expect(readTddState()).toBeNull();
    });

    it("creates context directory if missing", () => {
      rmSync(join(tmpDir, "hooks", "context"), {
        recursive: true,
        force: true,
      });
      writeTddState({ phase: "red", timestamp: 3000 });
      expect(readTddState()).toEqual({ phase: "red", timestamp: 3000 });
    });
  });
});
