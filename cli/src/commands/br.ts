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
).pipe(Command.withDescription('Validate required sections of a bead by id or piped stdin. Use after creating or editing a bead to ensure it has all required fields.'));

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
).pipe(Command.withDescription('Append a design section to a bead. Use during brainstorm or write-plan to attach design content.'));

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
).pipe(Command.withDescription('Print a blank bead template for a given type (epic, task, feature, bug). Use when creating new beads.'));

const brCloseCheck = Command.make(
  'close-check',
  {
    id: Argument.string('id'),
  },
  Effect.fn(function* ({ id }) {
    const children = yield* listChildren(id).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const openSubtasks = children.filter((child) => child.status !== 'closed');

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
    const canClose = openSubtasks.length === 0 && checksPassed;

    const result = { canClose, openSubtasks, checksPassed, checkResults };
    yield* Console.log(JSON.stringify(result, null, 2));

    if (!canClose) {
      yield* Effect.fail(new Error('close-check failed'));
    }
  }),
).pipe(Command.withDescription('Check if a bead can be closed: all subtasks done and project checks pass. Use before closing a task or epic.'));

export const br = Command.make('br').pipe(
  Command.withDescription('Manage beads issues. Use for bead validation, design updates, templates, and close-readiness checks.'),
  Command.withSubcommands([brValidate, brDesign, brTemplate, brCloseCheck]),
);

