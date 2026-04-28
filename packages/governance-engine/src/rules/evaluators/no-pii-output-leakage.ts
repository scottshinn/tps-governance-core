import type { EvaluationContext, RuleEvaluator, RuleResult } from '../types';
import type { Rule } from '../../client/types';

/**
 * For every resource tagged `pii`, requires at least one active
 * resource-scoped rule with `violation_action IN ('deny', 'require_approval')`.
 *
 * Fails open: a global rule does NOT count — the protection must be
 * explicitly bound to the PII resource so coverage is auditable per resource.
 */
export const noPiiOutputLeakageEvaluator: RuleEvaluator = {
  type: 'no_pii_output_leakage',

  async evaluate(ctx: EvaluationContext, rule: Rule): Promise<RuleResult> {
    const rows = await ctx.sql<{ resource_id: string }[]>`
      SELECT rdc.resource_id
      FROM governance.resource_data_categories rdc
      WHERE rdc.data_category = 'pii'
        AND NOT EXISTS (
          SELECT 1
          FROM governance.rules r
          WHERE r.status = 'active'
            AND r.scope = 'resource'
            AND r.scope_entity_id = rdc.resource_id
            AND r.violation_action IN ('deny', 'require_approval')
        )
    `;
    const passed = rows.length === 0;
    return {
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      severity: rule.severity,
      violation_action: rule.violation_action,
      details: passed
        ? 'Every PII resource is governed by an active deny/require_approval rule.'
        : `${rows.length} PII resource(s) have no active deny/require_approval governance rule.`,
      affected_entities: passed
        ? {}
        : { resource_ids: rows.map((r) => r.resource_id) },
    };
  },
};
