import type {
  EvaluationContext,
  NoUnrestrictedAccessCondition,
  RuleEvaluator,
  RuleResult,
} from '../types';
import type { Rule, SensitivityClassification } from '../../client/types';
import { SENSITIVITY_ORDER } from '../../client/types';

/**
 * Fails when any agent holds an allow permission with `tool_id IS NULL`
 * (broad scope) and an action in `actions` (default ['admin','delete']) on
 * a resource at or above `min_sensitivity`. This catches "blank check"
 * grants that bypass the tool boundary on critical resources.
 */
export const noUnrestrictedAccessEvaluator: RuleEvaluator = {
  type: 'no_unrestricted_access',

  async evaluate(ctx: EvaluationContext, rule: Rule): Promise<RuleResult> {
    const cond = rule.condition as NoUnrestrictedAccessCondition;
    const actions = cond.actions ?? ['admin', 'delete'];
    const sensitivities = sensitivitiesAtOrAbove(cond.min_sensitivity);

    const rows = await ctx.sql<
      { agent_id: string; permission_id: string }[]
    >`
      SELECT DISTINCT ara.agent_id, p.id AS permission_id
      FROM governance.permissions p
      JOIN governance.resources res ON res.id = p.resource_id
      JOIN governance.agent_role_assignments ara ON ara.role_id = p.role_id
        AND ara.status = 'active'
        AND (ara.expires_at IS NULL OR ara.expires_at > now())
      WHERE p.grant_type = 'allow'
        AND p.tool_id IS NULL
        AND (p.expires_at IS NULL OR p.expires_at > now())
        AND p.actions && ${actions}::governance.action_type[]
        AND res.sensitivity = ANY(${sensitivities}::governance.sensitivity_classification[])
    `;
    const passed = rows.length === 0;
    return {
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      severity: rule.severity,
      violation_action: rule.violation_action,
      details: passed
        ? `No agent has unrestricted (${actions.join('/')}) access on ${cond.min_sensitivity}+ resources.`
        : `${rows.length} permission grant(s) give unrestricted (${actions.join('/')}) access on ${cond.min_sensitivity}+ resources.`,
      affected_entities: passed
        ? {}
        : {
          agent_ids: Array.from(new Set(rows.map((r) => r.agent_id))),
          permission_ids: rows.map((r) => r.permission_id),
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
