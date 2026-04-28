import type { Sql } from '../client/connection';
import { withTpsReadOnly } from '../client/connection';
import type { PermissionOverlapRow, TpsContext } from '../client/types';

export class PermissionOverlapApi {
  constructor(private readonly sql: Sql) {}

  /**
   * All active/approved agents that hold allow permissions on `resource_id`,
   * with the union of effective actions per agent. Expensive — uses
   * `CROSS JOIN LATERAL` over every agent (D018).
   */
  async forResource(
    ctx: TpsContext,
    resource_id: string
  ): Promise<PermissionOverlapRow[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<PermissionOverlapRow[]>`
        SELECT
          agent_id,
          agent_name,
          agent_type,
          lifecycle_state,
          effective_actions,
          permission_count
        FROM governance.permission_overlap(${resource_id})
      `;
      return rows;
    });
  }

  /**
   * Agents whose overlap on `resource_id` includes `action`. Useful for
   * "who can delete this critical resource?" lookups.
   */
  async forResourceAndAction(
    ctx: TpsContext,
    resource_id: string,
    action: string
  ): Promise<PermissionOverlapRow[]> {
    const rows = await this.forResource(ctx, resource_id);
    return rows.filter((r) =>
      r.effective_actions.includes(action as (typeof r.effective_actions)[number])
    );
  }
}
