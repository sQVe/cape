const beadsPatterns = [
  /\bbr\b/i,
  /\bbeads?\b/i,
  /\.beads/i,
  /issue.*(track|create|log)/i,
  /track.*(bug|issue|finding|gap|these|them)/i,
  /what.*(task|work).*next/i,
  /batch.*(create|issue)/i,
  /--design.*create/i,
  /--description.*--design/i,
  /\bgaps?\b.*\btrack/i,
];

const managingPattern = /(?:split|merge|archiv).*\bbr-/i;

export const detectBeadsSkill = (prompt: string) => {
  if (managingPattern.test(prompt)) {
    return false;
  }
  return beadsPatterns.some((pattern) => pattern.test(prompt));
};

const errorPatterns = [
  /(?:^|\n)\s*at\s+\S+\s+\(.*:\d+:\d+\)/,
  /(?:^|\n)\s*File ".*", line \d+/,
  /(?:^|\n)(?:panic|fatal|FATAL|PANIC):/,
  /(?:^|\n)\S+Error:/,
  /(?:^|\n)Traceback \(most recent call last\)/,
  /(?:getting|seeing|hitting|got|have)\s+(?:an?\s+)?error/i,
  /(?:this|it)\s+(?:is\s+)?(?:broken|crashing|failing)(?!\s+(?:into|down|up|to)\b)/i,
];

export const detectDebugIssue = (prompt: string) =>
  errorPatterns.some((pattern) => pattern.test(prompt));

const continuePatterns = [
  /^(?:yes,?\s+)?(?:continue|keep going|carry on|next task|proceed|go ahead)\.?$/i,
];

export const detectExecutePlan = (prompt: string) =>
  continuePatterns.some((pattern) => pattern.test(prompt));

export const normalizeEventName = (name: string) => {
  if (name.includes('-')) {
    return name
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
  return name;
};

export const stripQuotedContent = (command: string): string => {
  let stripped = command;
  stripped = stripped.replace(/<<-?\s*['"]?(\w+)['"]?\n[\s\S]*?\n\s*\1\b/g, '<<HEREDOC');
  stripped = stripped.replace(/"[^"]*"/g, '""');
  stripped = stripped.replace(/'[^']*'/g, "''");
  return stripped;
};

const parseString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export const parseCommand = (input: string): string | null => {
  try {
    const data = JSON.parse(input);
    return parseString(data.tool_input?.command);
  } catch {
    return null;
  }
};

export interface SkillInput {
  readonly name: string;
  readonly args: string | null;
}

export const parseSkillInput = (input: string): SkillInput | null => {
  try {
    const data = JSON.parse(input);
    const name = parseString(data.tool_input?.skill);
    if (!name) {
      return null;
    }
    return { name, args: parseString(data.tool_input?.args) };
  } catch {
    return null;
  }
};

