/**
 * Cursor-based pagination helpers. Cursors are opaque base64url-encoded
 * `created_at|id` strings — no OFFSET, so list queries stay O(log n) on
 * (created_at, id) indexes.
 */

export interface Cursor {
  created_at: Date;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  const payload = `${cursor.created_at.toISOString()}|${cursor.id}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeCursor(token: string): Cursor {
  let raw: string;
  try {
    raw = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    throw new Error('Malformed pagination cursor');
  }
  const sep = raw.lastIndexOf('|');
  if (sep < 0) throw new Error('Malformed pagination cursor');
  const ts = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  const created_at = new Date(ts);
  if (Number.isNaN(created_at.getTime()) || !id) {
    throw new Error('Malformed pagination cursor');
  }
  return { created_at, id };
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;

export function clampLimit(limit: number | undefined): number {
  if (!limit || limit <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(limit, MAX_PAGE_SIZE);
}
