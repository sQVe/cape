import { Console, Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import {
  normalizeEventName,
  postToolUseLinearWrite,
  preToolUseBash,
  preToolUseSkill,
  sessionStart,
  userPromptSubmit,
} from '../services/hook';

const hookRun = Command.make(
  'hook',
  {
    event: Argument.string('event').pipe(
      Argument.withDescription(
        'Hook lifecycle event: SessionStart | UserPromptSubmit | PreToolUse | PostToolUse',
      ),
    ),
    matcher: Flag.string('matcher').pipe(
      Flag.withDescription(
        'Tool matcher: PreToolUse accepts Bash | Skill; PostToolUse accepts linear-write',
      ),
      Flag.withDefault(''),
    ),
  },
  Effect.fn(function* ({ event, matcher }) {
    const normalized = normalizeEventName(event);

    switch (normalized) {
      case 'SessionStart': {
        const result = yield* sessionStart();
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
        } else {
          yield* Console.error(
            `cape hook: unknown PreToolUse matcher "${matcher}" — expected Bash | Skill. Check hooks.json.`,
          );
        }
        if (result != null) {
          yield* Console.log(JSON.stringify(result));
        }
        break;
      }
      case 'PostToolUse': {
        let result;
        if (matcher === 'linear-write') {
          result = yield* postToolUseLinearWrite();
        } else {
          yield* Console.error(
            `cape hook: unknown PostToolUse matcher "${matcher}" — expected linear-write. Check hooks.json.`,
          );
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
