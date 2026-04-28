import { withTpsReadOnly, type Sql } from './connection';
import type { AuditActionType, AuditLogEntry, PaginatedResult, TpsContext } from './types';
import {
  AuditReplayApi,
  type PointInTimeQuery,
  type PointInTimeResult,
} from '../intelligence/audit-replay';
import { buildWhere } from '../utils/filtering';

export interface ListAuditOptions {
  entity_type?: string;
  entity_id?: string;
  action_type?: AuditActionType | AuditActionType[];
  actor?: string;
  correlation_id?: string;
  /** Inclusive lower bound on `occurred_at`. */
  since?: Date;
  /** Inclusive upper bound on `occurred_at`. KYA spec uses `to`; both accepted. */
  until?: Date;
  /** KYA façade alias for `since`. When both are set, `since` wins. */
  from?: Date;
  /** KYA façade alias for `until`. When both are set, `until` wins. */
  to?: Date;
  limit?: number;
  cursor?: string;
}

/**
 * Read-only access to `governance.audit_log`. Audit entries are immutable
 * (D008) — there are no create/update/delete methods here. Writes happen
 * automatically via the `governance_private.tg_audit_log` trigger.
 */
export class AuditApi {
  private readonly replay: AuditReplayApi;

  constructor(private readonly sql: Sql) {
    this.replay = new AuditReplayApi(sql);
  }

  async list(
    ctx: TpsContext,
    opts: ListAuditOptions = {}
  ): Promise<PaginatedResult<AuditLogEntry>> {
    const since = opts.since ?? opts.from;
    const until = opts.until ?? opts.to;

    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, {
        entity_type: opts.entity_type,
        entity_id: opts.entity_id,
        action_type: opts.action_type,
        actor: opts.actor,
        correlation_id: opts.correlation_id,
      });
      if (since) {
        const f = tx`occurred_at >= ${since}`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      if (until) {
        const f = tx`occurred_at <= ${until}`;
        where = where ? tx`${where} AND ${f}` : f;
      }

      // Custom pagination — audit_log uses occurred_at instead of created_at.
      const limit = Math.min(opts.limit ?? 50, 500);
      const cursorRow = opts.cursor
        ? JSON.parse(Buffer.from(opts.cursor, 'base64url').toString('utf8'))
        : null;

      const cursorPredicate = cursorRow
        ? tx`(occurred_at, id) < (${new Date(cursorRow.occurred_at)}, ${cursorRow.id})`
        : null;

      let combined = where;
      if (cursorPredicate) {
        combined = combined ? tx`${combined} AND ${cursorPredicate}` : cursorPredicate;
      }
      const whereClause = combined ? tx`WHERE ${combined}` : tx``;

      const rows = await tx<AuditLogEntry[]>`
        SELECT * FROM governance.audit_log
        ${whereClause}
        ORDER BY occurred_at DESC, id DESC
        LIMIT ${limit + 1}
      `;

      let next_cursor: string | null = null;
      let items: AuditLogEntry[] = Array.from(rows);
      if (rows.length > limit) {
        items = items.slice(0, limit);
        const last = items[items.length - 1];
        next_cursor = Buffer.from(
          JSON.stringify({ occurred_at: last.occurred_at, id: last.id }),
          'utf8'
        ).toString('base64url');
      }
      return { items, next_cursor };
    });
  }

  /** Convenience: full event history for a single (entity_type, entity_id). */
  async forEntity(
    ctx: TpsContext,
    entity_type: string,
    entity_id: string
  ): Promise<AuditLogEntry[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<AuditLogEntry[]>`
        SELECT * FROM governance.audit_log
        WHERE entity_type = ${entity_type} AND entity_id = ${entity_id}
        ORDER BY occurred_at ASC
      `;
      return rows;
    });
  }

  /**
   * KYA façade — alias for {@link AuditReplayApi.reconstruct}. Replays the
   * audit log to return the entity's `new_state` snapshot at `as_of`.
   */
  reconstructState<T = Record<string, unknown>>(
    ctx: TpsContext,
    query: PointInTimeQuery
  ): Promise<PointInTimeResult<T>> {
    return this.replay.reconstruct<T>(ctx, query);
  }
}
