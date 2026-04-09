import { execFileSync } from 'node:child_process';

export const gitRoot = (): string =>
  execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
