import { Console, Effect, Option } from 'effect';
import { Command, Flag } from 'effect/unstable/cli';

import { DetectService, getDetectResult } from '../services/detect';
import { catchAndDie } from '../utils/catchAndDie';

export const detect = Command.make(
  'detect',
  { map: Flag.optional(Flag.directory('map').pipe(Flag.withDescription('Directory to map as a file tree instead of detecting ecosystems'))) },
  Effect.fn(function* ({ map }) {
    if (Option.isSome(map)) {
      const service = yield* DetectService;
      const result = yield* service.mapDirectory(map.value).pipe(catchAndDie);
      yield* Console.log(JSON.stringify(result, null, 2));
      return;
    }

    const results = yield* getDetectResult.pipe(catchAndDie);

    yield* Console.log(JSON.stringify(results, null, 2));
  }),
).pipe(
  Command.withDescription(
    'Detect project ecosystems and their check commands. Returns JSON array of ecosystems with language, framework, and commands. Use to discover project tooling.',
  ),
);
