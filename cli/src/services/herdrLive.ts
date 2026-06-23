import { execFileSync } from 'node:child_process';

import { Effect, Layer } from 'effect';

import { HerdrService } from './herdr';

const env = (name: string) => {
  // eslint-disable-next-line node/no-process-env
  const value = process.env[name];
  // A blank or whitespace-only value is absent, not a usable id.
  return value == null || value.trim() === '' ? null : value;
};

// Renaming is best-effort: a cosmetic label must never break the cape command that
// triggered it, so failures resolve to false instead of throwing (mirrors hookLive spawnGit).
const rename = (kind: 'workspace' | 'tab', id: string, label: string) =>
  Effect.try({
    try: () => {
      execFileSync('herdr', [kind, 'rename', id, label], { encoding: 'utf-8', timeout: 3000 });
      return true;
    },
    catch: () => new Error('herdr command failed'),
  }).pipe(Effect.orElseSucceed(() => false));

export const HerdrServiceLive = Layer.succeed(HerdrService)({
  workspaceId: () => env('HERDR_WORKSPACE_ID'),
  tabId: () => env('HERDR_TAB_ID'),
  rename,
});
