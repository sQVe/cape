import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const pluginRoot = () =>
  // eslint-disable-next-line node/no-process-env
  process.env.CLAUDE_PLUGIN_ROOT ?? dirname(dirname(new URL(import.meta.url).pathname));

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
