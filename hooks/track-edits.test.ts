import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { tmpdir } from "os";
import { rmSync } from "fs";

const hookPath = resolve(import.meta.dir, "track-edits.ts");

let tempDir: string;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

const runHook = (input: string, root: string) =>
  Bun.spawn(["bun", "run", hookPath], {
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: root },
    stdin: new TextEncoder().encode(input),
    stdout: "pipe",
    stderr: "pipe",
  });

describe("track-edits", () => {
  describe("normal operation", () => {
    it("should append file path to edit log", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-track-edits-"));
      const input = JSON.stringify({ tool_input: { file_path: "/some/file.ts" } });

      const proc = runHook(input, tempDir);
      await proc.exited;

      const logFile = resolve(tempDir, "hooks/context/edit-log.txt");
      const contents = readFileSync(logFile, "utf-8");
      expect(contents).toContain("/some/file.ts");
    });

    it("should create context directory if missing", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-track-edits-"));
      const contextDir = resolve(tempDir, "hooks/context");
      expect(existsSync(contextDir)).toBe(false);

      const input = JSON.stringify({ tool_input: { file_path: "/some/file.ts" } });
      const proc = runHook(input, tempDir);
      await proc.exited;

      expect(existsSync(contextDir)).toBe(true);
    });

    it("should append multiple entries", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-track-edits-"));

      const input1 = JSON.stringify({ tool_input: { file_path: "/first.ts" } });
      const input2 = JSON.stringify({ tool_input: { file_path: "/second.ts" } });

      await runHook(input1, tempDir).exited;
      await runHook(input2, tempDir).exited;

      const logFile = resolve(tempDir, "hooks/context/edit-log.txt");
      const contents = readFileSync(logFile, "utf-8");
      const lines = contents.trim().split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("/first.ts");
      expect(lines[1]).toContain("/second.ts");
    });

    it("should prefix each entry with an ISO timestamp", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-track-edits-"));
      const input = JSON.stringify({ tool_input: { file_path: "/file.ts" } });

      const proc = runHook(input, tempDir);
      await proc.exited;

      const logFile = resolve(tempDir, "hooks/context/edit-log.txt");
      const contents = readFileSync(logFile, "utf-8");
      expect(contents).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("error cases", () => {
    it("should exit silently on invalid JSON input", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-track-edits-"));

      const proc = runHook("not valid json", tempDir);
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(existsSync(resolve(tempDir, "hooks/context/edit-log.txt"))).toBe(false);
    });

    it("should exit silently when file_path is empty", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-track-edits-"));
      const input = JSON.stringify({ tool_input: { file_path: "" } });

      const proc = runHook(input, tempDir);
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(existsSync(resolve(tempDir, "hooks/context/edit-log.txt"))).toBe(false);
    });
  });
});
