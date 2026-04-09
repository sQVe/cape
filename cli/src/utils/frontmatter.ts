export const parseFrontmatter = (content: string): Record<string, string> | null => {
  if (!content.startsWith('---\n')) {
    return null;
  }
  const closing = content.indexOf('\n---\n', 4);
  if (closing === -1) {
    return null;
  }

  const block = content.slice(4, closing);
  const fields: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentValue: string[] = [];

  for (const line of block.split('\n')) {
    const match = line.match(/^(\w+):\s*(.*)/);
    if (match) {
      if (currentKey != null) {
        fields[currentKey] = currentValue.join(' ').trim();
      }
      currentKey = match[1] ?? null;
      currentValue = match[2] ? [match[2]] : [];
    } else if (currentKey != null && /^\s+/.test(line)) {
      currentValue.push(line.trim());
    }
  }
  if (currentKey != null) {
    fields[currentKey] = currentValue.join(' ').trim();
  }
  return fields;
};
