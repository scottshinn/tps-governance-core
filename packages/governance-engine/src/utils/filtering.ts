import postgres from 'postgres';

import type { DbConn } from './crud-helpers';

/**
 * Build a `WHERE` fragment from a record of equality filters using the
 * postgres.js tagged-template `sql.unsafe`-free idioms. Caller composes the
 * fragment into the final query.
 *
 * Each entry of `filters` must be one of:
 *   - undefined → skipped
 *   - null → emits `col IS NULL`
 *   - array → emits `col = ANY(...)` (skipped when empty)
 *   - any other value → emits `col = ${value}`
 *
 * Column names are validated against `/^[a-z_][a-z0-9_]*$/` — anything else
 * is rejected to prevent injection through dynamic column lookup.
 */
export function buildWhere(
  sql: DbConn,
  filters: Record<string, unknown>
): postgres.PendingQuery<postgres.Row[]> | null {
  const fragments: postgres.PendingQuery<postgres.Row[]>[] = [];
  for (const [col, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (!/^[a-z_][a-z0-9_]*$/.test(col)) {
      throw new Error(`Unsafe filter column name: ${col}`);
    }
    if (value === null) {
      fragments.push(sql`${sql(col)} IS NULL`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) continue;
      fragments.push(sql`${sql(col)} = ANY(${value})`);
    } else {
      fragments.push(sql`${sql(col)} = ${value as never}`);
    }
  }
  if (fragments.length === 0) return null;
  // Compose with AND.
  let combined = fragments[0];
  for (let i = 1; i < fragments.length; i += 1) {
    combined = sql`${combined} AND ${fragments[i]}`;
  }
  return combined;
}
