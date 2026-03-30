import { join, relative, resolve } from 'node:path';

import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import type { ValidateResult } from '../services/validate';
import {
  ValidateService,
  inferFileType,
  validateAgentContent,
  validateCommandContent,
  validateSkillContent,
} from '../services/validate';

const validateFiles = (
  pattern: string,
  validator: (file: string, content: string) => ValidateResult,
) =>
  Effect.gen(function* () {
    const service = yield* ValidateService;
    const files = yield* service.globFiles(pattern);
    const results: ValidateResult[] = [];
    for (const file of files) {
      const content = yield* service.readFile(file);
      results.push(validator(file, content));
    }
    return results;
  });

const validateByType = (type: string, root: string) =>
  Effect.gen(function* () {
    const results: ValidateResult[] = [];

    if (type === 'all' || type === 'skills') {
      const r = yield* validateFiles(join(root, 'skills/*/SKILL.md'), (file, content) =>
        validateSkillContent(relative(root, file), content),
      );
      results.push(...r);
    }
    if (type === 'all' || type === 'agents') {
      const r = yield* validateFiles(join(root, 'agents/*.md'), (file, content) =>
        validateAgentContent(relative(root, file), content),
      );
      results.push(...r);
    }
    if (type === 'all' || type === 'commands') {
      const r = yield* validateFiles(join(root, 'commands/*.md'), (file, content) =>
        validateCommandContent(relative(root, file), content),
      );
      results.push(...r);
    }

    return results;
  });

const validTypes = new Set(['skills', 'agents', 'commands']);

export const validate = Command.make(
  'validate',
  { target: Argument.optional(Argument.string('target')) },
  Effect.fn(function* ({ target }) {
    const service = yield* ValidateService;
    const root = yield* service.gitRoot();
    let results: ValidateResult[];

    if (target._tag === 'None') {
      results = yield* validateByType('all', root);
    } else if (validTypes.has(target.value)) {
      results = yield* validateByType(target.value, root);
    } else {
      const absPath = resolve(target.value);
      const relPath = relative(root, absPath);
      const fileType = inferFileType(relPath);

      if (fileType == null) {
        yield* Console.error(JSON.stringify({ error: `Unknown file type: ${relPath}` }));
        return yield* Effect.die(new Error('unknown file type'));
      }

      const content = yield* service.readFile(absPath);
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
      return yield* Effect.die(new Error(`${failed} file(s) failed validation`));
    }
  }),
).pipe(
  Command.withDescription(
    'Validate skill, agent, and command markdown files for required structure. Use to check cape definition files are well-formed.',
  ),
);
