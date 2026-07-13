import { randomUUID } from 'node:crypto';
import { readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';

export const readFileUtf8 = (path: string): string => readFileSync(path, 'utf-8');

export const tryReadFileUtf8 = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
};

export const writeFileAtomic = (path: string, content: string): void => {
  const tempPath = `${path}.${randomUUID()}.tmp`;
  const mode = statSync(path, { throwIfNoEntry: false })?.mode;
  try {
    writeFileSync(tempPath, content, mode == null ? {} : { mode });
    renameSync(tempPath, path);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
};
