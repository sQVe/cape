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

const skillRequiredTags = [
  'skill_overview',
  'rigidity_level',
  'when_to_use',
  'critical_rules',
  'the_process',
  'examples',
  'key_principles',
];

const skillAllKnownTags = [...skillRequiredTags, 'agent_references', 'skill_references', 'anti_batching'];

const checkTagOrdering = (content: string, errors: string[]) => {
  const criticalRulesPos = content.indexOf('<critical_rules>');
  const theProcessPos = content.indexOf('<the_process>');
  if (criticalRulesPos !== -1 && theProcessPos !== -1 && criticalRulesPos > theProcessPos) {
    errors.push('<critical_rules> must appear before <the_process>');
  }
};

const checkDuplicateTags = (content: string, tags: string[], errors: string[]) => {
  for (const tag of tags) {
    const openTag = `<${tag}>`;
    if (content.indexOf(openTag) !== content.lastIndexOf(openTag)) {
      errors.push(`Duplicate tag: <${tag}>`);
    }
  }
};

const checkAgentReferences = (content: string, knownAgents: Set<string>, errors: string[]) => {
  if (!hasTag(content, 'agent_references')) {
    return;
  }
  const agentSection = content.slice(
    content.indexOf('<agent_references>'),
    content.indexOf('</agent_references>'),
  );
  for (const match of agentSection.matchAll(/cape:([a-z][-a-z]*)/g)) {
    const agentName = match[1];
    if (agentName != null && !knownAgents.has(agentName)) {
      errors.push(`References unknown agent: cape:${agentName}`);
    }
  }
};

interface SkillValidateOptions {
  readonly knownAgents?: Set<string>;
}

export const validateSkillContent = (
  file: string,
  content: string,
  options: SkillValidateOptions = {},
): ValidateResult => {
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

  for (const tag of skillRequiredTags) {
    if (!hasTag(content, tag)) {
      errors.push(`Missing required tag: <${tag}>`);
    } else if (!tagHasContent(content, tag)) {
      errors.push(`Empty tag: <${tag}>`);
    }
  }

  checkTagOrdering(content, errors);
  checkDuplicateTags(content, skillAllKnownTags, errors);

  if (options.knownAgents != null) {
    checkAgentReferences(content, options.knownAgents, errors);
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

interface CommandValidateOptions {
  readonly knownSkills?: Set<string>;
}

export const validateCommandContent = (
  file: string,
  content: string,
  options: CommandValidateOptions = {},
): ValidateResult => {
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

  if (options.knownSkills != null) {
    const skillRef = content.match(/Use the cape:([a-z-]+)/);
    if (skillRef?.[1] != null && !options.knownSkills.has(skillRef[1])) {
      errors.push(`References unknown skill: cape:${skillRef[1]}`);
    }
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
