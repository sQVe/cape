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

  describe("flow-context injection", () => {
    let tmpDir: string;

    afterEach(() => {
      if (tmpDir) {
        rmSync(tmpDir, { recursive: true, force: true });
        tmpDir = "";
      }
    });

    const runWithMockBr = async (script: string, prompt = "hello") => {
      tmpDir = mkdtempSync(join(tmpdir(), "cape-flow-"));
      writeFileSync(join(tmpDir, "br"), `#!/bin/sh\n${script}`, { mode: 0o755 });

      const proc = Bun.spawn(["bun", "run", hookPath], {
        stdin: new TextEncoder().encode(JSON.stringify({ prompt })),
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, PATH: `${tmpDir}:${process.env.PATH}` },
      });
      await proc.exited;
      const output = await new Response(proc.stdout).text();
      return JSON.parse(output.trim());
    };

    it("should inject idle phase when no br output", async () => {
      const result = await runWithMockBr("");

      expect(result.additionalContext).toContain("<flow-context>");
      expect(result.additionalContext).toContain("idle");
    });

    it("should inject executing phase when in-progress task exists", async () => {
      const script = `case "$*" in
  *"in_progress"*) echo "cape-abc task in_progress Do the thing" ;;
esac`;
      const result = await runWithMockBr(script);

      expect(result.additionalContext).toContain("<flow-context>");
      expect(result.additionalContext).toContain("executing");
    });

    it("should inject debugging phase when open bug exists", async () => {
      const script = `case "$*" in
  *"--type bug"*) echo "cape-bug1 bug open Something broke" ;;
esac`;
      const result = await runWithMockBr(script);

      expect(result.additionalContext).toContain("<flow-context>");
      expect(result.additionalContext).toContain("debugging");
    });

    it("should inject planning phase when open epic but no in-progress task", async () => {
      const script = `case "$*" in
  *"--type epic"*) echo "cape-epic1 epic open Build feature" ;;
esac`;
      const result = await runWithMockBr(script);

      expect(result.additionalContext).toContain("<flow-context>");
      expect(result.additionalContext).toContain("planning");
    });

    it("should prioritize debugging over executing", async () => {
      const script = `case "$*" in
  *"--type bug"*) echo "cape-bug1 bug open Something broke" ;;
  *"in_progress"*) echo "cape-abc task in_progress Do the thing" ;;
esac`;
      const result = await runWithMockBr(script);

      expect(result.additionalContext).toContain("debugging");
      expect(result.additionalContext).not.toContain("executing");
    });

    it("should not inject flow-context when br is unavailable", async () => {
      tmpDir = mkdtempSync(join(tmpdir(), "cape-flow-"));
      writeFileSync(join(tmpDir, "br"), "#!/bin/sh\nexit 1", { mode: 0o755 });

      const proc = Bun.spawn(["bun", "run", hookPath], {
        stdin: new TextEncoder().encode(JSON.stringify({ prompt: "hello" })),
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, PATH: `${tmpDir}:${process.env.PATH}` },
      });
      await proc.exited;
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());

      expect(result.additionalContext ?? "").not.toContain("flow-context");
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
