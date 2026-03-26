import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const hookPath = join(import.meta.dir, "stop-reinforcement.ts");

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "stop-reinforcement-"));
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
  const stdout = await new Response(proc.stdout).text();
  return { exitCode, stdout: stdout.trim() };
};

describe("stop-reinforcement", () => {
  describe("when command is br close", () => {
    it("outputs additionalContext for br close", async () => {
      const { stdout } = await runHook(
        JSON.stringify({ tool_input: { command: "br close cape-2v2.3" } }),
      );
      const result = JSON.parse(stdout);

      expect(result.additionalContext).toBeDefined();
      expect(result.additionalContext).toContain("STOP");
    });

    it("outputs additionalContext for br close without arguments", async () => {
      const { stdout } = await runHook(
        JSON.stringify({ tool_input: { command: "br close" } }),
      );
      const result = JSON.parse(stdout);

      expect(result.additionalContext).toBeDefined();
    });
  });

  describe("when command is not br close", () => {
    it("produces no output for non-br commands", async () => {
      const { exitCode, stdout } = await runHook(
        JSON.stringify({ tool_input: { command: "echo hello" } }),
      );

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
    });

    it("produces no output for br show", async () => {
      const { exitCode, stdout } = await runHook(
        JSON.stringify({ tool_input: { command: "br show cape-2v2" } }),
      );

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
    });

    it("produces no output for br update --status closed", async () => {
      const { exitCode, stdout } = await runHook(
        JSON.stringify({
          tool_input: { command: "br update cape-2v2.3 --status closed" },
        }),
      );

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
    });

    it("produces no output for empty command", async () => {
      const { exitCode, stdout } = await runHook(
        JSON.stringify({ tool_input: { command: "" } }),
      );

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
    });
  });

  describe("when input is invalid", () => {
    it("exits silently on invalid JSON", async () => {
      const { exitCode, stdout } = await runHook("not json at all");

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
    });
  });
});
