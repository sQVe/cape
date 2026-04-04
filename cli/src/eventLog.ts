import { appendFileSync, mkdirSync } from 'node:fs';

import { pluginRoot } from './pluginRoot';

export const logEvent = (cmd: string, detail?: string) => {
  try {
    const dir = `${pluginRoot()}/hooks/context`;
    mkdirSync(dir, { recursive: true });
    const entry: { ts: string; cmd: string; detail?: string } = {
      ts: new Date().toISOString(),
      cmd,
    };
    if (detail != null) {
      entry.detail = detail;
    }
    appendFileSync(`${dir}/events.jsonl`, JSON.stringify(entry) + '\n');
  } catch {
    // fire-and-forget — never crash the CLI
  }
};
