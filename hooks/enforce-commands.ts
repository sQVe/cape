import { readFileSync } from "fs";
import { brShowLog } from "./paths";

const input = await Bun.stdin.text();

let command = "";
try {
  const data = JSON.parse(input);
  command = data.tool_input?.command ?? "";
} catch {
  process.exit(0);
}

if (!command) {
  process.exit(0);
}

const violations: string[] = [];

const deny = (reason: string) => {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
};

const denyAll = () => {
  if (violations.length > 0) {
    deny(violations.join(" "));
  }
};

const cmdPrefix = /(?:^|&&|\|\||;)\s*/;
const isBrCreate = new RegExp(`${cmdPrefix.source}br\\s+create\\b`).test(
  command,
);
const isBrUpdate = new RegExp(`${cmdPrefix.source}br\\s+update\\b`).test(
  command,
);

// 1: --design does not exist on br create
if (isBrCreate && /--design\b/.test(command)) {
  violations.push(
    "Use `--description` on `br create`, not `--design`. The `--design` flag only works on `br update`.",
  );
}

// 2: br show <id> required before br update --design
if (isBrUpdate && /--design\b/.test(command)) {
  const idMatch = command.match(/\bbr\s+update\s+(\S+)/);
  if (idMatch) {
    const id = idMatch[1];
    let recentShows: string[] = [];
    try {
      recentShows = readFileSync(brShowLog, "utf-8")
        .trim()
        .split("\n")
        .filter(Boolean);
    } catch {
      // no log yet
    }
    const hasRecentShow = recentShows.some((line) => line.trim() === id);
    if (!hasRecentShow) {
      deny(
        `Run \`br show ${id}\` first to read existing content before \`br update --design\`.`,
      );
    }
  }
}

// 3: br create missing --type or --priority
if (isBrCreate) {
  if (!/--type\b|(?:^|\s)-t(?:\s|$)/.test(command)) {
    violations.push(
      "Add `--type` to `br create` (epic, task, bug, or feature).",
    );
  }
  if (!/--priority\b|(?:^|\s)-p(?:\s|$)/.test(command)) {
    violations.push("Add `--priority` to `br create` (0-4).");
  }
}

// 4: description header validation per type
if (isBrCreate && /--description\b/.test(command)) {
  const typeMatch = command.match(/(?:--type\s+|(?:^|\s)-t\s+)(\w+)/);
  const type = typeMatch?.[1];

  if (type === "task") {
    if (!/##\s*Goal/i.test(command)) {
      violations.push("Task descriptions need a `## Goal` header.");
    }
    if (!/##\s*Behaviors/i.test(command)) {
      violations.push(
        "Task descriptions need a `## Behaviors` header listing one behavior per TDD cycle.",
      );
    }
    if (!/##\s*Success criteria/i.test(command)) {
      violations.push(
        "Task descriptions need a `## Success criteria` header.",
      );
    }
  } else if (type === "bug") {
    if (
      !/##\s*Reproduction steps/i.test(command) &&
      !/##\s*Evidence/i.test(command)
    ) {
      violations.push(
        "Bug descriptions need a `## Reproduction steps` or `## Evidence` header.",
      );
    }
  } else if (type === "epic") {
    if (!/##\s*Requirements/i.test(command)) {
      violations.push("Epic descriptions need a `## Requirements` header.");
    }
    if (!/##\s*Success criteria/i.test(command)) {
      violations.push(
        "Epic descriptions need a `## Success criteria` header.",
      );
    }
  }
}

// 5: --status in-progress (hyphen) or --status done
if (isBrUpdate) {
  if (/--status\s+in-progress\b/.test(command)) {
    deny(
      "Use `--status in_progress` (underscore), not `--status in-progress` (hyphen).",
    );
  }
  if (/--status\s+done\b/.test(command)) {
    deny("Use `br close <id>` to complete an issue, not `--status done`.");
  }
}

// 6: git add . or git add -A / --all
if (/\bgit\s+add\s+\.(?:\s|$|;|&&|\|)/.test(command)) {
  deny("Stage specific files instead of `git add .`.");
}
if (/\bgit\s+add\s+(?:-A|--all)\b/.test(command)) {
  deny("Stage specific files instead of `git add -A`.");
}

// 7 & 8: gh pr create from main/master or with uncommitted changes
if (/\bgh\s+pr\s+create\b/.test(command)) {
  try {
    const branchResult = Bun.spawnSync(
      ["git", "rev-parse", "--abbrev-ref", "HEAD"],
      { timeout: 3000 },
    );
    const branch = branchResult.stdout.toString().trim();
    const defaultBranchResult = Bun.spawnSync(
      ["git", "symbolic-ref", "refs/remotes/origin/HEAD"],
      { timeout: 3000 },
    );
    const defaultBranch =
      defaultBranchResult.stdout
        .toString()
        .trim()
        .replace(/^refs\/remotes\/origin\//, "") || "main";
    if (branch === defaultBranch) {
      deny(
        `Cannot create a PR from \`${branch}\`. Create a feature branch first.`,
      );
    }
  } catch {
    // git not available — skip
  }

  try {
    const statusResult = Bun.spawnSync(["git", "status", "--short"], {
      timeout: 3000,
    });
    const status = statusResult.stdout.toString().trim();
    if (status) {
      deny(
        "Uncommitted changes detected. Commit changes before creating a PR.",
      );
    }
  } catch {
    // git not available — skip
  }
}

// 9: --labels missing on br create
if (isBrCreate && !/--labels\b|(?:^|\s)-l(?:\s|$)/.test(command)) {
  violations.push("Add `--labels` to `br create` for categorization.");
}

denyAll();
