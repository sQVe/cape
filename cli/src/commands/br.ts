import { Console, Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import {
  appendDesign,
  generateTemplate,
  listChildren,
  readStdin,
  showBead,
  updateDesign,
  validateSections,
} from '../services/brValidate';
import { getCheckResults } from '../services/check';
import { getDetectResult } from '../services/detect';
import { HookService, removeStateKey, writeStateKey } from '../services/hook';

export const runCloseReadinessCheck = (id: string) =>
  Effect.fn(function* () {
    const children = yield* listChildren(id).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const openItems = children.filter((child) => child.status !== 'closed');

    const ecosystems = yield* getDetectResult.pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const checkResults = yield* getCheckResults(ecosystems).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const checksPassed = checkResults.every((r) => r.passed);
    const ready = openItems.length === 0 && checksPassed;

    return { ready, openItems, checksPassed, checkResults };
  })();

const brValidate = Command.make(
  'validate',
  {
    id: Argument.string('id').pipe(Argument.withDescription('Bead ID to validate'), Argument.optional),
    type: Flag.string('type').pipe(Flag.withDescription('Bead type for stdin validation: epic | task | feature | bug'), Flag.optional),
  },
  Effect.fn(function* ({ id, type }) {
    let errors: string[];

    if (type._tag === 'Some') {
      const content = yield* readStdin();
      errors = validateSections(type.value, content);
    } else if (id._tag === 'Some') {
      const bead = yield* showBead(id.value);
      errors = validateSections(bead.issue_type, bead.description);
    } else {
      return yield* Console.error(JSON.stringify({ error: 'provide either <id> or --type' })).pipe(
        Effect.andThen(Effect.die(new Error('provide either <id> or --type'))),
      );
    }

    const result = { valid: errors.length === 0, errors };
    yield* Console.log(JSON.stringify(result));

    if (!result.valid) {
      const error = errors.join(', ');
      return yield* Console.error(JSON.stringify({ error })).pipe(
        Effect.andThen(Effect.die(new Error(error))),
      );
    }
  }),
).pipe(
  Command.withDescription(
    'Validate required sections of a bead by id or piped stdin. Returns { valid, errors }. Use after creating or editing a bead.',
  ),
);

const brDesign = Command.make(
  'design',
  {
    id: Argument.string('id').pipe(Argument.withDescription('Bead ID to append design to')),
    heading: Argument.string('heading').pipe(Argument.withDescription('Section heading for the appended content')),
  },
  Effect.fn(function* ({ id, heading }) {
    const bead = yield* showBead(id);
    const content = yield* readStdin();
    const newDesign = appendDesign(bead.design, heading, content);
    yield* updateDesign(id, newDesign);
    yield* Console.log(JSON.stringify({ updated: true, id }));
  }),
).pipe(
  Command.withDescription(
    'Append a design section to a bead from stdin. Returns { updated, id }. Use during brainstorm or write-plan.',
  ),
);

const brTemplate = Command.make(
  'template',
  {
    type: Flag.string('type').pipe(Flag.withDescription('Bead type: epic | task | feature | bug')),
  },
  Effect.fn(function* ({ type }) {
    const template = generateTemplate(type);

    if (template == null) {
      const error = `unknown type: ${type}. valid: epic, task, feature, bug`;
      return yield* Console.error(JSON.stringify({ error })).pipe(
        Effect.andThen(Effect.die(new Error(error))),
      );
    }

    yield* Console.log(template);
  }),
).pipe(
  Command.withDescription(
    'Print a blank bead template for a given type. Outputs raw markdown. Use when creating new beads.',
  ),
);

const brCloseCheck = Command.make(
  'close-check',
  {
    id: Argument.string('id').pipe(Argument.withDescription('Bead ID to check close readiness for')),
  },
  Effect.fn(function* ({ id }) {
    const { ready, openItems, checksPassed, checkResults } = yield* runCloseReadinessCheck(id);

    const result = { canClose: ready, openSubtasks: openItems, checksPassed, checkResults };
    yield* Console.log(JSON.stringify(result, null, 2));

    if (!ready) {
      const error = `close-check failed for ${id}: ${openItems.length} open task(s), checks ${checksPassed ? 'passed' : 'failed'}`;
      yield* Console.error(JSON.stringify({ error })).pipe(
        Effect.andThen(Effect.die(new Error(error))),
      );
    }
  }),
).pipe(
  Command.withDescription(
    'Check if a bead can be closed: all subtasks done and project checks pass. Returns { canClose, openSubtasks, checksPassed }. Use before closing a task or epic.',
  ),
);

const stopMessage = [
  'A task was just closed via `br close`.',
  'STOP working immediately. Present a checkpoint summary and wait for user input.',
  'Do not start the next task or make further code changes.',
].join(' ');

const brClose = Command.make(
  'close',
  { id: Argument.string('id').pipe(Argument.withDescription('Bead ID to close')) },
  Effect.fn(function* ({ id }) {
    const service = yield* HookService;
    const root = service.pluginRoot();

    const output = yield* service.brQuery(['close', id]);
    if (output == null) {
      return yield* Console.error(JSON.stringify({ error: `failed to close ${id}` })).pipe(
        Effect.andThen(Effect.die(new Error(`failed to close ${id}`))),
      );
    }

    yield* service.ensureDir(`${root}/hooks/context`);
    yield* removeStateKey('tddState');
    yield* removeStateKey('flowPhase');
    yield* removeStateKey('workflowActive');
    yield* service.writeFile(`${root}/hooks/context/br-show-log.txt`, '');

    yield* Console.log(JSON.stringify({ closed: true, id, stopMessage }));
  }),
).pipe(Command.withDescription('Close a bead issue and reset workflow state files. Returns { closed, id }. Use after close-check passes.'));

const brCreate = Command.make(
  'create',
  {
    title: Argument.string('title').pipe(Argument.withDescription('Issue title'), Argument.optional),
    type: Flag.string('type').pipe(Flag.withDescription('Bead type: epic | task | feature | bug'), Flag.optional),
    priority: Flag.string('priority').pipe(Flag.withDescription('Priority level: P1 | P2 | P3'), Flag.optional),
    labels: Flag.string('labels').pipe(Flag.withDescription('Comma-separated labels, e.g. hitl, afk, cape'), Flag.optional),
    description: Flag.string('description').pipe(Flag.withDescription('Bead description with required sections; reads stdin if omitted'), Flag.optional),
    parent: Flag.string('parent').pipe(Flag.withDescription('Parent bead ID for child issues'), Flag.optional),
    design: Flag.string('design').pipe(Flag.withDescription('Rejected: use cape br design <id> <heading> instead'), Flag.optional),
  },
  Effect.fn(function* ({ title, type, priority, labels, description, parent, design }) {
    if (design._tag === 'Some') {
      const error = 'Use `cape br design <id> <heading>` to attach design content after creation.';
      return yield* Console.error(JSON.stringify({ error })).pipe(
        Effect.andThen(Effect.die(new Error(error))),
      );
    }

    if (type._tag === 'None') {
      return yield* Console.error(JSON.stringify({ error: '--type is required' })).pipe(
        Effect.andThen(Effect.die(new Error('--type is required'))),
      );
    }
    if (priority._tag === 'None') {
      return yield* Console.error(JSON.stringify({ error: '--priority is required' })).pipe(
        Effect.andThen(Effect.die(new Error('--priority is required'))),
      );
    }
    if (labels._tag === 'None') {
      return yield* Console.error(JSON.stringify({ error: '--labels is required' })).pipe(
        Effect.andThen(Effect.die(new Error('--labels is required'))),
      );
    }

    const service = yield* HookService;

    let descContent: string;
    if (description._tag === 'Some') {
      descContent = description.value;
    } else {
      descContent = yield* service.readStdin();
    }

    if (descContent) {
      const errors = validateSections(type.value, descContent);
      if (errors.length > 0) {
        const error = errors.join(', ');
        return yield* Console.error(JSON.stringify({ error })).pipe(
          Effect.andThen(Effect.die(new Error(error))),
        );
      }
    }

    const args: string[] = ['create'];
    if (title._tag === 'Some') {
      args.push(title.value);
    }
    args.push('--type', type.value, '--priority', priority.value, '--labels', labels.value);
    if (descContent) {
      args.push('--description', descContent);
    }
    if (parent._tag === 'Some') {
      args.push('--parent', parent.value);
    }
    args.push('--silent');

    const output = yield* service.brQuery(args);
    if (output == null) {
      const titleContext = title._tag === 'Some' ? ` "${title.value}"` : '';
      const error = `br create failed: ${type.value}${titleContext}`;
      return yield* Console.error(JSON.stringify({ error })).pipe(
        Effect.andThen(Effect.die(new Error(error))),
      );
    }

    yield* Console.log(JSON.stringify({ created: true, id: output.trim() }));
  }),
).pipe(
  Command.withDescription(
    'Create a bead issue with section validation. Returns { created, id }. Use when creating new epics, tasks, features, or bugs.',
  ),
);

const derivePhase = (issueType: string) => {
  if (issueType === 'bug') {
    return 'debugging';
  }
  if (issueType === 'epic') {
    return 'planning';
  }
  return 'executing';
};

const writeFlowPhase = (id: string) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const showOutput = yield* service.brQuery(['show', id, '--json']);
    let phase = 'executing';
    if (showOutput != null) {
      try {
        const data: unknown = JSON.parse(showOutput);
        if (typeof data === 'object' && data != null && 'issue_type' in data && typeof data.issue_type === 'string') {
          phase = derivePhase(data.issue_type);
        }
      } catch {
        // fall through with default phase
      }
    }
    yield* writeStateKey('flowPhase', { phase, issueId: id });
    return phase;
  });

