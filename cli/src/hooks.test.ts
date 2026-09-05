import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('PostToolUse hooks', () => {
  it('matches Linear save_issue for any MCP server name', () => {
    const config = JSON.parse(
      readFileSync(new URL('../../hooks/hooks.json', import.meta.url), 'utf8'),
    ) as {
      hooks: {
        PostToolUse: { matcher: string; hooks: { command: string }[] }[];
      };
    };
    const hook = config.hooks.PostToolUse.find(({ hooks }) =>
      hooks.some(({ command }) => command === 'cape hook post-tool-use --matcher linear-write'),
    );
    const matcher = new RegExp(hook?.matcher ?? '');

    expect(matcher.test('mcp__plugin_linear_linear__save_issue')).toBe(true);
    expect(matcher.test('mcp__linear-platform__save_issue')).toBe(true);
    expect(matcher.test('mcp__claude_ai_Linear__save_issue')).toBe(true);
    expect(matcher.test('mcp__plugin_linear_linear__get_issue')).toBe(false);
    expect(matcher.test('mcp__github__create_issue')).toBe(false);
    expect(matcher.test('mcp__jira__save_issue')).toBe(false);
  });
});
