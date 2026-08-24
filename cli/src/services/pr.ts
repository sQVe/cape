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
  '- [ ] Code review by <model> (<reviewer>) on <sha>, findings addressed or dismissed',
  '- [ ] [Command or verifiable behavior]',
].join('\n');

export const extractPrSections = (content: string) =>
  content
    .split('\n')
    .filter((line) => /^#{2,4}\s/.test(line))
    .map((line) => line.replace(/^#{2,4}\s+/, '').trim());

// The section holding the review item is whatever the repo's own template calls it — "Test plan"
// here, "Testing" elsewhere — so a repo is never locked out by a heading cape does not recognize.
// Anchored, or an unrelated "Latest changes" would capture the search before the real section.
const testSectionName = (templateSections: string[]) =>
  templateSections.find((section) => /\btest/i.test(section));

const HEADING = /^#{1,6}\s/;

// Drop comments and fenced code first, so nothing downstream mistakes a `# comment` in a bash block
// for a heading or treats a quoted checkbox as real. A fence closes only on the same character, at
// least as long as the one that opened it — otherwise an inner ``` would end an outer ````.
const visibleLines = (body: string) => {
  let fence: string | null = null;
  const visible: string[] = [];

  for (const line of body.replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker == null) {
      if (fence == null) {
        visible.push(line);
      }
    } else if (fence == null) {
      fence = marker;
    } else if (marker[0] === fence[0] && marker.length >= fence.length) {
      fence = null;
    }
  }

  return visible;
};

const sectionLines = (body: string, sectionName: string | undefined) => {
  const lines = visibleLines(body);
  if (sectionName == null) {
    return lines.filter((line) => !HEADING.test(line));
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
  const end = rest.findIndex((line) => HEADING.test(line));
  return end === -1 ? rest : rest.slice(0, end);
};

// Both halves of the gate read the same filtered view: a box quoted in a fence or a comment is not
// a real box, so it must neither satisfy the review item nor fail the body as unticked.
export const extractUncheckedBoxes = (body: string) =>
  sectionLines(body, undefined)
    .filter((line) => /^\s*- \[ \]/.test(line))
    .map((line) => line.replace(/^\s*- \[ \]\s*/, '').trim());

// The review requirement rides on this item alone: cape has no hook or state gate for it, so a body
// that simply omits the box must fail rather than pass for having no unticked boxes. Two spellings
// pass. "/code-review ..." is the slash command naming its own reviewer. Everything else has to say
// "code review(ed) by <who>", and <who> has to be a real name.
//
// Each clause closes a leak this gate has actually shipped with. Requiring the token to open the
// item stops "Update the code review checklist". Requiring the attribution stops "Code review
// checklist updated" and "Code review run instructions added to CONTRIBUTING.md", neither of which
// names a reviewer. Rejecting a placeholder stops a run from ticking the line cape itself ships.
const reviewItemPattern =
  /^\s*- \[[ xX]\]\s*(?:\/code-review\b|code[- ]review(?:ed)?\s+by\s+(?<who>\S+))/i;

// Bold or italic markers around the label ("**Code review** by ...") are ordinary markdown and must
// not read as a missing review.
const stripEmphasis = (line: string) => line.replace(/[*_]/g, '');

// `<model>` and `[model and reviewer]` are the slots cape ships unfilled. A markdown link is not a
// placeholder, so `[Priya](https://...)` names a reviewer and counts.
const isPlaceholder = (who: string) =>
  who.startsWith('<') || (who.startsWith('[') && !who.includes(']('));

// The sha is the load-bearing half of the attribution: skills/pr defines review coverage from the
// commit the reviewer read, so every review item must also say "on <sha>" with real hex — an
// unfilled `<sha>` or `[sha]` placeholder is not hex and fails here. The bare "/code-review"
// spelling names its own reviewer but gets no sha exemption; a sha-less spelling would be the one
// wording that skips the requirement. Whether the sha exists in the repo is not checked; validate
// runs on stdin alone, without git.
const reviewedShaPattern = /\bon\s+[0-9a-f]{7,40}\b/i;

const hasReviewItem = (templateSections: string[], body: string) =>
  sectionLines(body, testSectionName(templateSections)).some((line) => {
    const stripped = stripEmphasis(line);
    const match = reviewItemPattern.exec(stripped);
    if (match == null) {
      return false;
    }
    const who = match.groups?.who;
    if (who != null && isPlaceholder(who)) {
      return false;
    }
    return reviewedShaPattern.test(stripped);
  });

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
    readonly spawnGh: (args: readonly string[], timeoutMs?: number) => Effect.Effect<string, Error>;
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
