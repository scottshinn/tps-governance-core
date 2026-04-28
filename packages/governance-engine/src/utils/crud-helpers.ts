import postgres from 'postgres';

import { TpsNotFoundError } from './errors';
import { clampLimit, decodeCursor, encodeCursor } from './pagination';
import type { PaginatedResult } from '../client/types';

/**
 * Loose handle to a postgres.js connection — either the pool's `Sql` or
 * a transaction's `TransactionSql`. Typed as `any` so the helpers below
 * don't drag the consumer into postgres.js's strict generic surface
 * (Helper, ParameterOrJSON, RowList, etc).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbConn = any;

/**
 * Fetch a single row by primary key, throwing {@link TpsNotFoundError} when
 * absent. `table` must be a fully-qualified `schema.table` name; it is passed
 * through `sql(...)` so postgres.js can quote it correctly. Identifiers come
 * from the calling CRUD module, never from user input.
 */
export async function getById<T>(
  sql: DbConn,
  table: string,
  id: string,
  entityLabel: string
): Promise<T> {
  const rows = (await sql`
    SELECT * FROM ${sql(table)} WHERE id = ${id}
  `) as unknown as T[];
  if (rows.length === 0) {
    throw new TpsNotFoundError(entityLabel, id);
  }
  return rows[0];
}

export interface ListOpts {
  where?: postgres.PendingQuery<postgres.Row[]> | null;
  cursor?: string;
  limit?: number;
  order?: postgres.PendingQuery<postgres.Row[]>;
}

export async function listPaginated<T extends { id: string; created_at: Date }>(
  sql: DbConn,
  table: string,
  opts: ListOpts = {}
): Promise<PaginatedResult<T>> {
  const limit = clampLimit(opts.limit);
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;

  const wherePredicates: postgres.PendingQuery<postgres.Row[]>[] = [];
  if (opts.where) wherePredicates.push(opts.where);
  if (cursor) {
    wherePredicates.push(
      sql`(created_at, id) < (${cursor.created_at}, ${cursor.id})`
    );
  }

  let combined: postgres.PendingQuery<postgres.Row[]> | null = null;
  for (const frag of wherePredicates) {
    combined = combined ? sql`${combined} AND ${frag}` : frag;
  }
  const whereClause = combined ? sql`WHERE ${combined}` : sql``;

  const rows = (await sql`
    SELECT * FROM ${sql(table)}
    ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit + 1}
  `) as unknown as T[];

  let next_cursor: string | null = null;
  let items = rows;
  if (rows.length > limit) {
    items = rows.slice(0, limit);
    const last = items[items.length - 1];
    next_cursor = encodeCursor({ created_at: last.created_at, id: last.id });
  }
  return { items, next_cursor };
}

/**
 * Strip undefined keys so postgres.js's `sql(obj)` helper produces clean
 * INSERT/UPDATE column lists. The return type is intentionally loose
 * (`Record<string, never>`) to satisfy postgres.js's helper signature —
 * actual runtime values are jsonb / Date / primitive as the column accepts.
 */
export function compact<T extends object>(input: T): Record<string, never> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[k] = v;
  }
  return out as unknown as Record<string, never>;
}
