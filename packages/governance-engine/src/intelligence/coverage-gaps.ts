import type { Sql } from '../client/connection';
import { withTpsReadOnly } from '../client/connection';
import type { CoverageGapRow, SensitivityClassification, TpsContext } from '../client/types';
import { SENSITIVITY_ORDER } from '../client/types';

export class CoverageGapsApi {
  constructor(private readonly sql: Sql) {}

  /**
   * Resources missing either active permissions or active resource-scoped
   * rules (D009). Ordered by sensitivity descending — highest-risk gaps
   * appear first.
   */
  async list(ctx: TpsContext): Promise<CoverageGapRow[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<CoverageGapRow[]>`
        SELECT
          resource_id,
          resource_name,
          resource_type,
          sensitivity,
          has_permission,
          has_rule
        FROM governance.coverage_gaps()
      `;
      return rows;
    });
  }

  async atOrAbove(
    ctx: TpsContext,
    min: SensitivityClassification
  ): Promise<CoverageGapRow[]> {
    const rows = await this.list(ctx);
    const t = SENSITIVITY_ORDER[min];
    return rows.filter((r) => SENSITIVITY_ORDER[r.sensitivity] >= t);
  }
}
