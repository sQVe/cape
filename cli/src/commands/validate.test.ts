import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it, vi } from 'vitest';

import { main } from '../main';
import {
  inferFileType,
  parseFrontmatter,
  ValidateService,
  validateAgentContent,
  validateCommandContent,
  validateSkillContent,
} from '../services/validate';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubHookLayer,
  stubConformLayer,
  stubPrLayer,
} from '../testStubs';

const validSkill = `---
name: test-skill
description: A test skill
---

<skill_overview>
Overview content here.
</skill_overview>

<rigidity_level>
High
</rigidity_level>

<when_to_use>
Use when testing.
</when_to_use>

<critical_rules>
Always test.
</critical_rules>
`;

const validAgent = `---
name: test-agent
description: A test agent
model: opus
---

## Investigation approach

Do stuff.

## Scale by scope

Scale it.
`;

const validCommand = `---
description: A test command
---

Use the cape:test-skill skill exactly as written.
`;

describe('parseFrontmatter', () => {
  it('parses valid frontmatter', () => {
    const result = parseFrontmatter('---\nname: foo\ndescription: bar\n---\nbody');
    expect(result).toEqual({ name: 'foo', description: 'bar' });
  });

  it('returns null for missing frontmatter', () => {
    expect(parseFrontmatter('no frontmatter')).toBeNull();
  });

  it('returns null for unclosed frontmatter', () => {
    expect(parseFrontmatter('---\nname: foo\nbody')).toBeNull();
  });

  it('handles multiline values', () => {
    const result = parseFrontmatter('---\ndescription: >\n  line one\n  line two\n---\n');
    expect(result?.description).toBe('> line one line two');
  });
});

