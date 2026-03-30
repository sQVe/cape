import { Console, Effect, Option } from 'effect';
import { Command, Flag } from 'effect/unstable/cli';

import { DetectService, getDetectResult } from '../services/detect';

export const detect = Command.make(
  'detect',
  { map: Flag.optional(Flag.directory('map')) },
  Effect.fn(function* ({ map }) {
    if (Option.isSome(map)) {
      const service = yield* DetectService;
      const result = yield* service
        .mapDirectory(map.value)
        .pipe(
          Effect.catch((error: Error) =>
            Console.error(JSON.stringify({ error: error.message })).pipe(
              Effect.andThen(Effect.die(error)),
            ),
          ),
        );
      yield* Console.log(JSON.stringify(result, null, 2));
      return;
    }

    const results = yield* getDetectResult.pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    yield* Console.log(JSON.stringify(results, null, 2));
  }),
).pipe(
  Command.withDescription(
    'Detect project ecosystems and their check commands. Use to discover what languages, frameworks, and tools are present.',
  ),
);
