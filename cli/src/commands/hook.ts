import { Console, Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import {
  normalizeEventName,
  postToolUseBash,
  postToolUseEdit,
  postToolUseFailureBash,
  preToolUseBash,
  preToolUseSkill,
  sessionStart,
  userPromptSubmit,
} from '../services/hook';

const hookRun = Command.make(
  'hook',
  {
    event: Argument.string('event'),
    clearLogs: Flag.boolean('clear-logs').pipe(Flag.withDefault(false)),
    matcher: Flag.string('matcher').pipe(Flag.withDefault('')),
  },
  Effect.fn(function* ({ event, clearLogs, matcher }) {
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
      case 'PreToolUse': {
        let result;
        if (matcher === 'Bash') {
          result = yield* preToolUseBash();
        } else if (matcher === 'Skill') {
          result = yield* preToolUseSkill();
        }
        if (result != null) {
          yield* Console.log(JSON.stringify(result));
        }
        break;
      }
      case 'PostToolUse': {
        let result;
        if (matcher === 'Bash') {
          result = yield* postToolUseBash();
        } else if (matcher === 'Edit') {
          result = yield* postToolUseEdit();
        }
        if (result != null) {
          yield* Console.log(JSON.stringify(result));
        }
        break;
      }
      case 'PostToolUseFailure': {
        let result;
        if (matcher === 'Bash') {
          result = yield* postToolUseFailureBash();
        }
        if (result != null) {
          yield* Console.log(JSON.stringify(result));
        }
        break;
      }
      default:
        break;
    }
  }),
).pipe(
  Command.withDescription(
    'Execute Claude Code hook handlers for lifecycle events (SessionStart, PreToolUse, PostToolUse, etc). Called by hook configuration, not directly.',
  ),
);

export const hook = hookRun;
