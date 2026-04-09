import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import {
  inferFileType,
  ValidateService,
  validateAgentContent,
  validateCommandContent,
  validateSkillContent,
} from '../services/validate';
import { makeTestCommandLayers, spyConsole } from '../testUtils';

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

<the_process>
Process here.
</the_process>

<examples>
Example content here.
</examples>

<key_principles>
Principle content here.
</key_principles>
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

  it('requires all seven tags', () => {
    const content = '---\nname: x\ndescription: x\n---\n';
    const result = validateSkillContent('test.md', content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required tag: <skill_overview>');
    expect(result.errors).toContain('Missing required tag: <rigidity_level>');
    expect(result.errors).toContain('Missing required tag: <when_to_use>');
    expect(result.errors).toContain('Missing required tag: <critical_rules>');
    expect(result.errors).toContain('Missing required tag: <the_process>');
    expect(result.errors).toContain('Missing required tag: <examples>');
    expect(result.errors).toContain('Missing required tag: <key_principles>');
  });

  it('detects missing the_process tag', () => {
    const skillWithoutTheProcess = validSkill.replace(
      /<the_process>[\s\S]*?<\/the_process>\n*/,
      '',
    );
    const result = validateSkillContent('test.md', skillWithoutTheProcess);
    expect(result.errors).toContain('Missing required tag: <the_process>');
  });

  it('detects missing examples tag', () => {
    const content = validSkill.replace(/<examples>[\s\S]*?<\/examples>\n*/, '');
    const result = validateSkillContent('test.md', content);
    expect(result.errors).toContain('Missing required tag: <examples>');
  });

  it('detects critical_rules after the_process', () => {
    const content = `---
name: test
description: test
---

<skill_overview>Overview.</skill_overview>
<rigidity_level>High</rigidity_level>
<when_to_use>Use here.</when_to_use>
<the_process>Process.</the_process>
<critical_rules>Rules.</critical_rules>
<examples>Examples.</examples>
<key_principles>Principles.</key_principles>
`;
    const result = validateSkillContent('test.md', content);
    expect(result.errors).toContain(
      '<critical_rules> must appear before <the_process>',
    );
  });

  it('detects duplicate XML tags', () => {
    const content =
      validSkill + '\n<critical_rules>\nDuplicate rules.\n</critical_rules>\n';
    const result = validateSkillContent('test.md', content);
    expect(result.errors).toContain('Duplicate tag: <critical_rules>');
  });

  it('detects whitespace-only tag as empty', () => {
    const content = validSkill.replace(
      /<skill_overview>[\s\S]*?<\/skill_overview>/,
      '<skill_overview>   </skill_overview>',
    );
    const result = validateSkillContent('test.md', content);
    expect(result.errors).toContain('Empty tag: <skill_overview>');
  });

  it('detects reference to nonexistent agent', () => {
    const knownAgents = new Set(['code-reviewer', 'test-runner']);
    const content =
      validSkill +
      '\n<agent_references>\n## `cape:nonexistent-agent` protocol:\nDispatch details.\n</agent_references>\n';
    const result = validateSkillContent('test.md', content, { knownAgents });
    expect(result.errors).toContain(
      'References unknown agent: cape:nonexistent-agent',
    );
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

  it('detects invalid model value', () => {
    const content = validAgent.replace('model: opus', 'model: sonnnet');
    const result = validateAgentContent('test.md', content);
    expect(result.errors).toContain(
      'Invalid model value: sonnnet (allowed: opus, sonnet, haiku)',
    );
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

  it('detects reference to nonexistent skill', () => {
    const knownSkills = new Set(['brainstorm', 'commit']);
    const content = '---\ndescription: test\n---\nUse the cape:nonexistent skill exactly as written.';
    const result = validateCommandContent('test.md', content, { knownSkills });
    expect(result.errors).toContain(
      'References unknown skill: cape:nonexistent',
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

describe('validate command wiring', () => {
  it('is wired as a subcommand of cape', async () => {
    await Effect.runPromise(
      run(['validate', '--help']).pipe(Effect.provide(makeTestCommandLayers())),
    );
  });

  it('validates all types with no args', async () => {
    const console_ = spyConsole();
    const layer = makeTestValidateLayer({
      '/repo/skills/test-skill/SKILL.md': validSkill,
      '/repo/agents/test.md': validAgent,
      '/repo/commands/test.md': validCommand,
    });

    await Effect.runPromise(
      run(['validate']).pipe(Effect.provide(makeTestCommandLayers(layer))),
    );

    const output = JSON.parse(console_.output());
    expect(output.passed).toBe(3);
    expect(output.failed).toBe(0);
    console_.restore();
  });

  it('reports failures in JSON output', async () => {
    const console_ = spyConsole();
    const layer = makeTestValidateLayer({
      '/repo/skills/bad/SKILL.md': '---\nname: bad\n---\nno tags',
    });

    await expect(
      Effect.runPromise(
        run(['validate']).pipe(Effect.provide(makeTestCommandLayers(layer))),
      ),
    ).rejects.toThrow();

    const output = JSON.parse(console_.output());
    expect(output.failed).toBe(1);
    expect(output.results[0].errors.length).toBeGreaterThan(0);
    console_.restore();
  });
});
