import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const hookPath = join(import.meta.dir, "user-prompt-submit.ts");

const runHook = async (input: string): Promise<{ decision: string; additionalContext?: string }> => {
  const proc = Bun.spawn(["bun", "run", hookPath], {
    stdin: new TextEncoder().encode(input),
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  const output = await new Response(proc.stdout).text();
  return JSON.parse(output.trim());
};

describe("user-prompt-submit", () => {
  describe("empty prompt", () => {
    it("should approve with no additional context", async () => {
      const result = await runHook(JSON.stringify({ prompt: "" }));

      expect(result).toEqual({ decision: "approve" });
    });

    it("should approve when prompt field is missing", async () => {
      const result = await runHook(JSON.stringify({}));

      expect(result).toEqual({ decision: "approve" });
    });
  });

  describe("beads detection", () => {
    it("should add cape:beads skill for br mentions", async () => {
      const result = await runHook(JSON.stringify({ prompt: "show br issues" }));

      expect(result.decision).toBe("approve");
      expect(result.additionalContext).toContain("cape:beads");
    });

    it("should add cape:beads skill for beads mentions", async () => {
      const result = await runHook(JSON.stringify({ prompt: "create a bead" }));

      expect(result.decision).toBe("approve");
      expect(result.additionalContext).toContain("cape:beads");
    });

    it("should add cape:beads skill for issue tracking", async () => {
      const result = await runHook(JSON.stringify({ prompt: "track this bug" }));

      expect(result.decision).toBe("approve");
      expect(result.additionalContext).toContain("cape:beads");
    });

    it("should add cape:beads skill for gap tracking", async () => {
      const result = await runHook(JSON.stringify({ prompt: "track these gaps" }));

      expect(result.decision).toBe("approve");
      expect(result.additionalContext).toContain("cape:beads");
    });

    it("should not add beads for split/merge/archive br operations", async () => {
      const result = await runHook(JSON.stringify({ prompt: "split br-123 into subtasks" }));

      expect(result.decision).toBe("approve");
      expect(result.additionalContext ?? "").not.toContain("cape:beads");
    });

    it("should add cape:beads skill for what task next", async () => {
      const result = await runHook(JSON.stringify({ prompt: "what task should I work on next" }));

      expect(result.decision).toBe("approve");
      expect(result.additionalContext).toContain("cape:beads");
    });
  });

  describe("TDD enforcement", () => {
    let tmpDir: string;

    afterEach(() => {
      if (tmpDir) {
        rmSync(tmpDir, { recursive: true, force: true });
        tmpDir = "";
      }
    });

    it("should inject TDD context when in-progress tasks exist", async () => {
      tmpDir = mkdtempSync(join(tmpdir(), "cape-tdd-"));
      const fakeBr = join(tmpDir, "br");
      writeFileSync(
        fakeBr,
        '#!/bin/sh\necho "cape-abc  task  in_progress  Do the thing"',
        { mode: 0o755 },
      );

      const proc = Bun.spawn(["bun", "run", hookPath], {
        stdin: new TextEncoder().encode(
          JSON.stringify({ prompt: "implement the feature" }),
        ),
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, PATH: `${tmpDir}:${process.env.PATH}` },
      });
      await proc.exited;
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());

      expect(result.additionalContext).toContain("tdd-enforcement");
    });

    it("should not inject TDD context when no in-progress tasks", async () => {
      tmpDir = mkdtempSync(join(tmpdir(), "cape-tdd-"));
      const fakeBr = join(tmpDir, "br");
      writeFileSync(fakeBr, "#!/bin/sh\n", { mode: 0o755 });

      const proc = Bun.spawn(["bun", "run", hookPath], {
        stdin: new TextEncoder().encode(
          JSON.stringify({ prompt: "implement the feature" }),
        ),
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, PATH: `${tmpDir}:${process.env.PATH}` },
      });
      await proc.exited;
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());

      expect(result).toEqual({ decision: "approve" });
    });

    it("should not crash when br is unavailable", async () => {
      const result = await runHook(JSON.stringify({ prompt: "some unrelated prompt" }));

      expect(result.decision).toBe("approve");
    });
  });

  describe("combined output", () => {
    it("should include skills in additionalContext", async () => {
      const result = await runHook(JSON.stringify({ prompt: "show br issues" }));

      expect(result.decision).toBe("approve");
      expect(result.additionalContext).toContain("cape:beads");
      expect(result.additionalContext).toContain("Use the following skill(s):");
    });
  });
});
