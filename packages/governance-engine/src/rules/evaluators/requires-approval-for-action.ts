import type {
  EvaluationContext,
  RequiresApprovalForActionCondition,
  RuleEvaluator,
  RuleResult,
} from '../types';
import type { Rule, SensitivityClassification } from '../../client/types';
import { SENSITIVITY_ORDER } from '../../client/types';

/**
 * Fails when an allow permission grants the configured action on a
 * resource at or above the configured sensitivity *without* a
 * `conditions.requires_approval = true` flag.
 */
export const requiresApprovalForActionEvaluator: RuleEvaluator = {
  type: 'requires_approval_for_action',

  async evaluate(ctx: EvaluationContext, rule: Rule): Promise<RuleResult> {
    const cond = rule.condition as RequiresApprovalForActionCondition;
    const sensitivities = sensitivitiesAtOrAbove(cond.min_sensitivity);

    const rows = await ctx.sql<{ permission_id: string; resource_id: string }[]>`
      SELECT p.id AS permission_id, p.resource_id
      FROM governance.permissions p
      JOIN governance.resources res ON res.id = p.resource_id
      WHERE p.grant_type = 'allow'
        AND (p.expires_at IS NULL OR p.expires_at > now())
        AND p.actions @> ARRAY[${cond.action}]::governance.action_type[]
        AND res.sensitivity = ANY(${sensitivities}::governance.sensitivity_classification[])
        AND COALESCE((p.conditions->>'requires_approval')::boolean, false) = false
    `;

    const passed = rows.length === 0;
    return {
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      severity: rule.severity,
      violation_action: rule.violation_action,
      details: passed
        ? `Every '${cond.action}' allow grant on ${cond.min_sensitivity}+ resources requires approval.`
        : `${rows.length} '${cond.action}' allow grant(s) on ${cond.min_sensitivity}+ resources lack the requires_approval condition.`,
      affected_entities: passed
        ? {}
        : {
          permission_ids: rows.map((r) => r.permission_id),
          resource_ids: Array.from(new Set(rows.map((r) => r.resource_id))),
        },
    };
  },
};

function sensitivitiesAtOrAbove(min: SensitivityClassification): string[] {
  const threshold = SENSITIVITY_ORDER[min];
  return (Object.keys(SENSITIVITY_ORDER) as SensitivityClassification[]).filter(
    (s) => SENSITIVITY_ORDER[s] >= threshold
  );
}
