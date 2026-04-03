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
import { HookService } from '../services/hook';

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
    id: Argument.string('id').pipe(Argument.optional),
    type: Flag.string('type').pipe(Flag.optional),
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
      yield* Console.error(JSON.stringify({ error: 'provide either <id> or --type' }));
      return yield* Effect.fail(new Error('provide either <id> or --type'));
    }

    const result = { valid: errors.length === 0, errors };
    yield* Console.log(JSON.stringify(result));

    if (!result.valid) {
      return yield* Effect.fail(new Error(errors.join(', ')));
    }
  }),
).pipe(
  Command.withDescription(
    'Validate required sections of a bead by id or piped stdin. Use after creating or editing a bead to ensure it has all required fields.',
  ),
);

const brDesign = Command.make(
  'design',
  {
    id: Argument.string('id'),
    heading: Argument.string('heading'),
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
    'Append a design section to a bead. Use during brainstorm or write-plan to attach design content.',
  ),
);

const brTemplate = Command.make(
  'template',
  {
    type: Flag.string('type'),
  },
  Effect.fn(function* ({ type }) {
    const template = generateTemplate(type);

    if (template == null) {
      const error = { error: `unknown type: ${type}. valid: epic, task, feature, bug` };
      yield* Console.error(JSON.stringify(error));
      return yield* Effect.fail(new Error(error.error));
    }

    yield* Console.log(template);
  }),
).pipe(
  Command.withDescription(
    'Print a blank bead template for a given type (epic, task, feature, bug). Use when creating new beads.',
  ),
);

const brCloseCheck = Command.make(
  'close-check',
  {
    id: Argument.string('id'),
  },
  Effect.fn(function* ({ id }) {
    const { ready, openItems, checksPassed, checkResults } = yield* runCloseReadinessCheck(id);

    const result = { canClose: ready, openSubtasks: openItems, checksPassed, checkResults };
    yield* Console.log(JSON.stringify(result, null, 2));

    if (!ready) {
      yield* Effect.fail(new Error('close-check failed'));
    }
  }),
).pipe(
  Command.withDescription(
    'Check if a bead can be closed: all subtasks done and project checks pass. Use before closing a task or epic.',
  ),
);

const stopMessage = [
  'A task was just closed via `br close`.',
  'STOP working immediately. Present a checkpoint summary and wait for user input.',
  'Do not start the next task or make further code changes.',
].join(' ');

const brClose = Command.make(
  'close',
  { id: Argument.string('id') },
  Effect.fn(function* ({ id }) {
    const service = yield* HookService;
    const root = service.pluginRoot();

    const output = yield* service.brQuery(['close', id]);
    if (output == null) {
      yield* Console.error(JSON.stringify({ error: `failed to close ${id}` }));
      return yield* Effect.fail(new Error(`failed to close ${id}`));
    }

    yield* service.ensureDir(`${root}/hooks/context`);
    yield* service.removeFile(`${root}/hooks/context/tdd-state.json`);
    yield* service.removeFile(`${root}/hooks/context/flow-phase.json`);
    yield* service.writeFile(`${root}/hooks/context/br-show-log.txt`, '');
    yield* service.writeFile(`${root}/hooks/context/workflow-active.txt`, '');

    yield* Console.log(JSON.stringify({ closed: true, id, stopMessage }));
  }),
).pipe(Command.withDescription('Close a bead issue and reset workflow state files.'));

const brCreate = Command.make(
  'create',
  {
    title: Argument.string('title').pipe(Argument.optional),
    type: Flag.string('type').pipe(Flag.optional),
    priority: Flag.string('priority').pipe(Flag.optional),
    labels: Flag.string('labels').pipe(Flag.optional),
    description: Flag.string('description').pipe(Flag.optional),
    parent: Flag.string('parent').pipe(Flag.optional),
    design: Flag.string('design').pipe(Flag.optional),
  },
  Effect.fn(function* ({ title, type, priority, labels, description, parent, design }) {
    if (design._tag === 'Some') {
      const error = {
        error: 'Use `cape br design <id> <heading>` to attach design content after creation.',
      };
      yield* Console.error(JSON.stringify(error));
      return yield* Effect.fail(new Error(error.error));
    }

    if (type._tag === 'None') {
      yield* Console.error(JSON.stringify({ error: '--type is required' }));
      return yield* Effect.fail(new Error('--type is required'));
    }
    if (priority._tag === 'None') {
      yield* Console.error(JSON.stringify({ error: '--priority is required' }));
      return yield* Effect.fail(new Error('--priority is required'));
    }
    if (labels._tag === 'None') {
      yield* Console.error(JSON.stringify({ error: '--labels is required' }));
      return yield* Effect.fail(new Error('--labels is required'));
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
        yield* Console.error(JSON.stringify({ valid: false, errors }));
        return yield* Effect.fail(new Error(errors.join(', ')));
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
      yield* Console.error(JSON.stringify({ error: 'br create failed' }));
      return yield* Effect.fail(new Error('br create failed'));
    }

    yield* Console.log(JSON.stringify({ created: true, id: output.trim() }));
  }),
).pipe(
  Command.withDescription(
    'Create a bead issue with validation. Validates required flags, description headers, and rejects --design.',
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
    const root = service.pluginRoot();
    yield* service.ensureDir(`${root}/hooks/context`);
    yield* service.writeFile(
      `${root}/hooks/context/flow-phase.json`,
      JSON.stringify({ phase, issueId: id, timestamp: Date.now() }),
    );
    return phase;
  });

const brUpdate = Command.make(
  'update',
  {
    id: Argument.string('id'),
    status: Flag.string('status').pipe(Flag.optional),
    description: Flag.string('description').pipe(Flag.optional),
    design: Flag.string('design').pipe(Flag.optional),
    priority: Flag.string('priority').pipe(Flag.optional),
    labels: Flag.string('labels').pipe(Flag.optional),
  },
  Effect.fn(function* ({ id, status, description, design, priority, labels }) {
    if (status._tag === 'Some') {
      const value = status.value;
      if (value.includes('-')) {
        const suggested = value.replace(/-/g, '_');
        const error = { error: `Invalid status "${value}". Use "${suggested}" (underscore, not hyphen).` };
        yield* Console.error(JSON.stringify(error));
        return yield* Effect.fail(new Error(error.error));
      }
      if (value === 'done') {
        const error = { error: 'Use `cape br close <id>` to close an issue instead of setting status to "done".' };
        yield* Console.error(JSON.stringify(error));
        return yield* Effect.fail(new Error(error.error));
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
      yield* Console.error(JSON.stringify({ error: `br update failed` }));
      return yield* Effect.fail(new Error('br update failed'));
    }

    if (status._tag === 'Some') {
      const phase = yield* writeFlowPhase(id);
      yield* Console.log(JSON.stringify({ updated: true, id, phase }));
      return;
    }

    yield* Console.log(JSON.stringify({ updated: true, id }));
  }),
).pipe(Command.withDescription('Update a bead issue with status validation and flow state tracking.'));

const brExpandedCheck = Command.make(
  'expanded-check',
  { id: Argument.string('id') },
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
    'Check if a bead has an expanded plan in its design field. Returns { hasExpandedPlan: boolean }.',
  ),
);

export const br = Command.make('br').pipe(
  Command.withDescription(
    'Manage beads issues. Use for bead validation, design updates, templates, and close-readiness checks.',
  ),
  Command.withSubcommands([brValidate, brDesign, brTemplate, brCloseCheck, brClose, brCreate, brUpdate, brExpandedCheck]),
);
