import type { Sql } from '../client/connection';
import { withTpsReadOnly } from '../client/connection';
import type { BlastRadiusRow, SensitivityClassification, TpsContext } from '../client/types';
import { SENSITIVITY_ORDER } from '../client/types';

export interface BlastRadiusSummary {
  agent_id: string;
  total_resources: number;
  by_sensitivity: Record<SensitivityClassification, number>;
  rows: BlastRadiusRow[];
}

export class BlastRadiusApi {
  constructor(private readonly sql: Sql) {}

  async compute(ctx: TpsContext, agent_id: string): Promise<BlastRadiusRow[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<BlastRadiusRow[]>`
        SELECT
          resource_id,
          resource_name,
          resource_type,
          sensitivity,
          effective_actions,
          access_paths
        FROM governance.blast_radius(${agent_id})
      `;
      return rows;
    });
  }

  async summarize(ctx: TpsContext, agent_id: string): Promise<BlastRadiusSummary> {
    const rows = await this.compute(ctx, agent_id);
    const by_sensitivity: Record<SensitivityClassification, number> = {
      public: 0,
      internal: 0,
      confidential: 0,
      restricted: 0,
      critical: 0,
    };
    for (const r of rows) by_sensitivity[r.sensitivity] += 1;
    return {
      agent_id,
      total_resources: rows.length,
      by_sensitivity,
      rows,
    };
  }

  /**
   * Filter blast-radius rows to those at or above the supplied sensitivity
   * threshold. Uses the {@link SENSITIVITY_ORDER} ranking from D020.
   */
  async atOrAbove(
    ctx: TpsContext,
    agent_id: string,
    min: SensitivityClassification
  ): Promise<BlastRadiusRow[]> {
    const rows = await this.compute(ctx, agent_id);
    const threshold = SENSITIVITY_ORDER[min];
    return rows.filter((r) => SENSITIVITY_ORDER[r.sensitivity] >= threshold);
  }
}
