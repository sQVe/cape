import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const hookPath = join(import.meta.dir, "track-test-outcome.ts");

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "track-test-outcome-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

const runHook = async (input: string, env?: Record<string, string>) => {
  const proc = Bun.spawn(["bun", "run", hookPath], {
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: tmpDir, ...env },
    stdout: "pipe",
    stderr: "pipe",
    stdin: new TextEncoder().encode(input),
  });
  const exitCode = await proc.exited;
  return { exitCode };
};

const readState = () => {
  const path = join(tmpDir, "hooks", "context", "tdd-state.json");
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, "utf-8"));
};

describe("track-test-outcome", () => {
  describe("when command is a test command", () => {
    it("writes green state for bun test", async () => {
      const { exitCode } = await runHook(
        JSON.stringify({
          tool_input: { command: "bun test hooks/tdd.test.ts" },
        }),
      );

      expect(exitCode).toBe(0);
      const state = readState();
      expect(state).not.toBeNull();
      expect(state.phase).toBe("green");
      expect(typeof state.timestamp).toBe("number");
    });

    it("writes green state for go test", async () => {
      await runHook(
        JSON.stringify({ tool_input: { command: "go test ./..." } }),
      );

      expect(readState()?.phase).toBe("green");
    });

    it("writes green state for pytest", async () => {
      await runHook(
        JSON.stringify({ tool_input: { command: "pytest tests/" } }),
      );

      expect(readState()?.phase).toBe("green");
    });
  });

  describe("when command is not a test command", () => {
    it("does not write state for echo", async () => {
      const { exitCode } = await runHook(
        JSON.stringify({ tool_input: { command: "echo hello" } }),
      );

      expect(exitCode).toBe(0);
      expect(readState()).toBeNull();
    });

    it("does not write state for bun run build", async () => {
      await runHook(
        JSON.stringify({ tool_input: { command: "bun run build" } }),
      );

      expect(readState()).toBeNull();
    });

    it("does not write state for empty command", async () => {
      await runHook(JSON.stringify({ tool_input: { command: "" } }));

      expect(readState()).toBeNull();
    });
  });

  describe("when TDD_PHASE is red (PostToolUseFailure)", () => {
    it("writes red state for failing bun test", async () => {
      await runHook(JSON.stringify({ tool_input: { command: "bun test" } }), {
        TDD_PHASE: "red",
      });

      expect(readState()?.phase).toBe("red");
    });

    it("writes red state for failing pytest", async () => {
      await runHook(
        JSON.stringify({ tool_input: { command: "pytest tests/" } }),
        { TDD_PHASE: "red" },
      );

      expect(readState()?.phase).toBe("red");
    });

    it("does not write state for non-test command even with TDD_PHASE=red", async () => {
      await runHook(JSON.stringify({ tool_input: { command: "echo hello" } }), {
        TDD_PHASE: "red",
      });

      expect(readState()).toBeNull();
    });
  });

  describe("when input is invalid", () => {
    it("exits silently on invalid JSON", async () => {
      const { exitCode } = await runHook("not json");

      expect(exitCode).toBe(0);
      expect(readState()).toBeNull();
    });

    it("exits silently on missing tool_input", async () => {
      const { exitCode } = await runHook(JSON.stringify({}));

      expect(exitCode).toBe(0);
      expect(readState()).toBeNull();
    });
  });
});
