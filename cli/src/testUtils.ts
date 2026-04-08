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
  stubTestLayer,
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
  stubTestLayer,
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
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  return {
    output: () => spy.mock.calls.flat().join(''),
    restore: () => {
      spy.mockRestore();
    },
  };
};
