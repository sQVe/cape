import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { HookService } from '../services/hook';

const validateName = (name: string): boolean => /^[a-z0-9-]+$/.test(name);

const contextSet = Command.make(
  'set',
  { name: Argument.string('name') },
  Effect.fn(function* ({ name }) {
    if (!validateName(name)) {
      yield* Console.error(`Invalid context name: ${name}`);
      return yield* Effect.fail(new Error(`Invalid context name: ${name}`));
    }
    const service = yield* HookService;
    const contextPath = `${service.pluginRoot()}/hooks/context`;
    yield* service.ensureDir(contextPath);
    yield* service.writeFile(`${contextPath}/${name}.txt`, 'true');
  }),
).pipe(
  Command.withDescription(
    'Activate a hook context flag. Use to enable context-dependent hook behavior.',
  ),
);

const contextClear = Command.make(
  'clear',
  { name: Argument.string('name') },
  Effect.fn(function* ({ name }) {
    if (!validateName(name)) {
      yield* Console.error(`Invalid context name: ${name}`);
      return yield* Effect.fail(new Error(`Invalid context name: ${name}`));
    }
    const service = yield* HookService;
    yield* service.removeFile(`${service.pluginRoot()}/hooks/context/${name}.txt`);
  }),
).pipe(
  Command.withDescription(
    'Deactivate a hook context flag. Use to disable context-dependent hook behavior.',
  ),
);

export const context = Command.make('context').pipe(
  Command.withDescription('Manage hook context flags that control conditional hook behavior.'),
  Command.withSubcommands([contextSet, contextClear]),
);
