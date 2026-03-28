import { Console, Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import { normalizeEventName, sessionStart, userPromptSubmit } from '../services/hook';

const hookRun = Command.make(
  'hook',
  {
    event: Argument.string('event'),
    clearLogs: Flag.boolean('clear-logs').pipe(Flag.withDefault(false)),
  },
  Effect.fn(function* ({ event, clearLogs }) {
    const normalized = normalizeEventName(event);

    switch (normalized) {
      case 'SessionStart': {
        const result = yield* sessionStart(clearLogs);
        yield* Console.log(JSON.stringify(result));
        break;
      }
      case 'UserPromptSubmit': {
        const result = yield* userPromptSubmit();
        yield* Console.log(JSON.stringify(result));
        break;
      }
      default:
        break;
    }
  }),
);

export const hook = hookRun;
