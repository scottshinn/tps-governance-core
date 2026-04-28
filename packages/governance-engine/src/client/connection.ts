import postgres from 'postgres';

import { mapPostgresError } from '../utils/errors';
import type { TpsContext } from './types';

export type Sql = postgres.Sql<Record<string, never>>;
export type TransactionSql = postgres.TransactionSql<Record<string, never>>;

export interface ConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  /** Maximum pool size. Defaults to postgres.js default (10). */
  max?: number;
  /** Idle timeout in seconds before closing connections. */
  idle_timeout?: number;
  /** SSL — passthrough to postgres.js. */
  ssl?: postgres.Options<Record<string, never>>['ssl'];
}

export interface TpsClientOptions {
  /** New pool from raw connection config. */
  connection?: ConnectionConfig;
  /** Reuse an existing postgres.js Sql instance. Mutually exclusive with `connection`. */
  sql?: Sql;
}

/**
 * Build a postgres.js Sql instance from {@link TpsClientOptions}.
 * Throws when neither `sql` nor `connection` is provided.
 */
export function createSql(opts: TpsClientOptions): { sql: Sql; ownsSql: boolean } {
  if (opts.sql) {
    return { sql: opts.sql, ownsSql: false };
  }
  if (!opts.connection) {
    throw new Error('TpsClient requires either `sql` or `connection`');
  }
  const cfg = opts.connection;
  const sql = postgres({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    username: cfg.username,
    password: cfg.password,
    max: cfg.max,
    idle_timeout: cfg.idle_timeout,
    ssl: cfg.ssl,
  });
  return { sql, ownsSql: true };
}

/**
 * Run `fn` inside a transaction with `tps.current_actor` and `tps.role`
 * session variables set to {@link TpsContext}. Both are SET LOCAL so they
 * vanish when the transaction ends — no leakage between borrows of the
 * underlying connection.
 *
 * @see governance-core DECISIONS.md D007, D016
 */
export async function withTpsContext<T>(
  sql: Sql,
  ctx: TpsContext,
  fn: (tx: TransactionSql) => Promise<T>
): Promise<T> {
  try {
    const result = await sql.begin(async (tx) => {
      await tx`SELECT set_config('tps.current_actor', ${ctx.actor}, true)`;
      await tx`SELECT set_config('tps.role', ${ctx.role}, true)`;
      if (ctx.correlation_id) {
        await tx`SELECT set_config('tps.correlation_id', ${ctx.correlation_id}, true)`;
      }
      return fn(tx as TransactionSql);
    });
    return result as T;
  } catch (err) {
    throw mapPostgresError(err);
  }
}

/**
 * Run a read-only operation. Wraps `withTpsContext` and additionally issues
 * `SET TRANSACTION READ ONLY`. Use this for intelligence queries that should
 * never mutate state.
 */
export async function withTpsReadOnly<T>(
  sql: Sql,
  ctx: TpsContext,
  fn: (tx: TransactionSql) => Promise<T>
): Promise<T> {
  return withTpsContext(sql, ctx, async (tx) => {
    await tx`SET TRANSACTION READ ONLY`;
    return fn(tx);
  });
}
