import { resolve, dirname } from "path";

export const pluginRoot =
  process.env.CLAUDE_PLUGIN_ROOT ?? dirname(dirname(import.meta.path));
export const contextDir = resolve(pluginRoot, "hooks/context");
export const brShowLog = resolve(contextDir, "br-show-log.txt");
export const editLog = resolve(contextDir, "edit-log.txt");
