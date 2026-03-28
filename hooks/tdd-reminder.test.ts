import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const hookPath = join(import.meta.dir, "tdd-reminder.ts");

let tmpDir: string;
let binDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "tdd-reminder-"));
  mkdirSync(join(tmpDir, "hooks", "context"), { recursive: true });
  binDir = join(tmpDir, "bin");
  mkdirSync(binDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

const createMockBr = (output: string) => {
  const script = join(binDir, "br");
  writeFileSync(script, `#!/usr/bin/env bash\necho "${output}"`);
  chmodSync(script, 0o755);
};

const writeState = (phase: string) => {
  writeFileSync(
    join(tmpDir, "hooks", "context", "tdd-state.json"),
    JSON.stringify({ phase, timestamp: Date.now() }),
  );
};

const runHook = async (input: string) => {
  const proc = Bun.spawn(["bun", "run", hookPath], {
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: tmpDir,
      PATH: `${binDir}:${process.env.PATH}`,
    },
    stdout: "pipe",
    stderr: "pipe",
    stdin: new TextEncoder().encode(input),
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  return { exitCode, stdout: stdout.trim() };
};

const parseOutput = (stdout: string) => {
  if (!stdout) {
    return null;
  }
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
};

const editInput = (filePath: string) =>
  JSON.stringify({
    tool_input: {
      file_path: filePath,
      old_string: "old",
      new_string: "new",
    },
  });

describe("tdd-reminder", () => {
  describe("when editing production code during executing phase", () => {
    beforeEach(() => {
      createMockBr("◐ cape-2cz.2 [● P2] [task] - some task");
    });

    it("injects reminder when no test state exists", async () => {
      const { exitCode, stdout } = await runHook(editInput("/src/foo.ts"));
      const result = parseOutput(stdout);

      expect(exitCode).toBe(0);
      expect(result?.additionalContext).toBeDefined();
      expect(result.additionalContext).toContain("test");
    });

    it("injects reminder when tests are green", async () => {
      writeState("green");
      const { stdout } = await runHook(editInput("/src/handler.go"));
      const result = parseOutput(stdout);

      expect(result?.additionalContext).toBeDefined();
    });

    it("does not inject reminder when tests are red", async () => {
      writeState("red");
      const { stdout } = await runHook(editInput("/src/foo.ts"));

      expect(stdout).toBe("");
    });
  });

  describe("when editing test files", () => {
    beforeEach(() => {
      createMockBr("◐ cape-2cz.2 [● P2] [task] - some task");
    });

    it("does not inject reminder for .test.ts files", async () => {
      const { stdout } = await runHook(editInput("/src/foo.test.ts"));

      expect(stdout).toBe("");
    });

    it("does not inject reminder for _test.go files", async () => {
      const { stdout } = await runHook(editInput("/pkg/handler_test.go"));

      expect(stdout).toBe("");
    });

    it("does not inject reminder for _spec.lua files", async () => {
      const { stdout } = await runHook(editInput("/tests/parser_spec.lua"));

      expect(stdout).toBe("");
    });
  });

  describe("when editing non-code files", () => {
    beforeEach(() => {
      createMockBr("◐ cape-2cz.2 [● P2] [task] - some task");
    });

    it("does not inject reminder for .md files", async () => {
      const { stdout } = await runHook(editInput("/README.md"));

      expect(stdout).toBe("");
    });

    it("does not inject reminder for .json files", async () => {
      const { stdout } = await runHook(editInput("/package.json"));

      expect(stdout).toBe("");
    });

    it("does not inject reminder for .yaml files", async () => {
      const { stdout } = await runHook(editInput("/config.yaml"));

      expect(stdout).toBe("");
    });
  });

  describe("when phase is not executing or debugging", () => {
    it("does not inject reminder during idle phase", async () => {
      createMockBr("");
      const { stdout } = await runHook(editInput("/src/foo.ts"));

      expect(stdout).toBe("");
    });

    it("does not inject reminder when br is unavailable", async () => {
      const script = join(binDir, "br");
      writeFileSync(script, "#!/usr/bin/env bash\nexit 1");
      chmodSync(script, 0o755);
      const { stdout } = await runHook(editInput("/src/foo.ts"));

      expect(stdout).toBe("");
    });
  });

  describe("when editing during debugging phase", () => {
    it("injects reminder when no test state exists", async () => {
      createMockBr("● cape-bug1 [● P2] [bug] - some bug");
      const { stdout } = await runHook(editInput("/src/foo.ts"));
      const result = parseOutput(stdout);

      expect(result?.additionalContext).toBeDefined();
    });
  });

  describe("when input is invalid", () => {
    it("exits silently on invalid JSON", async () => {
      const { exitCode, stdout } = await runHook("not json");

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
    });

    it("exits silently on missing file_path", async () => {
      const { exitCode, stdout } = await runHook(
        JSON.stringify({ tool_input: {} }),
      );

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
    });
  });

  describe("when state file is corrupted", () => {
    beforeEach(() => {
      createMockBr("◐ cape-2cz.2 [● P2] [task] - some task");
    });

    it("injects reminder when state file is corrupted", async () => {
      writeFileSync(
        join(tmpDir, "hooks", "context", "tdd-state.json"),
        "corrupted{{{",
      );
      const { exitCode, stdout } = await runHook(editInput("/src/foo.ts"));
      const result = parseOutput(stdout);

      expect(exitCode).toBe(0);
      expect(result?.additionalContext).toBeDefined();
    });
  });

  describe("when state is stale", () => {
    beforeEach(() => {
      createMockBr("◐ cape-2cz.2 [● P2] [task] - some task");
    });

    it("injects reminder when red state is older than 10 minutes", async () => {
      const staleTimestamp = Date.now() - 11 * 60 * 1000;
      writeFileSync(
        join(tmpDir, "hooks", "context", "tdd-state.json"),
        JSON.stringify({ phase: "red", timestamp: staleTimestamp }),
      );
      const { stdout } = await runHook(editInput("/src/foo.ts"));
      const result = parseOutput(stdout);

      expect(result?.additionalContext).toBeDefined();
    });

    it("does not inject reminder when red state is fresh", async () => {
      writeState("red");
      const { stdout } = await runHook(editInput("/src/foo.ts"));

      expect(stdout).toBe("");
    });
  });
});
