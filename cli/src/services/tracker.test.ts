import { describe, expect, it } from 'vitest';

import type { TrackerCache } from './tracker';
import { findEpic } from './tracker';

const cache: TrackerCache = {
  version: 1,
  timestamp: 1000,
  epics: {
    'AI-15': {
      id: 'AI-15',
      title: 'Cape V2',
      status: 'In Progress',
      humanTicketId: 'ABU-14',
      tasks: [],
    },
  },
};

describe('findEpic', () => {
  it('finds an epic by its plan issue id', () => {
    expect(findEpic(cache, 'AI-15')?.id).toBe('AI-15');
  });

  it('falls back to the paired human ticket id', () => {
    expect(findEpic(cache, 'ABU-14')?.id).toBe('AI-15');
  });

  it('returns null when neither id matches', () => {
    expect(findEpic(cache, 'ABU-99')).toBeNull();
  });
});
