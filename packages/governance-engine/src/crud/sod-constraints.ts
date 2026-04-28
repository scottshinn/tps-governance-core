import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  PaginatedResult,
  Severity,
  SodConstraint,
  SodConstraintPermission,
  SodConstraintType,
  TpsContext,
} from '../client/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateSodConstraintInput {
  name: string;
  constraint_type: SodConstraintType;
  description?: string | null;
  severity?: Severity;
  is_active?: boolean;
  compliance_req_id?: string | null;
}

export interface ListSodConstraintsOptions {
  constraint_type?: SodConstraintType;
  severity?: Severity | Severity[];
  is_active?: boolean;
  search?: string;
  limit?: number;
  cursor?: string;
}

export class SodConstraintsApi {
  constructor(private readonly sql: Sql) {}

  async create(
    ctx: TpsContext,
    input: CreateSodConstraintInput
  ): Promise<SodConstraint> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<SodConstraint[]>`
        INSERT INTO governance.sod_constraints ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<SodConstraint> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<SodConstraint>(tx, 'governance.sod_constraints', id, 'sod_constraint')
    );
  }

  async list(
    ctx: TpsContext,
    opts: ListSodConstraintsOptions = {}
  ): Promise<PaginatedResult<SodConstraint>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, {
        constraint_type: opts.constraint_type,
        severity: opts.severity,
        is_active: opts.is_active,
      });
      if (opts.search) {
        const f = tx`name ILIKE ${'%' + opts.search + '%'}`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      return listPaginated<SodConstraint>(
        tx,
        'governance.sod_constraints',
        { where, cursor: opts.cursor, limit: opts.limit }
      );
    });
  }

  async update(
    ctx: TpsContext,
    id: string,
    patch: Partial<CreateSodConstraintInput>
  ): Promise<SodConstraint> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<SodConstraint>(
          tx,
          'governance.sod_constraints',
          id,
          'sod_constraint'
        );
      }
      const rows = await tx<SodConstraint[]>`
        UPDATE governance.sod_constraints
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('sod_constraint', id);
      return rows[0];
    });
  }

  async delete(ctx: TpsContext, id: string): Promise<void> {
    await withTpsContext(this.sql, ctx, async (tx) => {
      const r = await tx`DELETE FROM governance.sod_constraints WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('sod_constraint', id);
    });
  }

  async setActive(
    ctx: TpsContext,
    id: string,
    is_active: boolean
  ): Promise<SodConstraint> {
    return this.update(ctx, id, { is_active });
  }

  // ---------- side-a / side-b membership (D006) ----------

  async addPermission(
    ctx: TpsContext,
    constraint_id: string,
    permission_id: string,
    side: 'a' | 'b'
  ): Promise<SodConstraintPermission> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<SodConstraintPermission[]>`
        INSERT INTO governance.sod_constraint_permissions (constraint_id, permission_id, side)
        VALUES (${constraint_id}, ${permission_id}, ${side})
        ON CONFLICT (constraint_id, permission_id, side) DO NOTHING
        RETURNING *
      `;
      return row;
    });
  }

  async removePermission(
    ctx: TpsContext,
    constraint_id: string,
    permission_id: string,
    side: 'a' | 'b'
  ): Promise<void> {
    await withTpsContext(this.sql, ctx, async (tx) => {
      await tx`
        DELETE FROM governance.sod_constraint_permissions
        WHERE constraint_id = ${constraint_id}
          AND permission_id = ${permission_id}
          AND side = ${side}
      `;
    });
  }

  async listPermissions(
    ctx: TpsContext,
    constraint_id: string
  ): Promise<SodConstraintPermission[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<SodConstraintPermission[]>`
        SELECT * FROM governance.sod_constraint_permissions
        WHERE constraint_id = ${constraint_id}
        ORDER BY side, permission_id
      `;
      return rows;
    });
  }
}
