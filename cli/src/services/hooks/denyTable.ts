type DenyTier = 'redirect' | 'block' | 'warn';

interface DenyEntry {
  readonly pattern: RegExp;
  readonly message: string;
  readonly tier: DenyTier;
}

export const denyTable: readonly DenyEntry[] = [
  {
    pattern: /\bgit\s+commit\b.*--amend\b/,
    message: 'Commit amend is blocked. Create a new commit instead.',
    tier: 'block',
  },
  {
    pattern: /\bgit\s+push\b.*(?:--force\b(?!-)|-f\b)/,
    message: 'Force push is blocked.',
    tier: 'block',
  },
  {
    pattern: /\bgh\s+pr\s+merge\b/,
    message: 'PR merge via CLI is blocked. Merge through the GitHub UI.',
    tier: 'block',
  },
  {
    pattern: /\bgh\s+pr\s+close\b/,
    message: 'PR close via CLI is blocked. Close through the GitHub UI.',
    tier: 'block',
  },
  {
    pattern: /\bgit\s+commit\b/,
    message: 'Use `cape commit` instead of raw `git commit`.',
    tier: 'redirect',
  },
  // Re-enable as each cape command is implemented:
  {
    pattern: /(?<!\bcape\s)\bbr\s+create\b/,
    message: 'Use `cape br create` instead of raw `br create`.',
    tier: 'redirect',
  },
  // { pattern: /(?<!\bcape\s)\bbr\s+q\b/, message: 'Use `cape br q` to query beads.', tier: 'redirect' },
  {
    pattern: /(?<!\bcape\s)\bbr\s+update\b.*--status\b/,
    message: 'Use `cape br update` to change issue status.',
    tier: 'redirect',
  },
  {
    pattern: /(?<!\bcape\s)\bbr\s+close\b/,
    message: 'Use `cape br close` to close an issue.',
    tier: 'redirect',
  },
  {
    pattern: /(?<!\bcape\s)\bgh\s+pr\s+create\b/,
    message: 'Use `cape pr create` instead of raw `gh pr create`.',
    tier: 'redirect',
  },
  {
    pattern: /(?<!\bcape\s)\bgit\s+(?:checkout\s+-b|switch\s+(?:-c|--create)\s|branch\s+(?!-)\w)/,
    message: 'Use `cape git create-branch` to create a branch.',
    tier: 'redirect',
  },
  {
    pattern:
      /(?<!\bcape\s)\b(?:npx vitest|vitest|bun test|npm test|pytest|go test|cargo test|busted|python -m (?:pytest|unittest))(?:\s|$)/,
    message: 'Use `cape test` to run tests so TDD state is tracked.',
    tier: 'redirect',
  },
  {
    pattern: /\bgit\s+reset\s+--hard\b/,
    message:
      '`git reset --hard` discards uncommitted changes permanently. Consider `git stash` first.',
    tier: 'warn',
  },
  {
    pattern: /\bgit\s+checkout\s+--(?:\s|$)/,
    message: '`git checkout --` discards working tree changes. Consider `git stash` first.',
    tier: 'warn',
  },
  {
    pattern: /\bgit\s+clean\b.*-f\b/,
    message: '`git clean -f` permanently removes untracked files. Consider `git clean -n` first.',
    tier: 'warn',
  },
];
