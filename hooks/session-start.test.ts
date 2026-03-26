import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";
import { tmpdir } from "os";

const hookPath = resolve(import.meta.dir, "session-start.ts");

let tempDir: string;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("session-start", () => {
  describe("when SKILL.md exists", () => {
    it("should output SKILL.md content as additionalContext", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-session-start-"));
      mkdirSync(resolve(tempDir, "skills/don-cape"), { recursive: true });
      writeFileSync(resolve(tempDir, "skills/don-cape/SKILL.md"), "test skill content");

      const proc = Bun.spawn(["bun", "run", hookPath], {
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: tempDir },
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      const result = JSON.parse(stdout);
      expect(result.additionalContext).toContain("test skill content");
      expect(result.additionalContext).toContain("skills/don-cape/SKILL.md");
    });

    it("should exit with code 0 when SKILL.md exists", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-session-start-"));
      mkdirSync(resolve(tempDir, "skills/don-cape"), { recursive: true });
      writeFileSync(resolve(tempDir, "skills/don-cape/SKILL.md"), "content");

      const proc = Bun.spawn(["bun", "run", hookPath], {
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: tempDir },
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    });
  });

  describe("when SKILL.md is missing", () => {
    it("should output fallback message", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-session-start-"));

      const proc = Bun.spawn(["bun", "run", hookPath], {
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: tempDir },
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      const result = JSON.parse(stdout);
      expect(result.additionalContext).toBe("cape plugin loaded.");
    });

    it("should exit with code 0 when SKILL.md is missing", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-session-start-"));

      const proc = Bun.spawn(["bun", "run", hookPath], {
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: tempDir },
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    });
  });

  describe("log clearing", () => {
    it("should clear br-show-log.txt when CAPE_CLEAR_LOGS is set", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-session-start-"));
      mkdirSync(resolve(tempDir, "skills/don-cape"), { recursive: true });
      writeFileSync(resolve(tempDir, "skills/don-cape/SKILL.md"), "content");
      mkdirSync(resolve(tempDir, "hooks/context"), { recursive: true });
      writeFileSync(resolve(tempDir, "hooks/context/br-show-log.txt"), "cape-123\n");

      const proc = Bun.spawn(["bun", "run", hookPath], {
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: tempDir, CAPE_CLEAR_LOGS: "1" },
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;

      const content = readFileSync(resolve(tempDir, "hooks/context/br-show-log.txt"), "utf-8");
      expect(content).toBe("");
    });

    it("should preserve br-show-log.txt when CAPE_CLEAR_LOGS is not set", async () => {
      tempDir = mkdtempSync(resolve(tmpdir(), "cape-session-start-"));
      mkdirSync(resolve(tempDir, "skills/don-cape"), { recursive: true });
      writeFileSync(resolve(tempDir, "skills/don-cape/SKILL.md"), "content");
      mkdirSync(resolve(tempDir, "hooks/context"), { recursive: true });
      writeFileSync(resolve(tempDir, "hooks/context/br-show-log.txt"), "cape-123\n");

      const { CAPE_CLEAR_LOGS: _, ...env } = process.env;
      const proc = Bun.spawn(["bun", "run", hookPath], {
        env: { ...env, CLAUDE_PLUGIN_ROOT: tempDir },
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;

      const content = readFileSync(resolve(tempDir, "hooks/context/br-show-log.txt"), "utf-8");
      expect(content).toBe("cape-123\n");
    });
  });
});
