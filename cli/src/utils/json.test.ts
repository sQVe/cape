import { describe, expect, it } from 'vitest';

import { safeParseJson } from './json';

describe('safeParseJson', () => {
  it('returns the parsed value for valid JSON objects', () => {
    expect(safeParseJson('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' });
  });

  it('returns null for invalid JSON', () => {
    expect(safeParseJson('{not json')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(safeParseJson('')).toBeNull();
  });
});
