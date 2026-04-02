import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export default function setup() {
  const result = spawnSync('pnpm', ['build'], {
    cwd: join(import.meta.dirname, '..', '..'),
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('CLI build failed');
  }
}
