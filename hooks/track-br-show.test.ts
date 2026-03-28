import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const hookPath = join(import.meta.dir, "track-br-show.ts");

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "track-br-show-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

const runHook = async (input: string) => {
  const proc = Bun.spawn(["bun", "run", hookPath], {
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: tmpDir },
    stdout: "pipe",
    stderr: "pipe",
    stdin: new TextEncoder().encode(input),
  });
  const exitCode = await proc.exited;
  return { exitCode };
};

const readBrShowLog = () =>
  readFileSync(join(tmpDir, "hooks", "context", "br-show-log.txt"), "utf-8");

describe("track-br-show", () => {
  describe("when command is br show", () => {
    it("should log bead ID when command is br show", async () => {
      await runHook(
        JSON.stringify({ tool_input: { command: "br show cape-2vo" } }),
      );

      expect(readBrShowLog()).toContain("cape-2vo");
    });

    it("should create context directory if missing", async () => {
      await runHook(
        JSON.stringify({ tool_input: { command: "br show cape-abc" } }),
      );

      expect(existsSync(join(tmpDir, "hooks", "context"))).toBe(true);
    });

    it("should append multiple IDs", async () => {
      await runHook(
        JSON.stringify({ tool_input: { command: "br show cape-111" } }),
      );
      await runHook(
        JSON.stringify({ tool_input: { command: "br show cape-222" } }),
      );

      const log = readBrShowLog();
      expect(log).toContain("cape-111");
      expect(log).toContain("cape-222");
    });
  });

  describe("when command is not br show", () => {
    it("should exit silently for non-br-show commands", async () => {
      const { exitCode } = await runHook(
        JSON.stringify({ tool_input: { command: "echo hello" } }),
      );

      expect(exitCode).toBe(0);
      expect(
        existsSync(join(tmpDir, "hooks", "context", "br-show-log.txt")),
      ).toBe(false);
    });

    it("should exit silently when command is empty", async () => {
      const { exitCode } = await runHook(
        JSON.stringify({ tool_input: { command: "" } }),
      );

      expect(exitCode).toBe(0);
      expect(
        existsSync(join(tmpDir, "hooks", "context", "br-show-log.txt")),
      ).toBe(false);
    });
  });

  describe("when input is invalid", () => {
    it("should exit silently on invalid JSON", async () => {
      const { exitCode } = await runHook("not json at all");

      expect(exitCode).toBe(0);
      expect(
        existsSync(join(tmpDir, "hooks", "context", "br-show-log.txt")),
      ).toBe(false);
    });
  });
});
