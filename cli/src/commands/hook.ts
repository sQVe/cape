import { Console, Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import {
  normalizeEventName,
  postToolUseBash,
  preToolUseBash,
  preToolUseSkill,
  sessionStart,
  userPromptSubmit,
} from '../services/hook';

const hookRun = Command.make(
  'hook',
  {
    event: Argument.string('event').pipe(Argument.withDescription('Hook lifecycle event: SessionStart | UserPromptSubmit | PreToolUse | PostToolUse')),
    clearLogs: Flag.boolean('clear-logs').pipe(Flag.withDescription('Clear event log on SessionStart'), Flag.withDefault(false)),
    matcher: Flag.string('matcher').pipe(Flag.withDescription('Tool matcher: PreToolUse accepts Bash | Skill; PostToolUse accepts Bash'), Flag.withDefault('')),
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
