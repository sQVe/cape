import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const hookPath = join(import.meta.dir, "enforce-commands.ts");

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const runHook = async (
  command: string,
  env: Record<string, string> = {},
): Promise<HookResult> => {
  const proc = Bun.spawn(["bun", "run", hookPath], {
    stdin: new Blob([JSON.stringify({ tool_input: { command } })]),
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

describe("enforce-commands", () => {
  describe("non-br commands", () => {
    it("should pass through echo hello", async () => {
      const result = await runHook("echo hello");

      expectPass(result);
    });

    it("should pass through arbitrary non-matching commands", async () => {
      const result = await runHook("ls -la /tmp");

      expectPass(result);
    });
  });

  describe("invalid JSON / empty input", () => {
    it("should exit 0 on invalid JSON", async () => {
      const proc = Bun.spawn(["bun", "run", hookPath], {
        stdin: new Blob(["not json"]),
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe("");
    });
  });

  describe("rule 1: --design on br create", () => {
    it("should deny --design flag on br create", async () => {
      const result = await runHook("br create --design foo");

      expectDeny(result, "--description");
    });

    it("should not deny --description on br create", async () => {
      const result = await runHook(
        'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
      );

      expectPass(result);
    });
  });

  describe("rule 2: br show required before br update --design", () => {
    let tmpDir: string;
    let contextDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "cape-test-"));
      contextDir = join(tmpDir, "hooks", "context");
      mkdirSync(contextDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should deny br update --design without prior br show", async () => {
      const result = await runHook("br update foo-123 --design bar", {
        CLAUDE_PLUGIN_ROOT: tmpDir,
      });

      expectDeny(result, "br show foo-123");
    });

    it("should not deny br update --design when id is in br-show-log.txt", async () => {
      writeFileSync(join(contextDir, "br-show-log.txt"), "foo-123\n");

      const result = await runHook("br update foo-123 --design bar", {
        CLAUDE_PLUGIN_ROOT: tmpDir,
      });

      expectPass(result);
    });
  });

  describe("rule 3: br create missing --type or --priority", () => {
    it("should deny when --type is missing", async () => {
      const result = await runHook("br create --title foo");

      expectDeny(result, "--type");
    });

    it("should deny when --priority is missing", async () => {
      const result = await runHook("br create --type task --title foo");

      expectDeny(result, "--priority");
    });

    it("should not deny when both --type and --priority are present", async () => {
      const result = await runHook(
        'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
      );

      expectPass(result);
    });
  });

  describe("short flags", () => {
    it("should accept -t -p -l short flags", async () => {
      const result = await runHook(
        'br create -t task -p 2 -l foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
      );

      expectPass(result);
    });

    it("should accept mixed short and long flags", async () => {
      const result = await runHook(
        'br create --type task -p 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
      );

      expectPass(result);
    });
  });

  describe("rule 4: description header validation", () => {
    it("should deny task without ## Goal", async () => {
      const result = await runHook(
        'br create --type task --priority 2 --labels foo --description "## Success criteria\nThing done"',
      );

      expectDeny(result, "## Goal");
    });

    it("should deny task without ## Success criteria", async () => {
      const result = await runHook(
        'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X"',
      );

      expectDeny(result, "## Success criteria");
    });

    it("should deny bug without ## Reproduction steps or ## Evidence", async () => {
      const result = await runHook(
        'br create --type bug --priority 2 --labels foo --description "## Summary\nBroken"',
      );

      expectDeny(result, "## Reproduction steps");
    });

    it("should not deny bug with ## Reproduction steps", async () => {
      const result = await runHook(
        'br create --type bug --priority 2 --labels foo --description "## Reproduction steps\nSteps here"',
      );

      expectPass(result);
    });

    it("should not deny bug with ## Evidence", async () => {
      const result = await runHook(
        'br create --type bug --priority 2 --labels foo --description "## Evidence\nScreenshot here"',
      );

      expectPass(result);
    });

    it("should deny epic without ## Requirements", async () => {
      const result = await runHook(
        'br create --type epic --priority 2 --labels foo --description "## Success criteria\nDone"',
      );

      expectDeny(result, "## Requirements");
    });

    it("should deny epic without ## Success criteria", async () => {
      const result = await runHook(
        'br create --type epic --priority 2 --labels foo --description "## Requirements\nNeeds this"',
      );

      expectDeny(result, "## Success criteria");
    });

    it("should deny task without ## Behaviors", async () => {
      const result = await runHook(
        'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Success criteria\nThing done"',
      );

      expectDeny(result, "## Behaviors");
    });

    it("should not deny valid task with all required headers", async () => {
      const result = await runHook(
        'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
      );

      expectPass(result);
    });
  });

  describe("rule 5: --status in-progress (hyphen) on br update", () => {
    it("should deny --status in-progress with hyphen", async () => {
      const result = await runHook("br update foo --status in-progress");

      expectDeny(result, "in_progress");
    });

    it("should not deny --status in_progress with underscore", async () => {
      const result = await runHook("br update foo --status in_progress");

      expectPass(result);
    });
  });

  describe("rule 6: --status done on br update", () => {
    it("should deny --status done", async () => {
      const result = await runHook("br update foo --status done");

      expectDeny(result, "br close");
    });
  });

  describe("rule 7: git add .", () => {
    it("should deny git add .", async () => {
      const result = await runHook("git add .");

      expectDeny(result, "git add .");
    });

    it("should deny git add -A", async () => {
      const result = await runHook("git add -A");

      expectDeny(result, "git add -A");
    });

    it("should deny git add --all", async () => {
      const result = await runHook("git add --all");

      expectDeny(result, "git add -A");
    });

    it("should not deny git add with specific file", async () => {
      const result = await runHook("git add specific-file.ts");

      expectPass(result);
    });
  });

  describe("rule 8: gh pr create checks", () => {
    it("should pass through gh pr create when on non-main branch with no uncommitted changes", async () => {
      const result = await runHook("gh pr create");

      expect(result.exitCode).toBe(0);
      const parsed = parseDeny(result.stdout);
      if (parsed !== null) {
        const reason: string =
          parsed.hookSpecificOutput.permissionDecisionReason;
        expect(
          reason.includes("Cannot create a PR from") ||
            reason.includes("Uncommitted changes"),
        ).toBe(true);
      }
    });
  });

  describe("rule 9: br create missing --labels", () => {
    it("should deny when --labels is missing", async () => {
      const result = await runHook(
        'br create --type task --priority 2 --description "## Goal\nDo\n## Behaviors\n- Adds X\n## Success criteria\nDone"',
      );

      expectDeny(result, "--labels");
    });

    it("should not deny when --labels is present", async () => {
      const result = await runHook(
        'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
      );

      expectPass(result);
    });
  });

  describe("full pass-through", () => {
    it("should exit 0 with no output for a fully valid br create command", async () => {
      const result = await runHook(
        'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
      );

      expectPass(result);
    });
  });
});
