import { describe, expect, it } from 'vitest';

import {
  clampLimit,
  decodeCursor,
  DEFAULT_PAGE_SIZE,
  encodeCursor,
  MAX_PAGE_SIZE,
} from '../../src/utils/pagination';

describe('pagination', () => {
  it('round-trips a cursor through encode/decode', () => {
    const c = {
      created_at: new Date('2026-04-27T12:34:56.789Z'),
      id: '00000000-0000-4000-a000-000000000001',
    };
    const decoded = decodeCursor(encodeCursor(c));
    expect(decoded.id).toBe(c.id);
    expect(decoded.created_at.toISOString()).toBe(c.created_at.toISOString());
  });

  it('rejects malformed cursors', () => {
    expect(() => decodeCursor('not-a-real-cursor')).toThrow();
  });

  it('clamps limit to defaults and ceiling', () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(0)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(-5)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(10)).toBe(10);
    expect(clampLimit(MAX_PAGE_SIZE + 1000)).toBe(MAX_PAGE_SIZE);
  });
});
