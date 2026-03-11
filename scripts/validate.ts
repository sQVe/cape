#!/usr/bin/env bun

import { readFileSync, existsSync } from "fs";
import { resolve, relative } from "path";
import { execSync } from "child_process";

const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const RESET = "\x1b[0m";

interface Result {
  file: string;
  errors: string[];
}

const results: Result[] = [];

let root: string;
try {
  root = execSync("git rev-parse --show-toplevel", {
    encoding: "utf-8",
  }).trim();
} catch {
  console.error("Not a git repository");
  process.exit(1);
}
process.chdir(root);

function parseFrontmatter(content: string): Record<string, string> | null {
  if (!content.startsWith("---\n")) return null;
  const closing = content.indexOf("\n---\n", 4);
  if (closing === -1) return null;

  const block = content.slice(4, closing);
  const fields: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentValue: string[] = [];

  for (const line of block.split("\n")) {
    const match = line.match(/^(\w+):\s*(.*)/);
    if (match) {
      if (currentKey != null) {
        fields[currentKey] = currentValue.join(" ").trim();
      }
      currentKey = match[1];
      currentValue = match[2] ? [match[2]] : [];
    } else if (currentKey != null && line.match(/^\s+/)) {
      currentValue.push(line.trim());
    }
  }
  if (currentKey != null) {
    fields[currentKey] = currentValue.join(" ").trim();
  }
  return fields;
}

function hasTag(content: string, tag: string): boolean {
  return content.includes(`<${tag}>`) && content.includes(`</${tag}>`);
}

function tagHasContent(content: string, tag: string): boolean {
  const open = content.indexOf(`<${tag}>`);
  const close = content.indexOf(`</${tag}>`, open);
  if (open === -1 || close === -1) return false;
  const inner = content.slice(open + tag.length + 2, close).trim();
  return inner.length > 0;
}

function hasHeading(content: string, heading: string): boolean {
  return content.split("\n").some((line) => line.startsWith(heading));
}

function validateSkill(file: string): Result {
  const content = readFileSync(file, "utf-8");
  const errors: string[] = [];

  const frontmatter = parseFrontmatter(content);
  if (frontmatter == null) {
    errors.push("Missing YAML frontmatter");
  } else {
    if (!frontmatter.name) errors.push("Missing frontmatter field: name");
    if (!frontmatter.description)
      errors.push("Missing frontmatter field: description");
  }

  const requiredTags = [
    "skill_overview",
    "rigidity_level",
    "when_to_use",
    "critical_rules",
  ];
  for (const tag of requiredTags) {
    if (!hasTag(content, tag)) {
      errors.push(`Missing required tag: <${tag}>`);
    } else if (!tagHasContent(content, tag)) {
      errors.push(`Empty tag: <${tag}>`);
    }
  }

  return { file, errors };
}

function validateAgent(file: string): Result {
  const content = readFileSync(file, "utf-8");
  const errors: string[] = [];

  const frontmatter = parseFrontmatter(content);
  if (frontmatter == null) {
    errors.push("Missing YAML frontmatter");
  } else {
    if (!frontmatter.name) errors.push("Missing frontmatter field: name");
    if (!frontmatter.description)
      errors.push("Missing frontmatter field: description");
    if (!frontmatter.model) errors.push("Missing frontmatter field: model");
  }

  // Accepted variants for the methodology heading
  if (
    !hasHeading(content, "## Investigation approach") &&
    !hasHeading(content, "## Research approach")
  ) {
    errors.push(
      "Missing heading: ## Investigation approach (or ## Research approach)",
    );
  }

  // Accepted variants for the scope-scaling heading
  if (
    !hasHeading(content, "## Scale by scope") &&
    !hasHeading(content, "## Source tiers")
  ) {
    errors.push("Missing heading: ## Scale by scope (or ## Source tiers)");
  }

  return { file, errors };
}

function validateCommand(file: string): Result {
  const content = readFileSync(file, "utf-8");
  const errors: string[] = [];

  const frontmatter = parseFrontmatter(content);
  if (frontmatter == null) {
    errors.push("Missing YAML frontmatter");
  } else {
    if (!frontmatter.description)
      errors.push("Missing frontmatter field: description");
  }

  if (!content.includes("Use the cape:")) {
    errors.push(
      "Body must reference a skill (expected 'Use the cape:' pattern)",
    );
  }

  return { file, errors };
}

function glob(pattern: string): string[] {
  const g = new Bun.Glob(pattern);
  return Array.from(g.scanSync("."));
}

function validateByType(type: string) {
  if (type === "all" || type === "skills") {
    for (const file of glob("skills/*/SKILL.md"))
      results.push(validateSkill(file));
  }
  if (type === "all" || type === "agents") {
    for (const file of glob("agents/*.md")) results.push(validateAgent(file));
  }
  if (type === "all" || type === "commands") {
    for (const file of glob("commands/*.md"))
      results.push(validateCommand(file));
  }
}

function validateFile(file: string) {
  if (file.match(/^skills\/[^/]+\/SKILL\.md$/)) {
    results.push(validateSkill(file));
  } else if (file.match(/^agents\/[^/]+\.md$/)) {
    results.push(validateAgent(file));
  } else if (file.match(/^commands\/[^/]+\.md$/)) {
    results.push(validateCommand(file));
  } else {
    console.error(`Unknown file type: ${file}`);
    process.exit(1);
  }
}

const arg = process.argv[2];

const validTypes = ["skills", "agents", "commands"];

if (arg == null) {
  validateByType("all");
} else if (validTypes.includes(arg)) {
  validateByType(arg);
} else if (existsSync(arg)) {
  validateFile(relative(root, resolve(arg)));
} else {
  console.error(`Unknown argument: ${arg}`);
  console.error("Usage: validate.ts [skills|agents|commands|<file>]");
  process.exit(1);
}

let passed = 0;
let failed = 0;

for (const result of results) {
  if (result.errors.length === 0) {
    console.log(`${GREEN}PASS${RESET}  ${result.file}`);
    passed++;
  } else {
    console.log(`${RED}FAIL${RESET}  ${result.file}`);
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
