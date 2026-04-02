import { capeCmd } from '../helpers';

import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('--help boots and exits 0', () => {
    expect(capeCmd(['--help']).status).toBe(0);
  });

  it('--version boots and exits 0', () => {
    expect(capeCmd(['--version']).status).toBe(0);
  });

  it('br boots and exits 0', () => {
    expect(capeCmd(['br', '--help']).status).toBe(0);
  });

  it('check boots and exits 0', () => {
    expect(capeCmd(['check', '--help']).status).toBe(0);
  });

  it('commit boots and exits 0', () => {
    expect(capeCmd(['commit', '--help']).status).toBe(0);
  });

  it('conform boots and exits 0', () => {
    expect(capeCmd(['conform', '--help']).status).toBe(0);
  });

  it('context boots and exits 0', () => {
    expect(capeCmd(['context', '--help']).status).toBe(0);
  });

  it('detect boots and exits 0', () => {
    expect(capeCmd(['detect']).status).toBe(0);
  });

  it('epic boots and exits 0', () => {
    expect(capeCmd(['epic', '--help']).status).toBe(0);
  });

  it('git context boots and exits 0', () => {
    expect(capeCmd(['git', 'context']).status).toBe(0);
  });

  it('hook boots and exits 0', () => {
    expect(capeCmd(['hook', '--help']).status).toBe(0);
  });

  it('pr boots and exits 0', () => {
    expect(capeCmd(['pr', '--help']).status).toBe(0);
  });

  it('stats boots and exits 0', () => {
    expect(capeCmd(['stats', '--help']).status).toBe(0);
  });

  it('test boots and exits 0', () => {
    expect(capeCmd(['test', '--help']).status).toBe(0);
  });

  it('validate boots and exits 0', () => {
    expect(capeCmd(['validate']).status).toBe(0);
  });
});
