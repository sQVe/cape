type DenyTier = 'redirect' | 'block' | 'warn';

interface DenyEntry {
  readonly pattern: RegExp;
  readonly message: string;
  readonly tier: DenyTier;
}

export const denyTable: readonly DenyEntry[] = [
  {
    pattern: /\bgit\s+commit\b.*--amend\b/,
    message:
      'Commit amend is blocked. Reason: amending rewrites history and can overwrite work already shared in the previous commit.',
    tier: 'block',
  },
  {
    pattern: /\bgit\s+push\b.*(?:--force\b(?!-)|-f\b)/,
    message:
      'Force push is blocked. Reason: it can overwrite commits on the remote that others depend on.',
    tier: 'block',
  },
  {
    pattern: /\bgh\s+pr\s+merge\b/,
    message:
      'PR merge via CLI is blocked. Reason: merges must go through review in the GitHub UI.',
    tier: 'block',
  },
  {
    pattern: /\bgh\s+pr\s+close\b/,
    message:
      'PR close via CLI is blocked. Reason: closing a PR silently loses review discussion; close it in the GitHub UI.',
    tier: 'block',
  },
  {
    pattern: /\bgit\s+commit\b/,
    message:
      'Use `cape commit` instead of raw `git commit`. Run `cape commit --help` to learn the workflow.',
    tier: 'redirect',
  },
  // Re-enable as each cape command is implemented:
  {
    pattern: /(?<!\bcape\s)\bbr\s+create\b/,
    message:
      'Use `cape br create` instead of raw `br create`. Run `cape br create --help` to learn the workflow.',
    tier: 'redirect',
  },
  // { pattern: /(?<!\bcape\s)\bbr\s+q\b/, message: 'Use `cape br q` to query beads.', tier: 'redirect' },
  {
    pattern: /(?<!\bcape\s)\bbr\s+update\b.*--status\b/,
    message:
      'Use `cape br update` to change issue status. Run `cape br update --help` to learn the workflow.',
    tier: 'redirect',
  },
  {
    pattern: /(?<!\bcape\s)\bbr\s+close\b/,
    message:
      'Use `cape br close` to close an issue. Run `cape br close --help` to learn the workflow.',
    tier: 'redirect',
  },
  {
    pattern: /(?<!\bcape\s)\bgh\s+pr\s+create\b/,
    message:
      'Use `cape pr create` instead of raw `gh pr create`. Run `cape pr create --help` to learn the workflow.',
    tier: 'redirect',
  },
  {
    pattern: /(?<!\bcape\s)\bgit\s+(?:checkout\s+-b|switch\s+(?:-c|--create)\s|branch\s+(?!-)\w)/,
    message:
      'Use `cape git create-branch` to create a branch. Run `cape git create-branch --help` to learn the workflow.',
    tier: 'redirect',
  },
  {
    pattern: /\bgit\s+reset\s+--hard\b/,
    message:
      'Caution: `git reset --hard` risks discarding uncommitted changes permanently. Consider `git stash` first.',
    tier: 'warn',
  },
  {
    pattern: /\bgit\s+checkout\s+--(?:\s|$)/,
    message:
      'Caution: `git checkout --` risks discarding working tree changes. Consider `git stash` first.',
    tier: 'warn',
  },
  {
    pattern: /\bgit\s+clean\b.*-f\b/,
    message:
      'Caution: `git clean -f` risks permanently removing untracked files. Consider `git clean -n` first.',
    tier: 'warn',
  },
];
