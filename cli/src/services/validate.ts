import type { Effect } from 'effect';
import { ServiceMap } from 'effect';

export interface ValidateResult {
  readonly file: string;
  readonly valid: boolean;
  readonly errors: string[];
}

export const parseFrontmatter = (content: string): Record<string, string> | null => {
  if (!content.startsWith('---\n')) {
    return null;
  }
  const closing = content.indexOf('\n---\n', 4);
  if (closing === -1) {
    return null;
  }

  const block = content.slice(4, closing);
  const fields: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentValue: string[] = [];

  for (const line of block.split('\n')) {
    const match = line.match(/^(\w+):\s*(.*)/);
    if (match) {
      if (currentKey != null) {
        fields[currentKey] = currentValue.join(' ').trim();
      }
      currentKey = match[1] ?? null;
      currentValue = match[2] ? [match[2]] : [];
    } else if (currentKey != null && /^\s+/.test(line)) {
      currentValue.push(line.trim());
    }
  }
  if (currentKey != null) {
    fields[currentKey] = currentValue.join(' ').trim();
  }
  return fields;
};

const hasTag = (content: string, tag: string): boolean =>
  content.includes(`<${tag}>`) && content.includes(`</${tag}>`);

const tagHasContent = (content: string, tag: string): boolean => {
  const open = content.indexOf(`<${tag}>`);
  const close = content.indexOf(`</${tag}>`, open);
  if (open === -1 || close === -1) {
    return false;
  }
  const inner = content.slice(open + tag.length + 2, close).trim();
  return inner.length > 0;
};

const hasHeading = (content: string, heading: string): boolean =>
  content.split('\n').some((line) => line.startsWith(heading));

export const validateSkillContent = (file: string, content: string): ValidateResult => {
  const errors: string[] = [];
  const frontmatter = parseFrontmatter(content);

  if (frontmatter == null) {
    errors.push('Missing YAML frontmatter');
  } else {
    if (!frontmatter.name) {
      errors.push('Missing frontmatter field: name');
    }
    if (!frontmatter.description) {
      errors.push('Missing frontmatter field: description');
    }
  }

  const requiredTags = ['skill_overview', 'rigidity_level', 'when_to_use', 'critical_rules'];
  for (const tag of requiredTags) {
    if (!hasTag(content, tag)) {
      errors.push(`Missing required tag: <${tag}>`);
    } else if (!tagHasContent(content, tag)) {
      errors.push(`Empty tag: <${tag}>`);
    }
  }

  return { file, valid: errors.length === 0, errors };
};

export const validateAgentContent = (file: string, content: string): ValidateResult => {
  const errors: string[] = [];
  const frontmatter = parseFrontmatter(content);

  if (frontmatter == null) {
    errors.push('Missing YAML frontmatter');
  } else {
    if (!frontmatter.name) {
      errors.push('Missing frontmatter field: name');
    }
    if (!frontmatter.description) {
      errors.push('Missing frontmatter field: description');
    }
    if (!frontmatter.model) {
      errors.push('Missing frontmatter field: model');
    }
  }

  if (
    !hasHeading(content, '## Investigation approach') &&
    !hasHeading(content, '## Research approach')
  ) {
    errors.push('Missing heading: ## Investigation approach (or ## Research approach)');
  }

  if (!hasHeading(content, '## Scale by scope') && !hasHeading(content, '## Source tiers')) {
    errors.push('Missing heading: ## Scale by scope (or ## Source tiers)');
  }

  return { file, valid: errors.length === 0, errors };
};

export const validateCommandContent = (file: string, content: string): ValidateResult => {
  const errors: string[] = [];
  const frontmatter = parseFrontmatter(content);

  if (frontmatter == null) {
    errors.push('Missing YAML frontmatter');
  } else {
    if (!frontmatter.description) {
      errors.push('Missing frontmatter field: description');
    }
  }

  if (!content.includes('Use the cape:')) {
    errors.push("Body must reference a skill (expected 'Use the cape:' pattern)");
  }

  return { file, valid: errors.length === 0, errors };
};

export const inferFileType = (path: string): 'skill' | 'agent' | 'command' | null => {
  if (/skills\/[^/]+\/SKILL\.md$/.test(path)) {
    return 'skill';
  }
  if (/agents\/[^/]+\.md$/.test(path)) {
    return 'agent';
  }
  if (/commands\/[^/]+\.md$/.test(path)) {
    return 'command';
  }
  return null;
};

export class ValidateService extends ServiceMap.Service<
  ValidateService,
  {
    readonly globFiles: (pattern: string) => Effect.Effect<string[]>;
    readonly readFile: (path: string) => Effect.Effect<string>;
    readonly gitRoot: () => Effect.Effect<string>;
  }
>()('ValidateService') {}
