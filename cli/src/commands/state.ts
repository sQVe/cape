import { Console, Effect, Option } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { HookService, readState, removeStateKey, writeStateKey } from '../services/hook';

// Source of truth for all known state keys.
// Update this catalog when adding or changing state keys.
const STATE_KEY_CATALOG = [
  {
    key: 'flowPhase',
    description: 'Controls which hooks fire — executing/debugging enable TDD gate',
    validValues: 'executing | debugging | planning',
    valueShape: '{ phase, issueId }',
    ttlMs: 30 * 60 * 1000,
  },
  {
    key: 'tddState',
    description: 'TDD enforcement — phase tracks test-first cycle progress',
    validValues: 'red | green | writing-test',
    valueShape: '{ phase }',
    ttlMs: 10 * 60 * 1000,
  },
  {
    key: 'workflowActive',
    description: 'Gates internal skills (expand-task, test-driven-development) for direct invocation',
    validValues: 'true (boolean, set or absent)',
    valueShape: '{ value: true }',
    ttlMs: null,
  },
] as const;

const catalogByKey = Object.fromEntries(
  STATE_KEY_CATALOG.map((entry) => [entry.key, entry]),
);

const formatTtlRemaining = (key: string, timestamp: number): string | null => {
  const ttl = catalogByKey[key]?.ttlMs;
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

const formatActiveEntry = (key: string, entry: Record<string, unknown> & { timestamp: number }) => {
  const { timestamp, ...value } = entry;
  const catalog = catalogByKey[key];
  const description = catalog?.description ?? 'Custom state key';
  const ttl = formatTtlRemaining(key, timestamp);
  const valueStr = JSON.stringify(value);

  let line = `  ${key}: ${valueStr}`;
  if (ttl != null) {
    line += ` [${ttl}]`;
  }
  line += `\n    ${description}`;
  return line;
};

const formatCatalogEntry = (entry: (typeof STATE_KEY_CATALOG)[number]) => {
  const ttlLabel = entry.ttlMs != null
    ? `TTL: ${entry.ttlMs / 60_000} min`
    : 'no TTL';
  return `  ${entry.key}: (not set)\n    ${entry.description}\n    Values: ${entry.validValues} · ${ttlLabel}`;
};

const stateList = Command.make(
  'list',
  {},
  Effect.fn(function* () {
    const entries = yield* readState();
    const activeKeys = Object.keys(entries);
    const sections: string[] = [];

    if (activeKeys.length === 0) {
      sections.push('Active state: None');
    } else {
      const activeLines: string[] = [];
      for (const key of activeKeys) {
        const entry = entries[key];
        if (entry == null) {
          continue;
        }
        activeLines.push(formatActiveEntry(key, entry));
      }
      sections.push(`Active state:\n${activeLines.join('\n\n')}`);
    }

    const inactiveEntries = STATE_KEY_CATALOG.filter(
      (entry) => entries[entry.key] == null,
    );
    if (inactiveEntries.length > 0) {
      const availableLines = inactiveEntries.map(formatCatalogEntry);
      sections.push(`Available keys:\n${availableLines.join('\n\n')}`);
    }

    sections.push(
      [
        'Common operations:',
        '  Opt out of TDD: cape state clear tddState && cape state clear flowPhase',
        '  Reset all state: cape state reset',
      ].join('\n'),
    );

    yield* Console.log(sections.join('\n\n'));
  }),
).pipe(Command.withDescription('Display all state keys (active and available), valid values, and common operations. Use to discover state keys and workflow recipes.'));

const stateSet = Command.make(
  'set',
  { key: Argument.string('key').pipe(Argument.withDescription('State key name (e.g. tddState, flowPhase, workflowActive)')), value: Argument.string('value').pipe(Argument.withDescription('Value as JSON object or plain string'), Argument.optional) },
  Effect.fn(function* ({ key, value }) {
    let parsed: Record<string, unknown>;
    if (Option.isNone(value)) {
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
).pipe(Command.withDescription('Set a key in state.json. Accepts JSON object or plain value. Use to activate state-dependent hook behavior.'));

const stateClear = Command.make(
  'clear',
  { key: Argument.string('key').pipe(Argument.withDescription('State key to remove')) },
  Effect.fn(function* ({ key }) {
    yield* removeStateKey(key);
  }),
).pipe(Command.withDescription('Remove a key from state.json. No-op if absent. Use to deactivate state-dependent hook behavior.'));

const stateReset = Command.make(
  'reset',
  {},
  Effect.fn(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();
    yield* service.removeFile(`${root}/hooks/context/state.json`);
  }),
).pipe(Command.withDescription('Delete state.json entirely, removing all state. Use to clear all hook state at once.'));

export const state = Command.make('state').pipe(
  Command.withDescription('Manage hook state that controls conditional hook behavior. Run `cape state list` to see all keys and common operations.'),
  Command.withSubcommands([stateList, stateSet, stateClear, stateReset]),
);
