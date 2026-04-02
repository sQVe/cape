import { Effect, ServiceMap } from 'effect';

const templatePaths = [
  '.github/pull_request_template.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'docs/pull_request_template.md',
];

const defaultContent = [
  '#### Motivation',
  '',
  '[Problem being solved or opportunity. Why now?]',
  '',
  '#### Changes',
  '',
  '- [Describe key changes made]',
  '',
  '#### Test plan',
  '',
  '- [ ] [Command or verifiable behavior]',
].join('\n');

export const extractPrSections = (content: string) =>
  content
    .split('\n')
    .filter((line) => /^#{2,4}\s/.test(line))
    .map((line) => line.replace(/^#{2,4}\s+/, '').trim());

export const extractUncheckedBoxes = (body: string) =>
  body
    .split('\n')
    .filter((line) => /^\s*- \[ \]/.test(line))
    .map((line) => line.replace(/^\s*- \[ \]\s*/, '').trim());

export const validatePrBody = (templateSections: string[], body: string) => {
  const bodySections = extractPrSections(body);
  const missing = templateSections.filter((s) => !bodySections.includes(s));
  const extra = bodySections.filter((s) => !templateSections.includes(s));
  const unchecked = extractUncheckedBoxes(body);
  return {
    valid: missing.length === 0 && unchecked.length === 0,
    missing,
    extra,
    unchecked,
  };
};

export class PrService extends ServiceMap.Service<
  PrService,
  {
    readonly fileExists: (path: string) => Effect.Effect<boolean, Error>;
    readonly readFile: (path: string) => Effect.Effect<string, Error>;
    readonly readStdin: () => Effect.Effect<string, Error>;
    readonly gitRoot: () => Effect.Effect<string, Error>;
    readonly spawnGh: (args: readonly string[]) => Effect.Effect<string, Error>;
  }
>()('PrService') {}

export const findTemplate = () =>
  Effect.gen(function* () {
    const service = yield* PrService;
    const root = yield* service.gitRoot();

    for (const relative of templatePaths) {
      const fullPath = `${root}/${relative}`;
      const exists = yield* service.fileExists(fullPath);
      if (exists) {
        const content = yield* service.readFile(fullPath);
        const sections = extractPrSections(content);
        return { source: 'repo' as const, content, sections };
      }
    }

    return {
      source: 'default' as const,
      content: defaultContent,
      sections: extractPrSections(defaultContent),
    };
  });

export const readStdin = () =>
  Effect.gen(function* () {
    const service = yield* PrService;
    return yield* service.readStdin();
  });
