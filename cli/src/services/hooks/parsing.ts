import { basename, extname } from 'node:path';

const testFilePattern =
  /\.(test|spec)\.(ts|tsx|js|jsx)$|_test\.go$|_spec\.lua$|^test_.*\.py$|[\\/]__tests__[\\/]/;

export const isTestFile = (filePath: string): boolean =>
  testFilePattern.test(filePath) || testFilePattern.test(basename(filePath));

const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.go', '.py', '.rs', '.lua']);

export const isCodeFile = (filePath: string): boolean => codeExtensions.has(extname(filePath));

export const MAX_NEW_TEST_BLOCKS = 1;
const testBlockPattern = /\b(?:it|test)\s*(?:\.\s*\w+\s*)?\(/g;

export const countTestBlocks = (content: string): number => {
  const matches = content.match(testBlockPattern);
  return matches?.length ?? 0;
};

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

export const parseFilePath = (input: string): string | null => {
  try {
    const data = JSON.parse(input);
    return parseString(data.tool_input?.file_path);
  } catch {
    return null;
  }
};

export interface EditInput {
  readonly filePath: string;
  readonly oldString: string;
  readonly newString: string;
}

export const parseEditInput = (input: string): EditInput | null => {
  try {
    const data = JSON.parse(input);
    const filePath = parseString(data.tool_input?.file_path);
    const oldString = parseString(data.tool_input?.old_string);
    const newString = parseString(data.tool_input?.new_string);
    if (!filePath || oldString == null || newString == null) {
      return null;
    }
    return { filePath, oldString, newString };
  } catch {
    return null;
  }
};

export interface WriteInput {
  readonly filePath: string;
  readonly content: string;
}

export const parseWriteInput = (input: string): WriteInput | null => {
  try {
    const data = JSON.parse(input);
    const filePath = parseString(data.tool_input?.file_path);
    const content = parseString(data.tool_input?.content);
    if (!filePath || content == null) {
      return null;
    }
    return { filePath, content };
  } catch {
    return null;
  }
};
