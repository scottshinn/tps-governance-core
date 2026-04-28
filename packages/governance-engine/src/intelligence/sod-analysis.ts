import type { Sql } from '../client/connection';
import { withTpsReadOnly } from '../client/connection';
import type { SodCheckRow, TpsContext } from '../client/types';

export interface SodReport {
  agent_id: string;
  violations: SodCheckRow[];
  summary: {
    total: number;
    by_severity: Record<string, number>;
  };
}

export class SodAnalysisApi {
  constructor(private readonly sql: Sql) {}

  /** Raw output from `governance.sod_check(agent_id)`. */
  async check(ctx: TpsContext, agent_id: string): Promise<SodCheckRow[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<SodCheckRow[]>`
        SELECT
          constraint_id,
          constraint_name,
          constraint_type,
          severity,
          side_a_perm_ids,
          side_b_perm_ids
        FROM governance.sod_check(${agent_id})
      `;
      return rows;
    });
  }

  async report(ctx: TpsContext, agent_id: string): Promise<SodReport> {
    const violations = await this.check(ctx, agent_id);
    const by_severity: Record<string, number> = {};
    for (const v of violations) {
      by_severity[v.severity] = (by_severity[v.severity] ?? 0) + 1;
    }
    return {
      agent_id,
      violations,
      summary: { total: violations.length, by_severity },
    };
  }

  /**
   * The `governance.sod_violations` view — every active/approved agent's
   * current SoD violations across all active constraints. Useful for the
   * KYA dashboard.
   */
  async listAllViolations(
    ctx: TpsContext
  ): Promise<Array<SodCheckRow & { agent_id: string; agent_name: string }>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<Array<SodCheckRow & { agent_id: string; agent_name: string }>>`
        SELECT
          agent_id,
          agent_name,
          constraint_id,
          constraint_name,
          constraint_type,
          severity,
          side_a_perm_ids,
          side_b_perm_ids
        FROM governance.sod_violations
        ORDER BY severity, agent_name, constraint_name
      `;
      return rows;
    });
  }
}
