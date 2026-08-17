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
  '- [ ] /code-review run on this branch, findings addressed or dismissed',
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

const outsideFences = (lines: string[]) => {
  let inFence = false;
  return lines.filter((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return false;
    }
    return !inFence;
  });
};

// The section holding the review item is whatever the repo's own template calls it — "Test plan"
// here, "Testing" elsewhere — so a repo is never locked out by a heading cape does not recognize.
const testSectionName = (templateSections: string[]) =>
  templateSections.find((section) => /test/i.test(section));

const testPlanLines = (body: string, sectionName: string | undefined) => {
  const lines = body.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  if (sectionName == null) {
    return outsideFences(lines);
  }
  const heading = new RegExp(
    `^#{1,6}\\s+${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
    'i',
  );
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) {
    return [];
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,6}\s/.test(line));
  return outsideFences(end === -1 ? rest : rest.slice(0, end));
};

// The review requirement rides on this item alone: cape has no hook or state gate for it, so a body
// that simply omits the box must fail rather than pass for having no unticked boxes. Comments and
// fenced blocks are dropped so a review line merely quoted somewhere cannot satisfy the gate.
const hasReviewItem = (templateSections: string[], body: string) =>
  testPlanLines(body, testSectionName(templateSections)).some(
    (line) => /^\s*- \[[ xX]\]/.test(line) && line.includes('/code-review'),
  );

export const validatePrBody = (templateSections: string[], body: string) => {
  const bodySections = extractPrSections(body);
  const missing = templateSections.filter((s) => !bodySections.includes(s));
  const extra = bodySections.filter((s) => !templateSections.includes(s));
  const unchecked = extractUncheckedBoxes(body);
  const missingReviewItem = !hasReviewItem(templateSections, body);
  return {
    valid: missing.length === 0 && unchecked.length === 0 && !missingReviewItem,
    missing,
    extra,
    unchecked,
    missingReviewItem,
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
