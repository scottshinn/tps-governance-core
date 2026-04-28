import postgres from 'postgres';

import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  Agent,
  AgentLifecycleState,
  AgentType,
  PaginatedResult,
  TpsContext,
} from '../client/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateAgentInput {
  name: string;
  purpose: string;
  agent_type: AgentType;
  owner: string;
  version?: string;
  description?: string;
  parent_agent_id?: string | null;
  product_id?: string | null;
  delegation_scope?: Record<string, unknown> | null;
  contact?: string | null;
  last_review_at?: Date | null;
  review_cycle_days?: number | null;
  metadata?: Record<string, unknown> | null;
  lifecycle_state?: AgentLifecycleState;
}

export interface ListAgentsOptions {
  lifecycle_state?: AgentLifecycleState | AgentLifecycleState[];
  agent_type?: AgentType;
  product_id?: string;
  parent_agent_id?: string | null;
  owner?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

export type UpdateAgentInput = Partial<Omit<CreateAgentInput, 'name'>> & {
  /** Renaming an agent is permitted but bumps the (name, version) unique key. */
  name?: string;
};

export class AgentsApi {
  constructor(private readonly sql: Sql) {}

  async create(ctx: TpsContext, input: CreateAgentInput): Promise<Agent> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<Agent[]>`
        INSERT INTO governance.agents ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<Agent> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<Agent>(tx, 'governance.agents', id, 'agent')
    );
  }

  async findByName(
    ctx: TpsContext,
    name: string,
    version?: string
  ): Promise<Agent | null> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<Agent[]>`
        SELECT * FROM governance.agents
        WHERE name = ${name}
          AND ${version === undefined ? tx`version IS NULL` : tx`version = ${version}`}
        LIMIT 1
      `;
      return rows[0] ?? null;
    });
  }

  async list(
    ctx: TpsContext,
    opts: ListAgentsOptions = {}
  ): Promise<PaginatedResult<Agent>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const eq = buildWhere(tx, {
        lifecycle_state: opts.lifecycle_state,
        agent_type: opts.agent_type,
        product_id: opts.product_id,
        parent_agent_id: opts.parent_agent_id === undefined ? undefined : opts.parent_agent_id,
        owner: opts.owner,
      });
      let where = eq;
      if (opts.search) {
        const searchFrag = tx`(name ILIKE ${'%' + opts.search + '%'} OR purpose ILIKE ${'%' + opts.search + '%'})`;
        where = where ? tx`${where} AND ${searchFrag}` : searchFrag;
      }
      return listPaginated<Agent>(tx, 'governance.agents', {
        where,
        cursor: opts.cursor,
        limit: opts.limit,
      });
    });
  }

  async update(ctx: TpsContext, id: string, patch: UpdateAgentInput): Promise<Agent> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<Agent>(tx, 'governance.agents', id, 'agent');
      }
      const rows = await tx<Agent[]>`
        UPDATE governance.agents
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('agent', id);
      return rows[0];
    });
  }

  /**
   * Convenience wrapper for the most-audited update — lifecycle transitions
   * map to a dedicated audit_action_type (`agent_lifecycle_changed`) when
   * lifecycle_state changes alone.
   */
  async setLifecycleState(
    ctx: TpsContext,
    id: string,
    lifecycle_state: AgentLifecycleState
  ): Promise<Agent> {
    return this.update(ctx, id, { lifecycle_state });
  }

  async delete(ctx: TpsContext, id: string): Promise<void> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const result = await tx`DELETE FROM governance.agents WHERE id = ${id}`;
      if (result.count === 0) throw new TpsNotFoundError('agent', id);
    });
  }

  /** Direct children of an agent (one level only). */
  async listChildren(ctx: TpsContext, parent_id: string): Promise<Agent[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<Agent[]>`
        SELECT * FROM governance.agents
        WHERE parent_agent_id = ${parent_id}
        ORDER BY name
      `;
      return rows;
    });
  }
}

// Re-export for downstream type consumers.
export type { Agent, postgres };
