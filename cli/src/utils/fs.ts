import { randomUUID } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';

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
  writeFileSync(tempPath, content);
  renameSync(tempPath, path);
};
