import { join, relative, resolve } from 'node:path';

import { Console, Effect, Option } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';
import type { ValidateResult } from '../services/validate';
import {
  ValidateService,
  inferFileType,
  validateAgentContent,
  validateCommandContent,
  validateSkillContent,
} from '../services/validate';
import { catchAndDie } from '../utils/catchAndDie';
import { collectDefinitionNames, loadDefinitions } from '../utils/loadDefinitions';

const skillNameFromPath = (path: string): string | null => {
  const match = path.match(/skills\/([^/]+)\/SKILL\.md$/);
  return match?.[1] ?? null;
};

const agentNameFromPath = (path: string): string | null => {
  const match = path.match(/agents\/([^/]+)\.md$/);
  return match?.[1] ?? null;
};

const validateByType = (type: string, root: string) =>
  Effect.gen(function* () {
    const service = yield* ValidateService;
    const results: ValidateResult[] = [];

    const knownSkills =
      type === 'all' || type === 'commands'
        ? yield* collectDefinitionNames(
            service,
            join(root, 'skills/*/SKILL.md'),
            skillNameFromPath,
          )
        : new Set<string>();

    const knownAgents =
      type === 'all' || type === 'skills'
        ? yield* collectDefinitionNames(service, join(root, 'agents/*.md'), agentNameFromPath)
        : new Set<string>();

    if (type === 'all' || type === 'skills') {
      const r = yield* loadDefinitions(
        service,
        join(root, 'skills/*/SKILL.md'),
        (file, content) =>
          validateSkillContent(relative(root, file), content, { knownAgents }),
      );
      results.push(...r);
    }
    if (type === 'all' || type === 'agents') {
      const r = yield* loadDefinitions(service, join(root, 'agents/*.md'), (file, content) =>
        validateAgentContent(relative(root, file), content),
      );
      results.push(...r);
    }
    if (type === 'all' || type === 'commands') {
      const r = yield* loadDefinitions(
        service,
        join(root, 'commands/*.md'),
        (file, content) =>
          validateCommandContent(relative(root, file), content, { knownSkills }),
      );
      results.push(...r);
    }

    return results;
  });

const validTypes = new Set(['skills', 'agents', 'commands']);

export const validate = Command.make(
  'validate',
  { target: Argument.optional(Argument.string('target').pipe(Argument.withDescription('File path or type to validate: skills | agents | commands (default: all)'))) },
  Effect.fn(function* ({ target }) {
    const service = yield* ValidateService;
    const root = yield* service.gitRoot().pipe(catchAndDie);
    let results: ValidateResult[];

    if (Option.isNone(target)) {
      results = yield* validateByType('all', root).pipe(catchAndDie);
    } else if (validTypes.has(target.value)) {
      results = yield* validateByType(target.value, root).pipe(catchAndDie);
    } else {
      const absPath = resolve(target.value);
      const relPath = relative(root, absPath);
      const fileType = inferFileType(relPath);

      if (fileType == null) {
        return yield* dieWithError(`Unknown file type: ${relPath}`);
      }

      const content = yield* service.readFile(absPath).pipe(catchAndDie);
      let validator: (file: string, content: string) => ValidateResult;
      if (fileType === 'skill') {
        validator = validateSkillContent;
      } else if (fileType === 'agent') {
        validator = validateAgentContent;
      } else {
        validator = validateCommandContent;
      }
      results = [validator(relPath, content)];
    }

    const passed = results.filter((r) => r.valid).length;
    const failed = results.filter((r) => !r.valid).length;
    yield* Console.log(JSON.stringify({ results, passed, failed }));

    if (failed > 0) {
      return yield* dieWithError(`${failed} file(s) failed validation`);
    }
  }),
).pipe(
  Command.withDescription(
    'Validate skill, agent, and command markdown files for required structure. Returns { results, passed, failed }. Use to check cape definition files.',
  ),
);