describe('validateSkillContent', () => {
  it('returns valid for correct skill', () => {
    const result = validateSkillContent('test.md', validSkill);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects missing frontmatter', () => {
    const result = validateSkillContent('test.md', 'no frontmatter');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing YAML frontmatter');
  });

  it('detects missing name field', () => {
    const content = validSkill.replace('name: test-skill\n', '');
    const result = validateSkillContent('test.md', content);
    expect(result.errors).toContain('Missing frontmatter field: name');
  });

  it('detects missing description field', () => {
    const content = validSkill.replace('description: A test skill\n', '');
    const result = validateSkillContent('test.md', content);
    expect(result.errors).toContain('Missing frontmatter field: description');
  });

  it('detects missing XML tags', () => {
    const content = validSkill.replace(/<skill_overview>[\s\S]*?<\/skill_overview>/, '');
    const result = validateSkillContent('test.md', content);
    expect(result.errors).toContain('Missing required tag: <skill_overview>');
  });

  it('detects empty XML tags', () => {
    const content = validSkill.replace(
      /<skill_overview>[\s\S]*?<\/skill_overview>/,
      '<skill_overview>\n</skill_overview>',
    );
    const result = validateSkillContent('test.md', content);
    expect(result.errors).toContain('Empty tag: <skill_overview>');
  });

  it('requires all four tags', () => {
    const content = '---\nname: x\ndescription: x\n---\n';
    const result = validateSkillContent('test.md', content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required tag: <skill_overview>');
    expect(result.errors).toContain('Missing required tag: <rigidity_level>');
    expect(result.errors).toContain('Missing required tag: <when_to_use>');
    expect(result.errors).toContain('Missing required tag: <critical_rules>');
  });

  it('detects whitespace-only tag as empty', () => {
    const content = validSkill.replace(
      /<skill_overview>[\s\S]*?<\/skill_overview>/,
      '<skill_overview>   </skill_overview>',
    );
    const result = validateSkillContent('test.md', content);
    expect(result.errors).toContain('Empty tag: <skill_overview>');
  });
});

describe('validateAgentContent', () => {
  it('returns valid for correct agent', () => {
    const result = validateAgentContent('test.md', validAgent);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects missing model field', () => {
    const content = validAgent.replace('model: opus\n', '');
    const result = validateAgentContent('test.md', content);
    expect(result.errors).toContain('Missing frontmatter field: model');
  });

  it('detects missing name field', () => {
    const content = validAgent.replace('name: test-agent\n', '');
    const result = validateAgentContent('test.md', content);
    expect(result.errors).toContain('Missing frontmatter field: name');
  });

  it('detects missing description field', () => {
    const content = validAgent.replace('description: A test agent\n', '');
    const result = validateAgentContent('test.md', content);
    expect(result.errors).toContain('Missing frontmatter field: description');
  });

  it('accepts Research approach as alternative heading', () => {
    const content = validAgent.replace('## Investigation approach', '## Research approach');
    const result = validateAgentContent('test.md', content);
    expect(result.valid).toBe(true);
  });

  it('accepts Source tiers as alternative heading', () => {
    const content = validAgent.replace('## Scale by scope', '## Source tiers');
    const result = validateAgentContent('test.md', content);
    expect(result.valid).toBe(true);
  });

  it('detects missing investigation heading', () => {
    const content = validAgent.replace('## Investigation approach\n', '');
    const result = validateAgentContent('test.md', content);
    expect(result.errors).toContain(
      'Missing heading: ## Investigation approach (or ## Research approach)',
    );
  });

  it('detects missing scale heading', () => {
    const content = validAgent.replace('## Scale by scope\n', '');
    const result = validateAgentContent('test.md', content);
    expect(result.errors).toContain('Missing heading: ## Scale by scope (or ## Source tiers)');
  });
});

describe('validateCommandContent', () => {
  it('returns valid for correct command', () => {
    const result = validateCommandContent('test.md', validCommand);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects missing description field', () => {
    const content = '---\nother: value\n---\nUse the cape:test skill.';
    const result = validateCommandContent('test.md', content);
    expect(result.errors).toContain('Missing frontmatter field: description');
  });

  it('detects missing skill reference', () => {
    const content = '---\ndescription: test\n---\nSome body without skill ref.';
    const result = validateCommandContent('test.md', content);
    expect(result.errors).toContain(
      "Body must reference a skill (expected 'Use the cape:' pattern)",
    );
  });
});

describe('inferFileType', () => {
  it('identifies skill files', () => {
    expect(inferFileType('skills/brainstorm/SKILL.md')).toBe('skill');
  });

  it('identifies agent files', () => {
    expect(inferFileType('agents/bug-tracer.md')).toBe('agent');
  });

  it('identifies command files', () => {
    expect(inferFileType('commands/review.md')).toBe('command');
  });

  it('returns null for unknown paths', () => {
    expect(inferFileType('src/index.ts')).toBeNull();
  });
});

const makeTestValidateLayer = (files: Record<string, string> = {}) =>
  Layer.succeed(ValidateService)({
    globFiles: (pattern: string) => {
      const dir = pattern.split('*')[0] ?? '';
      const matching = Object.keys(files).filter((f) => f.startsWith(dir));
      return Effect.succeed(matching);
    },
    readFile: (path: string) =>
      files[path] != null ? Effect.succeed(files[path]) : Effect.die(new Error(`no file: ${path}`)),
    gitRoot: () => Effect.succeed('/repo'),
  });

const run = Command.runWith(main, { version: '0.1.0' });

const makeCommandLayers = (validateLayer = makeTestValidateLayer()) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    stubBrLayer,
    stubHookLayer,
    stubPrLayer,
    stubConformLayer,
    validateLayer,
  );

describe('validate command wiring', () => {
  it('is wired as a subcommand of cape', async () => {
    await Effect.runPromise(run(['validate', '--help']).pipe(Effect.provide(makeCommandLayers())));
  });

  it('validates all types with no args', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const layer = makeTestValidateLayer({
      '/repo/skills/test/SKILL.md': validSkill,
      '/repo/agents/test.md': validAgent,
      '/repo/commands/test.md': validCommand,
    });

    await Effect.runPromise(run(['validate']).pipe(Effect.provide(makeCommandLayers(layer))));

    const output = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string);
    expect(output.passed).toBe(3);
    expect(output.failed).toBe(0);
    consoleSpy.mockRestore();
  });

  it('reports failures in JSON output', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const layer = makeTestValidateLayer({
      '/repo/skills/bad/SKILL.md': '---\nname: bad\n---\nno tags',
    });

    await expect(
      Effect.runPromise(run(['validate']).pipe(Effect.provide(makeCommandLayers(layer)))),
    ).rejects.toThrow();

    const output = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string);
    expect(output.failed).toBe(1);
    expect(output.results[0].errors.length).toBeGreaterThan(0);
    consoleSpy.mockRestore();
  });
});
