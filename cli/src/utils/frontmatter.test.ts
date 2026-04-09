import { describe, expect, it } from 'vitest';

import { parseFrontmatter, splitFrontmatter } from './frontmatter';

describe('splitFrontmatter', () => {
  it('splits on the standard \\n---\\n terminator', () => {
    const result = splitFrontmatter('---\nname: foo\n---\nbody text');
    expect(result).toEqual({ frontmatter: 'name: foo', body: 'body text' });
  });

  it('splits on trailing \\n--- with no newline after (EOF terminator)', () => {
    const result = splitFrontmatter('---\nname: foo\n---');
    expect(result).toEqual({ frontmatter: 'name: foo', body: '' });
  });

  it('returns null frontmatter for content without leading ---', () => {
    const result = splitFrontmatter('no frontmatter here');
    expect(result).toEqual({ frontmatter: null, body: 'no frontmatter here' });
  });

  it('returns null frontmatter for unclosed frontmatter', () => {
    const result = splitFrontmatter('---\nname: foo\nbody');
    expect(result).toEqual({ frontmatter: null, body: '---\nname: foo\nbody' });
  });

  it('strips leading blank lines from body after standard terminator', () => {
    const result = splitFrontmatter('---\nname: foo\n---\n\n\nbody');
    expect(result).toEqual({ frontmatter: 'name: foo', body: 'body' });
  });
});

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
