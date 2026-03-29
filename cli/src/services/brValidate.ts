import { Effect, ServiceMap } from 'effect';

export interface BeadData {
  readonly id: string;
  readonly issue_type: string;
  readonly description: string;
  readonly design: string | null;
}

export interface ChildStatus {
  readonly id: string;
  readonly title: string;
  readonly status: string;
}

const requiredSections: Record<string, string[]> = {
  epic: ['Requirements', 'Success criteria', 'Anti-patterns', 'Approach'],
  task: ['Goal', 'Behaviors', 'Success criteria'],
  feature: ['Goal', 'Behaviors', 'Success criteria'],
  bug: ['Reproduction steps', 'Expected behavior', 'Actual behavior'],
};

const extractHeadings = (content: string) =>
  content
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.replace(/^## /, '').trim());

export const validateSections = (type: string, description: string) => {
  const required = requiredSections[type];
  if (required == null) {
    return [`unknown bead type: ${type}`];
  }

  const headings = extractHeadings(description);

  return required
    .filter((section) => !headings.some((heading) => heading.startsWith(section)))
    .map((section) => `missing section: ${section}`);
};

export const generateTemplate = (type: string): string | null => {
  const sections = requiredSections[type];
  if (sections == null) {
    return null;
  }

  return sections.map((section) => `## ${section}\n\n`).join('\n');
};

export const appendDesign = (existing: string | null, heading: string, content: string) => {
  const section = `## ${heading}\n\n${content}`;
  if (existing == null || existing.trim() === '') {
    return section;
  }
  return `${existing}\n\n${section}`;
};

export class BrValidateService extends ServiceMap.Service<
  BrValidateService,
  {
    readonly show: (id: string) => Effect.Effect<BeadData, Error>;
    readonly updateDesign: (id: string, design: string) => Effect.Effect<void, Error>;
    readonly readStdin: () => Effect.Effect<string, Error>;
    readonly listChildren: (id: string) => Effect.Effect<ChildStatus[], Error>;
  }
>()('BrValidateService') {}

export const showBead = (id: string) =>
  Effect.gen(function* () {
    const service = yield* BrValidateService;
    return yield* service.show(id);
  });

export const updateDesign = (id: string, design: string) =>
  Effect.gen(function* () {
    const service = yield* BrValidateService;
    return yield* service.updateDesign(id, design);
  });

export const readStdin = () =>
  Effect.gen(function* () {
    const service = yield* BrValidateService;
    return yield* service.readStdin();
  });

export const listChildren = (id: string) =>
  Effect.gen(function* () {
    const service = yield* BrValidateService;
    return yield* service.listChildren(id);
  });
