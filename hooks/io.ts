export const parseStdin = async <T>(): Promise<T> => {
  const raw = await Bun.stdin.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    return process.exit(0);
  }
};

export const deny = (reason: string) => {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
};
