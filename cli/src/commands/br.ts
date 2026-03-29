import { Console, Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import {
  appendDesign,
  generateTemplate,
  readStdin,
  showBead,
  updateDesign,
  validateSections,
} from '../services/brValidate';

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
);

export const br = Command.make('br').pipe(
  Command.withSubcommands([brValidate, brDesign, brTemplate]),
);
