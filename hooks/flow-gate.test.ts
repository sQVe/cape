import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "fs";
import { tmpdir } from "os";

const hookPath = join(import.meta.dir, "flow-gate.ts");

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const runHook = async (
  skillName: string,
  env: Record<string, string> = {},
): Promise<HookResult> => {
  const proc = Bun.spawn(["bun", "run", hookPath], {
    stdin: new Blob([JSON.stringify({ tool_input: { skill: skillName } })]),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
};

const runHookRaw = async (
  stdin: string,
  env: Record<string, string> = {},
): Promise<HookResult> => {
  const proc = Bun.spawn(["bun", "run", hookPath], {
    stdin: new Blob([stdin]),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
};

const parseDeny = (stdout: string) => {
  if (!stdout.trim()) {
    return null;
  }
  return JSON.parse(stdout.trim());
};

const expectDeny = (result: HookResult, reasonSubstring: string) => {
  expect(result.exitCode).toBe(0);
  const parsed = parseDeny(result.stdout);
  expect(parsed).not.toBeNull();
  expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
  expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain(
    reasonSubstring,
  );
};

const expectPass = (result: HookResult) => {
  expect(result.exitCode).toBe(0);
  expect(result.stdout.trim()).toBe("");
};

const createMockBr = (
  tmpDir: string,
  handler: string,
): Record<string, string> => {
  const binDir = join(tmpDir, "bin");
  mkdirSync(binDir, { recursive: true });
  const script = `#!/usr/bin/env bash\n${handler}`;
  const scriptPath = join(binDir, "br");
  writeFileSync(scriptPath, script);
  chmodSync(scriptPath, 0o755);
  return { PATH: `${binDir}:${process.env.PATH}` };
};

describe("flow-gate", () => {
  describe("non-gated skills", () => {
    it("allows commit skill", async () => {
      const result = await runHook("cape:commit");

      expectPass(result);
    });

    it("allows review skill", async () => {
      const result = await runHook("cape:review");

      expectPass(result);
    });

    it("allows beads skill", async () => {
      const result = await runHook("cape:beads");

      expectPass(result);
    });

    it("allows branch skill", async () => {
      const result = await runHook("cape:branch");

      expectPass(result);
    });

    it("allows brainstorm skill", async () => {
      const result = await runHook("cape:brainstorm");

      expectPass(result);
    });

    it("allows write-plan skill", async () => {
      const result = await runHook("cape:write-plan");

      expectPass(result);
    });
  });

  describe("invalid input", () => {
    it("allows on invalid JSON", async () => {
      const result = await runHookRaw("not json");

      expectPass(result);
    });

    it("allows when skill field is missing", async () => {
      const result = await runHookRaw(
        JSON.stringify({ tool_input: { command: "echo" } }),
      );

      expectPass(result);
    });

    it("allows when tool_input is missing", async () => {
      const result = await runHookRaw(JSON.stringify({ other: "data" }));

      expectPass(result);
    });
  });

  describe("execute-plan gate", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "cape-flow-gate-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("denies when no open epic exists", async () => {
      const env = createMockBr(tmpDir, 'echo ""');
      const result = await runHook("cape:execute-plan", env);

      expectDeny(result, "brainstorm");
    });

    it("denies when epic exists but no ready tasks", async () => {
      const handler = `
if [[ "\$*" == *"list"*"--type"*"epic"* ]]; then
  echo "○ cape-1 [● P1] [epic] - My Epic"
elif [[ "\$*" == *"ready"* ]]; then
  echo ""
fi
`;
      const env = createMockBr(tmpDir, handler);
      const result = await runHook("cape:execute-plan", env);

      expectDeny(result, "ready");
    });

    it("allows when epic and ready tasks exist", async () => {
      const handler = `
if [[ "\$*" == *"list"*"--type"*"epic"* ]]; then
  echo "○ cape-1 [● P1] [epic] - My Epic"
elif [[ "\$*" == *"ready"* ]]; then
  echo "1. [● P1] [task] cape-1.1: Do something"
fi
`;
      const env = createMockBr(tmpDir, handler);
      const result = await runHook("cape:execute-plan", env);

      expectPass(result);
    });
  });

  describe("finish-epic gate", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "cape-flow-gate-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("denies when open epic has open tasks", async () => {
      const epicStatus = JSON.stringify([
        {
          epic: { id: "cape-1" },
          total_children: 3,
          closed_children: 1,
        },
      ]);
      const env = createMockBr(tmpDir, `echo '${epicStatus}'`);
      const result = await runHook("cape:finish-epic", env);

      expectDeny(result, "open task");
    });

    it("allows when all tasks under epic are closed", async () => {
      const epicStatus = JSON.stringify([
        {
          epic: { id: "cape-1" },
          total_children: 3,
          closed_children: 3,
        },
      ]);
      const env = createMockBr(tmpDir, `echo '${epicStatus}'`);
      const result = await runHook("cape:finish-epic", env);

      expectPass(result);
    });
  });

  describe("fix-bug gate", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "cape-flow-gate-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("denies when no open bug exists", async () => {
      const env = createMockBr(tmpDir, 'echo ""');
      const result = await runHook("cape:fix-bug", env);

      expectDeny(result, "debug-issue");
    });

    it("allows when an open bug exists", async () => {
      const env = createMockBr(
        tmpDir,
        'echo "○ cape-5 · Button crash [● P1 · OPEN]"',
      );
      const result = await runHook("cape:fix-bug", env);

      expectPass(result);
    });
  });

  describe("br unavailability", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "cape-flow-gate-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("allows execute-plan when br fails", async () => {
      const env = createMockBr(tmpDir, "exit 1");
      const result = await runHook("cape:execute-plan", env);

      expectPass(result);
    });

    it("allows finish-epic when br fails", async () => {
      const env = createMockBr(tmpDir, "exit 1");
      const result = await runHook("cape:finish-epic", env);

      expectPass(result);
    });

    it("allows fix-bug when br fails", async () => {
      const env = createMockBr(tmpDir, "exit 1");
      const result = await runHook("cape:fix-bug", env);

      expectPass(result);
    });
  });
});
