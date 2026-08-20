type DenyTier = 'redirect' | 'block';

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
    pattern: /\bgh\s+pr\s+merge\b/,
    message: 'PR merge via CLI is blocked. Reason: merges must go through review in the GitHub UI.',
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
];
