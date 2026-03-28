export const brQuery = (args: string[]): string | null => {
  try {
    const result = Bun.spawnSync(["br", ...args], { timeout: 3000 });
    if (result.exitCode !== 0) {
      return null;
    }
    return result.stdout.toString().trim();
  } catch {
    return null;
  }
};

interface FlowState {
  bugs: string | null;
  inProgressTasks: string | null;
  epics: string | null;
}

export const queryFlowState = (): FlowState => ({
  bugs: brQuery(["list", "--type", "bug", "--status", "open"]),
  inProgressTasks: brQuery([
    "list",
    "--status",
    "in_progress",
    "--type",
    "task",
  ]),
  epics: brQuery(["list", "--type", "epic", "--status", "open"]),
});

export const deriveFlowContext = (state: FlowState): string | null => {
  const brAvailable =
    state.bugs !== null ||
    state.inProgressTasks !== null ||
    state.epics !== null;
  if (!brAvailable) {
    return null;
  }

  let phase: string;
  if (state.bugs) {
    phase = "debugging";
  } else if (state.inProgressTasks) {
    phase = "executing";
  } else if (state.epics) {
    phase = "planning";
  } else {
    phase = "idle";
  }
  return `<flow-context>Current phase: ${phase}</flow-context>`;
};
