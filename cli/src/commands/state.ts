import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { HookService, readState, removeStateKey, writeStateKey } from '../services/hook';

const TTL_MS: Record<string, number> = {
  flowPhase: 30 * 60 * 1000,
  tddState: 10 * 60 * 1000,
};

const KEY_DESCRIPTIONS: Record<string, string> = {
  flowPhase: 'Controls which hooks fire — executing/debugging enable TDD gate (TTL: 30 min)',
  tddState: 'TDD enforcement — phase tracks test-first cycle progress (TTL: 10 min)',
  workflowActive: 'Gates internal skills (expand-task, test-driven-development) for direct invocation',
};

const formatTtlRemaining = (key: string, timestamp: number): string | null => {
  const ttl = TTL_MS[key];
  if (ttl == null) {
    return null;
  }
  const remaining = ttl - (Date.now() - timestamp);
  if (remaining <= 0) {
    return 'expired';
  }
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${minutes}m ${seconds}s remaining`;
};

const stateList = Command.make(
  'list',
  {},
  Effect.fn(function* () {
    const entries = yield* readState();
    const keys = Object.keys(entries);

    if (keys.length === 0) {
      yield* Console.log('No active state.');
      return;
    }

    const lines: string[] = [];
    for (const key of keys) {
      const entry = entries[key];
      if (entry == null) {
        continue;
      }
      const { timestamp, ...value } = entry;
      const description = KEY_DESCRIPTIONS[key] ?? 'Custom state key';
      const ttl = formatTtlRemaining(key, timestamp);
      const valueStr = JSON.stringify(value);

      let line = `${key}: ${valueStr}`;
      if (ttl != null) {
        line += ` [${ttl}]`;
      }
      line += `\n  ${description}`;
      lines.push(line);
    }

    yield* Console.log(lines.join('\n\n'));
  }),
).pipe(Command.withDescription('Display all active state keys with values, descriptions, and TTL remaining.'));

const stateSet = Command.make(
  'set',
  { key: Argument.string('key'), value: Argument.string('value').pipe(Argument.optional) },
  Effect.fn(function* ({ key, value }) {
    let parsed: Record<string, unknown>;
    if (value._tag === 'None') {
      parsed = { value: true };
    } else {
      try {
        const raw: unknown = JSON.parse(value.value);
        parsed = typeof raw === 'object' && raw != null && !Array.isArray(raw)
          ? Object.fromEntries(Object.entries(raw))
          : { value: raw };
      } catch {
        parsed = { value: value.value };
      }
    }
    yield* writeStateKey(key, parsed);
  }),
).pipe(Command.withDescription('Set a key in state.json. Accepts JSON object or plain value.'));

const stateClear = Command.make(
  'clear',
  { key: Argument.string('key') },
  Effect.fn(function* ({ key }) {
    yield* removeStateKey(key);
  }),
).pipe(Command.withDescription('Remove a key from state.json. No-op if absent.'));

const stateReset = Command.make(
  'reset',
  {},
  Effect.fn(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();
    yield* service.removeFile(`${root}/hooks/context/state.json`);
  }),
).pipe(Command.withDescription('Delete state.json entirely, removing all state.'));

export const state = Command.make('state').pipe(
  Command.withDescription('Manage hook state that controls conditional hook behavior.'),
  Command.withSubcommands([stateList, stateSet, stateClear, stateReset]),
);
