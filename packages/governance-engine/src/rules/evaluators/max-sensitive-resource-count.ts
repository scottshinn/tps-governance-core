import type {
  EvaluationContext,
  MaxSensitiveResourceCountCondition,
  RuleEvaluator,
  RuleResult,
} from '../types';
import type { Rule, SensitivityClassification } from '../../client/types';
import { SENSITIVITY_ORDER } from '../../client/types';

/**
 * Fails when any agent's allow-permission set covers more than `max_count`
 * distinct resources at or above the configured sensitivity threshold.
 *
 * Uses the database-side `agent_summary` is impractical here because we
 * need per-agent counts at a sensitivity threshold; we evaluate inline.
 */
export const maxSensitiveResourceCountEvaluator: RuleEvaluator = {
  type: 'max_sensitive_resource_count',

  async evaluate(ctx: EvaluationContext, rule: Rule): Promise<RuleResult> {
    const cond = rule.condition as MaxSensitiveResourceCountCondition;
    const sensitivities = sensitivitiesAtOrAbove(cond.sensitivity);

    const rows = await ctx.sql<{ agent_id: string; count: number; resource_ids: string[] }[]>`
      SELECT
        ara.agent_id,
        COUNT(DISTINCT p.resource_id)::int AS count,
        array_agg(DISTINCT p.resource_id) AS resource_ids
      FROM governance.agent_role_assignments ara
      JOIN governance.permissions p ON p.role_id = ara.role_id
        AND p.grant_type = 'allow'
        AND (p.expires_at IS NULL OR p.expires_at > now())
      JOIN governance.resources res ON res.id = p.resource_id
      WHERE ara.status = 'active'
        AND (ara.expires_at IS NULL OR ara.expires_at > now())
        AND res.sensitivity = ANY(${sensitivities}::governance.sensitivity_classification[])
        AND ${ctx.agentId ? ctx.sql`ara.agent_id = ${ctx.agentId}` : ctx.sql`TRUE`}
      GROUP BY ara.agent_id
      HAVING COUNT(DISTINCT p.resource_id) > ${cond.max_count}
    `;

    const passed = rows.length === 0;
    return {
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      severity: rule.severity,
      violation_action: rule.violation_action,
      details: passed
        ? `No agent exceeds ${cond.max_count} ${cond.sensitivity}+ resources.`
        : `${rows.length} agent(s) exceed the limit of ${cond.max_count} ${cond.sensitivity}+ resources.`,
      affected_entities: passed
        ? {}
        : {
          agent_ids: rows.map((r) => r.agent_id),
          resource_ids: Array.from(new Set(rows.flatMap((r) => r.resource_ids))),
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