const brUpdate = Command.make(
  'update',
  {
    id: Argument.string('id').pipe(Argument.withDescription('Bead ID to update')),
    status: Flag.string('status').pipe(Flag.withDescription('New status: open | in_progress (use cape br close for done)'), Flag.optional),
    description: Flag.string('description').pipe(Flag.withDescription('Replacement description content'), Flag.optional),
    design: Flag.string('design').pipe(Flag.withDescription('Replacement design content'), Flag.optional),
    priority: Flag.string('priority').pipe(Flag.withDescription('Priority level: P1 | P2 | P3'), Flag.optional),
    labels: Flag.string('labels').pipe(Flag.withDescription('Comma-separated labels'), Flag.optional),
  },
  Effect.fn(function* ({ id, status, description, design, priority, labels }) {
    if (status._tag === 'Some') {
      const value = status.value;
      if (value.includes('-')) {
        const suggested = value.replace(/-/g, '_');
        const error = `Invalid status "${value}". Use "${suggested}" (underscore, not hyphen).`;
        return yield* Console.error(JSON.stringify({ error })).pipe(
          Effect.andThen(Effect.die(new Error(error))),
        );
      }
      if (value === 'done') {
        const error = 'Use `cape br close <id>` to close an issue instead of setting status to "done".';
        return yield* Console.error(JSON.stringify({ error })).pipe(
          Effect.andThen(Effect.die(new Error(error))),
        );
      }
    }

    const service = yield* HookService;
    const args: string[] = ['update', id];
    if (status._tag === 'Some') {
      args.push('--status', status.value);
    }
    if (description._tag === 'Some') {
      args.push('--description', description.value);
    }
    if (design._tag === 'Some') {
      args.push('--design', design.value);
    }
    if (priority._tag === 'Some') {
      args.push('--priority', priority.value);
    }
    if (labels._tag === 'Some') {
      args.push('--labels', labels.value);
    }

    const output = yield* service.brQuery(args);
    if (output == null) {
      const error = `br update failed for ${id}`;
      return yield* Console.error(JSON.stringify({ error })).pipe(
        Effect.andThen(Effect.die(new Error(error))),
      );
    }

    if (status._tag === 'Some') {
      const phase = yield* writeFlowPhase(id);
      yield* Console.log(JSON.stringify({ updated: true, id, phase }));
      return;
    }

    yield* Console.log(JSON.stringify({ updated: true, id }));
  }),
).pipe(Command.withDescription('Update a bead issue fields with status validation and flow state tracking. Returns { updated, id, phase? }. Use to change status, description, or priority.'));

const brExpandedCheck = Command.make(
  'expanded-check',
  { id: Argument.string('id').pipe(Argument.withDescription('Bead ID to check for expanded plan')) },
  Effect.fn(function* ({ id }) {
    const bead = yield* showBead(id).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const hasExpandedPlan =
      bead.design?.includes('## Expanded plan') ?? false;

    yield* Console.log(JSON.stringify({ hasExpandedPlan }));
  }),
).pipe(
  Command.withDescription(
    'Check if a bead has an expanded plan in its design field. Returns { hasExpandedPlan }. Use during task expansion to check skip eligibility.',
  ),
);

export const br = Command.make('br').pipe(
  Command.withDescription(
    'Manage bead issues: validate, design, template, create, update, close, and close-check. Use for all bead lifecycle operations.',
  ),
  Command.withSubcommands([brValidate, brDesign, brTemplate, brCloseCheck, brClose, brCreate, brUpdate, brExpandedCheck]),
);
