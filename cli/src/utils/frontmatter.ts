export const splitFrontmatter = (
  raw: string,
): { frontmatter: string | null; body: string } => {
  if (!raw.startsWith('---\n')) {
    return { frontmatter: null, body: raw };
  }

  const closing = raw.indexOf('\n---\n', 4);
  if (closing !== -1) {
    return {
      frontmatter: raw.slice(4, closing),
      body: raw.slice(closing + 5).replace(/^\n+/, ''),
    };
  }

  const closingEnd = raw.indexOf('\n---', 4);
  if (closingEnd !== -1 && closingEnd + 4 >= raw.length) {
    return { frontmatter: raw.slice(4, closingEnd), body: '' };
  }

  return { frontmatter: null, body: raw };
};

export const parseFrontmatter = (content: string): Record<string, string> | null => {
  const { frontmatter } = splitFrontmatter(content);
  if (frontmatter == null) {
    return null;
  }

  const fields: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentValue: string[] = [];

  for (const line of frontmatter.split('\n')) {
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
