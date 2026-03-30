import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { Effect, Layer } from 'effect';

import { BrValidateService } from './brValidate';
import type { BeadData, ChildStatus } from './brValidate';

const parseBead = (output: string, id: string): BeadData => {
  const parsed: unknown = JSON.parse(output);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`bead not found: ${id}`);
  }
  const [bead] = parsed;
  return bead;
};

const show = (id: string) =>
  Effect.try({
    try: () => {
      const output = execFileSync('br', ['show', id, '--format', 'json'], {
        encoding: 'utf-8',
      });
      return parseBead(output, id);
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('br show failed', { cause: error }),
  });

const updateDesign = (id: string, design: string) =>
  Effect.try({
    try: () => {
      execFileSync('br', ['update', id, '--design', design], {
        encoding: 'utf-8',
      });
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('br update failed', { cause: error }),
  });

const readStdin = () =>
  Effect.try({
    try: () => readFileSync('/dev/stdin', 'utf-8').trim(),
    catch: (error) =>
      error instanceof Error ? error : new Error('failed to read stdin', { cause: error }),
  });

const isRecord = (v: unknown): v is Record<string, unknown> => v != null && typeof v === 'object';

const toStr = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

const listChildren = (id: string) =>
  Effect.try({
    try: (): ChildStatus[] => {
      const output = execFileSync('br', ['show', id, '--format', 'json'], {
        encoding: 'utf-8',
      });
      const parsed: unknown = JSON.parse(output);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [];
      }
      const bead = parsed[0];
      const dependents: unknown[] = bead.dependents ?? [];

      return dependents
        .filter((dep) => isRecord(dep) && dep.dependency_type === 'parent-child')
        .map((dep) => {
          const d = isRecord(dep) ? dep : {};
          return {
            id: toStr(d.id, ''),
            title: toStr(d.title, ''),
            status: toStr(d.status, 'unknown'),
          };
        });
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('br show failed', { cause: error }),
  });

export const BrValidateServiceLive = Layer.succeed(BrValidateService)({
  show,
  updateDesign,
  readStdin,
  listChildren,
});
