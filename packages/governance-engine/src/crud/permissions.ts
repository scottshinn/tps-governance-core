import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  ActionType,
  GrantType,
  PaginatedResult,
  Permission,
  TpsContext,
} from '../client/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError, TpsValidationError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreatePermissionInput {
  role_id: string;
  resource_id: string;
  actions: ActionType[];
  /** Null means "applies to any tool" (D019). */
  tool_id?: string | null;
  conditions?: Record<string, unknown> | null;
  grant_type?: GrantType;
  expires_at?: Date | null;
}

export interface ListPermissionsOptions {
  role_id?: string | string[];
  resource_id?: string | string[];
  tool_id?: string | null;
  grant_type?: GrantType;
  /** Filter to permissions whose `actions @> [action]`. */
  has_action?: ActionType;
  /** Filter to non-expired permissions only. */
  active_only?: boolean;
  limit?: number;
  cursor?: string;
}

export type UpdatePermissionInput = Partial<CreatePermissionInput>;

export class PermissionsApi {
  constructor(private readonly sql: Sql) {}

  async create(ctx: TpsContext, input: CreatePermissionInput): Promise<Permission> {
    if (!input.actions || input.actions.length === 0) {
      throw new TpsValidationError('actions must be non-empty', {
        role_id: input.role_id,
        resource_id: input.resource_id,
      });
    }
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<Permission[]>`
        INSERT INTO governance.permissions ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<Permission> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<Permission>(tx, 'governance.permissions', id, 'permission')
    );
  }

  async list(
    ctx: TpsContext,
    opts: ListPermissionsOptions = {}
  ): Promise<PaginatedResult<Permission>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, {
        role_id: opts.role_id,
        resource_id: opts.resource_id,
        tool_id: opts.tool_id === undefined ? undefined : opts.tool_id,
        grant_type: opts.grant_type,
      });
      if (opts.has_action) {
        const f = tx`actions @> ARRAY[${opts.has_action}]::governance.action_type[]`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      if (opts.active_only) {
        const f = tx`(expires_at IS NULL OR expires_at > now())`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      return listPaginated<Permission>(tx, 'governance.permissions', {
        where,
        cursor: opts.cursor,
        limit: opts.limit,
      });
    });
  }

  async update(
    ctx: TpsContext,
    id: string,
    patch: UpdatePermissionInput
  ): Promise<Permission> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<Permission>(tx, 'governance.permissions', id, 'permission');
      }
      const rows = await tx<Permission[]>`
        UPDATE governance.permissions
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('permission', id);
      return rows[0];
    });
  }

  async delete(ctx: TpsContext, id: string): Promise<void> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const r = await tx`DELETE FROM governance.permissions WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('permission', id);
    });
  }

  /** Convenience: revoke = soft-delete via expires_at = now(). */
  async expireNow(ctx: TpsContext, id: string): Promise<Permission> {
    return this.update(ctx, id, { expires_at: new Date() });
  }
}
