import { Effect } from 'effect';

export interface DefinitionReader {
  readonly globFiles: (pattern: string) => Effect.Effect<string[]>;
  readonly readFile: (path: string) => Effect.Effect<string>;
}

export const loadDefinitions = <T>(
  reader: DefinitionReader,
  pattern: string,
  transform: (file: string, content: string) => T,
): Effect.Effect<T[]> =>
  Effect.gen(function* () {
    const files = yield* reader.globFiles(pattern);
    const results: T[] = [];
    for (const file of files) {
      const content = yield* reader.readFile(file);
      results.push(transform(file, content));
    }
    return results;
  });

export const collectDefinitionNames = (
  reader: Pick<DefinitionReader, 'globFiles'>,
  pattern: string,
  extractor: (path: string) => string | null,
): Effect.Effect<Set<string>> =>
  Effect.gen(function* () {
    const files = yield* reader.globFiles(pattern);
    const names = new Set<string>();
    for (const file of files) {
      const name = extractor(file);
      if (name != null) {
        names.add(name);
      }
    }
    return names;
  });
