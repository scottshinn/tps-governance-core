import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type { PaginatedResult, Role, ScopeLevel, TpsContext } from '../client/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsDependencyError, TpsNotFoundError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateRoleInput {
  name: string;
  description?: string | null;
  parent_role_id?: string | null;
  scope?: ScopeLevel;
  is_built_in?: boolean;
  max_assignments?: number | null;
}

export interface ListRolesOptions {
  scope?: ScopeLevel | ScopeLevel[];
  parent_role_id?: string | null;
  is_built_in?: boolean;
  search?: string;
  limit?: number;
  cursor?: string;
}

export type UpdateRoleInput = Partial<CreateRoleInput>;

export class RolesApi {
  constructor(private readonly sql: Sql) {}

  async create(ctx: TpsContext, input: CreateRoleInput): Promise<Role> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<Role[]>`
        INSERT INTO governance.roles ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<Role> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<Role>(tx, 'governance.roles', id, 'role')
    );
  }

  async findByName(ctx: TpsContext, name: string): Promise<Role | null> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<Role[]>`
        SELECT * FROM governance.roles WHERE name = ${name} LIMIT 1
      `;
      return rows[0] ?? null;
    });
  }

  async list(ctx: TpsContext, opts: ListRolesOptions = {}): Promise<PaginatedResult<Role>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, {
        scope: opts.scope,
        parent_role_id:
          opts.parent_role_id === undefined ? undefined : opts.parent_role_id,
        is_built_in: opts.is_built_in,
      });
      if (opts.search) {
        const f = tx`name ILIKE ${'%' + opts.search + '%'}`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      return listPaginated<Role>(tx, 'governance.roles', {
        where,
        cursor: opts.cursor,
        limit: opts.limit,
      });
    });
  }

  async update(ctx: TpsContext, id: string, patch: UpdateRoleInput): Promise<Role> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<Role>(tx, 'governance.roles', id, 'role');
      }
      const rows = await tx<Role[]>`
        UPDATE governance.roles
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('role', id);
      return rows[0];
    });
  }

  async delete(ctx: TpsContext, id: string): Promise<void> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [role] = await tx<Pick<Role, 'is_built_in'>[]>`
        SELECT is_built_in FROM governance.roles WHERE id = ${id}
      `;
      if (!role) throw new TpsNotFoundError('role', id);
      if (role.is_built_in) {
        throw new TpsDependencyError('Built-in roles cannot be deleted', { id });
      }
      const r = await tx`DELETE FROM governance.roles WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('role', id);
    });
  }

  /**
   * Walk the parent_role_id chain up to D003's depth limit (20). Used by Layer 2
   * UIs that want to show role inheritance without making the database compute it.
   */
  async getAncestors(ctx: TpsContext, id: string): Promise<Role[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<Role[]>`
        WITH RECURSIVE chain AS (
          SELECT r.*, 0 AS depth
          FROM governance.roles r
          WHERE r.id = ${id}
          UNION ALL
          SELECT p.*, c.depth + 1
          FROM governance.roles p
          JOIN chain c ON p.id = c.parent_role_id
          WHERE c.depth < 20
        )
        SELECT id, name, description, parent_role_id, scope, is_built_in,
               max_assignments, created_at, updated_at
        FROM chain
        WHERE depth > 0
        ORDER BY depth ASC
      `;
      return rows;
    });
  }
}
