import { readFileSync } from 'node:fs';

export const readFileUtf8 = (path: string): string => readFileSync(path, 'utf-8');

export const tryReadFileUtf8 = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
};
