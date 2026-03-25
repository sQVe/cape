import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const hookPath = join(import.meta.dir, "gentle-reminders.ts");

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "gentle-reminders-"));
  mkdirSync(join(tmpDir, "hooks", "context"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

const runHook = async () => {
  const proc = Bun.spawn(["bun", "run", hookPath], {
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: tmpDir },
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  return { stdout, exitCode };
};

const writeLog = (content: string) => {
  writeFileSync(join(tmpDir, "hooks", "context", "edit-log.txt"), content);
};

describe("gentle-reminders", () => {
  describe("when edit log does not exist", () => {
    it("should exit silently when edit log does not exist", async () => {
      const { stdout, exitCode } = await runHook();

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
    });
  });

  describe("when edit log is empty", () => {
    it("should exit silently when edit log is empty", async () => {
      writeLog("");

      const { stdout, exitCode } = await runHook();

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
    });
  });

  describe("when source files edited without test files", () => {
    it("should remind when source files edited without test files", async () => {
      writeLog("2024-01-01T00:00:00.000Z|/foo/bar.ts\n");

      const { stdout, exitCode } = await runHook();

      expect(exitCode).toBe(0);
      expect(stdout).toContain(
        "Source files were edited without any test files. Write a failing test before continuing with production code.",
      );
    });

    it("should handle multiple source files", async () => {
      writeLog(
        "2024-01-01T00:00:00.000Z|/foo/bar.ts\n2024-01-01T00:00:01.000Z|/baz/qux.py\n",
      );

      const { stdout } = await runHook();

      expect(stdout).toContain(
        "Source files were edited without any test files.",
      );
    });
  });

  describe("when test files are also edited", () => {
    it("should not remind when both source and test files edited", async () => {
      writeLog(
        "2024-01-01T00:00:00.000Z|/foo/bar.ts\n2024-01-01T00:00:01.000Z|/foo/bar.test.ts\n",
      );

      const { stdout } = await runHook();

      expect(stdout).toBe("");
    });

    it("should not remind when only test files edited", async () => {
      writeLog("2024-01-01T00:00:00.000Z|/foo/bar.spec.ts\n");

      const { stdout } = await runHook();

      expect(stdout).toBe("");
    });
  });

  describe("when only non-code files edited", () => {
    it("should not remind when only non-code files edited", async () => {
      writeLog("2024-01-01T00:00:00.000Z|/foo/README.md\n");

      const { stdout } = await runHook();

      expect(stdout).toBe("");
    });
  });

  describe("after running", () => {
    it("should clear edit log after running", async () => {
      writeLog("2024-01-01T00:00:00.000Z|/foo/bar.ts\n");

      await runHook();

      const logContent = readFileSync(
        join(tmpDir, "hooks", "context", "edit-log.txt"),
        "utf-8",
      );
      expect(logContent).toBe("");
    });
  });
});
