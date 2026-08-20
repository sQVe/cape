import { Effect } from 'effect';

import { denyTable } from './denyTable';
import { parseCommand, parseCwd, stripQuotedContent } from './parsing';
import { HookService, resolveBranchInfo } from './state';

export { denyTable } from './denyTable';

export const denyWith = (reason: string) => ({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse' as const,
    permissionDecision: 'deny' as const,
    permissionDecisionReason: reason,
  },
});

export const preToolUseBash = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const command = parseCommand(input);
    if (!command) {
      return null;
    }

    const stripped = stripQuotedContent(command);

    for (const entry of denyTable) {
      if (entry.pattern.test(stripped)) {
        return denyWith(entry.message);
      }
    }

    if (/\bgit\s+push\b/.test(stripped)) {
      const cwd = parseCwd(input) ?? undefined;
      const { branch, defaultBranch } = yield* resolveBranchInfo(cwd);
      if (branch != null) {
        if (branch === defaultBranch) {
          return denyWith(
            `Push from \`${branch}\` is blocked. Reason: direct pushes to the default branch bypass review. Run \`cape git create-branch --help\` to start a feature branch first.`,
          );
        }
      }
    }

    return null;
  });
