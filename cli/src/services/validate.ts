import type { Effect } from 'effect';
import { ServiceMap } from 'effect';

import { parseFrontmatter, splitFrontmatter } from '../utils/frontmatter';

export interface ValidateResult {
  readonly file: string;
  readonly valid: boolean;
  readonly errors: string[];
}

const hasHeading = (content: string, heading: string): boolean =>
  content.split('\n').some((line) => line.startsWith(heading));

// Skills backtick their references; commands write the routing sentence bare ("Use the
// cape:execute-plan skill exactly as written"). Both forms have to resolve, or a renamed skill
// leaves a dead command behind that validation calls fine.
const checkCapeReferences = (content: string, knownNames: Set<string>, errors: string[]) => {
  for (const match of content.matchAll(/`?\bcape:([a-z][a-z0-9-]*)`?/g)) {
    const name = match[1];
    if (name != null && !knownNames.has(name)) {
      errors.push(`References unknown skill or agent: cape:${name}`);
    }
  }
};

interface SkillValidateOptions {
  readonly knownNames?: Set<string>;
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

  if (splitFrontmatter(content).body.trim().length === 0) {
    errors.push('Skill body is empty');
  }

  if (options.knownNames != null) {
    checkCapeReferences(content, options.knownNames, errors);
  }

  return { file, valid: errors.length === 0, errors };
};

const validAgentModels = new Set(['opus', 'sonnet', 'haiku']);

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
    } else if (!validAgentModels.has(frontmatter.model)) {
      errors.push(
        `Invalid model value: ${frontmatter.model} (allowed: ${[...validAgentModels].join(', ')})`,
      );
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
  readonly knownNames?: Set<string>;
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

  // Almost every command routes to a skill with "Use the cape:<name> skill exactly as written".
  // `review` is the exception: code review is an agent with no skill behind it, so a command may
  // target either kind. What has to hold either way is a cape reference that resolves.
  if (!/cape:[a-z]/.test(content)) {
    errors.push("Body must reference a cape skill or agent (expected a 'cape:<name>' reference)");
  }

  if (options.knownNames != null) {
    checkCapeReferences(content, options.knownNames, errors);
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
    readonly globFiles: (pattern: string) => Effect.Effect<string[], Error>;
    readonly readFile: (path: string) => Effect.Effect<string, Error>;
    readonly gitRoot: () => Effect.Effect<string, Error>;
  }
>()('ValidateService') {}
