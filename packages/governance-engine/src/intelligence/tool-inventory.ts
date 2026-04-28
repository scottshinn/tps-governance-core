import type { Sql } from '../client/connection';
import { withTpsReadOnly } from '../client/connection';
import type { AgentToolInventoryRow, TpsContext } from '../client/types';

export class ToolInventoryApi {
  constructor(private readonly sql: Sql) {}

  /**
   * Every tool an agent can use, with metadata, resource counts, effective
   * actions, and the most direct granting role (D025). Allow-only — tools
   * blocked by deny grants are excluded.
   */
  async forAgent(
    ctx: TpsContext,
    agent_id: string
  ): Promise<AgentToolInventoryRow[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<AgentToolInventoryRow[]>`
        SELECT
          tool_id,
          tool_name,
          tool_type,
          mcp_server_id,
          mcp_server_name,
          is_destructive,
          is_idempotent,
          resource_count,
          effective_actions,
          granted_via_role_name,
          granted_via_role_depth
        FROM governance.agent_tool_inventory(${agent_id})
      `;
      // postgres.js may return resource_count as bigint — coerce to number
      // for ergonomic consumption (governance scale stays well under 2^53).
      return rows.map((r) => ({
        ...r,
        resource_count: Number(r.resource_count),
      }));
    });
  }

  /** Subset of tools flagged as destructive (D012, schema-level flag). */
  async destructiveForAgent(
    ctx: TpsContext,
    agent_id: string
  ): Promise<AgentToolInventoryRow[]> {
    const rows = await this.forAgent(ctx, agent_id);
    return rows.filter((r) => r.is_destructive);
  }
}
