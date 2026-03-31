import { Console, Effect } from 'effect';
import { Command } from 'effect/unstable/cli';

import { HookService } from '../services/hook';

const EVENTS_FILENAME = 'events.jsonl';

interface Event {
  readonly ts: string;
  readonly cmd: string;
  readonly detail?: string;
}

const isEvent = (value: unknown): value is Event =>
  typeof value === 'object' &&
  value != null &&
  'ts' in value &&
  typeof value.ts === 'string' &&
  'cmd' in value &&
  typeof value.cmd === 'string';

const parseEvents = (content: string): Event[] =>
  content
    .trim()
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed: unknown = JSON.parse(line);
        return isEvent(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    });

const formatSummary = (events: Event[]): string => {
  const total = events.length;

  const byCmd: Record<string, number> = {};
  for (const event of events) {
    byCmd[event.cmd] = (byCmd[event.cmd] ?? 0) + 1;
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentCount = events.filter((event) => event.ts >= weekAgo).length;

  const recent = events.slice(-10).toReversed();

  const parts = [
    `Total events: ${total}`,
    `Events in last 7 days: ${recentCount}`,
    '',
    'Events by command:',
    ...Object.entries(byCmd)
      .toSorted(([, a], [, b]) => b - a)
      .map(([cmd, count]) => `  ${cmd}: ${count}`),
    '',
    'Most recent:',
    ...recent.map(
      (event) => `  ${event.ts} ${event.cmd}${event.detail != null ? ` (${event.detail})` : ''}`,
    ),
  ];

  return parts.join('\n');
};

export const stats = Command.make(
  'stats',
  {},
  Effect.fn(function* () {
    const service = yield* HookService;
    const eventsPath = `${service.pluginRoot()}/hooks/context/${EVENTS_FILENAME}`;
    const content = yield* service.readFile(eventsPath);

    if (!content) {
      yield* Console.log('No events recorded yet.');
      return;
    }

    const events = parseEvents(content);
    if (events.length === 0) {
      yield* Console.log('No events recorded yet.');
      return;
    }

    yield* Console.log(formatSummary(events));
  }),
).pipe(Command.withDescription('Display a summary of cape event history.'));
