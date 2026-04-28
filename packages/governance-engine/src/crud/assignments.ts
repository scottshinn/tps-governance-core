import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  AgentRoleAssignment,
  AssignmentStatus,
  PaginatedResult,
  TpsContext,
} from '../client/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateAssignmentInput {
  agent_id: string;
  role_id: string;
  assigned_by: string;
  reason?: string | null;
  status?: AssignmentStatus;
  expires_at?: Date | null;
}

export interface ListAssignmentsOptions {
  agent_id?: string | string[];
  role_id?: string | string[];
  status?: AssignmentStatus | AssignmentStatus[];
  /** Active and non-expired only. */
  active_only?: boolean;
  limit?: number;
  cursor?: string;
}

export type UpdateAssignmentInput = Partial<Omit<CreateAssignmentInput, 'agent_id' | 'role_id'>>;

export class AssignmentsApi {
  constructor(private readonly sql: Sql) {}

  async create(
    ctx: TpsContext,
    input: CreateAssignmentInput
  ): Promise<AgentRoleAssignment> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<AgentRoleAssignment[]>`
        INSERT INTO governance.agent_role_assignments ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<AgentRoleAssignment> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<AgentRoleAssignment>(
        tx,
        'governance.agent_role_assignments',
        id,
        'assignment'
      )
    );
  }

  async list(
    ctx: TpsContext,
    opts: ListAssignmentsOptions = {}
  ): Promise<PaginatedResult<AgentRoleAssignment>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, {
        agent_id: opts.agent_id,
        role_id: opts.role_id,
        status: opts.status,
      });
      if (opts.active_only) {
        const f = tx`status = 'active' AND (expires_at IS NULL OR expires_at > now())`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      return listPaginated<AgentRoleAssignment>(
        tx,
        'governance.agent_role_assignments',
        { where, cursor: opts.cursor, limit: opts.limit }
      );
    });
  }

  async update(
    ctx: TpsContext,
    id: string,
    patch: UpdateAssignmentInput
  ): Promise<AgentRoleAssignment> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<AgentRoleAssignment>(
          tx,
          'governance.agent_role_assignments',
          id,
          'assignment'
        );
      }
      const rows = await tx<AgentRoleAssignment[]>`
        UPDATE governance.agent_role_assignments
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('assignment', id);
      return rows[0];
    });
  }

  async delete(ctx: TpsContext, id: string): Promise<void> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const r = await tx`DELETE FROM governance.agent_role_assignments WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('assignment', id);
    });
  }

  async revoke(ctx: TpsContext, id: string): Promise<AgentRoleAssignment> {
    return this.update(ctx, id, { status: 'revoked' });
  }

  async suspend(ctx: TpsContext, id: string): Promise<AgentRoleAssignment> {
    return this.update(ctx, id, { status: 'suspended' });
  }
}
