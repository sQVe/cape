import { NodeServices } from '@effect/platform-node';
import type { Layer as LayerType } from 'effect';
import { Layer } from 'effect';
import { vi } from 'vitest';

import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubConformLayer,
  stubDetectLayer,
  stubGitLayer,
  stubHookLayer,
  stubPrLayer,
  stubValidateLayer,
} from './testStubs';

const baseCommandLayers = Layer.mergeAll(
  NodeServices.layer,
  stubGitLayer,
  stubDetectLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubBrLayer,
  stubHookLayer,
  stubPrLayer,
  stubValidateLayer,
  stubConformLayer,
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-type-assertion
const base = baseCommandLayers as LayerType.Layer<any>;

export const makeTestCommandLayers = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...overrides: LayerType.Layer<any>[]
) => overrides.reduce((acc, layer) => Layer.merge(acc, layer), base);

export const spyConsole = () => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  return {
    output: () => logSpy.mock.calls.flat().join(''),
    errorOutput: () => errorSpy.mock.calls.flat().join(''),
    restore: () => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    },
  };
};
