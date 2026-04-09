import { describe, expect, it } from 'vitest';

import { parseFrontmatter } from './frontmatter';

describe('parseFrontmatter', () => {
  it('parses valid frontmatter', () => {
    const result = parseFrontmatter('---\nname: foo\ndescription: bar\n---\nbody');
    expect(result).toEqual({ name: 'foo', description: 'bar' });
  });

  it('returns null for missing frontmatter', () => {
    expect(parseFrontmatter('no frontmatter')).toBeNull();
  });

  it('returns null for unclosed frontmatter', () => {
    expect(parseFrontmatter('---\nname: foo\nbody')).toBeNull();
  });

  it('handles multiline values', () => {
    const result = parseFrontmatter('---\ndescription: >\n  line one\n  line two\n---\n');
    expect(result?.description).toBe('> line one line two');
  });
});
